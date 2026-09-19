"""
evaluate_model.py — Phase 5 : Civil Comments (Safety / Toxicity)

Generates precision/recall/F1 metrics for the toxicity classifier.
"""

import json
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    roc_auc_score,
)

ROOT       = Path(__file__).resolve().parents[2]
MODELS_DIR = ROOT / "data" / "models" / "civil_comments"
OUT_DIR    = ROOT / "data" / "outputs" / "civil_comments"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def main():
    model_path = MODELS_DIR / "toxicity_model.joblib"
    test_path  = MODELS_DIR / "test_data.pkl"

    if not model_path.exists() or not test_path.exists():
        print("[ERROR] Model artifacts not found. Run train_model.py first.", file=sys.stderr)
        sys.exit(1)

    print("[evaluate] Loading model and test data...")
    model   = joblib.load(model_path)
    test_df = pd.read_pickle(test_path)

    X_test  = test_df["text"]
    y_true  = test_df["label"].values
    y_pred  = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    accuracy             = accuracy_score(y_true, y_pred)
    precision, recall, f1, _ = precision_recall_fscore_support(y_true, y_pred, average="binary")
    roc_auc              = roc_auc_score(y_true, y_proba)

    # Category-level detection rates using the raw keywords in text
    patterns = {
        "slur_or_insult": ["idiot", "stupid", "moron", "dumb", "fool"],
        "threat_keywords": ["kill", "hurt", "attack", "destroy", "bomb"],
        "obscene_words":   ["fuck", "shit", "ass", "bitch"],
    }

    category_rates = {}
    for cat, keywords in patterns.items():
        mask = X_test.str.lower().str.contains("|".join(keywords), na=False)
        subset_true  = y_true[mask.values]
        subset_pred  = y_pred[mask.values]
        if len(subset_true) > 0:
            category_rates[cat] = round(
                float((subset_true == subset_pred).mean()), 3
            )

    report = {
        "framework": "scikit-learn (TF-IDF + LR)",
        "dataset": "google/civil_comments",
        "metrics": {
            "accuracy": round(float(accuracy), 4),
            "precision": round(float(precision), 4),
            "recall": round(float(recall), 4),
            "f1_score": round(float(f1), 4),
            "roc_auc": round(float(roc_auc), 4),
        },
        "category_detection_rates": category_rates,
    }

    out_file = OUT_DIR / "eval_report.json"
    out_file.write_text(json.dumps(report, indent=2))

    print(f"[evaluate] Accuracy: {accuracy:.4f} | F1: {f1:.4f} | ROC-AUC: {roc_auc:.4f}")
    print(f"[evaluate] Saved to {out_file.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
