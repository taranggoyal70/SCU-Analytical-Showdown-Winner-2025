"use client";

import { useEffect, useRef, useState } from "react";
import {
	formatCompact,
	formatIdr,
	formatInteger,
	formatPercent,
} from "@/lib/format";

type NumberFormat = "idr" | "compact" | "integer" | "percent";

function render(value: number, format: NumberFormat, fractionDigits: number) {
	switch (format) {
		case "idr":
			return formatIdr(value);
		case "compact":
			return formatCompact(value, fractionDigits);
		case "percent":
			return formatPercent(value, fractionDigits);
		default:
			return formatInteger(value);
	}
}

export function AnimatedNumber({
	value,
	format = "integer",
	fractionDigits = 1,
	durationMs = 850,
}: {
	value: number;
	format?: NumberFormat;
	fractionDigits?: number;
	durationMs?: number;
}) {
	const [display, setDisplay] = useState(0);
	const frame = useRef<number | null>(null);

	useEffect(() => {
		const reduceMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (reduceMotion || !Number.isFinite(value)) {
			setDisplay(value);
			return;
		}

		const start = performance.now();
		const tick = (now: number) => {
			const progress = Math.min((now - start) / durationMs, 1);
			const eased = 1 - (1 - progress) ** 3;
			setDisplay(value * eased);
			if (progress < 1) frame.current = requestAnimationFrame(tick);
		};
		frame.current = requestAnimationFrame(tick);
		return () => {
			if (frame.current !== null) cancelAnimationFrame(frame.current);
		};
	}, [value, durationMs]);

	return <>{render(display, format, fractionDigits)}</>;
}

export function DeltaChip({
	delta,
	label,
}: {
	delta: number | null;
	label: string;
}) {
	if (delta === null || !Number.isFinite(delta)) return null;
	const direction = delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat";
	const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "◆";

	return (
		<span className={`delta-chip delta-${direction}`} title={label}>
			{arrow} {formatPercent(Math.abs(delta), 1)}
			<small>{label}</small>
		</span>
	);
}
