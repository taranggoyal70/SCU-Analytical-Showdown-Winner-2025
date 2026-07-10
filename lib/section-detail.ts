import {
	type AnalyticsRow,
	type DashboardSummary,
	loadAnalyticsRows,
} from "@/lib/analytics";
import {
	formatCompact,
	formatIdr,
	formatInteger,
	formatPercent,
} from "@/lib/format";
import type { DashboardSection } from "@/lib/sections";

type DetailFilters = {
	from?: string;
	to?: string;
};

export type SectionMetric = {
	label: string;
	value: string;
	note: string;
};

export type SectionDetail = {
	metrics: SectionMetric[];
	focusTitle: string;
	focusDescription: string;
	focusRows: Array<{
		label: string;
		value: string;
		detail: string;
	}>;
	playbookTitle: string;
	playbook: string[];
	chartTitle: string;
	chartDescription: string;
	chartKind: "trend" | "source" | "funnel" | "campaign";
};

function numberValue(value: unknown) {
	const raw = String(value ?? "").trim();
	if (!raw || raw.toLowerCase() === "nan") return 0;
	const normalized =
		raw.includes(",") && !raw.includes(".")
			? raw.replace(",", ".")
			: raw.replace(/,/g, "");
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : 0;
}

function percentFromRatio(value: number) {
	return formatPercent(value <= 1 ? value * 100 : value, 1);
}

function sumColumns(rows: AnalyticsRow[], columns: string[]) {
	return rows.reduce((total, row) => {
		for (const column of columns) {
			if (column in row.values && String(row.values[column]).trim()) {
				return total + numberValue(row.values[column]);
			}
		}
		return total;
	}, 0);
}

function averageColumn(rows: AnalyticsRow[], column: string) {
	const values = rows
		.map((row) => numberValue(row.values[column]))
		.filter((value) => value > 0);
	if (!values.length) return 0;
	return values.reduce((total, value) => total + value, 0) / values.length;
}

function rowsForSection(
	rows: AnalyticsRow[],
	section: DashboardSection,
	filters: DetailFilters,
) {
	return rows.filter((row) => {
		if (!section.datasetIds.includes(row.datasetId)) return false;
		if (!filters.from && !filters.to) return true;
		if (!row.periodStart) return false;
		if (filters.from && row.periodStart < filters.from) return false;
		if (filters.to && row.periodStart > filters.to) return false;
		return true;
	});
}

function commonRows(summary: DashboardSummary) {
	const top = summary.datasets[0];
	return [
		{
			label: "Top source",
			value: top?.label ?? "No source",
			detail: top ? `${formatIdr(top.revenue)} tracked revenue` : "No rows matched.",
		},
		{
			label: "Date quality",
			value: `${summary.quality.rowsWithoutDates} undated`,
			detail: "Undated rows are excluded from date-filtered comparisons.",
		},
	];
}

