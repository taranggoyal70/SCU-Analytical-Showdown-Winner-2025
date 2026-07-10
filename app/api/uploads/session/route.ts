import { NextResponse } from "next/server";
import {
	createUploadSession,
	uploadSessionCookie,
	verifyUploadPassword,
} from "@/lib/upload-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
	let password = "";
	try {
		const body = (await request.json()) as { password?: unknown };
		password = typeof body.password === "string" ? body.password : "";
	} catch {
		return NextResponse.json({ error: "Invalid request." }, { status: 400 });
	}

	if (!verifyUploadPassword(password)) {
		return NextResponse.json({ error: "Incorrect admin password." }, { status: 401 });
	}

	const session = createUploadSession();
	const response = NextResponse.json({ ok: true });
	response.cookies.set(uploadSessionCookie, session.value, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict",
		path: "/",
		maxAge: session.maxAge,
	});
	return response;
}

export async function DELETE() {
	const response = NextResponse.json({ ok: true });
	response.cookies.set(uploadSessionCookie, "", {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict",
		path: "/",
		maxAge: 0,
	});
	return response;
}
