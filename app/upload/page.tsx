import { Database, UploadCloud } from "lucide-react";
import { UploadLogin } from "@/components/upload-login";
import { UploadWorkspace } from "@/components/upload-workspace";
import { getActiveManifest } from "@/lib/blob-store";
import { hasUploadSession } from "@/lib/upload-session";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
	if (!(await hasUploadSession())) return <UploadLogin />;
	const active = await getActiveManifest();

	return (
		<main className="shell">
			<section className="section-hero upload-hero">
				<div>
					<div className="eyebrow"><UploadCloud size={15} /> Live data operations</div>
					<h1 className="title compact-title">Update analytics without a rebuild.</h1>
					<p className="subtitle">
						Upload fresh Shopee CSV or XLSX exports. They are validated, normalized, stored privately in Vercel Blob, and activated as one atomic batch.
					</p>
				</div>
				<div className="panel">
					<div className="panel-header"><div><h2>Blob-backed pipeline</h2><p className="muted">Seller-controlled and source-auditable.</p></div><Database color="#38bdf8" /></div>
					<p className="muted">The web app checks the active Blob manifest on a short TTL. A successful publish purges that cache, so the next dashboard request uses the new batch.</p>
				</div>
			</section>
			<UploadWorkspace activeBatch={active ? { batchId: active.batchId, uploadedAt: active.uploadedAt, files: active.files.length, rows: active.totalRows, bytes: active.totalBytes } : null} />
		</main>
	);
}
