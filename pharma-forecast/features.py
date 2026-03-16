"""
features.py — Feature Engineering Pipeline
===========================================
Transforms raw demand CSV into a feature matrix suitable for XGBoost.

Inputs:  pandas DataFrame with columns [date, city, product, category,
         tier, population_weight, demand_units]
Outputs: Feature DataFrame + target column (demand_units)
Run:     Imported by train.py and predict.py — not run standalone.
"""

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Encoding maps
# ---------------------------------------------------------------------------
TIER_ENCODING = {"metro": 2, "tier1": 1, "tier2": 0}

CATEGORY_ENCODING = {
    "fever_cold": 0,
    "antibiotic": 1,
    "OTC": 2,
    "chronic": 3,
    "gastro": 4,
}


def get_feature_columns() -> list:
    """Return the ordered list of feature column names used by the model."""
    return [
        "week_of_year",
        "month",
        "quarter",
        "is_monsoon",
        "is_winter",
        "lag_1w",
        "lag_4w",
        "lag_52w",
        "rolling_mean_4w",
        "rolling_mean_8w",
        "rolling_std_4w",
        "tier_encoded",
        "population_weight",
        "category_encoded",
    ]


def build_features(df: pd.DataFrame) -> tuple:
    """
    Build feature matrix from raw demand data.

    Parameters
    ----------
    df : pd.DataFrame
        Raw demand data with columns: date, city, product, category,
        tier, population_weight, demand_units.

    Returns
    -------
    features_df : pd.DataFrame
        DataFrame containing feature columns + metadata columns
        (date, city, product) for traceability, with NaN rows dropped.
    target : pd.Series
        Corresponding demand_units target values.
    """
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["city", "product", "date"]).reset_index(drop=True)

    # ------------------------------------------------------------------
    # Temporal features
    # ------------------------------------------------------------------
    df["week_of_year"] = df["date"].dt.isocalendar().week.astype(int)
    df["month"]        = df["date"].dt.month
    df["quarter"]      = df["date"].dt.quarter
    df["is_monsoon"]   = df["month"].isin([6, 7, 8, 9]).astype(int)
    df["is_winter"]    = df["month"].isin([11, 12, 1]).astype(int)

    # ------------------------------------------------------------------
    # Lag features (per city x product group)
    # ------------------------------------------------------------------
    group = df.groupby(["city", "product"])["demand_units"]

    df["lag_1w"]  = group.shift(1)
    df["lag_4w"]  = group.shift(4)
    df["lag_52w"] = group.shift(52)

    # Fill lag_52w NaNs with lag_4w as fallback (keeps early rows usable)
    df["lag_52w"] = df["lag_52w"].fillna(df["lag_4w"])

    # ------------------------------------------------------------------
    # Rolling features (per city x product group)
    # min_periods=1 ensures no rows are dropped due to insufficient history
    # ------------------------------------------------------------------
    df["rolling_mean_4w"] = group.transform(
        lambda x: x.shift(1).rolling(window=4, min_periods=1).mean()
    )
    df["rolling_mean_8w"] = group.transform(
        lambda x: x.shift(1).rolling(window=8, min_periods=1).mean()
    )
    df["rolling_std_4w"] = group.transform(
        lambda x: x.shift(1).rolling(window=4, min_periods=2).std().fillna(0)
    )

    # ------------------------------------------------------------------
    # City & product encoding
    # ------------------------------------------------------------------
    df["tier_encoded"]     = df["tier"].map(TIER_ENCODING)
    df["category_encoded"] = df["category"].map(CATEGORY_ENCODING)

    # ------------------------------------------------------------------
    # Drop only rows where lag_1w is NaN (very first row per group only)
    # All other NaNs have been handled above
    # ------------------------------------------------------------------
    df = df.dropna(subset=["lag_1w"]).reset_index(drop=True)

    # Keep metadata columns alongside features for traceability
    feature_cols = get_feature_columns()
    output_cols  = ["date", "city", "product", "category", "tier"] + feature_cols + ["demand_units"]
    df = df[output_cols]

    target = df["demand_units"]
    return df, target