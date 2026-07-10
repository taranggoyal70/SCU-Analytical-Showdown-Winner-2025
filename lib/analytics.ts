import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";

export type MetricName = "revenue" | "orders" | "visitors" | "cost";

export type SearchFilters = {
	dataset?: string;
	from?: string;
	to?: string;
};

export type AnalyticsRow = {
	datasetId: string;
	datasetLabel: string;
	category: string;
	sourceFile: string;
	periodStart: string | null;
	periodEnd: string | null;
	values: Record<string, string>;
	metrics: Record<MetricName, number>;
};

export type DatasetSummary = {
	id: string;
	label: string;
	category: string;
	rows: number;
	sourceFiles: number;
	revenue: number;
	orders: number;
	visitors: number;
	cost: number;
	dateCoverage: {
		withDates: number;
		withoutDates: number;
	};
};

export type DashboardSummary = {
	filters: Required<SearchFilters>;
	dateRange: {
		min: string | null;
		max: string | null;
	};
	kpis: {
		revenue: number;
		orders: number;
		visitors: number;
		cost: number;
		conversionRate: number;
		averageOrderValue: number;
		csat: number | null;
		replyRate: number | null;
	};
	datasets: DatasetSummary[];
	revenueTrend: Array<{ period: string; revenue: number; orders: number; visitors: number }>;
	channelBreakdown: Array<{ name: string; revenue: number; orders: number; visitors: number }>;
	funnel: Array<{ stage: string; value: number }>;
	campaigns: Array<{ name: string; revenue: number; cost: number; orders: number; roi: number }>;
	insights: string[];
	quality: {
		totalRows: number;
		sourceFiles: number;
		datasets: number;
		rowsWithoutDates: number;
		rowsWithoutSource: number;
	};
};

const dataDirectory = path.join(process.cwd(), "data", "cleaned");

const metricColumns: Record<MetricName, string[]> = {
	revenue: [
		"Sales_Ready_To_Ship_IDR",
		"Sales_IDR",
		"Total Sales (Orders Created) (IDR)",
		"Sales (Orders Ready to Ship) (IDR)",
		"Sales_Orders_Created_IDR",
		"Value_Products_Added_To_Cart_IDR",
	],
	orders: [
		"Orders_Ready_To_Ship",
		"Total_Orders",
		"Orders",
		"Orders_Created",
		"Orders_COD_Created_Plus_NonCOD_Paid",
		"Total Buyers (Orders Ready to Ship)",
		"Total Buyers (Orders Created)",
	],
	visitors: [
		"Total_Visitors",
		"Visitors",
		"Visits",
		"Product Visitors (Visits)",
		"New_Visitors",
		"Returning_Visitors",
		"Products_Viewed",
		"Number_Of_Products_Viewed",
	],
	cost: [
		"Total_Cost_Ready_To_Ship_IDR",
		"Total_Cost_Orders_Created_IDR",
		"Prize_Cost_Ready_To_Ship_IDR",
		"Prize_Cost_Orders_Created_IDR",
		"Service_Fee",
		"service fee.1",
		"Biaya Layanan yang Dikenakan (Pesanan Siap Dikirim)",
		"Biaya Layanan yang Dikenakan (Pesanan Dibuat)",
	],
};

function datasetLabel(fileName: string) {
	return fileName
		.replace(/_cleaned\.csv$/i, "")
		.replace(/_/g, " ")
		.replace(/\b\w/g, (match) => match.toUpperCase());
}

function datasetId(fileName: string) {
	return fileName.replace(/\.csv$/i, "");
}

function cleanCell(value: unknown) {
	if (value === null || value === undefined) return "";
	return String(value).trim();
}

function parseNumber(value: unknown) {
	const raw = cleanCell(value);
	if (!raw || raw.toLowerCase() === "nan") return 0;

	const normalized =
		raw.includes(",") && !raw.includes(".")
			? raw.replace(",", ".")
			: raw.replace(/,/g, "");

	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : 0;
}

function metricValue(row: Record<string, string>, metric: MetricName) {
	for (const column of metricColumns[metric]) {
		if (column in row && cleanCell(row[column])) {
			return parseNumber(row[column]);
		}
	}

	return 0;
}

function parseDateParts(year: string, month: string, day: string) {
	const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
	return Number.isNaN(date.getTime()) ? null : date;
}

function parsePeriodFromText(text: string): { start: Date | null; end: Date | null } {
	const cleaned = cleanCell(text);
	if (!cleaned || cleaned.toLowerCase() === "nan") {
		return { start: null, end: null };
	}

	const compactRange = cleaned.match(
		/(\d{4})(\d{2})(\d{2})[_-](\d{4})(\d{2})(\d{2})/,
	);
	if (compactRange) {
		return {
			start: parseDateParts(compactRange[1], compactRange[2], compactRange[3]),
			end: parseDateParts(compactRange[4], compactRange[5], compactRange[6]),
		};
	}

	const longRange = cleaned.match(
		/(\d{2})[-/](\d{2})[-/](\d{4})\s*[-–]\s*(\d{2})[-/](\d{2})[-/](\d{4})/,
	);
	if (longRange) {
		return {
			start: parseDateParts(longRange[3], longRange[2], longRange[1]),
			end: parseDateParts(longRange[6], longRange[5], longRange[4]),
		};
	}

	const singleDate = cleaned.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
	if (singleDate) {
		const date = parseDateParts(singleDate[3], singleDate[2], singleDate[1]);
		return { start: date, end: date };
	}

	return { start: null, end: null };
}

