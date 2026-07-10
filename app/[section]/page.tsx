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
	ForecastChart,
	FunnelPerformanceChart,
	RevenueTrendChart,
	Sparkline,
} from "@/components/charts";
import { getDashboardSummary } from "@/lib/analytics";
import { buildRevenueForecast, trimPartialTail } from "@/lib/forecast";
import {
	formatCompact,
	formatIdr,
	formatInteger,
} from "@/lib/format";
import { buildSectionDetail } from "@/lib/section-detail";
import { dashboardSections, getSection } from "@/lib/sections";

type SectionPageProps = {
	params: Promise<{ section: string }>;
	searchParams: Promise<{
		from?: string;
		to?: string;
	}>;
};

export const dynamic = "force-dynamic";

export function generateStaticParams() {
	return dashboardSections.map((section) => ({ section: section.slug }));
}

const metricIcons = [
	<Wallet size={16} key="wallet" />,
	<Target size={16} key="target" />,
	<Activity size={16} key="activity" />,
	<Database size={16} key="database" />,
];

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
	const detail = await buildSectionDetail(section, summary, allSummary, {
		from: query.from || undefined,
		to: query.to || undefined,
	});

	return (
		<main className="shell">
			<section className="section-hero">
				<div>
					<div className="eyebrow">{section.kicker}</div>
					<h1 className="title compact-title">{section.title}</h1>
					<p className="subtitle">{section.description}</p>
				</div>
				<div className="panel">
					<h2>What this page covers</h2>
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
				{detail.metrics.map((card, index) => (
					<div className="metric-card" key={card.label}>
						<div className="metric-label">
							{metricIcons[index] ?? <Activity size={16} />}
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
							<h2>{detail.chartTitle}</h2>
							<p className="muted">{detail.chartDescription}</p>
						</div>
						<LineChart color="#a78bfa" />
					</div>
					{detail.chartKind === "source" ? (
						<ChannelBreakdownChart data={summary.channelBreakdown} />
					) : detail.chartKind === "funnel" ? (
						<FunnelPerformanceChart data={summary.funnel} />
					) : detail.chartKind === "campaign" ? (
						<CampaignRoiChart data={summary.campaigns} />
					) : detail.chartKind === "forecast" ? (
						<ForecastChart
							data={
								buildRevenueForecast(
									trimPartialTail(summary.revenueTrend, summary.dateRange.max),
								).points
							}
						/>
					) : (
						<RevenueTrendChart data={summary.revenueTrend} />
					)}
				</div>
				<div className="panel">
					<div className="panel-header">
						<div>
							<h2>{detail.focusTitle}</h2>
							<p className="muted">{detail.focusDescription}</p>
						</div>
						<BarChart3 color="#38bdf8" />
					</div>
					<div className="detail-grid">
						{detail.focusRows.map((row) => (
							<div className="detail-card" key={`${row.label}-${row.value}`}>
								<span>{row.label}</span>
								<strong>{row.value}</strong>
								<small>{row.detail}</small>
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="grid-two">
				<div className="panel">
					<div className="panel-header">
						<div>
							<h2>
								{section.mode === "optimizer" || section.mode === "campaigns"
									? "ROI comparison"
									: "Conversion funnel"}
							</h2>
							<p className="muted">
								{section.mode === "optimizer" || section.mode === "campaigns"
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
							<h2>{detail.playbookTitle}</h2>
							<p className="muted">Section-specific next moves.</p>
						</div>
						<Bot color="#f59e0b" />
					</div>
					<ul className="insight-list">
						{detail.playbook.map((action) => (
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
							No hidden browser state; this table is generated from the active {summary.dataSource.kind === "blob" ? "Blob upload" : "bootstrap dataset"}.
						</p>
					</div>
					<div className="panel-actions">
						<a
							className="ghost-button"
							href={`/api/export${query.from || query.to ? `?${new URLSearchParams({ ...(query.from ? { from: query.from } : {}), ...(query.to ? { to: query.to } : {}) })}` : ""}`}
						>
							Export CSV
						</a>
						<Database color="#38bdf8" />
					</div>
				</div>
				<table className="dataset-table">
					<thead>
						<tr>
							<th>Dataset</th>
							<th className="spark-col">Trend</th>
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
								<td className="spark-col">
									<Sparkline data={dataset.sparkline} />
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
