import Papa from "papaparse";
import readExcelFile, { type CellValue } from "read-excel-file/node";

type MatrixCell = CellValue | null;

export const acceptedExportExtensions = [".csv", ".xlsx"] as const;
export const maximumExportBytes = 100 * 1024 * 1024;
export const maximumBatchFiles = 20;

export type NormalizedExport = {
	datasetId: string;
	datasetLabel: string;
	category: string;
	originalName: string;
	rows: Array<Record<string, string>>;
};

type DatasetDefinition = {
	id: string;
	label: string;
	category: string;
	fileTokens: string[];
	columnSignals: string[];
};

const datasetDefinitions: DatasetDefinition[] = [
	{
		id: "traffic_overview_cleaned",
		label: "Traffic Overview",
		category: "traffic overview",
		fileTokens: ["traffic_overview", "trafficoverview", "traffic overview"],
		columnSignals: ["Total_Visitors", "New_Visitors", "Products_Viewed"],
	},
	{
		id: "product_overview_cleaned",
		label: "Product Overview",
		category: "product overview",
		fileTokens: ["product_overview", "productoverview", "product overview"],
		columnSignals: ["Product Visitors (Visits)", "Product Page Views", "Products Visited"],
	},
	{
		id: "mass_chat_data_cleaned",
		label: "Mass Chat Data",
		category: "mass chat data",
		fileTokens: ["mass_chat", "masschat", "chat_broadcast", "chat broadcast"],
		columnSignals: ["Actual_Recipients", "Recipients_Read", "Recipients_Clicked"],
	},
	{
		id: "chat_data_cleaned",
		label: "Chat Data",
		category: "chat data",
		fileTokens: ["chat_data", "chatdata", "chat performance"],
		columnSignals: ["Number_Of_Chats", "Chats_Replied", "CSAT_Percent"],
	},
	{
		id: "flash_sale_cleaned",
		label: "Flash Sale",
		category: "flash sale",
		fileTokens: ["flash_sale", "flashsale", "flash sale"],
		columnSignals: ["Sales_Per_Buyer_Ready_To_Ship_IDR", "Products_Clicked"],
	},
	{
		id: "voucher_cleaned",
		label: "Voucher",
		category: "voucher",
		fileTokens: ["voucher"],
		columnSignals: ["Claims", "Usage_Rate_Ready_To_Ship", "Total_Cost_Ready_To_Ship_IDR"],
	},
	{
		id: "game_cleaned",
		label: "Game",
		category: "game",
		fileTokens: ["shop_prize", "shopprize", "game", "prize"],
		columnSignals: ["Total_Played", "Players", "Prizes_Claimed"],
	},
	{
		id: "live_cleaned",
		label: "Live",
		category: "live",
		fileTokens: ["live_stream", "livestream", "live streaming", "live"],
		columnSignals: ["Peak_Viewers", "Average_Watch_Duration"],
	},
	{
		id: "off_platform_cleaned",
		label: "Off Platform",
		category: "off platform",
		fileTokens: ["off_platform", "offplatform", "off platform"],
		columnSignals: ["Platform", "Channel", "Conversion_Rate_Orders_Per_Visit"],
	},
	{
		id: "shopee_paylater_cleaned",
		label: "Shopee Paylater",
		category: "shopee paylater",
		fileTokens: ["shopee_paylater", "shopeepaylater", "spaylater", "paylater"],
		columnSignals: ["Tenor", "ROI_Orders_Created", "Service_Fee_Orders_Created"],
	},
	{
		id: "revenue_2_cleaned",
		label: "Revenue 2",
		category: "revenue 2",
		fileTokens: ["income", "revenue"],
		columnSignals: ["Income_Report", "Income Report"],
	},
];

