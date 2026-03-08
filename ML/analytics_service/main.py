from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

APP_DIR = Path(__file__).resolve().parent
ML_DIR = APP_DIR.parent

DATASET_CANDIDATES = [
    ML_DIR / "pharma_supply_chain_risk.csv",
    ML_DIR / "pharma_supply_chain_risk_data.csv",
]


def resolve_dataset_path() -> Path:
    env_path = os.getenv("DATASET_PATH")
    if env_path:
        p = Path(env_path)
        if p.exists():
            return p

    for candidate in DATASET_CANDIDATES:
        if candidate.exists():
            return candidate

    raise FileNotFoundError(
        "No dataset found. Expected one of: "
        + ", ".join(str(p) for p in DATASET_CANDIDATES)
    )


DATASET_PATH = resolve_dataset_path()


def clamp_series(series: pd.Series, lo: float, hi: float) -> pd.Series:
    return series.clip(lower=lo, upper=hi)


def compute_reliability_score(df: pd.DataFrame) -> pd.Series:
    # Reliability is inverse of failure/delay/risk and direct with finance/compliance.
    financial = clamp_series(df["financial_health_score"], 0.2, 1.0)
    delay = clamp_series(df["historical_delay_frequency_pct"], 0.0, 0.7)
    batch_fail = clamp_series(df["batch_failure_rate_pct"], 0.0, 0.3)
    lead_var = clamp_series(df["lead_time_volatility_days"] / 20.0, 0.0, 1.0)
    risk = clamp_series(df["composite_risk_score"] / 100.0, 0.0, 1.0)
    gmp = df["gmp_status"].astype(int)
    fda = df["fda_approved"].astype(int)

    score = (
        financial * 0.32
        + (1 - delay) * 0.18
        + (1 - batch_fail) * 0.18
        + (1 - lead_var) * 0.10
        + (1 - risk) * 0.14
        + gmp * 0.04
        + fda * 0.04
    ) * 100

    return score.round(2)


def load_dataset() -> pd.DataFrame:
    df = pd.read_csv(DATASET_PATH)

    bool_cols = [
        "gmp_status",
        "fda_approved",
        "cold_chain_capable",
        "upstream_dependency_known",
        "is_sole_source",
        "active_disruption_signal",
        "cold_chain_route_mismatch",
        "compliance_violation_flag",
    ]
    for col in bool_cols:
        df[col] = df[col].astype(bool)

    df["reliability_score"] = compute_reliability_score(df)
    return df


app = FastAPI(title="Supply Chain Analytics API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

state: Dict[str, pd.DataFrame] = {}


@app.on_event("startup")
def startup() -> None:
    state["df"] = load_dataset()


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "dataset": str(DATASET_PATH)}


@app.post("/reload")
def reload_dataset() -> Dict[str, str]:
    state["df"] = load_dataset()
    return {"status": "reloaded", "rows": str(len(state["df"]))}


@app.get("/analytics/single-point-of-failure")
def single_point_of_failure(limit: int = 20) -> Dict[str, object]:
    df = state.get("df")
    if df is None or df.empty:
        raise HTTPException(status_code=500, detail="Dataset unavailable")

    spof_df = df[
        (df["is_sole_source"])
        & (df["num_approved_alternates"] == 0)
        & (df["dependency_pct"] >= 0.7)
    ].copy()

    spof_df["spof_risk_index"] = (
        spof_df["composite_risk_score"] * 0.5
        + spof_df["dependency_pct"] * 100 * 0.35
        + (spof_df["active_disruption_signal"].astype(int) * 100) * 0.15
    ).round(2)

    spof_df = spof_df.sort_values("spof_risk_index", ascending=False)

    records = spof_df.head(limit)[
        [
            "supplier_id",
            "tier",
            "country",
            "region",
            "dependency_pct",
            "composite_risk_score",
            "reliability_score",
            "spof_risk_index",
        ]
    ].to_dict(orient="records")

    return {
        "total_suppliers": int(len(df)),
        "single_point_failures": int(len(spof_df)),
        "spof_rate_pct": round((len(spof_df) / len(df)) * 100, 2),
        "top_exposed_suppliers": records,
    }