export async function buildSectionDetail(
	section: DashboardSection,
	summary: DashboardSummary,
	allSummary: DashboardSummary,
	filters: DetailFilters,
): Promise<SectionDetail> {
	const allRows = await loadAnalyticsRows();
	const rows = rowsForSection(allRows, section, filters);
	const basePlaybook = [
		"Use the source audit before making decisions; rows without reliable dates should not drive period comparisons.",
		"Treat any model-style output as a baseline until a trained model artifact is connected to the runtime.",
	];

	const revenue = summary.kpis.revenue;
	const orders = summary.kpis.orders;
	const visitors = summary.kpis.visitors;
	const cost = summary.kpis.cost;
	const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;
	const aov = summary.kpis.averageOrderValue;

	switch (section.slug) {
		case "traffic": {
			const newVisitors = sumColumns(rows, ["New_Visitors"]);
			const returningVisitors = sumColumns(rows, ["Returning_Visitors"]);
			const productViews = sumColumns(rows, [
				"Products_Viewed",
				"Product Page Views",
				"Number_Of_Products_Viewed",
			]);
			const followers = sumColumns(rows, ["New_Followers"]);
			return {
				metrics: [
					{ label: "Visitors", value: formatCompact(visitors), note: "Total tracked traffic" },
					{ label: "New visitors", value: formatCompact(newVisitors), note: "Acquisition signal" },
					{ label: "Returning", value: formatCompact(returningVisitors), note: "Retention signal" },
					{ label: "New followers", value: formatInteger(followers), note: "Audience capture" },
				],
				focusTitle: "Traffic diagnostics",
				focusDescription: "Not sales-first — this page focuses on acquisition and engagement.",
				focusRows: [
					{ label: "Product views", value: formatCompact(productViews), detail: "Views and products viewed across traffic/product datasets." },
					{ label: "Avg time spent", value: `${averageColumn(rows, "Average_Time_Spent").toFixed(2)} min`, detail: "Average from traffic overview rows." },
					{ label: "External orders", value: formatInteger(sumColumns(rows, ["Orders"])), detail: "Orders attributed to off-platform rows." },
					...commonRows(summary),
				],
				playbookTitle: "Traffic playbook",
				playbook: [
					"Separate acquisition campaigns from retention campaigns; new and returning visitor behavior should not be judged by one blended KPI.",
					"Prioritize off-platform channels that produce both cart adds and orders, not visits alone.",
					"Use follower growth as the soft-conversion metric when direct orders are delayed.",
				],
				chartTitle: "Visitor trend",
				chartDescription: "The main chart emphasizes traffic movement over revenue.",
				chartKind: "trend",
			};
		}
		case "sales":
		case "paylater": {
			const voucherSales = sumColumns(rows, ["Sales_Ready_To_Ship_IDR"]);
			const serviceFees = sumColumns(rows, ["Service_Fee", "service fee.1", "Biaya Layanan yang Dikenakan (Pesanan Siap Dikirim)"]);
			return {
				metrics: [
					{ label: "Revenue", value: formatIdr(revenue), note: "Sales fields only" },
					{ label: "Orders", value: formatInteger(orders), note: "Created/ready/order fields" },
					{ label: "AOV", value: formatIdr(aov), note: "Revenue divided by orders" },
					{ label: "Fees / cost", value: formatIdr(cost || serviceFees), note: "Measured fee/cost fields" },
				],
				focusTitle: section.slug === "paylater" ? "PayLater unit economics" : "Sales channel detail",
				focusDescription: "Revenue page prioritizes sales mix, order economics, and measured fees.",
				focusRows: [
					{ label: "Ready-to-ship sales", value: formatIdr(voucherSales), detail: "Primary fulfillment-backed sales signal where available." },
					{ label: "Order conversion", value: formatPercent(summary.kpis.conversionRate, 2), detail: "Orders divided by tracked visitors." },
					{ label: "Service fees", value: formatIdr(serviceFees), detail: "PayLater/service fee fields where available." },
					...commonRows(summary),
				],
				playbookTitle: "Sales playbook",
				playbook: [
					"Use ready-to-ship sales as the cleaner revenue signal when both created and shipped fields exist.",
					"Investigate high revenue sources with weak order counts; they may reflect large AOV rather than repeatability.",
					"Treat PayLater separately because fees and tenor mix change margin quality.",
				],
				chartTitle: "Revenue source mix",
				chartDescription: "Sales pages prioritize channel/source contribution over generic funnels.",
				chartKind: "source",
			};
		}
		case "campaigns":
		case "campaign-optimizer":
		case "spend-optimizer": {
			const bestCampaign = summary.campaigns.find((campaign) => campaign.roi > 0);
			return {
				metrics: [
					{ label: "Campaign revenue", value: formatIdr(revenue), note: "Promotion-linked datasets" },
					{ label: "Measured cost", value: formatIdr(cost), note: "Only explicit cost fields" },
					{ label: "ROI", value: cost ? formatPercent(roi, 1) : "Needs cost", note: "Revenue minus cost over cost" },
					{ label: "Campaign orders", value: formatInteger(orders), note: "Orders across campaign rows" },
				],
				focusTitle: "Campaign allocation board",
				focusDescription: "This is now an ROI and budget page, not the same sales dashboard.",
				focusRows: [
					{ label: "Best measured ROI", value: bestCampaign?.name ?? "Insufficient cost data", detail: bestCampaign ? formatPercent(bestCampaign.roi, 1) : "Add explicit spend/cost fields to rank ROI confidently." },
					{ label: "Campaign count", value: formatInteger(summary.campaigns.length), detail: "Promotion-like source datasets in this page." },
					{ label: "Cost coverage", value: cost > 0 ? "Available" : "Limited", detail: "ROI is only trusted where cost fields exist." },
					...commonRows(summary),
				],
				playbookTitle: "Campaign optimization playbook",
				playbook: [
					"Allocate budget first to campaigns with measured cost and positive ROI, not highest revenue alone.",
					"Separate vouchers from flash/live/game campaigns because they create different margin profiles.",
					"Before automating spend, add complete cost fields for every campaign row.",
				],
				chartTitle: "Campaign ROI comparison",
				chartDescription: "This page uses campaign bars instead of a generic funnel.",
				chartKind: "campaign",
			};
		}
		case "customer-service":
		case "mass-chat": {
			const chats = sumColumns(rows, ["Number_Of_Chats"]);
			const replied = sumColumns(rows, ["Chats_Replied"]);
			const recipients = sumColumns(rows, ["Actual_Recipients"]);
			const reads = sumColumns(rows, ["Recipients_Read"]);
			const clicks = sumColumns(rows, ["Recipients_Clicked"]);
			const replyRate = chats > 0 ? (replied / chats) * 100 : summary.kpis.replyRate ?? 0;
			const readRate = recipients > 0 ? (reads / recipients) * 100 : 0;
			return {
				metrics: [
					{ label: "Chats", value: formatInteger(chats || recipients), note: section.slug === "mass-chat" ? "Broadcast recipients" : "Inbound chat volume" },
					{ label: "Reply/read rate", value: formatPercent(section.slug === "mass-chat" ? readRate : replyRate, 1), note: "Engagement quality" },
					{ label: "CSAT", value: summary.kpis.csat ? formatPercent(summary.kpis.csat, 1) : "—", note: "Customer satisfaction" },
					{ label: "Chat revenue", value: formatIdr(revenue), note: "Sales linked to chat rows" },
				],
				focusTitle: section.slug === "mass-chat" ? "Broadcast funnel" : "Support performance",
				focusDescription: "Support pages track service responsiveness and chat-driven conversion.",
				focusRows: [
					{ label: "Recipients read", value: formatInteger(reads), detail: recipients ? `${formatPercent(readRate, 1)} of recipients` : "Broadcast recipient data only." },
					{ label: "Recipients clicked", value: formatInteger(clicks), detail: "Click engagement from mass chat data." },
					{ label: "Average response", value: `${averageColumn(rows, "Average_Response_Time").toFixed(1)} min`, detail: "Average response time from chat rows." },
					...commonRows(summary),
				],
				playbookTitle: "Service playbook",
				playbook: [
					"Track response speed and CSAT together; fast replies without satisfaction can hide quality problems.",
					"Mass broadcast quality should be judged by read → click → order, not recipients alone.",
					"Use chat-to-sales rows to decide which support workflows deserve automation.",
				],
				chartTitle: "Chat and broadcast funnel",
				chartDescription: "Support-specific funnel from recipients/chats to orders.",
				chartKind: "funnel",
			};
		}
		case "products":
		case "recommendations": {
			const productVisits = sumColumns(rows, ["Product Visitors (Visits)"]);
			const pageViews = sumColumns(rows, ["Product Page Views"]);
			const cartAdds = sumColumns(rows, ["Product Visitors (Added to Cart)", "Products_Added_To_Cart"]);
			const productsOrdered = sumColumns(rows, ["Products Ordered", "Products Ready to Ship"]);
			const cartRate = productVisits > 0 ? (cartAdds / productVisits) * 100 : 0;
			return {
				metrics: [
					{ label: "Product visits", value: formatCompact(productVisits), note: "Catalog demand" },
					{ label: "Page views", value: formatCompact(pageViews), note: "Browsing depth" },
					{ label: "Cart adds", value: formatCompact(cartAdds), note: `${formatPercent(cartRate, 1)} visit-to-cart` },
					{ label: "Products ordered", value: formatInteger(productsOrdered), note: "Purchase signal" },
				],
				focusTitle: "Product opportunity map",
				focusDescription: "Product pages should diagnose funnel drop-off and merchandising opportunities.",
				focusRows: [
					{ label: "Visit → cart", value: formatPercent(cartRate, 1), detail: "Product visitors added to cart divided by product visits." },
					{ label: "Revenue per visit", value: productVisits ? formatIdr(revenue / productVisits) : "—", detail: "Useful pricing and merchandising signal." },
					{ label: "Views per visitor", value: productVisits ? (pageViews / productVisits).toFixed(2) : "—", detail: "Catalog exploration depth." },
					...commonRows(summary),
				],
				playbookTitle: "Product playbook",
				playbook: [
					"Prioritize products with high views but weak cart conversion for listing/content fixes.",
					"Use revenue per visit to find premium products that deserve traffic.",
					"Recommendations should be product-level once SKU-level exports are added.",
				],
				chartTitle: "Product funnel",
				chartDescription: "This page focuses on catalog conversion, not generic revenue.",
				chartKind: "funnel",
			};
		}
		case "forecast":
		case "segments":
		case "adaptive-learning": {
			const datedRows = summary.quality.totalRows - summary.quality.rowsWithoutDates;
			const readiness = summary.quality.totalRows
				? Math.round((datedRows / summary.quality.totalRows) * 100)
				: 0;
			const recent = summary.revenueTrend
				.filter((point) => point.period !== "Unknown")
				.slice(-3);
			const baseline = recent.length
				? recent.reduce((total, point) => total + point.revenue, 0) / recent.length
				: 0;
			return {
				metrics: [
					{ label: "Readiness", value: formatPercent(readiness, 0), note: "Rows with usable dates" },
					{ label: "30-day baseline", value: formatIdr(baseline), note: "Recent monthly average" },
					{ label: "Training rows", value: formatInteger(summary.quality.totalRows), note: "Available section rows" },
					{ label: "Feature sources", value: formatInteger(summary.quality.datasets), note: "Datasets feeding view" },
				],
				focusTitle: "Model readiness",
				focusDescription: "These pages preserve the AI/ML feature area without pretending the web runtime retrained models.",
				focusRows: [
					{ label: "Dated rows", value: formatInteger(datedRows), detail: "Rows available for time-series validation." },
					{ label: "Recent basis", value: recent.map((point) => point.period).join(", ") || "None", detail: "Periods used for lightweight baseline." },
					{ label: "Customer IDs", value: "Not available", detail: "Segmentation is cohort-style until customer-level IDs are provided." },
					...commonRows(summary),
				],
				playbookTitle: "Modeling playbook",
				playbook: [
					"Wire a saved model artifact before claiming XGBoost/Prophet predictions in production.",
					"Add customer/SKU identifiers to graduate from cohort summaries to true segmentation and recommendations.",
					"Use the baseline forecast as a sanity check, not as an automated buying/spend decision.",
					...basePlaybook,
				],
				chartTitle: "Model input trend",
				chartDescription: "Historical signal available to forecasting/readiness pages.",
				chartKind: "trend",
			};
		}
		case "automation": {
			return {
				metrics: [
					{ label: "Action candidates", value: formatInteger(summary.insights.length + summary.datasets.length), note: "Generated from source data" },
					{ label: "API endpoints", value: "10", note: "Backend-compatible routes documented" },
					{ label: "Rows monitored", value: formatInteger(summary.quality.totalRows), note: "Automation input scope" },
					{ label: "Manual approval", value: "Required", note: "No fake Shopee writes" },
				],
				focusTitle: "Automation command center",
				focusDescription: "This page is intentionally about readiness and suggested actions, not fake execution logs.",
				focusRows: [
					{ label: "Suggested campaign action", value: summary.campaigns[0]?.name ?? "Needs data", detail: "Based on highest campaign revenue/ROI signal." },
					{ label: "Suggested product action", value: summary.datasets[0]?.label ?? "Needs data", detail: "Prioritize the strongest source signal for review." },
					{ label: "Execution safety", value: "Human-in-loop", detail: "External Shopee actions should require API credentials and approval." },
					...commonRows(summary),
				],
				playbookTitle: "Automation playbook",
				playbook: [
					"Keep recommendations and execution separate until Shopee API credentials/scopes are connected.",
					"Log every automated recommendation with source rows, confidence, and expected impact.",
					"Require approval before messages, vouchers, price updates, or campaign spend changes.",
				],
				chartTitle: "Automation source mix",
				chartDescription: "Inputs feeding automation recommendations.",
				chartKind: "source",
			};
		}
		case "off-platform": {
			const visits = sumColumns(rows, ["Visits"]);
			const carts = sumColumns(rows, ["Users_Added_To_Cart"]);
			const buyers = sumColumns(rows, ["Total_Buyers", "New_Buyers"]);
			const cartRate = visits ? (carts / visits) * 100 : 0;
			return {
				metrics: [
					{ label: "Visits", value: formatCompact(visits), note: "External traffic visits" },
					{ label: "Cart users", value: formatCompact(carts), note: `${formatPercent(cartRate, 1)} visit-to-cart` },
					{ label: "Buyers", value: formatInteger(buyers), note: "Tracked off-platform buyers" },
					{ label: "Sales", value: formatIdr(revenue), note: "External channel revenue" },
				],
				focusTitle: "External channel detail",
				focusDescription: "Off-platform is about traffic quality, not just top-line revenue.",
				focusRows: [
					{ label: "Visit → cart", value: formatPercent(cartRate, 1), detail: "Cart users divided by visits." },
					{ label: "Cart → order", value: carts ? formatPercent((orders / carts) * 100, 1) : "—", detail: "Orders divided by cart users." },
					{ label: "Sales per visit", value: visits ? formatIdr(revenue / visits) : "—", detail: "External channel monetization." },
					...commonRows(summary),
				],
				playbookTitle: "Off-platform playbook",
				playbook: [
					"Scale external channels that create carts and orders, not just cheap visits.",
					"Segment creative by platform/channel because blended off-platform averages hide winners.",
					"Investigate high cart value with low orders as a checkout/offer mismatch.",
				],
				chartTitle: "Off-platform source mix",
				chartDescription: "External source/channel contribution.",
				chartKind: "source",
			};
		}
		case "income": {
			const statements = [...rows].sort((a, b) =>
				(b.periodEnd ?? "").localeCompare(a.periodEnd ?? ""),
			);
			const latest = statements[0];
			const latestIncome = latest ? latest.metrics.revenue : 0;
			const latestExpenses = latest ? latest.metrics.cost : 0;
			return {
				metrics: [
					{ label: "Statements", value: formatInteger(statements.length), note: "Parsed income reports" },
					{ label: "Latest income", value: formatIdr(latestIncome), note: latest?.values.Statement_Period ?? "No statements" },
					{ label: "Latest expenses", value: formatIdr(latestExpenses), note: "Total expenses in latest statement" },
					{ label: "Latest net", value: formatIdr(latestIncome - latestExpenses), note: "Income minus expenses" },
				],
				focusTitle: "Statement ledger",
				focusDescription:
					"Each row is one official Shopee income report. Periods can overlap (e.g. an annual export next to monthly exports), so statements are shown individually instead of blindly summed.",
				focusRows: [
					...statements.slice(0, 4).map((statement) => ({
						label: statement.values.Statement_Period,
						value: formatIdr(
							numberValue(statement.values.Statement_Net_IDR),
						),
						detail: `Income ${formatIdr(statement.metrics.revenue)} · expenses ${formatIdr(statement.metrics.cost)}`,
					})),
					...commonRows(summary),
				],
				playbookTitle: "Finance playbook",
				playbook: [
					"Reconcile channel sales dashboards against these official statements before reporting revenue externally.",
					"Watch the expense share per statement; fee and shipping subsidy changes show up here first.",
					"Statement windows overlap across exports — compare same-length periods only.",
				],
				chartTitle: "Statement income trend",
				chartDescription: "Official income by statement period.",
				chartKind: "trend",
			};
		}
		case "comparison": {
			const totalRevenue = allSummary.kpis.revenue || 0;
			const share = totalRevenue ? (revenue / totalRevenue) * 100 : 0;
			return {
				metrics: [
					{ label: "Filtered revenue", value: formatIdr(revenue), note: `${formatPercent(share, 1)} of available section revenue` },
					{ label: "Filtered orders", value: formatInteger(orders), note: "Current URL filter" },
					{ label: "All-section revenue", value: formatIdr(totalRevenue), note: "Unfiltered comparison base" },
					{ label: "Rows selected", value: formatInteger(summary.quality.totalRows), note: "Rows in current period" },
				],
				focusTitle: "Period comparison detail",
				focusDescription: "This page compares the current URL filter against total available section history.",
				focusRows: [
					{ label: "Revenue share", value: formatPercent(share, 1), detail: "Current filter divided by all available section revenue." },
					{ label: "Rows selected", value: `${summary.quality.totalRows} / ${allSummary.quality.totalRows}`, detail: "Filtered rows versus full section rows." },
					{ label: "Date gaps", value: formatInteger(summary.quality.rowsWithoutDates), detail: "Rows that cannot be included in period windows." },
					...commonRows(summary),
				],
				playbookTitle: "Comparison playbook",
				playbook: [
					"Always set date filters before using this page for decision-making.",
					"Do not compare pages with many undated rows against pages with clean daily dates.",
					"Use comparison output as a narrative layer for weekly/monthly business reviews.",
				],
				chartTitle: "Period revenue trend",
				chartDescription: "Filtered section trend for comparison.",
				chartKind: "trend",
			};
		}
		default:
			return {
				metrics: [
					{ label: "Revenue", value: formatIdr(revenue), note: "Tracked revenue" },
					{ label: "Orders", value: formatInteger(orders), note: "Tracked orders" },
					{ label: "Visitors", value: formatCompact(visitors), note: "Tracked visitors" },
					{ label: "Rows", value: formatInteger(summary.quality.totalRows), note: "Source rows" },
				],
				focusTitle: "Section detail",
				focusDescription: "Source-backed detail for this page.",
				focusRows: commonRows(summary),
				playbookTitle: "Playbook",
				playbook: basePlaybook,
				chartTitle: "Trend",
				chartDescription: "Section trend.",
				chartKind: "trend",
			};
	}
}
