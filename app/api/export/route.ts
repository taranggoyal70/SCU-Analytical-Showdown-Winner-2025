import { getDashboardSummary } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(value: string | number) {
	const raw = String(value);
	return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

export async function GET(request: Request) {
	try {
		const url = new URL(request.url);
		const dataset = url.searchParams.get("dataset") || undefined;
		const from = url.searchParams.get("from") || undefined;
		const to = url.searchParams.get("to") || undefined;

		const summary = await getDashboardSummary({
			dataset: dataset === "all" ? undefined : dataset,
			from,
			to,
		});

		const header = [
			"dataset",
			"category",
			"rows",
			"source_files",
			"revenue_idr",
			"orders",
			"visitors",
			"cost_idr",
			"rows_with_dates",
			"rows_without_dates",
		];
		const lines = [
			header.join(","),
			...summary.datasets.map((entry) =>
				[
					csvCell(entry.label),
					csvCell(entry.category),
					entry.rows,
					entry.sourceFiles,
					entry.revenue,
					entry.orders,
					entry.visitors,
					entry.cost,
					entry.dateCoverage.withDates,
					entry.dateCoverage.withoutDates,
				].join(","),
			),
		];

		return new Response(lines.join("\n"), {
			headers: {
				"Content-Type": "text/csv; charset=utf-8",
				"Content-Disposition": 'attachment; filename="nazava-dataset-audit.csv"',
			},
		});
	} catch (error) {
		console.error("Export API failed:", error);
		return new Response("Failed to build export.", { status: 500 });
	}
}