const translations: Record<string, string> = {
	Tanggal: "Date",
	"Periode Data": "Data_Period",
	"Waktu Periode": "Time_Period",
	"Periode Waktu": "Time_Period",
	"Produk Dilihat": "Products_Viewed",
	"Rata-rata Dilihat": "Average_Views",
	"Rata-rata Waktu Dihabiskan": "Average_Time_Spent",
	"Tingkat Pengunjung Melihat Tanpa Membeli": "Rate_Visitors_Viewing_Without_Buying",
	"Total Pengunjung": "Total_Visitors",
	"Pengunjung Baru": "New_Visitors",
	"Pengunjung Lama": "Returning_Visitors",
	"Jumlah Pengikut Baru": "New_Followers",
	"Pengunjung Produk (Kunjungan)": "Product Visitors (Visits)",
	"Halaman Produk Dilihat": "Product Page Views",
	"Produk Dikunjungi": "Products Visited",
	"Pengunjung Melihat Tanpa Membeli": "Visitors Viewed Without Purchase",
	"Klik Pencarian": "Search Clicks",
	Suka: "Likes",
	"Pengunjung Produk (Menambahkan Produk ke Keranjang)": "Product Visitors (Added to Cart)",
	"Dimasukkan ke Keranjang (Produk)": "Added to Cart (Products)",
	"Total Pembeli (Pesanan Dibuat)": "Total Buyers (Orders Created)",
	"Produk (Pesanan Dibuat)": "Products (Orders Created)",
	"Produk Dipesan": "Products Ordered",
	"Total Penjualan (Pesanan Dibuat) (IDR)": "Total Sales (Orders Created) (IDR)",
	"Penjualan (Pesanan Dibuat) (IDR)": "Sales_Orders_Created_IDR",
	"Total Pembeli (Pesanan Siap Dikirim)": "Total Buyers (Orders Ready to Ship)",
	"Produk (Pesanan Siap Dikirim)": "Products (Orders Ready to Ship)",
	"Produk Siap Dikirim": "Products Ready to Ship",
	"Penjualan (Pesanan Siap Dikirim) (IDR)": "Sales_Ready_To_Ship_IDR",
	Pengunjung: "Visitors",
	"Jumlah Chat": "Number_Of_Chats",
	"Pengunjung Bertanya": "Visitors_Asking",
	"Pertanyaan Diajukan": "Questions_Asked",
	"Chat Dibalas": "Chats_Replied",
	"Chat Tidak Dibalas": "Chats_Not_Replied",
	"Chat Belum Dibalas": "Chats_Not_Replied",
	"Waktu Respons Rata-rata": "Average_Response_Time",
	"Waktu Respon Rata-rata": "Average_Response_Time",
	"Persentase CSAT": "CSAT_Percent",
	"CSAT %": "CSAT_Percent",
	"Waktu Respons Chat Pertama": "First_Chat_Response_Time",
	"Waktu Respon Chat Pertama Kali": "First_Chat_Response_Time",
	"Tingkat Konversi (Chat Direspons)": "Conversion_Rate_Chats_Responded",
	"Tingkat Konversi (Jumlah Chat yang Direspon)": "Conversion_Rate_Chats_Responded",
	"Total Pembeli": "Total_Buyers",
	"Total Pesanan": "Total_Orders",
	Produk: "Products",
	"Penjualan (IDR)": "Sales_IDR",
	"Tingkat Konversi (Chat Dibalas)": "Conversion_Rate_Chats_Replied",
	Saluran: "Channel",
	Kunjungan: "Visits",
	"Pembeli Baru": "New_Buyers",
	"Tingkat Konversi (Pesanan per Kunjungan)": "Conversion_Rate_Orders_Per_Visit",
	"Pengguna Menambahkan ke Keranjang": "Users_Added_To_Cart",
	"Nilai Produk Ditambahkan ke Keranjang (IDR)": "Value_Products_Added_To_Cart_IDR",
	"Produk Ditambahkan ke Keranjang": "Products_Added_To_Cart",
	"Tingkat Konversi (Kunjungan ke Keranjang)": "Conversion_Rate_Visit_To_Cart",
	"Tingkat Konversi (Keranjang ke Pesanan)": "Conversion_Rate_Cart_To_Order",
	"Penerima Sebenarnya": "Actual_Recipients",
	"Penerima Membaca": "Recipients_Read",
	"Penerima Mengklik": "Recipients_Clicked",
	"Penerima Memblokir": "Recipients_Blocked",
	Pesanan: "Orders",
	Pembeli: "Buyers",
	"Tingkat Baca": "Read_Rate",
	"Tingkat Klik": "Click_Rate",
	"Tingkat Konversi (Merespons ke Ditempatkan)": "Conversion_Rate_Respond_To_Placed",
	"Jumlah Produk Dilihat": "Number_Of_Products_Viewed",
	"Produk Diklik": "Products_Clicked",
	"Penjualan per Pembeli (Pesanan Dibuat) (IDR)": "Sales_Per_Buyer_Orders_Created_IDR",
	"Penjualan per Pembeli (Pesanan Siap Dikirim) (IDR)": "Sales_Per_Buyer_Ready_To_Ship_IDR",
	"Biaya Layanan yang Dikenakan (Pesanan Dibuat)": "Service_Fee_Orders_Created",
	"Biaya Layanan yang Dikenakan (Pesanan Siap Dikirim)": "Service_Fee_Ready_To_Ship",
	"ROI (Pesanan Dibuat)": "ROI_Orders_Created",
	"ROI (Pesanan Siap Dikirim)": "ROI_Ready_To_Ship",
};

