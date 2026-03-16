from __future__ import annotations

import collections
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

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

state: Dict[str, Any] = {}

FEATURE_COLS = [
    "financial_health_score",
    "historical_delay_frequency_pct",
    "batch_failure_rate_pct",
    "lead_time_volatility_days",
    "dependency_pct",
    "capacity_utilization_pct",
    "gmp_status",
    "fda_approved",
    "active_disruption_signal",
    "compliance_violation_flag",
]

FEATURE_DEFAULTS: Dict[str, float] = {
    "financial_health_score": 0.70,
    "historical_delay_frequency_pct": 0.15,
    "batch_failure_rate_pct": 0.05,
    "lead_time_volatility_days": 3.0,
    "dependency_pct": 0.50,
    "capacity_utilization_pct": 0.70,
    "gmp_status": 1.0,
    "fda_approved": 1.0,
    "active_disruption_signal": 0.0,
    "compliance_violation_flag": 0.0,
}

VALID_DISRUPTIONS = {
    "supplier_failure",
    "transport_delay",
    "demand_surge",
    "natural_disaster",
    "quality_issue",
    "regulatory_change",
}

HOP_ATTENUATION = 0.55


def _to_binary(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    if isinstance(value, (int, float, np.integer, np.floating)):
        return 1.0 if float(value) >= 0.5 else 0.0
    text = str(value).strip().lower()
    if text in {
        "1",
        "true",
        "yes",
        "y",
        "compliant",
        "approved",
        "certified",
        "pass",
        "ok",
        "not required",
        "n/a",
        "na",
    }:
        return 1.0
    if text in {
        "0",
        "false",
        "no",
        "n",
        "non-compliant",
        "violation",
        "pending",
        "rejected",
        "revoked",
        "failed",
    }:
        return 0.0
    return default


def _to_float(value: Any, default: float) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _clip_feature_ranges(features: Dict[str, float]) -> Dict[str, float]:
    features["financial_health_score"] = float(
        np.clip(features["financial_health_score"], 0.0, 1.0)
    )
    features["historical_delay_frequency_pct"] = float(
        np.clip(features["historical_delay_frequency_pct"], 0.0, 1.0)
    )
    features["batch_failure_rate_pct"] = float(
        np.clip(features["batch_failure_rate_pct"], 0.0, 1.0)
    )
    features["lead_time_volatility_days"] = float(
        np.clip(features["lead_time_volatility_days"], 0.0, 60.0)
    )
    features["dependency_pct"] = float(np.clip(features["dependency_pct"], 0.0, 1.0))
    features["capacity_utilization_pct"] = float(
        np.clip(features["capacity_utilization_pct"], 0.0, 1.0)
    )
    for flag_col in [
        "gmp_status",
        "fda_approved",
        "active_disruption_signal",
        "compliance_violation_flag",
    ]:
        features[flag_col] = 1.0 if features[flag_col] >= 0.5 else 0.0
    return features


def _build_simulation_training_frame(df: pd.DataFrame) -> pd.DataFrame:
    train = df.copy()
    for col in FEATURE_COLS:
        if col not in train.columns:
            train[col] = FEATURE_DEFAULTS[col]

    for flag_col in [
        "gmp_status",
        "fda_approved",
        "active_disruption_signal",
        "compliance_violation_flag",
    ]:
        train[flag_col] = train[flag_col].astype(int)

    for col in FEATURE_COLS:
        train[col] = pd.to_numeric(train[col], errors="coerce").fillna(
            FEATURE_DEFAULTS[col]
        )

    if "composite_risk_score" not in train.columns:
        train["composite_risk_score"] = 50.0
    train["composite_risk_score"] = pd.to_numeric(
        train["composite_risk_score"], errors="coerce"
    ).fillna(50.0)

    return train


def train_simulation_models(
    df: pd.DataFrame,
) -> Tuple[Pipeline, Pipeline]:
    train = _build_simulation_training_frame(df)

    x_risk = train[FEATURE_COLS]
    y_risk = train["composite_risk_score"]

    ltv_feature_cols = [c for c in FEATURE_COLS if c != "lead_time_volatility_days"]
    x_ltv = train[ltv_feature_cols]
    y_ltv = train["lead_time_volatility_days"]

    risk_model = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            (
                "model",
                GradientBoostingRegressor(
                    n_estimators=200,
                    max_depth=4,
                    learning_rate=0.05,
                    subsample=0.8,
                    random_state=42,
                ),
            ),
        ]
    )

    lead_time_model = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            (
                "model",
                GradientBoostingRegressor(
                    n_estimators=160,
                    max_depth=3,
                    learning_rate=0.05,
                    subsample=0.85,
                    random_state=42,
                ),
            ),
        ]
    )

    risk_model.fit(x_risk, y_risk)
    lead_time_model.fit(x_ltv, y_ltv)
    return risk_model, lead_time_model


