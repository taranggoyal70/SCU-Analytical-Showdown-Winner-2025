"use client";

import type { PutBlobResult } from "@vercel/blob";
import { upload } from "@vercel/blob/client";
import {
	CheckCircle2,
	FileSpreadsheet,
	LoaderCircle,
	LogOut,
	ShieldCheck,
	UploadCloud,
	X,
} from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

type ActiveBatch = {
	batchId: string;
	uploadedAt: string;
	files: number;
	rows: number;
	bytes: number;
} | null;

type FinalizeResult = {
	ok?: boolean;
	error?: string;
	batchId?: string;
	files?: number;
	rows?: number;
	uploadedAt?: string;
};

const maximumFiles = 20;
const maximumFileBytes = 100 * 1024 * 1024;

function safeName(fileName: string) {
	const safe = fileName
		.normalize("NFKD")
		.replace(/[^a-zA-Z0-9._-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^[-.]+|[-.]+$/g, "");
	return safe.slice(0, 160) || `export-${Date.now()}.csv`;
}

function formatBytes(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function formatTimestamp(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Unknown time";
	return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function formatInteger(value: number) {
	return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function validFile(file: File) {
	return /\.(csv|xlsx)$/i.test(file.name) && file.size > 0 && file.size <= maximumFileBytes;
}

export function UploadWorkspace({ activeBatch }: { activeBatch: ActiveBatch }) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [files, setFiles] = useState<File[]>([]);
	const [dragging, setDragging] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [progress, setProgress] = useState(0);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");

	function addFiles(nextFiles: File[]) {
		setError("");
		const invalid = nextFiles.find((file) => !validFile(file));
		if (invalid) {
			setError(`${invalid.name} is not a non-empty CSV/XLSX under 100 MB.`);
			return;
		}
		const merged = [...files];
		for (const file of nextFiles) {
			if (!merged.some((item) => item.name === file.name && item.size === file.size)) merged.push(file);
		}
		if (merged.length > maximumFiles) {
			setError(`A batch can contain at most ${maximumFiles} files.`);
			return;
		}
		setFiles(merged);
	}

	function onDrop(event: DragEvent<HTMLButtonElement>) {
		event.preventDefault();
		setDragging(false);
		addFiles(Array.from(event.dataTransfer.files));
	}

	function onSelect(event: ChangeEvent<HTMLInputElement>) {
		addFiles(Array.from(event.target.files ?? []));
		event.target.value = "";
	}

	async function discard(blobs: PutBlobResult[]) {
		if (!blobs.length) return;
		await fetch("/api/uploads/discard", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ pathnames: blobs.map((blob) => blob.pathname) }),
		}).catch(() => undefined);
	}

	async function publish() {
		if (!files.length || uploading) return;
		setUploading(true);
		setProgress(0);
		setMessage("");
		setError("");
		const batchId = crypto.randomUUID();
		const uploaded: PutBlobResult[] = [];

		try {
			for (const [index, file] of files.entries()) {
				const blob = await upload(
					`shopee-exports/raw/${batchId}/${index + 1}-${safeName(file.name)}`,
					file,
					{
						access: "private",
						handleUploadUrl: "/api/uploads/token",
						clientPayload: JSON.stringify({ batchId, originalName: file.name }),
						multipart: file.size > 5 * 1024 * 1024,
						onUploadProgress: ({ percentage }) => {
							setProgress(Math.round(((index + percentage / 100) / files.length) * 75));
						},
					},
				);
				uploaded.push(blob);
			}

			setProgress(82);
			const response = await fetch("/api/uploads/finalize", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					batchId,
					blobs: uploaded.map((blob, index) => ({
						pathname: blob.pathname,
						url: blob.url,
						originalName: files[index].name,
						size: files[index].size,
					})),
				}),
			});
			const result = (await response.json()) as FinalizeResult;
			if (!response.ok) throw new Error(result.error || "The batch could not be activated.");
			setProgress(100);
			setFiles([]);
			setMessage(`${result.files} exports and ${formatInteger(result.rows ?? 0)} rows are now live.`);
			setTimeout(() => window.location.reload(), 900);
		} catch (caught) {
			await discard(uploaded);
			setError(caught instanceof Error ? caught.message : "The upload failed.");
			setProgress(0);
		} finally {
			setUploading(false);
		}
	}

	async function logout() {
		await fetch("/api/uploads/session", { method: "DELETE" });
		window.location.reload();
	}

	return (
		<>
			<section className="upload-status-grid">
				<div className="panel">
					<div className="panel-header">
						<div><h2>Active data batch</h2><p className="muted">The dashboard reads this Blob manifest.</p></div>
						<ShieldCheck color="#22c55e" />
					</div>
					{activeBatch ? (
						<div className="batch-stats">
							<div><strong>{activeBatch.files}</strong><span>exports</span></div>
							<div><strong>{formatInteger(activeBatch.rows)}</strong><span>rows</span></div>
							<div><strong>{formatBytes(activeBatch.bytes)}</strong><span>raw size</span></div>
						</div>
					) : <p className="muted">No Blob batch is active yet. The dashboard is using its bundled bootstrap data.</p>}
					{activeBatch ? <p className="batch-meta">Published {formatTimestamp(activeBatch.uploadedAt)} · {activeBatch.batchId}</p> : null}
				</div>
				<div className="panel guardrail-card">
					<div className="panel-header"><div><h2>Safe activation</h2><p className="muted">Validation happens before the dashboard switches.</p></div><CheckCircle2 color="#38bdf8" /></div>
					<ul className="feature-list compact-list">
						<li>Raw files remain private in Vercel Blob.</li>
						<li>A failed batch leaves the current dashboard untouched.</li>
						<li>Successful uploads invalidate the 30-second data cache immediately.</li>
					</ul>
				</div>
			</section>

			<section className="panel upload-panel">
				<div className="panel-header">
					<div><h2>Upload Shopee exports</h2><p className="muted">CSV or XLSX · up to 20 files · 100 MB per file</p></div>
					<button className="button button-secondary" type="button" onClick={logout}><LogOut size={16} /> Lock</button>
				</div>
				<input ref={inputRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" multiple hidden onChange={onSelect} />
				<button
					type="button"
					className={`drop-zone${dragging ? " is-dragging" : ""}`}
					onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
					onDragOver={(event) => event.preventDefault()}
					onDragLeave={() => setDragging(false)}
					onDrop={onDrop}
					onClick={() => inputRef.current?.click()}
				>
					<UploadCloud size={34} />
					<strong>Drag Shopee exports here</strong>
					<span>or click to choose files from your computer</span>
				</button>

				{files.length ? (
					<div className="upload-file-list">
						{files.map((file, index) => (
							<div className="upload-file" key={`${file.name}-${file.size}`}>
								<FileSpreadsheet size={20} />
								<div><strong>{file.name}</strong><span>{formatBytes(file.size)}</span></div>
								<button type="button" aria-label={`Remove ${file.name}`} disabled={uploading} onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={16} /></button>
							</div>
						))}
					</div>
				) : null}

				{progress > 0 ? <div className="upload-progress" aria-label={`Upload ${progress}% complete`}><span style={{ width: `${progress}%` }} /></div> : null}
				{error ? <p className="form-error" role="alert">{error}</p> : null}
				{message ? <p className="form-success" role="status"><CheckCircle2 size={17} /> {message}</p> : null}
				<div className="upload-actions">
					<p className="muted">Publishing replaces the entire active batch. Include every export you want represented.</p>
					<button className="button" type="button" disabled={!files.length || uploading} onClick={publish}>
						{uploading ? <LoaderCircle className="spin" size={18} /> : <UploadCloud size={18} />}
						{uploading ? `Publishing ${progress}%` : "Validate and publish"}
					</button>
				</div>
			</section>
		</>
	);
}
