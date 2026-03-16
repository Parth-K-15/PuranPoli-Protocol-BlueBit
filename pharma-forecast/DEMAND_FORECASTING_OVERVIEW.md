# Demand Forecasting Project: End-to-End Thinking Process

## 1) Project Objective

This project forecasts **weekly pharmaceutical demand per city** and exports predictions as JSON for downstream visualization (for example, city heatmaps).

The core idea is:
1. Generate realistic weekly demand data (synthetic but behavior-driven).
2. Engineer time-series + location + product features.
3. Train a supervised regression model (XGBoost) to learn demand patterns.
4. Predict future weekly demand by city for a selected product.
5. Normalize and classify predictions into demand intensity levels.

---

## 2) High-Level Pipeline (How the system thinks)

### Step A — Data generation (`generate_data.py`)
- Creates weekly demand records from **2022-01-03 to 2023-12-25** (`W-MON`).
- Simulates demand using:
  - base demand,
  - product-specific multipliers,
  - city population and tier effects,
  - seasonal boosts,
  - random noise.
- Saves the dataset to `data/synthetic_demand.csv`.

### Step B — Feature engineering (`features.py`)
- Converts raw rows into model-ready features:
  - temporal signals (week/month/quarter/season flags),
  - lags (1, 4, 52 weeks),
  - rolling statistics,
  - encoded tier/category,
  - population weight.
- Drops only rows where `lag_1w` is not available (first row per city-product history).

### Step C — Training (`train.py`)
- Uses engineered features to train `XGBRegressor`.
- Uses a **time-based split** (train on earlier dates, test on later dates).
- Evaluates using **MAPE** and **RMSE**.
- Saves:
  - trained model (`models/xgb_demand_model.pkl`),
  - feature-importance plot (`models/feature_importance.png`).

### Step D — Forecasting (`predict.py`)
- Loads trained model and historical data.
- Creates placeholder future rows for the requested product and future Monday dates.
- Rebuilds features on combined historical+future rows.
- Predicts `predicted_units`, scales into `demand_index` (0 to 1), and tags each city as `high/medium/low`.
- Exports forecast JSON to `output/` (and similar files in `json_files_demand/`).

---

## 3) Dataset Overview

## 3.1 Main Training Dataset
**File:** `data/synthetic_demand.csv`

**Columns:**
- `date` (YYYY-MM-DD, weekly Monday)
- `city`
- `product`
- `category`
- `tier`
- `population_weight`
- `demand_units` (target)

**Cardinality from code design:**
- Cities: **20**
- Products: **10**
- Weeks: **104**
- Total rows: **20 × 10 × 104 = 20,800** rows

## 3.2 City Metadata Dataset
**File:** `cities.json`

**Columns/fields:**
- `city`
- `lat`
- `lng`
- `tier` (`metro`, `tier1`, `tier2`)
- `population_weight` (relative demand weight)

This file drives:
- geographic context (lat/lng for UI output),
- market-size scaling,
- tier-based scaling and encoding.

## 3.3 Forecast Output Dataset (JSON)
**Files:**
- `pharma-forecast/output/*.json`
- `json_files_demand/*.json`

**Schema:**
- `product`
- `forecast_week` (ISO week, e.g., `2024-W04`)
- `generated_at` (UTC timestamp)
- `cities` (array), each with:
  - `city`, `lat`, `lng`
  - `predicted_units`
  - `demand_index` (0–1 min-max normalized across cities)
  - `demand_level` (`high`, `medium`, `low`)

---

## 4) Parameters Considered in Dataset Generation

## 4.1 Global constants
- `BASE_UNITS = 1000`
- `TIER_SCALE`:
  - `metro: 1.0`
  - `tier1: 0.55`
  - `tier2: 0.30`
- Random seed: `42` (reproducibility)

## 4.2 Product-level parameters

| Product | Category | Base Multiplier | Noise Std |
|---|---|---:|---:|
| Paracetamol | fever_cold | 1.8 | 0.10 |
| Azithromycin | antibiotic | 1.2 | 0.12 |
| ORS Sachets | OTC | 2.0 | 0.15 |
| Cetirizine | OTC | 1.5 | 0.12 |
| Metformin | chronic | 1.4 | 0.05 |
| Insulin Glargine | chronic | 0.8 | 0.05 |
| Omeprazole | gastro | 1.3 | 0.10 |
| Amoxicillin | antibiotic | 1.4 | 0.12 |
| Vitamin D3 | chronic | 1.0 | 0.05 |
| Ibuprofen | fever_cold | 1.6 | 0.10 |

