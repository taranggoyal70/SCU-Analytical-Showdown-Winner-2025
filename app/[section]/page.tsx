import { notFound } from "next/navigation";
import {
	Activity,
	BarChart3,
	Bot,
	Database,
	LineChart,
	PackageSearch,
	Target,
	Wallet,
} from "lucide-react";
import {
	CampaignRoiChart,
	ChannelBreakdownChart,
	FunnelPerformanceChart,
	RevenueTrendChart,
} from "@/components/charts";
import { getDashboardSummary } from "@/lib/analytics";
import {
	formatCompact,
	formatIdr,
	formatInteger,
	formatPercent,
} from "@/lib/format";
import { dashboardSections, getSection } from "@/lib/sections";

type SectionPageProps = {
	params: Promise<{ section: string }>;
	searchParams: Promise<{
		from?: string;
		to?: string;
	}>;
};

export function generateStaticParams() {
	return dashboardSections.map((section) => ({ section: section.slug }));
}

function metricCards(summary: Awaited<ReturnType<typeof getDashboardSummary>>) {
	return [
		{
			label: "Revenue",
			value: formatIdr(summary.kpis.revenue),
			note: "Source-backed tracked revenue",
			icon: <Wallet size={16} />,
		},
		{
			label: "Orders",
			value: formatInteger(summary.kpis.orders),
			note: `AOV ${formatIdr(summary.kpis.averageOrderValue)}`,
			icon: <Target size={16} />,
		},
		{
			label: "Visitors",
			value: formatCompact(summary.kpis.visitors),
			note: `Conversion ${formatPercent(summary.kpis.conversionRate, 2)}`,
			icon: <Activity size={16} />,
		},
		{
			label: "Data rows",
			value: formatInteger(summary.quality.totalRows),
			note: `${summary.quality.datasets} datasets / ${summary.quality.sourceFiles} files`,
			icon: <Database size={16} />,
		},
	];
}

function recommendationsFor(
	section: NonNullable<ReturnType<typeof getSection>>,
	summary: Awaited<ReturnType<typeof getDashboardSummary>>,
) {
	const topDataset = summary.datasets[0];
	const recommendations = [
		topDataset
			? `Prioritize ${topDataset.label}; it is the strongest measured contributor in this section.`
			: "Add more cleaned data to unlock stronger recommendations.",
		summary.kpis.conversionRate > 0
			? `Use the ${formatPercent(summary.kpis.conversionRate, 2)} conversion baseline as the guardrail for experiments.`
			: "Conversion cannot be trusted yet because the selected datasets lack enough visitor/order overlap.",
		summary.quality.rowsWithoutDates > 0
			? `${summary.quality.rowsWithoutDates} rows need better period metadata before this page can support clean period-over-period analysis.`
			: "Date coverage is sufficient for period-filtered analysis.",
	];

	if (section.mode === "optimizer") {
		const roiLeader = summary.campaigns.find((campaign) => campaign.roi > 0);
		recommendations.push(
			roiLeader
				? `Budget allocation should start with ${roiLeader.name}; it has the strongest measured ROI in this slice.`
				: "Cost fields are limited, so allocation should be treated as directional until campaign spend is complete.",
		);
	}

	if (section.mode === "model") {
		recommendations.push(
			"Model-style outputs are presented as baselines/readiness views unless a trained model artifact is wired into the web runtime.",
		);
	}

	return recommendations;
}

function forecastCard(summary: Awaited<ReturnType<typeof getDashboardSummary>>) {
	const known = summary.revenueTrend.filter((point) => point.period !== "Unknown");
	const recent = known.slice(-3);
	const monthlyAverage = recent.length
		? recent.reduce((total, point) => total + point.revenue, 0) / recent.length
		: 0;
	return {
		predicted30DayRevenue: monthlyAverage,
		basis: recent.map((point) => point.period).join(", ") || "No dated revenue",
	};
}