@app.on_event("startup")
def startup() -> None:
    state["df"] = load_dataset()
    state["simulation_model_version"] = "simulation_ml_v1"
    try:
        risk_model, lead_time_model = train_simulation_models(state["df"])
        state["simulation_risk_model"] = risk_model
        state["simulation_lead_time_model"] = lead_time_model
        state["simulation_training_ok"] = True
    except Exception:
        state["simulation_risk_model"] = None
        state["simulation_lead_time_model"] = None
        state["simulation_training_ok"] = False


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "dataset": str(DATASET_PATH)}


@app.post("/reload")
def reload_dataset() -> Dict[str, str]:
    state["df"] = load_dataset()
    try:
        risk_model, lead_time_model = train_simulation_models(state["df"])
        state["simulation_risk_model"] = risk_model
        state["simulation_lead_time_model"] = lead_time_model
        state["simulation_training_ok"] = True
    except Exception:
        state["simulation_risk_model"] = None
        state["simulation_lead_time_model"] = None
        state["simulation_training_ok"] = False

    return {
        "status": "reloaded",
        "rows": str(len(state["df"])),
        "simulation_training_ok": str(bool(state.get("simulation_training_ok"))),
    }


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


# ─────────────────────────────────────────────────────────────────────────────
# Graph-topology-aware inference  (POST /analytics/predict-graph)
# ─────────────────────────────────────────────────────────────────────────────


class GraphNodePayload(BaseModel):
    id: str
    data: Dict[str, Any] = {}
    type: str = "supplyNode"


class GraphEdgePayload(BaseModel):
    id: str = ""
    source: str = ""
    target: str = ""
    data: Dict[str, Any] = {}


class GraphPredictRequest(BaseModel):
    nodes: List[GraphNodePayload] = []
    edges: List[GraphEdgePayload] = []


def _find_articulation_points(
    node_ids: List[str], edge_list: List[Tuple[str, str]]
) -> Set[str]:
    """
    Tarjan's DFS-based articulation point algorithm on the *undirected* version
    of the supply chain.  A node is an articulation point (structural SPOF) if
    removing it disconnects the graph — e.g. a warehouse that is the only link
    between three manufacturers and all downstream nodes.
    """
    if len(node_ids) < 2:
        return set()

    node_id_set = set(node_ids)

    # Build undirected adjacency
    adj: Dict[str, List[str]] = collections.defaultdict(list)
    for src, tgt in edge_list:
        if src in node_id_set and tgt in node_id_set:
            adj[src].append(tgt)
            adj[tgt].append(src)

    disc: Dict[str, int] = {}
    low: Dict[str, int] = {}
    parent: Dict[str, Optional[str]] = {}
    ap_set: Set[str] = set()
    timer = [0]

    def dfs(u: str) -> None:
        disc[u] = low[u] = timer[0]
        timer[0] += 1
        child_count = 0

        for v in adj[u]:
            if v not in disc:
                child_count += 1
                parent[v] = u
                dfs(v)
                low[u] = min(low[u], low[v])
                # Root with 2+ children → AP
                if parent.get(u) is None and child_count > 1:
                    ap_set.add(u)
                # Non-root: no back-edge from subtree can bypass u → AP
                if parent.get(u) is not None and low[v] >= disc[u]:
                    ap_set.add(u)
            elif v != parent.get(u):
                low[u] = min(low[u], disc[v])

    for nid in node_ids:
        if nid not in disc:
            parent[nid] = None
            dfs(nid)

    return ap_set


