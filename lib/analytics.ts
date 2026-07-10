import { cache } from "react";
import { trimPartialTail } from "@/lib/forecast";
import { loadAnalyticsSnapshot } from "@/lib/data-source";
import type { NormalizedExport } from "@/lib/export-ingestion";

export type MetricName = "revenue" | "orders" | "visitors" | "cost";

export type SearchFilters = {
	dataset?: string;
	datasetIds?: string[];
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
	/**
	 * Official income statements overlap the per-channel sales reports, so they
	 * are kept out of blended KPI totals unless the dataset is explicitly
	 * requested via filters (e.g. the Income Statements page).
	 */
	excludeFromBlend?: boolean;
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
	/** Monthly revenue history (sorted by month) for sparklines. */
	sparkline: number[];
};

export type Momentum = {
	period: string;
	previousPeriod: string;
	revenue: number | null;
	orders: number | null;
	visitors: number | null;
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
	/** Month-over-month change across the two most recent tracked months. */
	momentum: Momentum | null;
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
	dataSource: {
		kind: "blob" | "bundled";
		batchId: string | null;
		uploadedAt: string | null;
		files: number;
	};
};

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

/**
 * Source files mix two 8-digit date styles: YYYYMMDD (20250501) and
 * DDMMYYYY (01032024). Validate the year/month ranges to pick the right one
 * instead of guessing and producing garbage periods like year 0102.
 */
function parseCompactDate(token: string) {
	const asYearFirst = {
		year: Number(token.slice(0, 4)),
		month: Number(token.slice(4, 6)),
		day: Number(token.slice(6, 8)),
	};
	if (
		asYearFirst.year >= 2000 &&
		asYearFirst.year <= 2100 &&
		asYearFirst.month >= 1 &&
		asYearFirst.month <= 12 &&
		asYearFirst.day >= 1 &&
		asYearFirst.day <= 31
	) {
		return parseDateParts(
			String(asYearFirst.year),
			String(asYearFirst.month),
			String(asYearFirst.day),
		);
	}

	const asDayFirst = {
		day: Number(token.slice(0, 2)),
		month: Number(token.slice(2, 4)),
		year: Number(token.slice(4, 8)),
	};
	if (
		asDayFirst.year >= 2000 &&
		asDayFirst.year <= 2100 &&
		asDayFirst.month >= 1 &&
		asDayFirst.month <= 12 &&
		asDayFirst.day >= 1 &&
		asDayFirst.day <= 31
	) {
		return parseDateParts(
			String(asDayFirst.year),
			String(asDayFirst.month),
			String(asDayFirst.day),
		);
	}

	return null;
}

