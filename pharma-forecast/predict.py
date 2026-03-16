"""
predict.py — Forecast Generator for UI Heatmap
================================================
Loads trained model and generates per-city demand forecasts as JSON,
ready for consumption by the heatmap UI team.

Inputs:  models/xgb_demand_model.pkl, cities.json, data/synthetic_demand.csv
Outputs: output/{product}_{week_date}.json
Run:     python predict.py --product Paracetamol --weeks_ahead 1
"""

import os
import json
import argparse
from datetime import datetime

import numpy as np
import pandas as pd
import joblib

from features import build_features, get_feature_columns, TIER_ENCODING, CATEGORY_ENCODING

# ---------------------------------------------------------------------------
# Reproducibility
# ---------------------------------------------------------------------------
np.random.seed(42)

# ---------------------------------------------------------------------------
# Product metadata (mirrors generate_data.py)
# ---------------------------------------------------------------------------
PRODUCTS = {
    "Paracetamol":      {"base_multiplier": 1.8, "category": "fever_cold",  "noise_std": 0.10},
    "Azithromycin":     {"base_multiplier": 1.2, "category": "antibiotic",  "noise_std": 0.12},
    "ORS Sachets":      {"base_multiplier": 2.0, "category": "OTC",         "noise_std": 0.15},
    "Cetirizine":       {"base_multiplier": 1.5, "category": "OTC",         "noise_std": 0.12},
    "Metformin":        {"base_multiplier": 1.4, "category": "chronic",     "noise_std": 0.05},
    "Insulin Glargine": {"base_multiplier": 0.8, "category": "chronic",     "noise_std": 0.05},
    "Omeprazole":       {"base_multiplier": 1.3, "category": "gastro",      "noise_std": 0.10},
    "Amoxicillin":      {"base_multiplier": 1.4, "category": "antibiotic",  "noise_std": 0.12},
    "Vitamin D3":       {"base_multiplier": 1.0, "category": "chronic",     "noise_std": 0.05},
    "Ibuprofen":        {"base_multiplier": 1.6, "category": "fever_cold",  "noise_std": 0.10},
}


def _demand_level(index: float) -> str:
    """Classify demand index into high / medium / low."""
    if index > 0.66:
        return "high"
    elif index >= 0.33:
        return "medium"
    return "low"


def _build_future_features(
    historical_df: pd.DataFrame,
    cities: list,
    product: str,
    forecast_dates: list,
) -> pd.DataFrame:
    """
    Construct feature rows for future weeks by appending placeholder rows
    to the historical data and re-running the feature pipeline.
    """
    product_cfg = PRODUCTS[product]
    category = product_cfg["category"]

    # Filter historical data to the target product only
    hist = historical_df[historical_df["product"] == product].copy()

    # Build placeholder rows for future dates
    future_rows = []
    for date in forecast_dates:
        for city in cities:
            future_rows.append({
                "date": date.strftime("%Y-%m-%d"),
                "city": city["city"],
                "product": product,
                "category": category,
                "tier": city["tier"],
                "population_weight": city["population_weight"],
                "demand_units": 0,  # placeholder — will not be used
            })

    future_df = pd.DataFrame(future_rows)
    combined = pd.concat([hist, future_df], ignore_index=True)

    # Run feature pipeline on the combined data
    feat_df, _ = build_features(combined)

    # Keep only the future rows
    feat_df["date"] = pd.to_datetime(feat_df["date"])
    future_mask = feat_df["date"].isin(forecast_dates)
    return feat_df[future_mask].reset_index(drop=True)


def main():
    parser = argparse.ArgumentParser(description="Generate demand forecast JSON")
    parser.add_argument("--product", type=str, required=True,
                        help="Product name, e.g. 'Paracetamol'")
    parser.add_argument("--weeks_ahead", type=int, default=1,
                        help="Number of weeks ahead to forecast (default: 1)")
    args = parser.parse_args()

    product = args.product
    weeks_ahead = args.weeks_ahead

    if product not in PRODUCTS:
        print(f"Error: Unknown product '{product}'.")
        print(f"Available: {', '.join(PRODUCTS.keys())}")
        return

    # Load resources
    print(f"Loading model and data for '{product}'...")
    model = joblib.load("models/xgb_demand_model.pkl")
    with open("cities.json", "r") as f:
        cities = json.load(f)
    historical = pd.read_csv("data/synthetic_demand.csv")

    # Determine forecast dates (next N Mondays after the last date in data)
    last_date = pd.to_datetime(historical["date"].max())
    forecast_dates = pd.date_range(
        start=last_date + pd.Timedelta(weeks=1),
        periods=weeks_ahead,
        freq="W-MON",
    )

    feature_cols = get_feature_columns()
    os.makedirs("output", exist_ok=True)

    for fdate in forecast_dates:
        print(f"\nForecasting week: {fdate.strftime('%Y-%m-%d')}...")

        # Build features for this forecast date
        feat_df = _build_future_features(historical, cities, product, [fdate])

        if feat_df.empty:
            print("  WARNING: Could not build features (insufficient history). Skipping.")
            continue

        # Predict
        X = feat_df[feature_cols].values
        predictions = model.predict(X)
        feat_df["predicted_units"] = predictions.clip(min=0).astype(int)

        # Normalise to 0–1 demand_index (min-max across cities)
        min_pred = feat_df["predicted_units"].min()
        max_pred = feat_df["predicted_units"].max()
        if max_pred > min_pred:
            feat_df["demand_index"] = (
                (feat_df["predicted_units"] - min_pred) / (max_pred - min_pred)
            )
        else:
            feat_df["demand_index"] = 0.5  # all equal

        feat_df["demand_index"] = feat_df["demand_index"].round(4)

        # Build city lookup for lat/lng
        city_lookup = {c["city"]: c for c in cities}

        # Assemble JSON
        iso_week = fdate.strftime("%G-W%V")
        output = {
            "product": product,
            "forecast_week": iso_week,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "cities": [],
        }

        for _, row in feat_df.iterrows():
            cname = row["city"]
            cmeta = city_lookup[cname]
            di = round(row["demand_index"], 4)
            output["cities"].append({
                "city": cname,
                "lat": cmeta["lat"],
                "lng": cmeta["lng"],
                "predicted_units": int(row["predicted_units"]),
                "demand_index": di,
                "demand_level": _demand_level(di),
            })

        # Sort cities by demand_index descending for readability
        output["cities"].sort(key=lambda c: c["demand_index"], reverse=True)

        # Write JSON
        fname = f"output/{product}_{fdate.strftime('%Y-%m-%d')}.json"
        with open(fname, "w") as f:
            json.dump(output, f, indent=2)
        print(f"  Saved -> {fname}")

        # Print summary
        print(f"  {'City':<18} {'Predicted':>10} {'Index':>7} {'Level':<8}")
        print(f"  {'-'*45}")
        for c in output["cities"][:5]:
            print(f"  {c['city']:<18} {c['predicted_units']:>10} "
                  f"{c['demand_index']:>7.4f} {c['demand_level']:<8}")
        if len(output["cities"]) > 5:
            print(f"  ... and {len(output['cities']) - 5} more cities")


if __name__ == "__main__":
    main()
