"""
generate_data.py — Synthetic Weekly Pharmaceutical Demand Generator
==================================================================
Generates realistic weekly demand data for 10 pharma products across
20 Maharashtra cities with seasonal patterns and city-tier scaling.

Inputs:  cities.json (city metadata)
Outputs: data/synthetic_demand.csv
Run:     python generate_data.py
"""

import os
import json
import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Reproducibility
# ---------------------------------------------------------------------------
np.random.seed(42)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
BASE_UNITS = 1000  # base weekly demand units for a metro city with weight=1.0

# Tier scaling factors relative to metro
TIER_SCALE = {
    "metro": 1.0,
    "tier1": 0.55,
    "tier2": 0.30,
}

# Date range: weekly Mondays over 2 full years
DATE_RANGE = pd.date_range(start="2022-01-03", end="2023-12-25", freq="W-MON")

# ---------------------------------------------------------------------------
# Product definitions
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

# ---------------------------------------------------------------------------
# Seasonality rules: month -> multiplicative boost per category
# ---------------------------------------------------------------------------

def _seasonal_factor(month: int, category: str) -> float:
    """Return the seasonal multiplier for a given month and product category."""
    if category == "fever_cold":
        # +60% spike Nov–Jan (winter)
        if month in (11, 12, 1):
            return 1.60
        return 1.0

    if category == "antibiotic":
        # +50% spike Nov–Feb
        if month in (11, 12, 1, 2):
            return 1.50
        return 1.0

    if category == "OTC":
        # +80% spike Jun–Sep (monsoon)
        if month in (6, 7, 8, 9):
            return 1.80
        return 1.0

    if category == "chronic":
        # Flat demand, ±10% random variation (handled via noise)
        return 1.0

    if category == "gastro":
        # +40% spike Jun–Aug
        if month in (6, 7, 8):
            return 1.40
        return 1.0

    return 1.0


# ---------------------------------------------------------------------------
# Main generation logic
# ---------------------------------------------------------------------------

def generate() -> pd.DataFrame:
    """Generate synthetic demand data and return as a DataFrame."""

    # Load city metadata
    with open("cities.json", "r") as f:
        cities = json.load(f)

    rows = []

    for date in DATE_RANGE:
        month = date.month
        for city in cities:
            city_name = city["city"]
            tier = city["tier"]
            pop_weight = city["population_weight"]
            tier_scale = TIER_SCALE[tier]

            for product_name, product_cfg in PRODUCTS.items():
                base = BASE_UNITS * product_cfg["base_multiplier"]
                seasonal = _seasonal_factor(month, product_cfg["category"])
                noise = 1.0 + np.random.normal(0, product_cfg["noise_std"])

                demand = base * pop_weight * tier_scale * seasonal * noise
                demand = max(int(round(demand)), 0)  # no negative demand

                rows.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "city": city_name,
                    "product": product_name,
                    "category": product_cfg["category"],
                    "tier": tier,
                    "population_weight": pop_weight,
                    "demand_units": demand,
                })

    return pd.DataFrame(rows)


if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    df = generate()
    df.to_csv("data/synthetic_demand.csv", index=False)
    print(f"Generated {len(df):,} rows -> data/synthetic_demand.csv")
    print(f"Date range : {df['date'].min()} to {df['date'].max()}")
    print(f"Cities     : {df['city'].nunique()}")
    print(f"Products   : {df['product'].nunique()}")
    print(df.head(10))