def _compute_graph_predictions(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    df: Optional[pd.DataFrame] = None,
) -> Dict[str, Any]:
    """
    Compute topology-aware, context-sensitive risk predictions for every node
    in the user's supply chain graph.

    Risk formula
    ─────────────
      contextual_risk = base_risk (from node data / CSV lookup)
                      + structural_bonus
        structural_bonus:
          • +25  if the node is an articulation point
                 (removing it disconnects the chain)
          • +min(in_degree × 8, 30)  if multiple upstream nodes feed into it
                 (bottleneck / single-funnelling risk)
          • +10  if it is a sole-leaf supplier (in=0, out=1)

    This means a warehouse with 3 manufacturers flowing through it and no
    alternative path will be flagged as a high-risk SPOF automatically.
    """
    if not nodes:
        return {
            "summary": {"total_nodes": 0, "total_edges": 0, "avg_predicted_risk": 0},
            "vulnerabilities": [],
            "bottlenecks": [],
            "node_predictions": [],
            "geographic_risk": {
                "hhi_country": 0,
                "concentration_level": "low",
                "countries": [],
            },
            "articulation_points": [],
        }

    # Build degree maps
    in_degree: Dict[str, int] = collections.defaultdict(int)
    out_degree: Dict[str, int] = collections.defaultdict(int)
    edge_list: List[Tuple[str, str]] = []

    for e in edges:
        src = e.get("source") or e.get("data", {}).get("sourceId", "")
        tgt = e.get("target") or e.get("data", {}).get("targetId", "")
        if src and tgt:
            in_degree[tgt] += 1
            out_degree[src] += 1
            edge_list.append((src, tgt))

    node_ids = [n["id"] for n in nodes]
    n_total = max(len(node_ids), 1)

    # Structural SPOF detection via Tarjan's algorithm
    ap_set = _find_articulation_points(node_ids, edge_list)

    # Build historical CSV lookup keyed by supplier_id (for contextual enrichment)
    csv_lookup: Dict[str, Any] = {}
    if df is not None:
        for _, row in df.iterrows():
            sid = str(row.get("supplier_id", ""))
            if sid:
                csv_lookup[sid] = row

    node_predictions: List[Dict[str, Any]] = []

    for node in nodes:
        node_id = node["id"]
        data = node.get("data", {})

        in_deg = in_degree[node_id]
        out_deg = out_degree[node_id]
        total_deg = in_deg + out_deg
        centrality = total_deg / (n_total - 1) if n_total > 1 else 0.0

        # Raw articulation point from topology (undirected cut-vertex).
        is_ap_raw = node_id in ap_set
        # Bottleneck = multiple inputs AND has at least one output
        is_bottleneck = in_deg >= 2 and out_deg >= 1

        # SPOF guardrail: ignore edge/corner nodes (pure sources/sinks).
        # A "true" SPOF for this app must sit in the middle of flow.
        is_edge_node = in_deg == 0 or out_deg == 0
        is_ap = is_ap_raw and (not is_edge_node) and total_deg >= 3

        # Base risk: prefer value stored on the node (set from catalog / manual entry)
        base_risk = float(data.get("risk_score") or 50)

        # Try to enrich with live CSV historical data
        csv_row = None
        catalog_id = str(data.get("catalog_id") or data.get("supplier_id") or "")
        if catalog_id and catalog_id in csv_lookup:
            csv_row = csv_lookup[catalog_id]
            base_risk = float(csv_row.get("composite_risk_score", base_risk))

        # ── Structural bonus ────────────────────────────────────────────────
        structural_bonus = 0.0
        if is_ap:
            structural_bonus += 25  # removing this disconnects the chain
        if in_deg >= 2:
            structural_bonus += min(in_deg * 8, 30)  # funnelling load
        if in_deg == 0 and out_deg == 1:
            structural_bonus += 10  # sole-leaf supplier

        contextual_risk = min(round(base_risk + structural_bonus, 2), 100.0)

        # Bottleneck score (0–100): in-degree load + centrality + AP status
        bottleneck_score = min(
            round((in_deg * 20) + (centrality * 50) + (30.0 if is_ap else 0.0), 2),
            100.0,
        )

        # Reliability: from node data → CSV fallback → infer from risk
        reliability = float(data.get("reliability_score") or 0)
        if reliability == 0 and csv_row is not None:
            reliability = float(csv_row.get("reliability_score", 0))
        if reliability == 0:
            reliability = round(max(0.0, 100.0 - contextual_risk), 2)

        # Mismatch index: capacity bottleneck + risk pressure + degree load
        capacity_util = float(data.get("capacity_utilization") or 0.7)
        mismatch_index = min(
            round((capacity_util * 35) + (contextual_risk * 0.35) + (in_deg * 7), 2),
            100.0,
        )

        dep_pct = float(data.get("dependency_percentage") or 0)
        compliance_raw = str(data.get("compliance_status") or "Compliant").lower()
        is_non_compliant = compliance_raw in (
            "non-compliant",
            "false",
            "0",
            "violation",
        )

        is_vulnerable = (
            contextual_risk >= 70
            or is_ap
            or in_deg >= 3
            or dep_pct >= 75
            or is_non_compliant
        )

        country = (data.get("country") or "Unknown").strip() or "Unknown"

        spof_reasons: List[str] = []
        if is_ap:
            spof_reasons.append("structural articulation point")
        if in_deg >= 3:
            spof_reasons.append(f"high in-degree ({in_deg} dependencies)")
        if is_bottleneck:
            spof_reasons.append("funnels multiple upstream flows")
        if dep_pct >= 75:
            spof_reasons.append(f"high dependency ({dep_pct:.0f}%)")

        node_predictions.append(
            {
                "node_id": node_id,
                "name": data.get("name") or node_id,
                "type": data.get("type") or "Unknown",
                "country": country,
                "predicted_risk": contextual_risk,
                "bottleneck_score": bottleneck_score,
                "mismatch_index": mismatch_index,
                "centrality": round(centrality, 3),
                "in_degree": in_deg,
                "out_degree": out_deg,
                "is_articulation_point": is_ap,
                "is_articulation_point_raw": is_ap_raw,
                "is_bottleneck": is_bottleneck,
                "is_vulnerable": is_vulnerable,
                "dependency": dep_pct,
                "reliability": round(reliability, 2),
                "spof_reasons": spof_reasons,
            }
        )

    # Sort by predicted risk descending
    node_predictions.sort(key=lambda x: -x["predicted_risk"])

    vulnerabilities = [p for p in node_predictions if p["is_vulnerable"]]
    bottlenecks_list = sorted(
        [
            p
            for p in node_predictions
            if p["is_bottleneck"] or p["is_articulation_point"]
        ],
        key=lambda x: -x["bottleneck_score"],
    )
    # Lowest-reliability nodes (ascending)
    reliability_ranking = sorted(node_predictions, key=lambda x: x["reliability"])
    # Highest mismatch nodes
    mismatch_ranking = sorted(node_predictions, key=lambda x: -x["mismatch_index"])

    # Geographic risk — derived ONLY from the actual nodes in this chain
    country_counts: collections.Counter = collections.Counter(
        p["country"]
        for p in node_predictions
        if p["country"] not in ("Unknown", "", None)
    )
    total_in_chain = sum(country_counts.values())
    if total_in_chain > 0:
        shares = {c: v / total_in_chain for c, v in country_counts.items()}
        hhi = round(sum(s**2 for s in shares.values()) * 10000, 2)
        countries = [
            {
                "country": c,
                "count": cnt,
                "share_pct": round(cnt / total_in_chain * 100, 2),
            }
            for c, cnt in sorted(country_counts.items(), key=lambda x: -x[1])
        ]
        geo_risk = {
            "hhi_country": hhi,
            "concentration_level": (
                "high" if hhi >= 2500 else "moderate" if hhi >= 1500 else "low"
            ),
            "countries": countries,
        }
    else:
        geo_risk = {"hhi_country": 0, "concentration_level": "low", "countries": []}

    risks = [p["predicted_risk"] for p in node_predictions]
    avg_risk = round(sum(risks) / len(risks), 2) if risks else 0.0

    return {
        "summary": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "avg_predicted_risk": avg_risk,
            "max_predicted_risk": round(max(risks), 2) if risks else 0.0,
            "single_point_failures": len(
                [p for p in node_predictions if p["is_articulation_point"]]
            ),
            "bottleneck_count": len(bottlenecks_list),
            "vulnerability_count": len(vulnerabilities),
            "critical_nodes": len(
                [p for p in node_predictions if p["predicted_risk"] >= 80]
            ),
        },
        "vulnerabilities": vulnerabilities,
        "bottlenecks": bottlenecks_list,
        "reliability_ranking": reliability_ranking,
        "mismatch_ranking": mismatch_ranking,
        "node_predictions": node_predictions,
        "geographic_risk": geo_risk,
        "articulation_points": [
            p["node_id"] for p in node_predictions if p["is_articulation_point"]
        ],
    }