@app.get("/analytics/geographic-concentration")
def geographic_concentration(top_n: int = 10) -> Dict[str, object]:
    df = state.get("df")
    if df is None or df.empty:
        raise HTTPException(status_code=500, detail="Dataset unavailable")

    country_counts = df["country"].value_counts()
    shares = country_counts / country_counts.sum()
    hhi = float((shares.pow(2).sum() * 10000).round(2))

    by_country = (
        df.groupby("country", as_index=False)
        .agg(
            suppliers=("supplier_id", "count"),
            avg_geo_concentration=("geographic_concentration_pct", "mean"),
            avg_risk=("composite_risk_score", "mean"),
            avg_reliability=("reliability_score", "mean"),
        )
        .sort_values("suppliers", ascending=False)
    )
    by_country["share_pct"] = ((by_country["suppliers"] / len(df)) * 100).round(2)

    by_region = (
        df.groupby("region", as_index=False)
        .agg(
            suppliers=("supplier_id", "count"),
            avg_geo_concentration=("geographic_concentration_pct", "mean"),
            avg_risk=("composite_risk_score", "mean"),
            avg_reliability=("reliability_score", "mean"),
        )
        .sort_values("suppliers", ascending=False)
    )
    by_region["share_pct"] = ((by_region["suppliers"] / len(df)) * 100).round(2)

    return {
        "hhi_country": hhi,
        "concentration_level": (
            "high" if hhi >= 2500 else "moderate" if hhi >= 1500 else "low"
        ),
        "top_countries": by_country.head(top_n).round(2).to_dict(orient="records"),
        "region_breakdown": by_region.round(2).to_dict(orient="records"),
    }


@app.get("/analytics/supplier-reliability")
def supplier_reliability(limit: int = 20) -> Dict[str, object]:
    df = state.get("df")
    if df is None or df.empty:
        raise HTTPException(status_code=500, detail="Dataset unavailable")

    enriched = df.copy()
    enriched["reliability_band"] = pd.cut(
        enriched["reliability_score"],
        bins=[-np.inf, 40, 60, 80, np.inf],
        labels=["fragile", "watch", "stable", "resilient"],
    )

    lowest = enriched.sort_values("reliability_score", ascending=True).head(limit)
    highest = enriched.sort_values("reliability_score", ascending=False).head(limit)

    return {
        "average_reliability": round(float(enriched["reliability_score"].mean()), 2),
        "band_distribution": (
            enriched["reliability_band"].value_counts().sort_index().to_dict()
        ),
        "lowest_reliability_suppliers": lowest[
            [
                "supplier_id",
                "tier",
                "country",
                "region",
                "reliability_score",
                "composite_risk_score",
                "historical_delay_frequency_pct",
                "batch_failure_rate_pct",
            ]
        ].to_dict(orient="records"),
        "highest_reliability_suppliers": highest[
            [
                "supplier_id",
                "tier",
                "country",
                "region",
                "reliability_score",
                "composite_risk_score",
                "historical_delay_frequency_pct",
                "batch_failure_rate_pct",
            ]
        ].to_dict(orient="records"),
    }


@app.get("/analytics/demand-supply-mismatch")
def demand_supply_mismatch(limit: int = 20) -> Dict[str, object]:
    df = state.get("df")
    if df is None or df.empty:
        raise HTTPException(status_code=500, detail="Dataset unavailable")

    view = df.copy()

    # Proxy demand pressure from disruptions, delay and dependency.
    demand_pressure = (
        view["active_disruption_signal"].astype(int) * 0.35
        + view["historical_delay_frequency_pct"] * 0.25
        + view["dependency_pct"] * 0.20
        + (view["composite_risk_score"] / 100.0) * 0.20
    )

    # Proxy supply adequacy from capacity, quality and reliability drivers.
    supply_adequacy = (
        (1 - view["capacity_utilization_pct"]) * 0.35
        + view["financial_health_score"] * 0.30
        + (1 - view["batch_failure_rate_pct"]) * 0.20
        + (
            view["production_capacity_units_month"]
            / view["production_capacity_units_month"].max()
        )
        * 0.15
    )

    view["mismatch_index"] = ((demand_pressure - supply_adequacy) * 100).round(2)
    stressed = view[view["mismatch_index"] > 15].sort_values(
        "mismatch_index", ascending=False
    )

    return {
        "avg_mismatch_index": round(float(view["mismatch_index"].mean()), 2),
        "critical_mismatch_suppliers": int((view["mismatch_index"] > 25).sum()),
        "high_mismatch_suppliers": int((view["mismatch_index"] > 15).sum()),
        "top_mismatches": stressed.head(limit)[
            [
                "supplier_id",
                "tier",
                "country",
                "region",
                "capacity_utilization_pct",
                "production_capacity_units_month",
                "historical_delay_frequency_pct",
                "dependency_pct",
                "reliability_score",
                "mismatch_index",
            ]
        ].to_dict(orient="records"),
    }


@app.get("/analytics/overview")
def analytics_overview() -> Dict[str, object]:
    return {
        "single_point_of_failure": single_point_of_failure(limit=5),
        "geographic_concentration": geographic_concentration(top_n=5),
        "supplier_reliability": supplier_reliability(limit=5),
        "demand_supply_mismatch": demand_supply_mismatch(limit=5),
    }
