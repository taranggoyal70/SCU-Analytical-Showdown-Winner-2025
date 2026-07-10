import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const uploadSessionCookie = "nazava_upload_session";
const sessionLifetimeSeconds = 8 * 60 * 60;

function uploadSecret() {
	return process.env.UPLOAD_SECRET?.trim() || null;
}

function safeEqual(left: string, right: string) {
	const leftBytes = Buffer.from(left);
	const rightBytes = Buffer.from(right);
	if (leftBytes.length !== rightBytes.length) return false;
	return timingSafeEqual(leftBytes, rightBytes);
}

function signature(expiresAt: string, secret: string) {
	return createHmac("sha256", secret).update(`nazava-upload:${expiresAt}`).digest("base64url");
}

export function verifyUploadPassword(password: string) {
	const secret = uploadSecret();
	return Boolean(secret && password.length <= 512 && safeEqual(password, secret));
}

export function createUploadSession() {
	const secret = uploadSecret();
	if (!secret) throw new Error("UPLOAD_SECRET is not configured.");
	const expiresAt = String(Math.floor(Date.now() / 1000) + sessionLifetimeSeconds);
	return {
		value: `${expiresAt}.${signature(expiresAt, secret)}`,
		maxAge: sessionLifetimeSeconds,
	};
}

export function verifyUploadSessionValue(value?: string | null) {
	const secret = uploadSecret();
	if (!secret || !value) return false;
	const [expiresAt, providedSignature, extra] = value.split(".");
	if (!expiresAt || !providedSignature || extra) return false;
	const expires = Number(expiresAt);
	if (!Number.isSafeInteger(expires) || expires <= Math.floor(Date.now() / 1000)) return false;
	return safeEqual(providedSignature, signature(expiresAt, secret));
}

export async function hasUploadSession() {
	const cookieStore = await cookies();
	return verifyUploadSessionValue(cookieStore.get(uploadSessionCookie)?.value);
}

export function isUploadRequestAuthorized(request: Request) {
	const cookieHeader = request.headers.get("cookie") ?? "";
	const value = cookieHeader
		.split(";")
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${uploadSessionCookie}=`))
		?.slice(uploadSessionCookie.length + 1);
	try {
		return verifyUploadSessionValue(value ? decodeURIComponent(value) : null);
	} catch {
		return false;
	}
}
