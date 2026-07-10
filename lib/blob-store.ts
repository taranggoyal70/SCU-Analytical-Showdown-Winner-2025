import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { del, get, list, put, type ListBlobResultBlob, type PutBlobResult } from "@vercel/blob";
import { normalizeExport, type NormalizedExport } from "@/lib/export-ingestion";

export const analyticsCacheTag = "analytics-exports";
export const analyticsCacheSeconds = 30;
export const rawExportPrefix = "shopee-exports/raw/";
const normalizedExportPrefix = "shopee-exports/normalized/";
const manifestPrefix = "shopee-exports/manifests/";

export type UploadManifestFile = {
	originalName: string;
	rawPathname: string;
	normalizedPathname: string;
	datasetId: string;
	datasetLabel: string;
	category: string;
	rows: number;
	bytes: number;
	sha256: string;
};

export type UploadManifest = {
	schemaVersion: 1;
	batchId: string;
	uploadedAt: string;
	files: UploadManifestFile[];
	totalRows: number;
	totalBytes: number;
};

export type AnalyticsSnapshot = {
	datasets: NormalizedExport[];
	source: {
		kind: "blob" | "bundled";
		batchId: string | null;
		uploadedAt: string | null;
		files: number;
	};
};

export type PendingBlob = Pick<PutBlobResult, "pathname" | "url"> & {
	originalName: string;
	size: number;
};

function requireBlobConfiguration() {
	if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL_OIDC_TOKEN) {
		throw new Error("Vercel Blob is not configured for this environment.");
	}
}

export function hasBlobConfiguration() {
	return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN);
}