@app.post("/analytics/predict-graph")
def predict_graph(req: GraphPredictRequest) -> Dict[str, Any]:
    """
    Topology-aware supply chain risk inference.

    Accepts the nodes and edges of a workspace graph and returns per-node
    predictions that account for:
      • Historical risk from the pharma CSV dataset (when supplier_id matches)
      • Graph-structural risk: articulation points, in-degree load, centrality
      • SPOF detection: nodes whose removal disconnects the graph
      • Bottleneck detection: nodes funnelling ≥2 upstream flows
      • Geographic concentration calculated from actual chain nodes
      • Demand-supply mismatch calculated from actual chain nodes
    """
    nodes = [{"id": n.id, "data": n.data} for n in req.nodes]
    edges = [
        {
            "source": e.source or e.data.get("sourceId", ""),
            "target": e.target or e.data.get("targetId", ""),
        }
        for e in req.edges
    ]

    if not nodes:
        raise HTTPException(status_code=400, detail="Payload contains no nodes.")

    df = state.get("df")  # May be None during tests; algorithm handles it gracefully
    predictions = _compute_graph_predictions(nodes, edges, df)

    return {"model": "graph_topology_v2", "predictions": predictions}


# ─────────────────────────────────────────────────────────────────────────────
# ML-based scenario simulation (POST /analytics/simulate)
# ─────────────────────────────────────────────────────────────────────────────


