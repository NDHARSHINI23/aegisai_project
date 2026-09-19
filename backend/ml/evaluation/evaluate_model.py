"""
evaluate_model.py — AegisAI Phase 1 (Dataset 1: Credit Card Fraud Detection)

Loads the trained model + held-out test split, computes evaluation metrics
(accuracy, precision, recall, F1, ROC-AUC), logs them to MLflow, and writes
an evaluation report JSON consumed by the dashboard API.

Reads:   backend/data/models/fraud/model.joblib
         backend/data/models/fraud/test_data.npz
Writes:  backend/data/outputs/fraud/eval_report.json
Logs to: MLflow experiment "aegisai-fraud-detection"
"""

import json
import os
import sys
import datetime
from pathlib import Path

import joblib
import mlflow
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

ROOT        = Path(__file__).resolve().parents[2]
MODELS_DIR  = ROOT / "data" / "models" / "fraud"
OUT_DIR     = ROOT / "data" / "outputs" / "fraud"
OUT_DIR.mkdir(parents=True, exist_ok=True)

MLFLOW_URI  = os.environ.get("MLFLOW_TRACKING_URI", "http://127.0.0.1:5001")
EXPERIMENT  = "aegisai-fraud-detection"


def load_artifacts():
    model_path = MODELS_DIR / "model.joblib"
    data_path  = MODELS_DIR / "test_data.npz"

    if not model_path.exists():
        print(f"[ERROR] Model not found at {model_path}. Run train_model.py first.", file=sys.stderr)
        sys.exit(1)
    if not data_path.exists():
        print(f"[ERROR] Test data not found at {data_path}. Run train_model.py first.", file=sys.stderr)
        sys.exit(1)

    model = joblib.load(model_path)
    data  = np.load(str(data_path))
    return model, data["X_test"], data["y_test"]


def compute_metrics(model, X_test, y_test) -> dict:
    y_pred = model.predict(X_test)

    # For ROC-AUC we need probability estimates
    try:
        y_proba = model.predict_proba(X_test)[:, 1]
        roc_auc = float(roc_auc_score(y_test, y_proba))
    except Exception:
        roc_auc = None

    cm = confusion_matrix(y_test, y_pred).tolist()

    return {
        "accuracy":  round(float(accuracy_score(y_test, y_pred)), 4),
        "precision": round(float(precision_score(y_test, y_pred, zero_division=0)), 4),
        "recall":    round(float(recall_score(y_test, y_pred, zero_division=0)), 4),
        "f1_score":  round(float(f1_score(y_test, y_pred, zero_division=0)), 4),
        "roc_auc":   round(roc_auc, 4) if roc_auc is not None else None,
        "confusion_matrix": cm,
        "class_report": classification_report(y_test, y_pred, output_dict=True),
    }


def log_to_mlflow(metrics: dict, metadata: dict) -> str:
    mlflow.set_tracking_uri(MLFLOW_URI)
    mlflow.set_experiment(EXPERIMENT)

    with mlflow.start_run(run_name=f"fraud-eval-{datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S')}") as run:
        # Log scalar metrics
        for key in ("accuracy", "precision", "recall", "f1_score", "roc_auc"):
            val = metrics.get(key)
            if val is not None:
                mlflow.log_metric(key, val)

        # Log training metadata as params
        for k, v in metadata.items():
            if isinstance(v, (str, int, float, bool)):
                mlflow.log_param(k, v)

        mlflow.set_tag("dataset",  "credit_card_fraud")
        mlflow.set_tag("phase",    "1")
        mlflow.set_tag("platform", "AegisAI")

        return run.info.run_id


def main():
    print("[evaluate] Loading model and test data …")
    model, X_test, y_test = load_artifacts()
    print(f"[evaluate]   Test samples: {len(X_test):,}")

    # Load training metadata if available
    meta_path = MODELS_DIR / "training_metadata.json"
    metadata  = json.loads(meta_path.read_text()) if meta_path.exists() else {}

    print("[evaluate] Computing metrics …")
    metrics = compute_metrics(model, X_test, y_test)

    # ── Display on terminal ───────────────────────────────────────────────────
    print(f"\n  Accuracy : {metrics['accuracy']}")
    print(f"  Precision: {metrics['precision']}")
    print(f"  Recall   : {metrics['recall']}")
    print(f"  F1       : {metrics['f1_score']}")
    print(f"  ROC-AUC  : {metrics['roc_auc']}")

    # ── Log to MLflow ─────────────────────────────────────────────────────────
    print("\n[evaluate] Logging to MLflow …")
    try:
        run_id = log_to_mlflow(metrics, metadata)
        print(f"[evaluate] MLflow run_id: {run_id}")
    except Exception as exc:
        # Non-fatal — still write the report
        run_id = None
        print(f"[evaluate] ⚠️  MLflow logging failed: {exc}", file=sys.stderr)

    # ── Write evaluation report ────────────────────────────────────────────────
    report = {
        "dataset":         "credit_card_fraud",
        "model":           metadata.get("primary_model", "unknown"),
        "framework":       metadata.get("framework", "scikit-learn"),
        "evaluated_at":    datetime.datetime.utcnow().isoformat() + "Z",
        "mlflow_run_id":   run_id,
        "mlflow_uri":      MLFLOW_URI,
        "metrics":         metrics,
        "training_meta":   metadata,
    }

    out_path = OUT_DIR / "eval_report.json"
    out_path.write_text(json.dumps(report, indent=2))
    print(f"\n[evaluate] Report written to {out_path}")
    print("[evaluate] Evaluation complete. ✅")


if __name__ == "__main__":
    main()
