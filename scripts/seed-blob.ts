import { seedBundledDataToBlob } from "../lib/blob-store";

async function main() {
	const manifest = await seedBundledDataToBlob();
	console.log(
		`Activated Blob batch ${manifest.batchId}: ${manifest.files.length} files, ${manifest.totalRows} rows.`,
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
