export function formatCompact(value: number, maximumFractionDigits = 1) {
	return new Intl.NumberFormat("en", {
		notation: "compact",
		maximumFractionDigits,
	}).format(value || 0);
}

export function formatInteger(value: number) {
	return new Intl.NumberFormat("en", {
		maximumFractionDigits: 0,
	}).format(value || 0);
}

export function formatPercent(value: number, maximumFractionDigits = 1) {
	return `${new Intl.NumberFormat("en", {
		maximumFractionDigits,
	}).format(value || 0)}%`;
}

export function formatIdr(value: number) {
	return `IDR ${formatCompact(value || 0, 1)}`;
}

export function formatDate(value: string | null) {
	if (!value) return "Unknown";
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(value));
}
