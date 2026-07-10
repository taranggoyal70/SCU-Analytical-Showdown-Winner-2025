import { del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { rawExportPrefix } from "@/lib/blob-store";
import { isUploadRequestAuthorized } from "@/lib/upload-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
	if (!isUploadRequestAuthorized(request)) {
		return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
	}

	let pathnames: unknown;
	try {
		pathnames = ((await request.json()) as { pathnames?: unknown }).pathnames;
	} catch {
		return NextResponse.json({ error: "Invalid request." }, { status: 400 });
	}

	if (
		!Array.isArray(pathnames) ||
		pathnames.length > 20 ||
		!pathnames.every((value) => typeof value === "string" && value.startsWith(rawExportPrefix))
	) {
		return NextResponse.json({ error: "Invalid Blob pathnames." }, { status: 400 });
	}

	if (pathnames.length) await del(pathnames);
	return NextResponse.json({ ok: true });
}
