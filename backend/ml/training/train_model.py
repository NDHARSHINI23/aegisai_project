"""
train_model.py — AegisAI Phase 1 (Dataset 1: Credit Card Fraud Detection)

Reads the validated fraud dataset, trains both a Logistic Regression
and a Random Forest classifier with class-imbalance handling, then:
  - saves the best model to  data/models/fraud/model.joblib
  - saves a training metadata JSON to data/models/fraud/training_metadata.json

Expects:  backend/data/raw/fraud/creditcard.csv
Writes:   backend/data/models/fraud/model.joblib
          backend/data/models/fraud/training_metadata.json
"""

import json
import sys
import time
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

ROOT        = Path(__file__).resolve().parents[2]
RAW_PATH    = ROOT / "data" / "raw" / "fraud" / "creditcard.csv"
MODELS_DIR  = ROOT / "data" / "models" / "fraud"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

RANDOM_SEED  = 42
TEST_SIZE    = 0.20
MAX_SAMPLES  = 50_000          # cap for fast local iteration; set None for full


def load_and_split(max_samples: int | None = MAX_SAMPLES):
    if not RAW_PATH.exists():
        print(f"[ERROR] Dataset not found at {RAW_PATH}", file=sys.stderr)
        print("Run validate_dataset.py first and ensure creditcard.csv is present.", file=sys.stderr)
        sys.exit(1)

    df = pd.read_csv(RAW_PATH)
    if max_samples:
        # Stratified subsample so we keep class ratio
        df = df.groupby("Class", group_keys=False).apply(
            lambda g: g.sample(min(len(g), max_samples // 2), random_state=RANDOM_SEED)
        ).reset_index(drop=True)

    feature_cols = [f"V{i}" for i in range(1, 29)] + ["Amount"]
    X = df[feature_cols].values
    y = df["Class"].values
    return train_test_split(X, y, test_size=TEST_SIZE, random_state=RANDOM_SEED, stratify=y)


def train_logistic_regression(X_train, y_train):
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_train)
    clf = LogisticRegression(
        max_iter=1000,
        class_weight="balanced",
        random_state=RANDOM_SEED,
        solver="lbfgs",
    )
    t0 = time.time()
    clf.fit(X_scaled, y_train)
    duration = time.time() - t0
    return {"name": "LogisticRegression", "model": (scaler, clf), "train_duration_s": round(duration, 2)}


def train_random_forest(X_train, y_train):
    clf = RandomForestClassifier(
        n_estimators=100,
        class_weight="balanced",
        random_state=RANDOM_SEED,
        n_jobs=-1,
        max_depth=8,
    )
    t0 = time.time()
    clf.fit(X_train, y_train)
    duration = time.time() - t0
    return {"name": "RandomForest", "model": clf, "train_duration_s": round(duration, 2)}


def main():
    print("[train] Loading and splitting dataset …")
    X_train, X_test, y_train, y_test = load_and_split()
    print(f"[train]   Train={len(X_train):,}  Test={len(X_test):,}")

    print("[train] Training Logistic Regression …")
    lr_result = train_logistic_regression(X_train, y_train)

    print("[train] Training Random Forest …")
    rf_result = train_random_forest(X_train, y_train)

    # ── Pick the model to persist (Random Forest is the primary) ──────────────
    primary = rf_result
    print(f"[train] Persisting primary model → {primary['name']}")

    model_path = MODELS_DIR / "model.joblib"
    joblib.dump(primary["model"], model_path)
    print(f"[train] Model saved to {model_path}")

    # ── Save the test split for downstream evaluation ─────────────────────────
    test_path = MODELS_DIR / "test_data.npz"
    import numpy as np
    np.savez_compressed(str(test_path), X_test=X_test, y_test=y_test)
    print(f"[train] Test data saved to {test_path}")

    # ── Write metadata ─────────────────────────────────────────────────────────
    metadata = {
        "primary_model": primary["name"],
        "framework": "scikit-learn",
        "algorithm" : primary["name"],
        "dataset": "credit_card_fraud",
        "train_samples": int(len(X_train)),
        "test_samples":  int(len(X_test)),
        "test_size_pct": int(TEST_SIZE * 100),
        "random_seed": RANDOM_SEED,
        "train_duration_s": primary["train_duration_s"],
        "models_compared": [lr_result["name"], rf_result["name"]],
        "model_path": str(model_path),
        "test_data_path": str(test_path),
    }

    meta_path = MODELS_DIR / "training_metadata.json"
    meta_path.write_text(json.dumps(metadata, indent=2))
    print(f"[train] Metadata written to {meta_path}")
    print("\n[train] Training complete. ✅")


if __name__ == "__main__":
    main()
