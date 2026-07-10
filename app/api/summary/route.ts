import { NextResponse } from "next/server";
import { getDashboardSummary } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

		return NextResponse.json(summary);
	} catch (error) {
		console.error("Summary API failed:", error);
		return NextResponse.json(
			{ error: "Failed to compute analytics summary. Please try again." },
			{ status: 500 },
		);
	}
}
