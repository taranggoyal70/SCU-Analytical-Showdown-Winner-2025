"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, LoaderCircle, LockKeyhole } from "lucide-react";

export function UploadLogin() {
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setLoading(true);
		setError("");
		try {
			const form = new FormData(event.currentTarget);
			const response = await fetch("/api/uploads/session", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password: form.get("password") }),
			});
			const result = (await response.json()) as { error?: string };
			if (!response.ok) throw new Error(result.error || "Sign-in failed.");
			window.location.reload();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Sign-in failed.");
			setLoading(false);
		}
	}

	return (
		<main className="shell auth-shell">
			<section className="panel auth-card">
				<div className="auth-icon"><LockKeyhole size={24} /></div>
				<div>
					<div className="eyebrow"><KeyRound size={14} /> Protected operation</div>
					<h1 className="auth-title">Unlock export uploads</h1>
					<p className="muted">
						Only the seller admin can replace the live analytics dataset. Sessions expire after eight hours.
					</p>
				</div>
				<form className="auth-form" onSubmit={submit}>
					<label className="field">
						<span>Admin password</span>
						<input className="input" name="password" type="password" autoComplete="current-password" required autoFocus />
					</label>
					{error ? <p className="form-error" role="alert">{error}</p> : null}
					<button className="button" type="submit" disabled={loading}>
						{loading ? <LoaderCircle className="spin" size={18} /> : <LockKeyhole size={18} />}
						{loading ? "Checking…" : "Continue securely"}
					</button>
				</form>
			</section>
		</main>
	);
}
