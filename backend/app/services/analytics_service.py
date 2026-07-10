"""CSV-backed analytics service used by the optional FastAPI backend."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

import pandas as pd

from app.core.config import settings


METRIC_COLUMNS = {
    "revenue": [
        "Sales_Ready_To_Ship_IDR",
        "Sales_IDR",
        "Total Sales (Orders Created) (IDR)",
        "Sales (Orders Ready to Ship) (IDR)",
        "Sales_Orders_Created_IDR",
        "Value_Products_Added_To_Cart_IDR",
    ],
    "orders": [
        "Orders_Ready_To_Ship",
        "Total_Orders",
        "Orders",
        "Orders_Created",
        "Orders_COD_Created_Plus_NonCOD_Paid",
        "Total Buyers (Orders Ready to Ship)",
        "Total Buyers (Orders Created)",
    ],
    "visitors": [
        "Total_Visitors",
        "Visitors",
        "Visits",
        "Product Visitors (Visits)",
        "New_Visitors",
        "Returning_Visitors",
        "Products_Viewed",
        "Number_Of_Products_Viewed",
    ],
    "cost": [
        "Total_Cost_Ready_To_Ship_IDR",
        "Total_Cost_Orders_Created_IDR",
        "Prize_Cost_Ready_To_Ship_IDR",
        "Prize_Cost_Orders_Created_IDR",
        "Service_Fee",
        "service fee.1",
        "Biaya Layanan yang Dikenakan (Pesanan Siap Dikirim)",
        "Biaya Layanan yang Dikenakan (Pesanan Dibuat)",
    ],
}


@dataclass
class AnalyticsRow:
    dataset_id: str
    dataset_label: str
    category: str
    source_file: str
    period_start: str | None
    period_end: str | None
    values: dict[str, Any]
    metrics: dict[str, float]


class AnalyticsService:
    """Loads committed cleaned CSVs and computes dashboard/API metrics."""

    def __init__(self, data_path: str | None = None):
        self.data_path = Path(data_path or settings.DATA_PATH)
        self._rows: list[AnalyticsRow] | None = None

    def load_rows(self) -> list[AnalyticsRow]:
        if self._rows is not None:
            return self._rows

        if not self.data_path.exists():
            raise FileNotFoundError(f"Data directory not found: {self.data_path}")

        rows: list[AnalyticsRow] = []
        for csv_file in sorted(self.data_path.glob("*.csv")):
            rows.extend(self._read_dataset(csv_file))

        self._rows = rows
        return rows

    def summary(
        self,
        dataset: str | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
    ) -> dict[str, Any]:
        rows = [
            row
            for row in self.load_rows()
            if self._matches_filter(row, dataset, from_date, to_date)
        ]
        datasets = self.dataset_summaries(rows)
        revenue = self._sum(rows, "revenue")
        orders = self._sum(rows, "orders")
        visitors = self._sum(rows, "visitors")
        cost = self._sum(rows, "cost")
        source_files = {row.source_file for row in rows if row.source_file}
        dated = sorted(row.period_start for row in self.load_rows() if row.period_start)

        base = {
            "filters": {
                "dataset": dataset or "all",
                "from": from_date or "",
                "to": to_date or "",
            },
            "dateRange": {
                "min": dated[0] if dated else None,
                "max": dated[-1] if dated else None,
            },
            "kpis": {
                "revenue": revenue,
                "orders": orders,
                "visitors": visitors,
                "cost": cost,
                "conversionRate": (orders / visitors * 100) if visitors else 0,
                "averageOrderValue": (revenue / orders) if orders else 0,
                "csat": self._average_csat(rows),
                "replyRate": self._average_column_percent(
                    rows, "Conversion_Rate_Chats_Responded"
                ),
            },
            "datasets": datasets,
            "revenueTrend": self.revenue_trend(rows),
            "channelBreakdown": [
                {
                    "name": item["label"],
                    "revenue": item["revenue"],
                    "orders": item["orders"],
                    "visitors": item["visitors"],
                }
                for item in datasets[:8]
            ],
            "funnel": self.funnel(rows),
            "campaigns": self.campaigns(datasets),
            "quality": {
                "totalRows": len(rows),
                "sourceFiles": len(source_files),
                "datasets": len(datasets),
                "rowsWithoutDates": len([row for row in rows if not row.period_start]),
                "rowsWithoutSource": len([row for row in rows if not row.source_file]),
            },
        }
        return {**base, "insights": self.insights(base)}

    def dataset_summaries(
        self, rows: list[AnalyticsRow] | None = None
    ) -> list[dict[str, Any]]:
        groups: dict[str, list[AnalyticsRow]] = {}
        for row in rows or self.load_rows():
            groups.setdefault(row.dataset_id, []).append(row)

        summaries = []
        for dataset_id, group in groups.items():
            summaries.append(
                {
                    "id": dataset_id,
                    "label": group[0].dataset_label,
                    "category": group[0].category,
                    "rows": len(group),
                    "sourceFiles": len({row.source_file for row in group if row.source_file}),
                    "revenue": self._sum(group, "revenue"),
                    "orders": self._sum(group, "orders"),
                    "visitors": self._sum(group, "visitors"),
                    "cost": self._sum(group, "cost"),
                    "dateCoverage": {
                        "withDates": len([row for row in group if row.period_start]),
                        "withoutDates": len([row for row in group if not row.period_start]),
                    },
                }
            )

        return sorted(summaries, key=lambda item: item["revenue"], reverse=True)

    def revenue_trend(self, rows: list[AnalyticsRow] | None = None) -> list[dict[str, Any]]:
        groups: dict[str, dict[str, float]] = {}
        for row in rows or self.load_rows():
            period = (row.period_start or "Unknown")[:7]
            bucket = groups.setdefault(
                period, {"revenue": 0.0, "orders": 0.0, "visitors": 0.0}
            )
            bucket["revenue"] += row.metrics["revenue"]
            bucket["orders"] += row.metrics["orders"]
            bucket["visitors"] += row.metrics["visitors"]

        return [
            {"period": period, **values}
            for period, values in sorted(groups.items(), key=lambda item: item[0])
        ]

    def funnel(self, rows: list[AnalyticsRow] | None = None) -> list[dict[str, Any]]:
        selected = rows or self.load_rows()

        def value_for(columns: list[str]) -> float:
            total = 0.0
            for row in selected:
                for column in columns:
                    if column in row.values and str(row.values[column]).strip():
                        total += self._number(row.values[column])
                        break
            return total

        return [
            {
                "stage": "Visitors",
                "value": value_for(["Product Visitors (Visits)", "Total_Visitors", "Visitors"]),
            },
            {
                "stage": "Product views",
                "value": value_for(
                    [
                        "Product Page Views",
                        "Products_Viewed",
                        "Number_Of_Products_Viewed",
                    ]
                ),
            },
            {
                "stage": "Added to cart",
                "value": value_for(["Product Visitors (Added to Cart)", "Users_Added_To_Cart"]),
            },
            {
                "stage": "Orders",
                "value": value_for(
                    [
                        "Total Buyers (Orders Ready to Ship)",
                        "Orders_Ready_To_Ship",
                        "Total_Orders",
                    ]
                ),
            },
        ]

    def campaigns(self, datasets: list[dict[str, Any]]) -> list[dict[str, Any]]:
        campaign_tokens = ["flash", "voucher", "game", "live", "chat", "paylater"]
        campaigns = []
        for dataset in datasets:
            if not any(token in dataset["id"] for token in campaign_tokens):
                continue
            cost = dataset["cost"]
            campaigns.append(
                {
                    "name": dataset["label"],
                    "revenue": dataset["revenue"],
                    "cost": cost,
                    "orders": dataset["orders"],
                    "roi": ((dataset["revenue"] - cost) / cost * 100) if cost else 0,
                }
            )
        return sorted(campaigns, key=lambda item: item["revenue"], reverse=True)

    def insights(self, summary: dict[str, Any]) -> list[str]:
        insights = []
        if summary["channelBreakdown"]:
            insights.append(
                f"{summary['channelBreakdown'][0]['name']} is the largest tracked revenue contributor."
            )
        if summary["kpis"]["conversionRate"] > 0:
            insights.append(
                f"Blended conversion is {summary['kpis']['conversionRate']:.2f}% from tracked orders divided by tracked visitors."
            )
        if summary["quality"]["rowsWithoutDates"]:
            insights.append(
                f"{summary['quality']['rowsWithoutDates']} rows do not expose a reliable period and are flagged in quality."
            )
        return insights

    def _read_dataset(self, csv_file: Path) -> list[AnalyticsRow]:
        dataset_id = csv_file.stem
        dataset_label = self._label(csv_file.name)
        df = pd.read_csv(csv_file).fillna("")
        rows: list[AnalyticsRow] = []

        for record in df.to_dict("records"):
            if not any(str(value).strip() for value in record.values()):
                continue
            start, end = self._extract_period(record)
            rows.append(
                AnalyticsRow(
                    dataset_id=dataset_id,
                    dataset_label=dataset_label,
                    category=str(record.get("Category") or dataset_label),
                    source_file=str(record.get("Source_File") or ""),
                    period_start=start,
                    period_end=end,
                    values=record,
                    metrics={
                        name: self._metric(record, name)
                        for name in ["revenue", "orders", "visitors", "cost"]
                    },
                )
            )
        return rows

    def _metric(self, record: dict[str, Any], metric: str) -> float:
        for column in METRIC_COLUMNS[metric]:
            if column in record and str(record[column]).strip():
                return self._number(record[column])
        return 0.0

    def _extract_period(self, record: dict[str, Any]) -> tuple[str | None, str | None]:
        for column in ["Date", "Data_Period", "Time_Period", "Periode Data", "Source_File"]:
            start, end = self._parse_period(str(record.get(column) or ""))
            if start or end:
                return start, end
        return None, None

    def _parse_period(self, text: str) -> tuple[str | None, str | None]:
        compact = re.search(r"(\d{4})(\d{2})(\d{2})[_-](\d{4})(\d{2})(\d{2})", text)
        if compact:
            return (
                self._iso(compact.group(1), compact.group(2), compact.group(3)),
                self._iso(compact.group(4), compact.group(5), compact.group(6)),
            )

        date_range = re.search(
            r"(\d{2})[-/](\d{2})[-/](\d{4})\s*[-–]\s*(\d{2})[-/](\d{2})[-/](\d{4})",
            text,
        )
        if date_range:
            return (
                self._iso(date_range.group(3), date_range.group(2), date_range.group(1)),
                self._iso(date_range.group(6), date_range.group(5), date_range.group(4)),
            )

        single = re.search(r"(\d{2})[-/](\d{2})[-/](\d{4})", text)
        if single:
            parsed = self._iso(single.group(3), single.group(2), single.group(1))
            return parsed, parsed

        return None, None

    def _matches_filter(
        self,
        row: AnalyticsRow,
        dataset: str | None,
        from_date: str | None,
        to_date: str | None,
    ) -> bool:
        if dataset and dataset != "all" and row.dataset_id != dataset:
            return False
        if not from_date and not to_date:
            return True
        if not row.period_start:
            return False
        if from_date and row.period_start < from_date:
            return False
        if to_date and row.period_start > to_date:
            return False
        return True

    def _average_csat(self, rows: list[AnalyticsRow]) -> float | None:
        values = []
        for row in rows:
            if "CSAT_Percent" not in row.values:
                continue
            value = self._number(row.values["CSAT_Percent"])
            if value > 0:
                values.append(value * 100 if value <= 1 else value)
        return sum(values) / len(values) if values else None

    def _average_column_percent(
        self, rows: list[AnalyticsRow], column: str
    ) -> float | None:
        values = [self._number(row.values[column]) * 100 for row in rows if column in row.values]
        values = [value for value in values if value > 0]
        return sum(values) / len(values) if values else None

    def _sum(self, rows: list[AnalyticsRow], metric: str) -> float:
        return sum(row.metrics[metric] for row in rows)

    def _number(self, value: Any) -> float:
        raw = str(value).strip()
        if not raw or raw.lower() == "nan":
            return 0.0
        normalized = raw.replace(",", ".") if "," in raw and "." not in raw else raw.replace(",", "")
        try:
            return float(normalized)
        except ValueError:
            return 0.0

    def _iso(self, year: str, month: str, day: str) -> str | None:
        try:
            return date(int(year), int(month), int(day)).isoformat()
        except ValueError:
            return None

    def _label(self, file_name: str) -> str:
        label = re.sub(r"_cleaned\.csv$", "", file_name)
        return label.replace("_", " ").title()
