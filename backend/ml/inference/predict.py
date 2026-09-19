"""
predict.py — AegisAI Phase 1 (Dataset 1: Credit Card Fraud Detection)

Standalone inference script.  Loads the trained model and accepts input
feature vectors from the command line or a CSV, then outputs predictions.

Usage:
  # Predict on a single transaction (29 comma-separated values: V1-V28, Amount)
  python backend/ml/inference/predict.py --vector "0.1,0.2,...,150.00"

  # Batch prediction on a CSV of unlabelled transactions
  python backend/ml/inference/predict.py --csv path/to/transactions.csv

The CSV should have columns:  V1,V2,...,V28,Amount  (no Class column needed)
"""

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np

ROOT       = Path(__file__).resolve().parents[2]
MODEL_PATH = ROOT / "data" / "models" / "fraud" / "model.joblib"


def load_model():
    if not MODEL_PATH.exists():
        print(
            f"[ERROR] Model not found at {MODEL_PATH}.\n"
            "Run train_model.py first to generate the model artifact.",
            file=sys.stderr,
        )
        sys.exit(1)
    return joblib.load(MODEL_PATH)


def predict_single(model, vector_str: str) -> dict:
    """Predict on one comma-separated feature string."""
    values = [float(v.strip()) for v in vector_str.split(",")]
    if len(values) != 29:
        raise ValueError(f"Expected 29 feature values (V1-V28 + Amount), got {len(values)}")

    X = np.array(values).reshape(1, -1)
    label = int(model.predict(X)[0])

    try:
        proba = model.predict_proba(X)[0]
        fraud_prob = round(float(proba[1]), 4)
    except Exception:
        fraud_prob = None

    return {
        "prediction":   label,
        "label":        "FRAUD" if label == 1 else "LEGITIMATE",
        "fraud_probability": fraud_prob,
    }


def predict_csv(model, csv_path: str) -> list[dict]:
    """Batch prediction on a CSV file."""
    import pandas as pd

    df = pd.read_csv(csv_path)
    feature_cols = [f"V{i}" for i in range(1, 29)] + ["Amount"]
    missing = [c for c in feature_cols if c not in df.columns]
    if missing:
        raise ValueError(f"CSV is missing required columns: {missing}")

    X = df[feature_cols].values
    labels  = model.predict(X).tolist()

    try:
        proba   = model.predict_proba(X)[:, 1].tolist()
    except Exception:
        proba   = [None] * len(labels)

    results = []
    for i, (lbl, p) in enumerate(zip(labels, proba)):
        results.append({
            "row":              i,
            "prediction":       int(lbl),
            "label":            "FRAUD" if lbl == 1 else "LEGITIMATE",
            "fraud_probability": round(float(p), 4) if p is not None else None,
        })
    return results


def main():
    parser = argparse.ArgumentParser(description="AegisAI Fraud Detection — Inference")
    group  = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--vector", type=str, help="Comma-separated feature values (V1-V28, Amount)")
    group.add_argument("--csv",    type=str, help="Path to a CSV of transactions to classify")
    args = parser.parse_args()

    print("[predict] Loading model …")
    model = load_model()
    print(f"[predict] Model loaded from {MODEL_PATH}")

    if args.vector:
        result = predict_single(model, args.vector)
        print(json.dumps(result, indent=2))
    else:
        results = predict_csv(model, args.csv)
        fraud_count = sum(1 for r in results if r["prediction"] == 1)
        print(f"[predict] Processed {len(results):,} transactions — {fraud_count} flagged as FRAUD")
        out_path = Path(args.csv).with_suffix(".predictions.json")
        out_path.write_text(json.dumps(results, indent=2))
        print(f"[predict] Predictions written to {out_path}")


if __name__ == "__main__":
    main()
