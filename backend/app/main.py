"""Optional FastAPI backend for Nazava Analytics.

The primary production app is the Next.js web app. This backend is kept
functional for API consumers, local experimentation, and future service work.
It reads the same committed cleaned CSVs as the web app.
"""

from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.services.analytics_service import AnalyticsService


app = FastAPI(
    title="Nazava Analytics Backend",
    description="CSV-backed analytics API for the SCU Analytical Showdown dataset.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def analytics_service() -> AnalyticsService:
    return AnalyticsService()


@app.get("/")
async def root():
    return {
        "service": settings.APP_NAME,
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health",
        "summary": "/api/summary",
    }


@app.get("/health")
async def health_check():
    service = analytics_service()
    rows = service.load_rows()
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": "2.0.0",
        "dataPath": str(service.data_path),
        "rowsLoaded": len(rows),
        "datasets": len(service.dataset_summaries(rows)),
    }


@app.get("/api/summary")
async def get_summary(
    dataset: Optional[str] = Query(default=None),
    from_date: Optional[str] = Query(default=None, alias="from"),
    to_date: Optional[str] = Query(default=None, alias="to"),
):
    return analytics_service().summary(dataset=dataset, from_date=from_date, to_date=to_date)


@app.get("/api/analytics/kpis")
async def get_kpis(
    dataset: Optional[str] = Query(default=None),
    from_date: Optional[str] = Query(default=None, alias="from"),
    to_date: Optional[str] = Query(default=None, alias="to"),
):
    return analytics_service().summary(dataset=dataset, from_date=from_date, to_date=to_date)[
        "kpis"
    ]


@app.get("/api/analytics/datasets")
async def get_datasets():
    return analytics_service().dataset_summaries()


@app.get("/api/analytics/trends/revenue")
async def get_revenue_trend(
    dataset: Optional[str] = Query(default=None),
    from_date: Optional[str] = Query(default=None, alias="from"),
    to_date: Optional[str] = Query(default=None, alias="to"),
):
    return analytics_service().summary(dataset=dataset, from_date=from_date, to_date=to_date)[
        "revenueTrend"
    ]


@app.get("/api/analytics/funnel")
async def get_funnel(
    dataset: Optional[str] = Query(default=None),
    from_date: Optional[str] = Query(default=None, alias="from"),
    to_date: Optional[str] = Query(default=None, alias="to"),
):
    return analytics_service().summary(dataset=dataset, from_date=from_date, to_date=to_date)[
        "funnel"
    ]


@app.get("/api/analytics/campaigns")
async def get_campaigns(
    dataset: Optional[str] = Query(default=None),
    from_date: Optional[str] = Query(default=None, alias="from"),
    to_date: Optional[str] = Query(default=None, alias="to"),
):
    return analytics_service().summary(dataset=dataset, from_date=from_date, to_date=to_date)[
        "campaigns"
    ]


@app.get("/api/insights/summary")
async def get_insights_summary(
    dataset: Optional[str] = Query(default=None),
    from_date: Optional[str] = Query(default=None, alias="from"),
    to_date: Optional[str] = Query(default=None, alias="to"),
):
    summary = analytics_service().summary(dataset=dataset, from_date=from_date, to_date=to_date)
    return {
        "insights": summary["insights"],
        "quality": summary["quality"],
        "topDatasets": summary["datasets"][:5],
    }


@app.get("/api/predictions/forecast/revenue")
async def forecast_revenue(days: int = Query(default=30, ge=7, le=180)):
    summary = analytics_service().summary()
    trend = [point for point in summary["revenueTrend"] if point["period"] != "Unknown"]
    recent = trend[-3:] if len(trend) >= 3 else trend
    average_monthly = (
        sum(point["revenue"] for point in recent) / len(recent) if recent else 0
    )
    daily_estimate = average_monthly / 30 if average_monthly else 0
    return {
        "metric": "revenue",
        "method": "rolling_recent_month_average",
        "days": days,
        "predictedRevenue": daily_estimate * days,
        "basisPeriods": recent,
        "note": "Lightweight baseline forecast from available CSV history; not a trained ML model.",
    }


@app.get("/api/reports/export")
async def export_report(
    dataset: Optional[str] = Query(default=None),
    from_date: Optional[str] = Query(default=None, alias="from"),
    to_date: Optional[str] = Query(default=None, alias="to"),
):
    return analytics_service().summary(dataset=dataset, from_date=from_date, to_date=to_date)