function extractPeriod(row: Record<string, string>) {
	const candidateColumns = ["Date", "Data_Period", "Time_Period", "Periode Data"];
	for (const column of candidateColumns) {
		const parsed = parsePeriodFromText(row[column]);
		if (parsed.start || parsed.end) return parsed;
	}

	return parsePeriodFromText(row.Source_File);
}

function iso(date: Date | null) {
	return date ? date.toISOString().slice(0, 10) : null;
}

function monthKey(value: string | null) {
	if (!value) return "Unknown";
	return value.slice(0, 7);
}

function isWithinFilters(row: AnalyticsRow, filters: SearchFilters) {
	if (filters.dataset && row.datasetId !== filters.dataset) return false;

	if (!filters.from && !filters.to) return true;
	if (!row.periodStart) return false;

	const rowTime = new Date(row.periodStart).getTime();
	if (filters.from && rowTime < new Date(filters.from).getTime()) return false;
	if (filters.to && rowTime > new Date(filters.to).getTime()) return false;
	return true;
}

async function readDataset(fileName: string): Promise<AnalyticsRow[]> {
	const filePath = path.join(dataDirectory, fileName);
	const csv = await readFile(filePath, "utf8");
	const parsed = Papa.parse<Record<string, string>>(csv, {
		header: true,
		skipEmptyLines: false,
		transform: (value) => cleanCell(value),
	});
	const id = datasetId(fileName);
	const label = datasetLabel(fileName);

	return parsed.data
		.filter((row) => Object.values(row).some((value) => cleanCell(value)))
		.map((row) => {
			const period = extractPeriod(row);
			const category = cleanCell(row.Category) || label;
			return {
				datasetId: id,
				datasetLabel: label,
				category,
				sourceFile: cleanCell(row.Source_File),
				periodStart: iso(period.start),
				periodEnd: iso(period.end),
				values: row,
				metrics: {
					revenue: metricValue(row, "revenue"),
					orders: metricValue(row, "orders"),
					visitors: metricValue(row, "visitors"),
					cost: metricValue(row, "cost"),
				},
			};
		});
}

let cachedRows: Promise<AnalyticsRow[]> | null = null;

export async function loadAnalyticsRows() {
	if (!cachedRows) {
		cachedRows = readdir(dataDirectory).then(async (files) => {
			const csvFiles = files.filter((file) => file.endsWith(".csv")).sort();
			const datasets = await Promise.all(csvFiles.map(readDataset));
			return datasets.flat();
		});
	}

	return cachedRows;
}

function sum(rows: AnalyticsRow[], metric: MetricName) {
	return rows.reduce((total, row) => total + row.metrics[metric], 0);
}

function average(values: number[]) {
	const clean = values.filter((value) => Number.isFinite(value) && value > 0);
	if (!clean.length) return null;
	return clean.reduce((total, value) => total + value, 0) / clean.length;
}

function buildDatasetSummaries(rows: AnalyticsRow[]): DatasetSummary[] {
	const groups = new Map<string, AnalyticsRow[]>();
	for (const row of rows) {
		const current = groups.get(row.datasetId) ?? [];
		current.push(row);
		groups.set(row.datasetId, current);
	}

	return [...groups.entries()]
		.map(([id, group]) => ({
			id,
			label: group[0].datasetLabel,
			category: group[0].category,
			rows: group.length,
			sourceFiles: new Set(group.map((row) => row.sourceFile).filter(Boolean)).size,
			revenue: sum(group, "revenue"),
			orders: sum(group, "orders"),
			visitors: sum(group, "visitors"),
			cost: sum(group, "cost"),
			dateCoverage: {
				withDates: group.filter((row) => row.periodStart).length,
				withoutDates: group.filter((row) => !row.periodStart).length,
			},
		}))
		.sort((a, b) => b.revenue - a.revenue);
}

function buildTrend(rows: AnalyticsRow[]) {
	const groups = new Map<string, { revenue: number; orders: number; visitors: number }>();
	for (const row of rows) {
		const key = monthKey(row.periodStart);
		const current = groups.get(key) ?? { revenue: 0, orders: 0, visitors: 0 };
		current.revenue += row.metrics.revenue;
		current.orders += row.metrics.orders;
		current.visitors += row.metrics.visitors;
		groups.set(key, current);
	}

	return [...groups.entries()]
		.map(([period, values]) => ({ period, ...values }))
		.sort((a, b) => a.period.localeCompare(b.period));
}

function buildBreakdown(datasets: DatasetSummary[]) {
	return datasets
		.slice(0, 8)
		.map((dataset) => ({
			name: dataset.label,
			revenue: dataset.revenue,
			orders: dataset.orders,
			visitors: dataset.visitors,
		}));
}

