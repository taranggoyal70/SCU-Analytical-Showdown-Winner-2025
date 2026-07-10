export type ForecastPoint = {
	period: string;
	actual: number | null;
	forecast: number | null;
	band: [number, number] | null;
};

export type ForecastResult = {
	/** Historical points followed by projected points. */
	points: ForecastPoint[];
	ready: boolean;
	sampleMonths: number;
	nextPeriod: string | null;
	nextForecast: number;
	monthlySlope: number;
	/** Half-width of the ~95% band derived from fit residuals. */
	bandHalfWidth: number;
};

type TrendPoint = {
	period: string;
	revenue: number;
};

const MIN_SAMPLE_MONTHS = 4;

/**
 * Drop a trailing month that is only partially tracked (the newest tracked
 * date lands before the 25th). A near-empty final month would otherwise fake
 * a collapse in month-over-month deltas and drag trend fits down.
 */
export function trimPartialTail<T extends { period: string }>(
	trend: T[],
	maxDateIso: string | null,
): T[] {
	if (!maxDateIso) return trend;
	const day = Number(maxDateIso.slice(8, 10));
	if (!Number.isFinite(day) || day >= 25) return trend;
	const partialMonth = maxDateIso.slice(0, 7);
	return trend.filter((point) => point.period !== partialMonth);
}

function addMonths(period: string, count: number) {
	const [year, month] = period.split("-").map(Number);
	const date = new Date(Date.UTC(year, month - 1 + count, 1));
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Honest, fully in-runtime revenue projection: an ordinary least-squares
 * trend over the tracked monthly history, with a ~95% band built from the
 * fit residuals. No pre-trained artifacts, no invented accuracy claims —
 * every number is recomputed from the committed CSVs on request.
 */
export function buildRevenueForecast(
	trend: TrendPoint[],
	horizon = 3,
): ForecastResult {
	const history = trend
		.filter((point) => point.period !== "Unknown")
		.map((point) => ({ period: point.period, revenue: point.revenue }))
		.sort((a, b) => a.period.localeCompare(b.period));

	const empty: ForecastResult = {
		points: history.map((point) => ({
			period: point.period,
			actual: point.revenue,
			forecast: null,
			band: null,
		})),
		ready: false,
		sampleMonths: history.length,
		nextPeriod: null,
		nextForecast: 0,
		monthlySlope: 0,
		bandHalfWidth: 0,
	};

	if (history.length < MIN_SAMPLE_MONTHS) return empty;

	const n = history.length;
	const meanX = (n - 1) / 2;
	const meanY = history.reduce((total, point) => total + point.revenue, 0) / n;

	let covariance = 0;
	let variance = 0;
	for (let i = 0; i < n; i += 1) {
		covariance += (i - meanX) * (history[i].revenue - meanY);
		variance += (i - meanX) ** 2;
	}

	const slope = variance > 0 ? covariance / variance : 0;
	const intercept = meanY - slope * meanX;
	const fitted = (index: number) => intercept + slope * index;

	const residualVariance =
		history.reduce(
			(total, point, index) => total + (point.revenue - fitted(index)) ** 2,
			0,
		) / Math.max(n - 2, 1);
	const bandHalfWidth = 1.96 * Math.sqrt(residualVariance);

	const lastPeriod = history[n - 1].period;
	const points: ForecastPoint[] = history.map((point, index) => ({
		period: point.period,
		actual: point.revenue,
		// Connect the dashed projection to the last observed month.
		forecast: index === n - 1 ? point.revenue : null,
		band: null,
	}));

	for (let step = 1; step <= horizon; step += 1) {
		const projected = Math.max(fitted(n - 1 + step), 0);
		points.push({
			period: addMonths(lastPeriod, step),
			actual: null,
			forecast: projected,
			band: [Math.max(projected - bandHalfWidth, 0), projected + bandHalfWidth],
		});
	}

	return {
		points,
		ready: true,
		sampleMonths: n,
		nextPeriod: addMonths(lastPeriod, 1),
		nextForecast: Math.max(fitted(n), 0),
		monthlySlope: slope,
		bandHalfWidth,
	};
}