class NodeData(BaseModel):
    node_id: str
    edges: List[str] = []

    financial_health_score: Optional[float] = None
    historical_delay_frequency_pct: Optional[float] = None
    batch_failure_rate_pct: Optional[float] = None
    lead_time_volatility_days: Optional[float] = None
    dependency_pct: Optional[float] = None
    capacity_utilization_pct: Optional[float] = None
    gmp_status: Optional[Any] = None
    fda_approved: Optional[Any] = None
    active_disruption_signal: Optional[Any] = None
    compliance_violation_flag: Optional[Any] = None

    class Config:
        extra = "allow"


class SimulationRequest(BaseModel):
    origin_node_id: str
    disruption_type: Optional[str] = None
    severity: float = 5.0
    nodes: List[NodeData]
    max_hops: int = 4
    risk_threshold: float = 20.0
    disruptions: List[Dict[str, Any]] = []


class AffectedNode(BaseModel):
    node_id: str
    hop: int
    risk_score: float
    lead_time_increase: float
    capacity_impact_pct: float
    effective_severity: float


class TimelineEntry(BaseModel):
    day: int
    hop: int
    stage: str
    affected_nodes: int
    cumulative_affected: int
    avg_risk: float
    peak_risk: float


class RippleHopSummary(BaseModel):
    hop: int
    nodes: int
    avg_risk: float
    peak_risk: float
    avg_lead_time_increase: float


class SimulationResponse(BaseModel):
    model: str
    origin_node_id: str
    disruption_type: str
    severity: float
    origin_risk: float
    origin_lt_inc: float
    origin_cap_impact: float
    affected_nodes: List[AffectedNode]
    total_affected: int
    affected_products: List[str] = []
    impact_timeline: List[TimelineEntry] = []
    ripple_by_hop: List[RippleHopSummary] = []
    applied_disruptions: List[Dict[str, Any]] = []


def _extract_product_identifiers(node_data: Dict[str, Any]) -> List[str]:
    product_keys = [
        "product",
        "product_name",
        "product_id",
        "name",
        "label",
        "title",
        "sku",
        "sku_id",
        "drug_name",
        "medicine",
        "material",
        "material_name",
    ]

    values: List[str] = []
    for key in product_keys:
        value = node_data.get(key)
        if isinstance(value, str) and value.strip():
            values.append(value.strip())

    if values:
        return values

    node_id = str(node_data.get("node_id") or "").strip()
    if node_id:
        return [node_id]

    return []