function extension(fileName: string) {
	const dot = fileName.lastIndexOf(".");
	return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

export function isAcceptedExportName(fileName: string) {
	return acceptedExportExtensions.includes(
		extension(fileName) as (typeof acceptedExportExtensions)[number],
	);
}

export function sanitizeExportName(fileName: string) {
	const safe = fileName
		.normalize("NFKD")
		.replace(/[^a-zA-Z0-9._-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^[-.]+|[-.]+$/g, "");
	return safe.slice(0, 160) || `export-${Date.now()}.csv`;
}

function cleanHeader(value: unknown) {
	const header = String(value ?? "")
		.replace(/\s+/g, " ")
		.trim();
	if (!header) return "";
	if (translations[header]) return translations[header];
	return header;
}

function formatCell(value: MatrixCell | undefined) {
	if (value === null || value === undefined) return "";
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	return String(value).trim();
}

function uniqueHeaders(values: unknown[]) {
	const counts = new Map<string, number>();
	return values.map((value, index) => {
		const cleaned = cleanHeader(value) || `Column_${index + 1}`;
		const count = (counts.get(cleaned) ?? 0) + 1;
		counts.set(cleaned, count);
		return count === 1 ? cleaned : `${cleaned}_${count}`;
	});
}

function recordsFromMatrix(matrix: MatrixCell[][]) {
	const candidates = matrix.slice(0, 30);
	let headerIndex = 0;
	let bestScore = -1;
	for (const [index, row] of candidates.entries()) {
		const nonEmpty = row.filter((cell) => formatCell(cell)).length;
		const strings = row.filter((cell) => typeof cell === "string").length;
		const recognized = row.filter((cell) => translations[String(cell ?? "").trim()]).length;
		const score = nonEmpty + strings * 0.25 + recognized * 5;
		if (nonEmpty >= 2 && score > bestScore) {
			headerIndex = index;
			bestScore = score;
		}
	}

	const headers = uniqueHeaders(matrix[headerIndex] ?? []);
	if (headers.length < 2) throw new Error("No usable header row was found.");

	return matrix
		.slice(headerIndex + 1)
		.map((row) =>
			Object.fromEntries(headers.map((header, index) => [header, formatCell(row[index])])),
		)
		.filter((row) => Object.values(row).some(Boolean));
}

async function parseRows(fileName: string, bytes: Uint8Array) {
	if (extension(fileName) === ".csv") {
		const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/^\uFEFF/, "");
		const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
		if (parsed.errors.length && !parsed.data.length) {
			throw new Error(parsed.errors[0].message);
		}
		return recordsFromMatrix(parsed.data as MatrixCell[][]);
	}

	const sheets = await readExcelFile(Buffer.from(bytes));
	return sheets.flatMap(({ data }) => (data.length ? recordsFromMatrix(data) : []));
}

function identifyDataset(fileName: string, headers: string[]) {
	const normalizedName = fileName.toLowerCase().replace(/[-.]+/g, "_");
	const exactId = normalizedName.replace(/\.(csv|xlsx)$/i, "");
	const exact = datasetDefinitions.find((definition) => definition.id === exactId);
	if (exact) return exact;

	const byName = datasetDefinitions.find((definition) =>
		definition.fileTokens.some((token) =>
			normalizedName.includes(token.toLowerCase().replace(/[-. ]+/g, "_")),
		),
	);
	if (byName) return byName;

	const byColumns = datasetDefinitions
		.map((definition) => ({
			definition,
			score: definition.columnSignals.filter((signal) => headers.includes(signal)).length,
		}))
		.sort((a, b) => b.score - a.score)[0];
	return byColumns?.score > 0 ? byColumns.definition : null;
}

export async function normalizeExport(
	fileName: string,
	bytes: Uint8Array,
): Promise<NormalizedExport> {
	if (!isAcceptedExportName(fileName)) {
		throw new Error("Only .csv and .xlsx Shopee exports are supported.");
	}
	if (!bytes.byteLength) throw new Error("The file is empty.");
	if (bytes.byteLength > maximumExportBytes) {
		throw new Error("The file exceeds the 100 MB upload limit.");
	}

	const parsedRows = await parseRows(fileName, bytes);
	if (!parsedRows.length) throw new Error("The export contains no data rows.");
	if (parsedRows.length > 250_000) throw new Error("The export exceeds 250,000 rows.");

	const definition = identifyDataset(fileName, Object.keys(parsedRows[0]));
	if (!definition) {
		throw new Error(
			"The Shopee export type could not be identified from its filename or columns.",
		);
	}

	const processedAt = new Date().toISOString();
	const rows = parsedRows.map((row) => ({
		...row,
		Source_File: fileName,
		Category: row.Category || definition.category,
		Processed_Date: row.Processed_Date || processedAt,
	}));

	return {
		datasetId: definition.id,
		datasetLabel: definition.label,
		category: definition.category,
		originalName: fileName,
		rows,
	};
}
