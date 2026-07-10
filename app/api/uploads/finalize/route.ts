import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import {
	activateBlobBatch,
	analyticsCacheTag,
	type PendingBlob,
} from "@/lib/blob-store";
import { maximumBatchFiles } from "@/lib/export-ingestion";
import { isUploadRequestAuthorized } from "@/lib/upload-session";

export const runtime = "nodejs";
export const maxDuration = 300;

type FinalizeBody = { batchId?: unknown; blobs?: unknown };

function isPendingBlob(value: unknown): value is PendingBlob {
	if (!value || typeof value !== "object") return false;
	const blob = value as Record<string, unknown>;
	return (
		typeof blob.pathname === "string" &&
		typeof blob.url === "string" &&
		typeof blob.originalName === "string" &&
		typeof blob.size === "number" &&
		Number.isFinite(blob.size) &&
		blob.size >= 0
	);
}

export async function POST(request: Request) {
	if (!isUploadRequestAuthorized(request)) {
		return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
	}

	let body: FinalizeBody;
	try {
		body = (await request.json()) as FinalizeBody;
	} catch {
		return NextResponse.json({ error: "Invalid finalize request." }, { status: 400 });
	}

	if (typeof body.batchId !== "string" || !Array.isArray(body.blobs)) {
		return NextResponse.json({ error: "Upload metadata is incomplete." }, { status: 400 });
	}
	if (!body.blobs.length || body.blobs.length > maximumBatchFiles || !body.blobs.every(isPendingBlob)) {
		return NextResponse.json({ error: "The uploaded file list is invalid." }, { status: 400 });
	}

	try {
		const manifest = await activateBlobBatch(body.batchId, body.blobs);
		revalidateTag(analyticsCacheTag, { expire: 0 });
		return NextResponse.json({
			ok: true,
			batchId: manifest.batchId,
			files: manifest.files.length,
			rows: manifest.totalRows,
			uploadedAt: manifest.uploadedAt,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "The export batch could not be activated.";
		return NextResponse.json({ error: message }, { status: 422 });
	}
}