function buildFunnel(rows: AnalyticsRow[]) {
	const valueFor = (columns: string[]) =>
		rows.reduce((total, row) => {
			for (const column of columns) {
				if (column in row.values && cleanCell(row.values[column])) {
					return total + parseNumber(row.values[column]);
				}
			}
			return total;
		}, 0);

	return [
		{ stage: "Visitors", value: valueFor(["Product Visitors (Visits)", "Total_Visitors", "Visitors"]) },
		{
			stage: "Product views",
			value: valueFor(["Product Page Views", "Products_Viewed", "Number_Of_Products_Viewed"]),
		},
		{
			stage: "Added to cart",
			value: valueFor(["Product Visitors (Added to Cart)", "Users_Added_To_Cart"]),
		},
		{
			stage: "Orders",
			value: valueFor(["Total Buyers (Orders Ready to Ship)", "Orders_Ready_To_Ship", "Total_Orders"]),
		},
	].filter((stage) => stage.value > 0);
}

function buildCampaigns(datasets: DatasetSummary[]) {
	return datasets
		.filter((dataset) =>
			["flash", "voucher", "game", "live", "chat", "paylater"].some((token) =>
				dataset.id.includes(token),
			),
		)
		.map((dataset) => {
			const cost = dataset.cost > 0 ? dataset.cost : 0;
			return {
				name: dataset.label,
				revenue: dataset.revenue,
				cost,
				orders: dataset.orders,
				roi: cost > 0 ? ((dataset.revenue - cost) / cost) * 100 : 0,
			};
		})
		.sort((a, b) => b.revenue - a.revenue);
}

function buildInsights(summary: Omit<DashboardSummary, "insights">) {
	const insights: string[] = [];
	const topChannel = summary.channelBreakdown[0];
	if (topChannel) {
		insights.push(
			`${topChannel.name} is the largest tracked revenue contributor in the current filter.`,
		);
	}

	if (summary.kpis.conversionRate > 0) {
		insights.push(
			`Blended conversion is ${summary.kpis.conversionRate.toFixed(2)}%, calculated from tracked orders divided by tracked visitors.`,
		);
	}

	const topCampaign = summary.campaigns.find((campaign) => campaign.roi > 0);
	if (topCampaign) {
		insights.push(
			`${topCampaign.name} has the strongest measured campaign ROI where cost data exists.`,
		);
	}

	if (summary.quality.rowsWithoutDates > 0) {
		insights.push(
			`${summary.quality.rowsWithoutDates} rows do not expose a reliable period; the app keeps them visible in data quality instead of silently guessing.`,
		);
	}

	return insights;
}

export async function getDashboardSummary(filters: SearchFilters = {}): Promise<DashboardSummary> {
	const allRows = await loadAnalyticsRows();
	const filteredRows = allRows.filter((row) => isWithinFilters(row, filters));
	const datasets = buildDatasetSummaries(filteredRows);
	const datedRows = allRows.filter((row) => row.periodStart);
	const sortedDates = datedRows.map((row) => row.periodStart as string).sort();
	const revenue = sum(filteredRows, "revenue");
	const orders = sum(filteredRows, "orders");
	const visitors = sum(filteredRows, "visitors");
	const cost = sum(filteredRows, "cost");
	const csatValues = filteredRows
		.filter((row) => "CSAT_Percent" in row.values)
		.map((row) => {
			const value = parseNumber(row.values.CSAT_Percent);
			return value > 0 && value <= 1 ? value * 100 : value;
		});
	const replyRateValues = filteredRows
		.filter((row) => "Conversion_Rate_Chats_Responded" in row.values)
		.map((row) => parseNumber(row.values.Conversion_Rate_Chats_Responded) * 100);

	const baseSummary = {
		filters: {
			dataset: filters.dataset ?? "all",
			from: filters.from ?? "",
			to: filters.to ?? "",
		},
		dateRange: {
			min: sortedDates[0] ?? null,
			max: sortedDates[sortedDates.length - 1] ?? null,
		},
		kpis: {
			revenue,
			orders,
			visitors,
			cost,
			conversionRate: visitors > 0 ? (orders / visitors) * 100 : 0,
			averageOrderValue: orders > 0 ? revenue / orders : 0,
			csat: average(csatValues),
			replyRate: average(replyRateValues),
		},
		datasets,
		revenueTrend: buildTrend(filteredRows),
		channelBreakdown: buildBreakdown(datasets),
		funnel: buildFunnel(filteredRows),
		campaigns: buildCampaigns(datasets),
		quality: {
			totalRows: filteredRows.length,
			sourceFiles: new Set(filteredRows.map((row) => row.sourceFile).filter(Boolean)).size,
			datasets: datasets.length,
			rowsWithoutDates: filteredRows.filter((row) => !row.periodStart).length,
			rowsWithoutSource: filteredRows.filter((row) => !row.sourceFile).length,
		},
	};

	return {
		...baseSummary,
		insights: buildInsights(baseSummary),
	};
}