function parsePeriodFromText(text: string): { start: Date | null; end: Date | null } {
	const cleaned = cleanCell(text);
	if (!cleaned || cleaned.toLowerCase() === "nan") {
		return { start: null, end: null };
	}

	const compactRange = cleaned.match(/(\d{8})[_-](\d{8})/);
	if (compactRange) {
		const start = parseCompactDate(compactRange[1]);
		const end = parseCompactDate(compactRange[2]);
		if (start || end) {
			return { start, end };
		}
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
	if (filters.datasetIds?.length && !filters.datasetIds.includes(row.datasetId)) {
		return false;
	}
	if (filters.dataset && row.datasetId !== filters.dataset) return false;

	if (!filters.from && !filters.to) return true;
	if (!row.periodStart) return false;

	const rowTime = new Date(row.periodStart).getTime();
	if (filters.from && rowTime < new Date(filters.from).getTime()) return false;
	if (filters.to && rowTime > new Date(filters.to).getTime()) return false;
	return true;
}

/**
 * Shopee income reports are exported as key/value statements (label in one
 * column, amount in another) rather than tabular rows. This parser turns each
 * statement file into one structured row: period, total income, total
 * expenses, and net. Duplicate exports of the same period are deduplicated.
 */
function parseIncomeStatements(
	data: Array<Record<string, string>>,
	id: string,
): AnalyticsRow[] {
	const label = "Income Statements";
	const groups = new Map<string, Array<Record<string, string>>>();
	for (const row of data) {
		const sourceFile = cleanCell(row.Source_File);
		if (!sourceFile) continue;
		const current = groups.get(sourceFile) ?? [];
		current.push(row);
		groups.set(sourceFile, current);
	}

	const statements: AnalyticsRow[] = [];
	const seenPeriods = new Set<string>();

	for (const [sourceFile, rows] of groups) {
		let from: string | null = null;
		let to: string | null = null;
		let income = 0;
		let expenses = 0;

		for (const row of rows) {
			const labelCell =
				cleanCell(row.Income_Report) || cleanCell(row["Income Report"]);
			if (!labelCell) continue;
			const amountCell = cleanCell(row["Unnamed: 3"]);
			const dateCell = cleanCell(row["Unnamed: 1"]);

			if (/^(dari|from)$/i.test(labelCell) && dateCell) from = dateCell;
			else if (/^(ke|to)$/i.test(labelCell) && dateCell) to = dateCell;
			else if (/^1\.\s*Total\s+(Pendapatan|Revenue)/i.test(labelCell)) {
				income = parseNumber(amountCell);
			} else if (/^2\.\s*Total\s+(Pengeluaran|Expenses)/i.test(labelCell)) {
				expenses = Math.abs(parseNumber(amountCell));
			}
		}

		if (!income && !expenses) continue;
		const periodKey = `${from ?? "?"}_${to ?? "?"}`;
		if (seenPeriods.has(periodKey)) continue;
		seenPeriods.add(periodKey);

		statements.push({
			datasetId: id,
			datasetLabel: label,
			category: "income statement",
			sourceFile,
			periodStart: from,
			periodEnd: to,
			values: {
				Statement_Period: `${from ?? "unknown"} → ${to ?? "unknown"}`,
				Statement_Income_IDR: String(income),
				Statement_Expenses_IDR: String(expenses),
				Statement_Net_IDR: String(income - expenses),
				Source_File: sourceFile,
			},
			metrics: {
				revenue: income,
				orders: 0,
				visitors: 0,
				cost: expenses,
			},
			excludeFromBlend: true,
		});
	}

	return statements.sort((a, b) =>
		(a.periodStart ?? "").localeCompare(b.periodStart ?? ""),
	);
}

function isIncomeReportDataset(datasetId: string) {
	return datasetId.startsWith("revenue_2");
}

function readDataset(dataset: NormalizedExport): AnalyticsRow[] {
	const data = dataset.rows.filter((row) =>
		Object.values(row).some((value) => cleanCell(value)),
	);

	if (isIncomeReportDataset(dataset.datasetId)) {
		return parseIncomeStatements(data, dataset.datasetId);
	}

	return data.map((row) => {
		const period = extractPeriod(row);
		const category = cleanCell(row.Category) || dataset.category;
		return {
			datasetId: dataset.datasetId,
			datasetLabel: dataset.datasetLabel,
			category,
			sourceFile: cleanCell(row.Source_File) || dataset.originalName,
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

const loadAnalyticsData = cache(async () => {
	const snapshot = await loadAnalyticsSnapshot();
	return {
		rows: snapshot.datasets.flatMap((dataset) => {
			try {
				return readDataset(dataset);
			} catch (error) {
				console.error(`Failed to read dataset ${dataset.originalName}:`, error);
				return [];
			}
		}),
		source: snapshot.source,
	};
});

export async function loadAnalyticsRows() {
	return (await loadAnalyticsData()).rows;
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
			sparkline: buildSparkline(group),
		}))
		.sort((a, b) => b.revenue - a.revenue);
}

function buildSparkline(rows: AnalyticsRow[]) {
	const byMonth = new Map<string, number>();
	for (const row of rows) {
		if (!row.periodStart) continue;
		const key = monthKey(row.periodStart);
		byMonth.set(key, (byMonth.get(key) ?? 0) + row.metrics.revenue);
	}
	return [...byMonth.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([, revenue]) => revenue);
}

function percentChange(current: number, previous: number) {
	if (previous <= 0) return null;
	return ((current - previous) / previous) * 100;
}

function buildMomentum(rows: AnalyticsRow[], maxDate: string | null): Momentum | null {
	// Dataset exports cover different month ranges, so a blended
	// month-over-month delta would compare different dataset mixes. Only
	// datasets present in BOTH months are compared.
	const perDatasetMonth = new Map<
		string,
		Map<string, { revenue: number; orders: number; visitors: number }>
	>();
	for (const row of rows) {
		if (!row.periodStart) continue;
		const month = monthKey(row.periodStart);
		const datasetMonths = perDatasetMonth.get(row.datasetId) ?? new Map();
		const current = datasetMonths.get(month) ?? { revenue: 0, orders: 0, visitors: 0 };
		current.revenue += row.metrics.revenue;
		current.orders += row.metrics.orders;
		current.visitors += row.metrics.visitors;
		datasetMonths.set(month, current);
		perDatasetMonth.set(row.datasetId, datasetMonths);
	}

	const allMonths = [
		...new Set(
			[...perDatasetMonth.values()].flatMap((months) => [...months.keys()]),
		),
	].sort();
	const usableMonths = trimPartialTail(
		allMonths.map((period) => ({ period })),
		maxDate,
	).map((entry) => entry.period);
	if (usableMonths.length < 2) return null;

	const period = usableMonths[usableMonths.length - 1];
	const previousPeriod = usableMonths[usableMonths.length - 2];

	const current = { revenue: 0, orders: 0, visitors: 0 };
	const previous = { revenue: 0, orders: 0, visitors: 0 };
	let matchedDatasets = 0;
	for (const months of perDatasetMonth.values()) {
		const now = months.get(period);
		const before = months.get(previousPeriod);
		if (!now || !before) continue;
		matchedDatasets += 1;
		current.revenue += now.revenue;
		current.orders += now.orders;
		current.visitors += now.visitors;
		previous.revenue += before.revenue;
		previous.orders += before.orders;
		previous.visitors += before.visitors;
	}
	if (!matchedDatasets) return null;

	return {
		period,
		previousPeriod,
		revenue: percentChange(current.revenue, previous.revenue),
		orders: percentChange(current.orders, previous.orders),
		visitors: percentChange(current.visitors, previous.visitors),
	};
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
	const analyticsData = await loadAnalyticsData();
	const allRows = analyticsData.rows;
	const filteredRows = allRows.filter((row) => isWithinFilters(row, filters));

	// Income statements double-count the per-channel sales reports, so they
	// only join KPI math when the caller explicitly asks for that dataset.
	const explicitlyRequested = new Set([
		...(filters.datasetIds ?? []),
		...(filters.dataset ? [filters.dataset] : []),
	]);
	const blendRows = filteredRows.filter(
		(row) => !row.excludeFromBlend || explicitlyRequested.has(row.datasetId),
	);

	const datasets = buildDatasetSummaries(filteredRows);
	const blendDatasets = buildDatasetSummaries(blendRows);
	const datedRows = allRows.filter((row) => row.periodStart);
	const sortedDates = datedRows.map((row) => row.periodStart as string).sort();
	const revenue = sum(blendRows, "revenue");
	const orders = sum(blendRows, "orders");
	const visitors = sum(blendRows, "visitors");
	const cost = sum(blendRows, "cost");
	const csatValues = blendRows
		.filter((row) => "CSAT_Percent" in row.values)
		.map((row) => {
			const value = parseNumber(row.values.CSAT_Percent);
			return value > 0 && value <= 1 ? value * 100 : value;
		});
	const replyRateValues = blendRows
		.filter((row) => "Conversion_Rate_Chats_Responded" in row.values)
		.map((row) => parseNumber(row.values.Conversion_Rate_Chats_Responded) * 100);
	const revenueTrend = buildTrend(blendRows);

	const baseSummary = {
		filters: {
			dataset: filters.dataset ?? "all",
			datasetIds: filters.datasetIds ?? [],
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
		revenueTrend,
		momentum: buildMomentum(blendRows, sortedDates[sortedDates.length - 1] ?? null),
		channelBreakdown: buildBreakdown(blendDatasets),
		funnel: buildFunnel(blendRows),
		campaigns: buildCampaigns(blendDatasets),
		quality: {
			totalRows: filteredRows.length,
			sourceFiles: new Set(filteredRows.map((row) => row.sourceFile).filter(Boolean)).size,
			datasets: datasets.length,
			rowsWithoutDates: filteredRows.filter((row) => !row.periodStart).length,
			rowsWithoutSource: filteredRows.filter((row) => !row.sourceFile).length,
		},
		dataSource: analyticsData.source,
	};

	return {
		...baseSummary,
		insights: buildInsights(baseSummary),
	};
}
