import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import {
	isAcceptedExportName,
	maximumExportBytes,
	sanitizeExportName,
} from "@/lib/export-ingestion";
import { rawExportPrefix } from "@/lib/blob-store";
import { isUploadRequestAuthorized } from "@/lib/upload-session";

export const runtime = "nodejs";

type ClientPayload = { batchId: string; originalName: string };

function parseClientPayload(payload: string | null): ClientPayload {
	if (!payload) throw new Error("Upload metadata is missing.");
	const parsed = JSON.parse(payload) as Partial<ClientPayload>;
	if (!parsed.batchId || !/^[a-zA-Z0-9-]{12,80}$/.test(parsed.batchId)) {
		throw new Error("The upload batch ID is invalid.");
	}
	if (!parsed.originalName || !isAcceptedExportName(parsed.originalName)) {
		throw new Error("Only .csv and .xlsx Shopee exports are supported.");
	}
	return { batchId: parsed.batchId, originalName: parsed.originalName };
}

export async function POST(request: Request) {
	let body: HandleUploadBody;
	try {
		body = (await request.json()) as HandleUploadBody;
	} catch {
		return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
	}

	if (body.type === "blob.generate-client-token" && !isUploadRequestAuthorized(request)) {
		return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
	}

	try {
		const response = await handleUpload({
			body,
			request,
			onBeforeGenerateToken: async (pathname, clientPayload) => {
				if (!isUploadRequestAuthorized(request)) throw new Error("Unauthorized.");
				const metadata = parseClientPayload(clientPayload);
				const expectedPrefix = `${rawExportPrefix}${metadata.batchId}/`;
				if (!pathname.startsWith(expectedPrefix)) throw new Error("Invalid upload pathname.");
				if (!pathname.endsWith(sanitizeExportName(metadata.originalName))) {
					throw new Error("The upload pathname does not match the selected file.");
				}
				return {
					allowedContentTypes: [
						"text/csv",
						"application/csv",
						"application/vnd.ms-excel",
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
						"application/octet-stream",
					],
					maximumSizeInBytes: maximumExportBytes,
					addRandomSuffix: false,
					allowOverwrite: false,
					cacheControlMaxAge: 30,
					tokenPayload: JSON.stringify(metadata),
				};
			},
		});
		return NextResponse.json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Upload authorization failed.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
