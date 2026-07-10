"use client";

import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Funnel,
	FunnelChart,
	LabelList,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { formatCompact, formatIdr } from "@/lib/format";

const palette = ["#38bdf8", "#8b5cf6", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6"];

type TrendPoint = {
	period: string;
	revenue: number;
	orders: number;
	visitors: number;
};

type BreakdownPoint = {
	name: string;
	revenue: number;
	orders: number;
	visitors: number;
};

type FunnelPoint = {
	stage: string;
	value: number;
};

type CampaignPoint = {
	name: string;
	revenue: number;
	cost: number;
	orders: number;
	roi: number;
};

function EmptyChart() {
	return (
		<div className="empty-chart">
			No chartable data exists for the current filter.
		</div>
	);
}

export function RevenueTrendChart({ data }: { data: TrendPoint[] }) {
	if (!data.length) return <EmptyChart />;

	return (
		<ResponsiveContainer width="100%" height={320}>
			<AreaChart data={data} margin={{ left: 0, right: 16, top: 10, bottom: 0 }}>
				<defs>
					<linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.55} />
						<stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.04} />
					</linearGradient>
				</defs>
				<CartesianGrid stroke="#1f2937" vertical={false} />
				<XAxis dataKey="period" stroke="#94a3b8" tickLine={false} axisLine={false} />
				<YAxis
					stroke="#94a3b8"
					tickLine={false}
					axisLine={false}
					tickFormatter={(value) => formatCompact(Number(value))}
				/>
				<Tooltip
					contentStyle={{
						background: "#020617",
						border: "1px solid rgba(148, 163, 184, 0.25)",
						borderRadius: 16,
					}}
					formatter={(value, name) =>
						name === "revenue" ? [formatIdr(Number(value)), "Revenue"] : [value, name]
					}
				/>
				<Area
					type="monotone"
					dataKey="revenue"
					stroke="#a78bfa"
					strokeWidth={3}
					fill="url(#revenueGradient)"
				/>
			</AreaChart>
		</ResponsiveContainer>
	);
}

export function ChannelBreakdownChart({ data }: { data: BreakdownPoint[] }) {
	if (!data.length) return <EmptyChart />;

	return (
		<ResponsiveContainer width="100%" height={320}>
			<PieChart>
				<Pie
					data={data}
					dataKey="revenue"
					nameKey="name"
					innerRadius={68}
					outerRadius={116}
					paddingAngle={3}
				>
					{data.map((entry, index) => (
						<Cell key={entry.name} fill={palette[index % palette.length]} />
					))}
				</Pie>
				<Tooltip
					contentStyle={{
						background: "#020617",
						border: "1px solid rgba(148, 163, 184, 0.25)",
						borderRadius: 16,
					}}
					formatter={(value) => formatIdr(Number(value))}
				/>
			</PieChart>
		</ResponsiveContainer>
	);
}

export function FunnelPerformanceChart({ data }: { data: FunnelPoint[] }) {
	if (!data.length) return <EmptyChart />;

	return (
		<ResponsiveContainer width="100%" height={320}>
			<FunnelChart>
				<Tooltip
					contentStyle={{
						background: "#020617",
						border: "1px solid rgba(148, 163, 184, 0.25)",
						borderRadius: 16,
					}}
					formatter={(value) => formatCompact(Number(value))}
				/>
				<Funnel dataKey="value" data={data} isAnimationActive>
					<LabelList dataKey="stage" position="right" fill="#e5e7eb" />
					{data.map((entry, index) => (
						<Cell key={entry.stage} fill={palette[index % palette.length]} />
					))}
				</Funnel>
			</FunnelChart>
		</ResponsiveContainer>
	);
}

export function CampaignRoiChart({ data }: { data: CampaignPoint[] }) {
	const chartData = data.filter((campaign) => campaign.revenue > 0).slice(0, 8);
	if (!chartData.length) return <EmptyChart />;

	return (
		<ResponsiveContainer width="100%" height={320}>
			<BarChart data={chartData} margin={{ left: 0, right: 16, top: 10, bottom: 0 }}>
				<CartesianGrid stroke="#1f2937" vertical={false} />
				<XAxis
					dataKey="name"
					stroke="#94a3b8"
					tickLine={false}
					axisLine={false}
					interval={0}
					angle={-18}
					textAnchor="end"
					height={76}
				/>
				<YAxis
					stroke="#94a3b8"
					tickLine={false}
					axisLine={false}
					tickFormatter={(value) => formatCompact(Number(value))}
				/>
				<Tooltip
					contentStyle={{
						background: "#020617",
						border: "1px solid rgba(148, 163, 184, 0.25)",
						borderRadius: 16,
					}}
					formatter={(value, name) =>
						name === "revenue" ? [formatIdr(Number(value)), "Revenue"] : [value, name]
					}
				/>
				<Bar dataKey="revenue" radius={[12, 12, 0, 0]}>
					{chartData.map((entry, index) => (
						<Cell key={entry.name} fill={palette[index % palette.length]} />
					))}
				</Bar>
			</BarChart>
		</ResponsiveContainer>
	);
}