## 4.3 Seasonality parameters (month-based multipliers)
- `fever_cold`: +60% in **Nov–Jan** (`×1.60`)
- `antibiotic`: +50% in **Nov–Feb** (`×1.50`)
- `OTC`: +80% in **Jun–Sep** (`×1.80`)
- `gastro`: +40% in **Jun–Aug** (`×1.40`)
- `chronic`: no explicit seasonal boost (`×1.00`, only noise variation)

## 4.4 Demand formula used during generation
For each `(date, city, product)` row:

`demand = BASE_UNITS × base_multiplier × population_weight × tier_scale × seasonal_factor × noise`

Where:
- `noise = 1 + Normal(0, noise_std)`
- final demand is rounded to integer and clipped at minimum 0.

---

## 5) Feature Engineering Parameters (Model Inputs)

**Feature columns used by model (ordered):**
1. `week_of_year`
2. `month`
3. `quarter`
4. `is_monsoon`
5. `is_winter`
6. `lag_1w`
7. `lag_4w`
8. `lag_52w`
9. `rolling_mean_4w`
10. `rolling_mean_8w`
11. `rolling_std_4w`
12. `tier_encoded`
13. `population_weight`
14. `category_encoded`

### Encodings
- `tier_encoded`:
  - metro → 2
  - tier1 → 1
  - tier2 → 0
- `category_encoded`:
  - fever_cold → 0
  - antibiotic → 1
  - OTC → 2
  - chronic → 3
  - gastro → 4

### Lag and rolling behavior
- Grouping key: `(city, product)`
- Lags: `shift(1)`, `shift(4)`, `shift(52)`
- `lag_52w` missing values are filled from `lag_4w`
- Rolling windows use shifted history (to avoid peeking into current target)
  - `rolling_mean_4w` with `min_periods=1`
  - `rolling_mean_8w` with `min_periods=1`
  - `rolling_std_4w` with `min_periods=2`, then fill NaN with 0
- Rows dropped: only where `lag_1w` is NaN

---

## 6) Modeling Parameters

## 6.1 Algorithm
- `XGBRegressor` (gradient-boosted decision trees for non-linear tabular regression).

## 6.2 Hyperparameters used
- `n_estimators=500`
- `max_depth=7`
- `learning_rate=0.05`
- `subsample=0.8`
- `colsample_bytree=0.8`
- `min_child_weight=5`
- `reg_alpha=0.1`
- `reg_lambda=1.0`
- `random_state=42`
- `n_jobs=-1`

## 6.3 Train/test strategy
- Time-based split (not random split).
- Split date = earliest feature date + 20 months.
- Earlier period = train, later period = test.

## 6.4 Evaluation metrics
- **MAPE** for relative percentage error.
- **RMSE** for absolute scale-sensitive error.

---

## 7) Forecasting Logic Parameters

- CLI inputs:
  - `--product` (required)
  - `--weeks_ahead` (default `1`)
- Forecast dates are next Monday weeks after latest historical date.
- Predictions are clipped to non-negative integers.
- `demand_index` is min-max normalized across cities for that forecast week:
  - if all predictions equal, index defaults to `0.5`
- Demand level thresholds:
  - `high` if `demand_index > 0.66`
  - `medium` if `0.33 <= demand_index <= 0.66`
  - `low` if `< 0.33`

---

## 8) What this design captures well

- Strong seasonality behavior by product type.
- City hierarchy (metro/tier1/tier2) and city-size effects.
- Temporal momentum via lag and rolling features.
- Product-specific demand patterns.
- Deployment-friendly JSON output for visualization.

---

## 9) Known assumptions and limitations

- Historical demand is synthetic, not real transactional data.
- No explicit external drivers (price, promotions, stock-outs, holidays, epidemics, weather API).
- One-state city distribution (Maharashtra-focused city list).
- No probabilistic uncertainty intervals in output.

---

## 10) Quick Reference: Files and Roles

- `generate_data.py` → builds synthetic demand dataset.
- `features.py` → creates model features.
- `train.py` → trains model and reports metrics.
- `predict.py` → creates future forecast JSON files.
- `cities.json` → city metadata and weights.
- `data/synthetic_demand.csv` → training base dataset.
- `output/*.json` + `json_files_demand/*.json` → weekly city forecast artifacts.

---

## 11) Summary

The forecasting system is built around a practical structure: **domain-inspired synthetic generation + time-series feature engineering + XGBoost regression + JSON-first forecast serving**. The parameterization (city tier, population weight, product multipliers, category seasonality, lag/rolling windows, and model hyperparameters) is the core reasoning engine that drives demand estimation quality in this project.
