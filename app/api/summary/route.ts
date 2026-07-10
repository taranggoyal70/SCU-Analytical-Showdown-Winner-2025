import { NextResponse } from "next/server";
import { getDashboardSummary } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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
}
