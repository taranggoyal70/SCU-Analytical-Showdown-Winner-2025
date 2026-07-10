import {
	Activity,
	BarChart3,
	Bot,
	CheckCircle2,
	Database,
	Filter,
	LineChart,
	PackageSearch,
	RefreshCw,
	ShoppingCart,
	Sparkles,
	Users,
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
	formatDate,
	formatIdr,
	formatInteger,
	formatPercent,
} from "@/lib/format";

type PageProps = {
	searchParams: Promise<{
		dataset?: string;
		from?: string;
		to?: string;
	}>;
};

function metricNote(value: string | null, fallback = "Calculated from cleaned CSVs") {
	return value || fallback;
}

export default async function Home({ searchParams }: PageProps) {
	const params = await searchParams;
	const filters = {
		dataset: params.dataset === "all" ? undefined : params.dataset,
		from: params.from || undefined,
		to: params.to || undefined,
	};
	const [summary, allSummary] = await Promise.all([
		getDashboardSummary(filters),
		getDashboardSummary(),
	]);

	const selectedDataset = filters.dataset ?? "all";

	return (
		<main className="shell">
			<section className="hero">
				<div className="hero-card">
					<div className="eyebrow">
						<Sparkles size={16} />
						Nazava Intelligence OS
					</div>
					<h1 className="title">Shopee analytics, rebuilt as a real web app.</h1>
					<p className="subtitle">
						This is no longer a Streamlit dashboard. The web app reads the cleaned
						CSV dataset on the server, computes metrics on request, exposes a JSON
						summary API, and keeps filters in the URL so nothing relies on
						browser-only storage or hardcoded dashboard values.
					</p>
				</div>

				<div className="hero-aside">
					<div className="panel">
						<div className="panel-header">
							<div>
								<h2>Data contract</h2>
								<p className="muted">
									Source-backed, deployable, and auditable.
								</p>
							</div>
							<Database color="#38bdf8" />
						</div>
						<div className="quality-grid">
							<div className="quality-item">
								<strong>{summary.quality.datasets}</strong>
								<span className="muted">datasets</span>
							</div>
							<div className="quality-item">
								<strong>{summary.quality.sourceFiles}</strong>
								<span className="muted">source files</span>
							</div>
							<div className="quality-item">
								<strong>{summary.quality.totalRows}</strong>
								<span className="muted">rows loaded</span>
							</div>
							<div className="quality-item">
								<strong>{summary.quality.rowsWithoutDates}</strong>
								<span className="muted">rows missing dates</span>
							</div>
						</div>
					</div>

					<div className="panel">
						<div className="panel-header">
							<div>
								<h2>Current coverage</h2>
								<p className="muted">
									{formatDate(summary.dateRange.min)} →{" "}
									{formatDate(summary.dateRange.max)}
								</p>
							</div>
							<CheckCircle2 color="#22c55e" />
						</div>
						<p className="muted">
							Filters are server-side query parameters. Share the URL and the same
							audit view opens for everyone.
						</p>
					</div>
				</div>
			</section>

			<section className="panel">
				<div className="panel-header">
					<div>
						<h2>Filters</h2>
						<p className="muted">No client storage. The URL is the state.</p>
					</div>
					<Filter color="#a78bfa" />
				</div>
				<form className="filters">
					<label className="field">
						<span>Dataset</span>
						<select className="input" name="dataset" defaultValue={selectedDataset}>
							<option value="all">All datasets</option>
							{allSummary.datasets.map((dataset) => (
								<option key={dataset.id} value={dataset.id}>
									{dataset.label}
								</option>
							))}
						</select>
					</label>
					<label className="field">
						<span>From</span>
						<input
							className="input"
							type="date"
							name="from"
							defaultValue={filters.from ?? ""}
							min={summary.dateRange.min ?? undefined}
							max={summary.dateRange.max ?? undefined}
						/>
					</label>
					<label className="field">
						<span>To</span>
						<input
							className="input"
							type="date"
							name="to"
							defaultValue={filters.to ?? ""}
							min={summary.dateRange.min ?? undefined}
							max={summary.dateRange.max ?? undefined}
						/>
					</label>
					<button className="button" type="submit">
						Apply filters
					</button>
				</form>
			</section>

			<section className="kpi-grid">
				<div className="metric-card">
					<div className="metric-label">
						<Wallet size={16} />
						Tracked revenue
					</div>
					<div className="metric-value">{formatIdr(summary.kpis.revenue)}</div>
					<div className="metric-note">Computed from revenue columns.</div>
				</div>
				<div className="metric-card">
					<div className="metric-label">
						<ShoppingCart size={16} />
						Orders
					</div>
					<div className="metric-value">{formatInteger(summary.kpis.orders)}</div>
					<div className="metric-note">
						AOV {formatIdr(summary.kpis.averageOrderValue)}
					</div>
				</div>
				<div className="metric-card">
					<div className="metric-label">
						<Users size={16} />
						Visitors
					</div>
					<div className="metric-value">{formatCompact(summary.kpis.visitors)}</div>
					<div className="metric-note">
						Conversion {formatPercent(summary.kpis.conversionRate, 2)}
					</div>
				</div>
				<div className="metric-card">
					<div className="metric-label">
						<Activity size={16} />
						Customer signal
					</div>
					<div className="metric-value">
						{summary.kpis.csat ? formatPercent(summary.kpis.csat, 1) : "—"}
					</div>
					<div className="metric-note">
						{metricNote(
							summary.kpis.replyRate
								? `Reply rate ${formatPercent(summary.kpis.replyRate, 1)}`
								: null,
						)}
					</div>
				</div>
			</section>

			<section className="grid-two">
				<div className="panel">
					<div className="panel-header">
						<div>
							<h2>Revenue trend</h2>
							<p className="muted">Monthly rollup from parsed period dates.</p>
						</div>
						<LineChart color="#a78bfa" />
					</div>
					<RevenueTrendChart data={summary.revenueTrend} />
				</div>
				<div className="panel">
					<div className="panel-header">
						<div>
							<h2>Dataset mix</h2>
							<p className="muted">Top revenue-contributing datasets.</p>
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
							<h2>Conversion funnel</h2>
							<p className="muted">Built from visitor, product, cart, and order fields.</p>
						</div>
						<PackageSearch color="#22c55e" />
					</div>
					<FunnelPerformanceChart data={summary.funnel} />
				</div>
				<div className="panel">
					<div className="panel-header">
						<div>
							<h2>Campaign revenue</h2>
							<p className="muted">Campaign-like datasets ranked by tracked revenue.</p>
						</div>
						<RefreshCw color="#f59e0b" />
					</div>
					<CampaignRoiChart data={summary.campaigns} />
				</div>
			</section>

			<section className="grid-three">
				<div className="panel">
					<div className="panel-header">
						<div>
							<h2>Generated insights</h2>
							<p className="muted">Rules based on current filtered data.</p>
						</div>
						<Bot color="#a78bfa" />
					</div>
					<ul className="insight-list">
						{summary.insights.map((insight) => (
							<li key={insight}>{insight}</li>
						))}
					</ul>
				</div>

				<div className="panel" style={{ gridColumn: "span 2" }}>
					<div className="panel-header">
						<div>
							<h2>Dataset audit</h2>
							<p className="muted">
								Every row below is generated from files in data/cleaned.
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
				</div>
			</section>
		</main>
	);
}
