import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import writeExcelFile from "write-excel-file/node";
import { normalizeExport } from "../lib/export-ingestion";

test("normalizes every bundled CSV export", async () => {
	const directory = path.join(process.cwd(), "data", "cleaned");
	const files = (await readdir(directory)).filter((file) => file.endsWith(".csv"));
	assert.equal(files.length, 11);

	const exports = await Promise.all(
		files.map(async (file) => normalizeExport(file, await readFile(path.join(directory, file)))),
	);
	assert.equal(new Set(exports.map((item) => item.datasetId)).size, 11);
	assert.ok(exports.every((item) => item.rows.length > 0));
	assert.ok(exports.every((item) => item.rows.every((row) => row.Source_File === item.originalName)));
});

test("translates Indonesian traffic headers", async () => {
	const csv = [
		"Tanggal,Total Pengunjung,Pengunjung Baru,Produk Dilihat",
		"01-01-2026,120,80,400",
	].join("\n");
	const result = await normalizeExport("traffic_overview_202601.csv", new TextEncoder().encode(csv));
	assert.equal(result.datasetId, "traffic_overview_cleaned");
	assert.deepEqual(
		{
			date: result.rows[0].Date,
			visitors: result.rows[0].Total_Visitors,
			newVisitors: result.rows[0].New_Visitors,
			products: result.rows[0].Products_Viewed,
		},
		{ date: "01-01-2026", visitors: "120", newVisitors: "80", products: "400" },
	);
});

test("reads a raw XLSX Shopee export", async () => {
	const workbook = await writeExcelFile([
		[{ value: "Tanggal" }, { value: "Total Pengunjung" }, { value: "Produk Dilihat" }],
		[{ value: "01-02-2026" }, { value: 250 }, { value: 900 }],
	]).toBuffer();
	const result = await normalizeExport("traffic_overview_202602.xlsx", workbook);
	assert.equal(result.datasetId, "traffic_overview_cleaned");
	assert.equal(result.rows[0].Total_Visitors, "250");
	assert.equal(result.rows[0].Products_Viewed, "900");
});

test("rejects files that are not recognized Shopee exports", async () => {
	const csv = "name,value\nhello,1\n";
	await assert.rejects(
		normalizeExport("random.csv", new TextEncoder().encode(csv)),
		/could not be identified/,
	);
});
