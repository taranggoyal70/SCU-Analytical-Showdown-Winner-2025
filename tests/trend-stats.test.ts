import assert from "node:assert/strict";
import { test } from "node:test";

import { trendStats } from "../lib/trend-stats";

test("computes peak, trough, and total", () => {
	const s = trendStats([
		{ period: "2025-01", revenue: 100 },
		{ period: "2025-02", revenue: 300 },
		{ period: "2025-03", revenue: 200 },
	]);
	assert.equal(s.months, 3);
	assert.equal(s.totalRevenue, 600);
	assert.equal(s.peak?.period, "2025-02");
	assert.equal(s.trough?.period, "2025-01");
});

test("CMGR and average growth for a clean doubling", () => {
	const s = trendStats([
		{ period: "2025-01", revenue: 100 },
		{ period: "2025-02", revenue: 200 },
		{ period: "2025-03", revenue: 400 },
	]);
	assert.ok(Math.abs((s.cmgr ?? 0) - 100) < 1e-6);
	assert.ok(Math.abs((s.averageMonthlyGrowth ?? 0) - 100) < 1e-6);
});

test("ignores Unknown periods and refuses CMGR with one positive month", () => {
	const s = trendStats([
		{ period: "Unknown", revenue: 999 },
		{ period: "2025-01", revenue: 0 },
		{ period: "2025-02", revenue: 50 },
	]);
	assert.equal(s.months, 2);
	assert.equal(s.cmgr, null);
});

test("empty input is safe", () => {
	const s = trendStats([]);
	assert.equal(s.months, 0);
	assert.equal(s.peak, null);
	assert.equal(s.averageMonthlyGrowth, null);
});