async function streamToBytes(stream: ReadableStream<Uint8Array>) {
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readPrivateBlob(pathname: string, useCache = false) {
	const result = await get(pathname, { access: "private", useCache });
	if (!result || result.statusCode !== 200 || !result.stream) {
		throw new Error(`Blob not found: ${pathname}`);
	}
	return streamToBytes(result.stream);
}

async function readJsonBlob<T>(pathname: string, useCache = false): Promise<T> {
	const bytes = await readPrivateBlob(pathname, useCache);
	return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

function validateBatchId(batchId: string) {
	if (!/^[a-zA-Z0-9-]{12,80}$/.test(batchId)) {
		throw new Error("The upload batch ID is invalid.");
	}
}

function validatePendingBlob(batchId: string, blob: PendingBlob) {
	const expectedPrefix = `${rawExportPrefix}${batchId}/`;
	if (!blob.pathname.startsWith(expectedPrefix)) {
		throw new Error(`Unexpected Blob pathname for ${blob.originalName}.`);
	}
	if (!blob.url.startsWith("https://")) {
		throw new Error(`Unexpected Blob URL for ${blob.originalName}.`);
	}
}

export async function activateBlobBatch(batchId: string, blobs: PendingBlob[]) {
	requireBlobConfiguration();
	validateBatchId(batchId);
	if (!blobs.length) throw new Error("Choose at least one export.");

	const normalizedPathnames: string[] = [];
	try {
		const files: UploadManifestFile[] = [];
		for (let start = 0; start < blobs.length; start += 2) {
			const chunk = await Promise.all(
				blobs.slice(start, start + 2).map(async (blob, offset): Promise<UploadManifestFile> => {
					const index = start + offset;
				validatePendingBlob(batchId, blob);
				const rawBytes = await readPrivateBlob(blob.pathname);
				const normalized = await normalizeExport(blob.originalName, rawBytes);
				const normalizedPathname = `${normalizedExportPrefix}${batchId}/${index + 1}-${normalized.datasetId}.json`;
				await put(normalizedPathname, JSON.stringify(normalized), {
					access: "private",
					addRandomSuffix: false,
					allowOverwrite: false,
					contentType: "application/json",
					cacheControlMaxAge: analyticsCacheSeconds,
				});
				normalizedPathnames.push(normalizedPathname);

				return {
					originalName: blob.originalName,
					rawPathname: blob.pathname,
					normalizedPathname,
					datasetId: normalized.datasetId,
					datasetLabel: normalized.datasetLabel,
					category: normalized.category,
					rows: normalized.rows.length,
					bytes: rawBytes.byteLength,
					sha256: createHash("sha256").update(rawBytes).digest("hex"),
				};
				}),
			);
			files.push(...chunk);
		}

		const manifest: UploadManifest = {
			schemaVersion: 1,
			batchId,
			uploadedAt: new Date().toISOString(),
			files,
			totalRows: files.reduce((total, file) => total + file.rows, 0),
			totalBytes: files.reduce((total, file) => total + file.bytes, 0),
		};

		await put(`${manifestPrefix}${batchId}.json`, JSON.stringify(manifest), {
			access: "private",
			addRandomSuffix: false,
			allowOverwrite: false,
			contentType: "application/json",
			cacheControlMaxAge: analyticsCacheSeconds,
		});
		return manifest;
	} catch (error) {
		const cleanup = [...normalizedPathnames, ...blobs.map((blob) => blob.pathname)];
		if (cleanup.length) await del(cleanup).catch(() => undefined);
		throw error;
	}
}

export async function getActiveManifest(): Promise<UploadManifest | null> {
	if (!hasBlobConfiguration()) return null;
	let latest: ListBlobResultBlob | undefined;
	let cursor: string | undefined;
	do {
		const page = await list({ prefix: manifestPrefix, limit: 1000, cursor });
		for (const blob of page.blobs) {
			if (!latest || blob.uploadedAt > latest.uploadedAt) latest = blob;
		}
		cursor = page.hasMore ? page.cursor : undefined;
	} while (cursor);
	if (!latest) return null;
	const manifest = await readJsonBlob<UploadManifest>(latest.pathname);
	if (manifest.schemaVersion !== 1 || !manifest.files?.length) {
		throw new Error("The active Blob manifest is invalid.");
	}
	return manifest;
}

export async function loadActiveBlobSnapshot(): Promise<AnalyticsSnapshot | null> {
	const manifest = await getActiveManifest();
	if (!manifest) return null;
	const datasets = await Promise.all(
		manifest.files.map((file) =>
			readJsonBlob<NormalizedExport>(file.normalizedPathname, true),
		),
	);
	return {
		datasets,
		source: {
			kind: "blob",
			batchId: manifest.batchId,
			uploadedAt: manifest.uploadedAt,
			files: manifest.files.length,
		},
	};
}

export async function loadBundledSnapshot(): Promise<AnalyticsSnapshot> {
	const dataDirectory = path.join(process.cwd(), "data", "cleaned");
	const files = (await readdir(dataDirectory))
		.filter((file) => file.toLowerCase().endsWith(".csv"))
		.sort();
	const datasets = await Promise.all(
		files.map(async (file) => normalizeExport(file, await readFile(path.join(dataDirectory, file)))),
	);
	return {
		datasets,
		source: {
			kind: "bundled",
			batchId: null,
			uploadedAt: null,
			files: files.length,
		},
	};
}

export async function seedBundledDataToBlob() {
	requireBlobConfiguration();
	const dataDirectory = path.join(process.cwd(), "data", "cleaned");
	const fileNames = (await readdir(dataDirectory))
		.filter((file) => file.toLowerCase().endsWith(".csv"))
		.sort();
	const batchId = `seed-${Date.now()}`;
	const blobs = await Promise.all(
		fileNames.map(async (fileName, index): Promise<PendingBlob> => {
			const bytes = await readFile(path.join(dataDirectory, fileName));
			const pathname = `${rawExportPrefix}${batchId}/${index + 1}-${fileName}`;
			const blob = await put(pathname, bytes, {
				access: "private",
				addRandomSuffix: false,
				allowOverwrite: false,
				contentType: "text/csv",
				cacheControlMaxAge: analyticsCacheSeconds,
			});
			return { pathname: blob.pathname, url: blob.url, originalName: fileName, size: bytes.length };
		}),
	);
	return activateBlobBatch(batchId, blobs);
}
