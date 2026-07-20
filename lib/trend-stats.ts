/**
 * Summary statistics over a monthly revenue trend: peak/trough months, compound
 * monthly growth rate (CMGR), and average month-over-month growth. Pure and
 * side-effect free so it is trivial to test and safe to reuse anywhere.
 */

export type TrendPoint = { period: string; revenue: number };

export type TrendStats = {
	months: number;
	totalRevenue: number;
	peak: { period: string; revenue: number } | null;
	trough: { period: string; revenue: number } | null;
	/** Compound monthly growth rate, percent, first→last dated positive month. */
	cmgr: number | null;
	/** Mean of consecutive month-over-month percent changes. */
	averageMonthlyGrowth: number | null;
};

export function trendStats(points: TrendPoint[]): TrendStats {
	// Only dated months with positive revenue drive growth math; "Unknown"
	// buckets and empty months would produce meaningless rates.
	const dated = points
		.filter((p) => p.period && p.period !== "Unknown")
		.sort((a, b) => a.period.localeCompare(b.period));

	const totalRevenue = dated.reduce((sum, p) => sum + p.revenue, 0);

	let peak: TrendStats["peak"] = null;
	let trough: TrendStats["trough"] = null;
	for (const p of dated) {
		if (!peak || p.revenue > peak.revenue) peak = { period: p.period, revenue: p.revenue };
		if (!trough || p.revenue < trough.revenue) trough = { period: p.period, revenue: p.revenue };
	}

	const positive = dated.filter((p) => p.revenue > 0);
	let cmgr: number | null = null;
	if (positive.length >= 2) {
		const first = positive[0].revenue;
		const last = positive[positive.length - 1].revenue;
		const periods = positive.length - 1;
		cmgr = ((last / first) ** (1 / periods) - 1) * 100;
	}

	const changes: number[] = [];
	for (let i = 1; i < dated.length; i++) {
		const prev = dated[i - 1].revenue;
		if (prev > 0) changes.push(((dated[i].revenue - prev) / prev) * 100);
	}
	const averageMonthlyGrowth = changes.length
		? changes.reduce((sum, c) => sum + c, 0) / changes.length
		: null;

	return { months: dated.length, totalRevenue, peak, trough, cmgr, averageMonthlyGrowth };
}