def _build_timeline_and_ripple(
    origin_risk: float,
    origin_lt_inc: float,
    affected_nodes: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    by_hop: Dict[int, List[Dict[str, Any]]] = collections.defaultdict(list)
    for item in affected_nodes:
        by_hop[int(item["hop"])].append(item)

    timeline: List[Dict[str, Any]] = [
        {
            "day": 0,
            "hop": 0,
            "stage": "Origin disruption",
            "affected_nodes": 1,
            "cumulative_affected": 1,
            "avg_risk": round(origin_risk, 2),
            "peak_risk": round(origin_risk, 2),
        }
    ]

    ripple_by_hop: List[Dict[str, Any]] = []
    cumulative = 1

    for hop in sorted(by_hop.keys()):
        hop_nodes = by_hop[hop]
        risks = [float(n["risk_score"]) for n in hop_nodes]
        lt_vals = [float(n["lead_time_increase"]) for n in hop_nodes]

        cumulative += len(hop_nodes)
        timeline.append(
            {
                "day": int(round(hop * 2 + max(0.0, (sum(lt_vals) / len(lt_vals))))),
                "hop": hop,
                "stage": f"Ripple hop {hop}",
                "affected_nodes": len(hop_nodes),
                "cumulative_affected": cumulative,
                "avg_risk": round(sum(risks) / len(risks), 2),
                "peak_risk": round(max(risks), 2),
            }
        )

        ripple_by_hop.append(
            {
                "hop": hop,
                "nodes": len(hop_nodes),
                "avg_risk": round(sum(risks) / len(risks), 2),
                "peak_risk": round(max(risks), 2),
                "avg_lead_time_increase": round(sum(lt_vals) / len(lt_vals), 2),
            }
        )

    if not ripple_by_hop:
        ripple_by_hop.append(
            {
                "hop": 0,
                "nodes": 1,
                "avg_risk": round(origin_risk, 2),
                "peak_risk": round(origin_risk, 2),
                "avg_lead_time_increase": round(origin_lt_inc, 2),
            }
        )

    return timeline, ripple_by_hop


def _node_to_features(node_data: Dict[str, Any]) -> Dict[str, float]:
    dep_value = node_data.get("dependency_pct")
    if dep_value is None:
        dep_value = node_data.get("dependency_percentage")

    capacity_value = node_data.get("capacity_utilization_pct")
    if capacity_value is None:
        capacity_value = node_data.get("capacity_utilization")

    fda_value = node_data.get("fda_approved")
    if fda_value is None:
        fda_value = node_data.get("fda_approval")

    compliance_raw = node_data.get("compliance_violation_flag")
    if compliance_raw is None:
        compliance_status = str(node_data.get("compliance_status") or "").strip().lower()
        if compliance_status in {"non-compliant", "violation", "false", "0"}:
            compliance_raw = 1
        elif compliance_status:
            compliance_raw = 0

    features = {
        "financial_health_score": _to_float(
            node_data.get("financial_health_score"),
            FEATURE_DEFAULTS["financial_health_score"],
        ),
        "historical_delay_frequency_pct": _to_float(
            node_data.get("historical_delay_frequency_pct"),
            FEATURE_DEFAULTS["historical_delay_frequency_pct"],
        ),
        "batch_failure_rate_pct": _to_float(
            node_data.get("batch_failure_rate_pct"),
            FEATURE_DEFAULTS["batch_failure_rate_pct"],
        ),
        "lead_time_volatility_days": _to_float(
            node_data.get("lead_time_volatility_days"),
            FEATURE_DEFAULTS["lead_time_volatility_days"],
        ),
        "dependency_pct": _to_float(
            dep_value,
            FEATURE_DEFAULTS["dependency_pct"],
        ),
        "capacity_utilization_pct": _to_float(
            capacity_value,
            FEATURE_DEFAULTS["capacity_utilization_pct"],
        ),
        "gmp_status": _to_binary(
            node_data.get("gmp_status"),
            FEATURE_DEFAULTS["gmp_status"],
        ),
        "fda_approved": _to_binary(
            fda_value,
            FEATURE_DEFAULTS["fda_approved"],
        ),
        "active_disruption_signal": _to_binary(
            node_data.get("active_disruption_signal"),
            FEATURE_DEFAULTS["active_disruption_signal"],
        ),
        "compliance_violation_flag": _to_binary(
            compliance_raw,
            FEATURE_DEFAULTS["compliance_violation_flag"],
        ),
    }

    return _clip_feature_ranges(features)


def _perturb_features(
    features: Dict[str, float], disruption_type: str, severity: float
) -> Dict[str, float]:
    updated = dict(features)

    if disruption_type == "supplier_failure":
        updated["active_disruption_signal"] = 1.0
        updated["financial_health_score"] -= severity * 0.5
        updated["batch_failure_rate_pct"] += severity * 0.4
    elif disruption_type == "transport_delay":
        updated["historical_delay_frequency_pct"] += severity * 0.5
        updated["lead_time_volatility_days"] += severity * 0.4
    elif disruption_type == "demand_surge":
        updated["capacity_utilization_pct"] += severity * 0.6
        updated["active_disruption_signal"] = 1.0
    elif disruption_type == "natural_disaster":
        updated["active_disruption_signal"] = 1.0
        updated["financial_health_score"] -= severity * 0.4
        updated["lead_time_volatility_days"] += severity * 0.3
    elif disruption_type == "quality_issue":
        updated["batch_failure_rate_pct"] += severity * 0.7
        updated["compliance_violation_flag"] = 1.0
    elif disruption_type == "regulatory_change":
        updated["compliance_violation_flag"] = 1.0
        updated["gmp_status"] = 0.0
        updated["fda_approved"] = 0.0

    return _clip_feature_ranges(updated)


def _as_feature_vector(features: Dict[str, float], cols: List[str]) -> pd.DataFrame:
    return pd.DataFrame([{col: features[col] for col in cols}], columns=cols)


def _ml_predict_disruption(
    node_data: Dict[str, Any],
    disruption_plan: List[Tuple[str, float]],
    risk_model: Pipeline,
    lead_time_model: Pipeline,
) -> Tuple[float, float, float]:
    base_features = _node_to_features(node_data)
    perturbed_features = dict(base_features)
    for disruption_type, severity in disruption_plan:
        perturbed_features = _perturb_features(perturbed_features, disruption_type, severity)

    risk_pred = float(risk_model.predict(_as_feature_vector(perturbed_features, FEATURE_COLS))[0])
    simulated_risk = float(np.clip(round(risk_pred, 2), 0.0, 100.0))

    ltv_cols = [c for c in FEATURE_COLS if c != "lead_time_volatility_days"]
    lead_time_pred = float(
        lead_time_model.predict(_as_feature_vector(perturbed_features, ltv_cols))[0]
    )
    lead_time_increase = max(
        0.0,
        round(lead_time_pred - base_features["lead_time_volatility_days"], 2),
    )

    capacity_impact = max(
        0.0,
        round(
            perturbed_features["capacity_utilization_pct"]
            - base_features["capacity_utilization_pct"],
            3,
        ),
    )

    return simulated_risk, lead_time_increase, capacity_impact


def _bfs_cascade(
    origin_node_id: str,
    nodes_by_id: Dict[str, Dict[str, Any]],
    disruption_plan: List[Tuple[str, float]],
    max_hops: int,
    risk_threshold: float,
    risk_model: Pipeline,
    lead_time_model: Pipeline,
) -> List[Dict[str, Any]]:
    queue: collections.deque = collections.deque()
    visited: Set[str] = {origin_node_id}
    affected_nodes: List[Dict[str, Any]] = []

    origin_edges = nodes_by_id.get(origin_node_id, {}).get("edges", [])
    for next_node_id in origin_edges:
        queue.append((next_node_id, 1, HOP_ATTENUATION))

    while queue:
        node_id, hop, attenuation_scale = queue.popleft()
        if node_id in visited or hop > max_hops or attenuation_scale <= 0:
            continue

        visited.add(node_id)
        node = nodes_by_id.get(node_id)
        if node is None:
            continue

        hop_disruption_plan = [
            (disruption_type, severity * attenuation_scale)
            for disruption_type, severity in disruption_plan
        ]

        effective_severity = max((severity for _, severity in hop_disruption_plan), default=0.0)
        if effective_severity <= 0:
            continue

        risk_score, lead_time_inc, cap_impact = _ml_predict_disruption(
            node,
            hop_disruption_plan,
            risk_model,
            lead_time_model,
        )

        if risk_score < risk_threshold:
            continue

        affected_nodes.append(
            {
                "node_id": node_id,
                "hop": hop,
                "risk_score": round(risk_score, 2),
                "lead_time_increase": round(lead_time_inc, 2),
                "capacity_impact_pct": round(cap_impact, 3),
                "effective_severity": round(effective_severity, 3),
            }
        )

        if hop < max_hops:
            next_scale = attenuation_scale * HOP_ATTENUATION
            for neighbor_id in node.get("edges", []):
                if neighbor_id not in visited:
                    queue.append((neighbor_id, hop + 1, next_scale))

    affected_nodes.sort(key=lambda item: (-item["risk_score"], item["hop"]))
    return affected_nodes


@app.post("/analytics/simulate", response_model=SimulationResponse)
def simulate(req: SimulationRequest) -> SimulationResponse:
    if req.severity < 0 or req.severity > 10:
        raise HTTPException(status_code=400, detail="severity must be between 0 and 10")

    disruption_items = req.disruptions or []
    if disruption_items:
        disruption_plan_raw: List[Tuple[str, float]] = []
        for item in disruption_items:
            disruption_type = str(item.get("disruption_type") or "").strip()
            if disruption_type not in VALID_DISRUPTIONS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported disruption_type '{disruption_type}'",
                )
            item_severity = float(item.get("severity", req.severity))
            if item_severity < 0 or item_severity > 10:
                raise HTTPException(
                    status_code=400,
                    detail="Each disruption severity must be between 0 and 10",
                )
            disruption_plan_raw.append((disruption_type, item_severity))
    else:
        if req.disruption_type not in VALID_DISRUPTIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported disruption_type '{req.disruption_type}'",
            )
        disruption_plan_raw = [(req.disruption_type, req.severity)]

    risk_model = state.get("simulation_risk_model")
    lead_time_model = state.get("simulation_lead_time_model")
    if risk_model is None or lead_time_model is None:
        raise HTTPException(
            status_code=503,
            detail="Simulation ML models unavailable. Call /reload or restart service.",
        )

    if not req.nodes:
        raise HTTPException(status_code=400, detail="Payload contains no nodes")

    nodes_by_id: Dict[str, Dict[str, Any]] = {}
    for node in req.nodes:
        raw = node.model_dump() if hasattr(node, "model_dump") else node.dict()
        edges = raw.get("edges") or []
        raw["edges"] = [str(edge_id) for edge_id in edges if edge_id]
        nodes_by_id[str(raw["node_id"])] = raw

    origin_node = nodes_by_id.get(req.origin_node_id)
    if origin_node is None:
        raise HTTPException(status_code=400, detail="origin_node_id not found in payload")

    normalized_disruption_plan = [
        (disruption_type, severity / 10.0)
        for disruption_type, severity in disruption_plan_raw
    ]

    origin_risk, origin_lt_inc, origin_cap_impact = _ml_predict_disruption(
        origin_node,
        normalized_disruption_plan,
        risk_model,
        lead_time_model,
    )

    affected_nodes = _bfs_cascade(
        origin_node_id=req.origin_node_id,
        nodes_by_id=nodes_by_id,
        disruption_plan=normalized_disruption_plan,
        max_hops=max(1, int(req.max_hops)),
        risk_threshold=max(0.0, float(req.risk_threshold)),
        risk_model=risk_model,
        lead_time_model=lead_time_model,
    )

    impacted_node_ids = {req.origin_node_id}
    impacted_node_ids.update(str(item["node_id"]) for item in affected_nodes)

    affected_products: List[str] = []
    seen_products: Set[str] = set()
    for node_id in impacted_node_ids:
        node = nodes_by_id.get(node_id)
        if node is None:
            continue
        for product in _extract_product_identifiers(node):
            if product.lower() not in seen_products:
                seen_products.add(product.lower())
                affected_products.append(product)

    timeline, ripple_by_hop = _build_timeline_and_ripple(
        origin_risk=origin_risk,
        origin_lt_inc=origin_lt_inc,
        affected_nodes=affected_nodes,
    )

    return SimulationResponse(
        model=str(state.get("simulation_model_version") or "simulation_ml_v1"),
        origin_node_id=req.origin_node_id,
        disruption_type=(
            req.disruption_type if len(disruption_plan_raw) == 1 else "multi_disruption"
        ),
        severity=req.severity,
        origin_risk=round(origin_risk, 2),
        origin_lt_inc=round(origin_lt_inc, 2),
        origin_cap_impact=round(origin_cap_impact, 3),
        affected_nodes=affected_nodes,
        total_affected=len(affected_nodes),
        affected_products=affected_products,
        impact_timeline=timeline,
        ripple_by_hop=ripple_by_hop,
        applied_disruptions=[
            {"disruption_type": disruption_type, "severity": severity}
            for disruption_type, severity in disruption_plan_raw
        ],
    )
