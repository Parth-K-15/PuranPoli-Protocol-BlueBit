"""
train.py — XGBoost Model Training & Evaluation
================================================
Trains an XGBoost regressor on engineered features from synthetic
demand data. Evaluates with MAPE and RMSE, saves model and plots.

Inputs:  data/synthetic_demand.csv
Outputs: models/xgb_demand_model.pkl, models/feature_importance.png
Run:     python train.py
"""

import os
import numpy as np
import pandas as pd
import joblib
import matplotlib
matplotlib.use("Agg")  # non-interactive backend for PNG saving
import matplotlib.pyplot as plt
from xgboost import XGBRegressor
from sklearn.metrics import mean_squared_error

from features import build_features, get_feature_columns

# ---------------------------------------------------------------------------
# Reproducibility
# ---------------------------------------------------------------------------
np.random.seed(42)

# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Mean Absolute Percentage Error (avoids division by zero)."""
    mask = y_true != 0
    return np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100


def rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Root Mean Squared Error."""
    return np.sqrt(mean_squared_error(y_true, y_pred))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # Load raw data
    print("Loading data...")
    raw = pd.read_csv("data/synthetic_demand.csv")
    print(f"  Raw rows: {len(raw):,}")

    # Build features
    print("Building features...")
    df, target = build_features(raw)
    feature_cols = get_feature_columns()
    print(f"  Feature rows: {len(df):,}")

    # ------------------------------------------------------------------
    # Time-based train/test split: first 20 months train, last 4 test
    # ------------------------------------------------------------------
    df["date"] = pd.to_datetime(df["date"])
    min_date = df["date"].min()
    # 20 months from the earliest date in the feature set
    split_date = min_date + pd.DateOffset(months=20)

    train_mask = df["date"] < split_date
    test_mask = df["date"] >= split_date

    X_train = df.loc[train_mask, feature_cols].values
    y_train = target[train_mask].values
    X_test = df.loc[test_mask, feature_cols].values
    y_test = target[test_mask].values

    print(f"  Train: {len(X_train):,} rows | Test: {len(X_test):,} rows")
    print(f"  Split date: {split_date.date()}")

    # ------------------------------------------------------------------
    # Train XGBoost
    # ------------------------------------------------------------------
    print("\nTraining XGBoost...")
    model = XGBRegressor(
        n_estimators=500,
        max_depth=7,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=5,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=50,
    )

    # ------------------------------------------------------------------
    # Predictions
    # ------------------------------------------------------------------
    y_pred = model.predict(X_test)

    # ------------------------------------------------------------------
    # Overall metrics
    # ------------------------------------------------------------------
    overall_mape = mape(y_test, y_pred)
    overall_rmse = rmse(y_test, y_pred)
    print("\n" + "=" * 60)
    print(f"OVERALL  MAPE: {overall_mape:.2f}%   RMSE: {overall_rmse:.1f}")
    print("=" * 60)

    # ------------------------------------------------------------------
    # Per-product metrics
    # ------------------------------------------------------------------
    test_df = df.loc[test_mask].copy()
    test_df["predicted"] = y_pred

    print(f"\n{'Product':<20} {'MAPE (%)':>10} {'RMSE':>10}")
    print("-" * 42)
    for product in sorted(test_df["product"].unique()):
        mask = test_df["product"] == product
        yt = test_df.loc[mask, "demand_units"].values
        yp = test_df.loc[mask, "predicted"].values
        print(f"{product:<20} {mape(yt, yp):>10.2f} {rmse(yt, yp):>10.1f}")

    # ------------------------------------------------------------------
    # Sample predictions table (5 rows per product)
    # ------------------------------------------------------------------
    print("\n\nSAMPLE PREDICTIONS (5 rows per product):")
    print(f"{'Product':<20} {'City':<15} {'Date':<12} {'Actual':>8} {'Predicted':>10}")
    print("-" * 67)
    for product in sorted(test_df["product"].unique()):
        subset = test_df[test_df["product"] == product].head(5)
        for _, row in subset.iterrows():
            print(
                f"{row['product']:<20} {row['city']:<15} "
                f"{row['date'].strftime('%Y-%m-%d'):<12} "
                f"{int(row['demand_units']):>8} {int(row['predicted']):>10}"
            )

    # ------------------------------------------------------------------
    # Save model
    # ------------------------------------------------------------------
    os.makedirs("models", exist_ok=True)
    model_path = "models/xgb_demand_model.pkl"
    joblib.dump(model, model_path)
    print(f"\nModel saved to {model_path}")

    # ------------------------------------------------------------------
    # Feature importance plot
    # ------------------------------------------------------------------
    importances = model.feature_importances_
    indices = np.argsort(importances)[::-1]

    plt.figure(figsize=(10, 6))
    plt.title("Feature Importance (XGBoost)")
    plt.bar(range(len(feature_cols)), importances[indices], align="center")
    plt.xticks(range(len(feature_cols)),
               [feature_cols[i] for i in indices], rotation=45, ha="right")
    plt.ylabel("Importance (gain)")
    plt.tight_layout()
    plot_path = "models/feature_importance.png"
    plt.savefig(plot_path, dpi=150)
    plt.close()
    print(f"Feature importance plot saved to {plot_path}")


if __name__ == "__main__":
    main()