export default async function SectionPage({
	params,
	searchParams,
}: SectionPageProps) {
	const [{ section: slug }, query] = await Promise.all([params, searchParams]);
	const section = getSection(slug);
	if (!section) notFound();

	const [summary, allSummary] = await Promise.all([
		getDashboardSummary({
			datasetIds: section.datasetIds,
			from: query.from || undefined,
			to: query.to || undefined,
		}),
		getDashboardSummary({ datasetIds: section.datasetIds }),
	]);
	const forecast = forecastCard(summary);
	const cards = metricCards(summary);
	const actions = recommendationsFor(section, summary);

	return (
		<main className="shell">
			<section className="section-hero">
				<div>
					<div className="eyebrow">{section.kicker}</div>
					<h1 className="title compact-title">{section.title}</h1>
					<p className="subtitle">{section.description}</p>
				</div>
				<div className="panel">
					<h2>Restored from Streamlit scope</h2>
					<ul className="feature-list">
						{section.features.map((feature) => (
							<li key={feature}>{feature}</li>
						))}
					</ul>
				</div>
			</section>

			<section className="panel">
				<div className="panel-header">
					<div>
						<h2>Page filters</h2>
						<p className="muted">
							This page combines {section.datasetIds.length} source dataset
							{section.datasetIds.length === 1 ? "" : "s"}.
						</p>
					</div>
					<Database color="#38bdf8" />
				</div>
				<form className="filters">
					<label className="field">
						<span>From</span>
						<input
							className="input"
							type="date"
							name="from"
							defaultValue={query.from ?? ""}
							min={allSummary.dateRange.min ?? undefined}
							max={allSummary.dateRange.max ?? undefined}
						/>
					</label>
					<label className="field">
						<span>To</span>
						<input
							className="input"
							type="date"
							name="to"
							defaultValue={query.to ?? ""}
							min={allSummary.dateRange.min ?? undefined}
							max={allSummary.dateRange.max ?? undefined}
						/>
					</label>
					<button className="button" type="submit">
						Apply date filter
					</button>
				</form>
			</section>

			<section className="kpi-grid">
				{cards.map((card) => (
					<div className="metric-card" key={card.label}>
						<div className="metric-label">
							{card.icon}
							{card.label}
						</div>
						<div className="metric-value">{card.value}</div>
						<div className="metric-note">{card.note}</div>
					</div>
				))}
			</section>

			<section className="grid-two">
				<div className="panel">
					<div className="panel-header">
						<div>
							<h2>Trend</h2>
							<p className="muted">Monthly rollup for this section.</p>
						</div>
						<LineChart color="#a78bfa" />
					</div>
					<RevenueTrendChart data={summary.revenueTrend} />
				</div>
				<div className="panel">
					<div className="panel-header">
						<div>
							<h2>Source mix</h2>
							<p className="muted">Contribution by source dataset.</p>
						</div>
						<BarChart3 color="#38bdf8" />
					</div>
					<ChannelBreakdownChart data={summary.channelBreakdown} />
				</div>
			</section>

			<section className="grid-two">
				<div className="panel">
					<div className="panel-header">
						<div>
							<h2>
								{section.mode === "optimizer"
									? "ROI comparison"
									: "Conversion funnel"}
							</h2>
							<p className="muted">
								{section.mode === "optimizer"
									? "Campaign return view where cost exists."
									: "Available visitor/product/cart/order stages."}
							</p>
						</div>
						<PackageSearch color="#22c55e" />
					</div>
					{section.mode === "optimizer" || section.mode === "campaigns" ? (
						<CampaignRoiChart data={summary.campaigns} />
					) : (
						<FunnelPerformanceChart data={summary.funnel} />
					)}
				</div>

				<div className="panel">
					<div className="panel-header">
						<div>
							<h2>
								{section.mode === "model" ? "Model baseline" : "Action plan"}
							</h2>
							<p className="muted">
								Recommendations generated from the selected source data.
							</p>
						</div>
						<Bot color="#f59e0b" />
					</div>
					{section.mode === "model" && (
						<div className="model-card">
							<span className="muted">30-day revenue baseline</span>
							<strong>{formatIdr(forecast.predicted30DayRevenue)}</strong>
							<small>Basis periods: {forecast.basis}</small>
						</div>
					)}
					<ul className="insight-list">
						{actions.map((action) => (
							<li key={action}>{action}</li>
						))}
					</ul>
				</div>
			</section>

			<section className="panel">
				<div className="panel-header">
					<div>
						<h2>Source audit</h2>
						<p className="muted">
							No hidden local state; this table is generated from committed CSVs.
						</p>
					</div>
					<Database color="#38bdf8" />
				</div>
				<table className="dataset-table">
					<thead>
						<tr>
							<th>Dataset</th>
							<th>Rows</th>
							<th>Sources</th>
							<th>Orders</th>
							<th>Revenue</th>
						</tr>
					</thead>
					<tbody>
						{summary.datasets.map((dataset) => (
							<tr key={dataset.id}>
								<td>
									<strong>{dataset.label}</strong>
									<br />
									<span className="muted">
										{dataset.dateCoverage.withDates} dated /{" "}
										{dataset.dateCoverage.withoutDates} undated
									</span>
								</td>
								<td>{formatInteger(dataset.rows)}</td>
								<td>{formatInteger(dataset.sourceFiles)}</td>
								<td>{formatInteger(dataset.orders)}</td>
								<td>{formatIdr(dataset.revenue)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</section>
		</main>
	);
}
