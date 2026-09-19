"""
evaluate_model.py — Phase 6 : AgentOps (BANKING77)

Evaluates the multi-class intent classification model on weighted precision/recall/F1.
"""

import json
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import accuracy_score, precision_recall_fscore_support

ROOT       = Path(__file__).resolve().parents[2]
MODELS_DIR = ROOT / "data" / "models" / "banking77"
OUT_DIR    = ROOT / "data" / "outputs" / "banking77"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def main():
    model_path = MODELS_DIR / "intent_model.joblib"
    test_path  = MODELS_DIR / "test_data.pkl"

    if not model_path.exists() or not test_path.exists():
        print("[ERROR] Model artifacts not found. Run train_model.py first.", file=sys.stderr)
        sys.exit(1)

    print("[evaluate] Loading Intent model and test data...")
    model   = joblib.load(model_path)
    test_df = pd.read_pickle(test_path)

    X_test = test_df["text"]
    y_true = test_df["label"]
    y_pred = model.predict(X_test)

    acc = accuracy_score(y_true, y_pred)
    # Using 'weighted' since this is a 77-class multi-class problem
    precision, recall, f1, _ = precision_recall_fscore_support(y_true, y_pred, average="weighted")

    report = {
        "framework": "scikit-learn (TF-IDF + LinearSVC)",
        "dataset": "PolyAI/banking77",
        "classes": 77,
        "metrics": {
            "accuracy": round(float(acc), 4),
            "precision_weighted": round(float(precision), 4),
            "recall_weighted": round(float(recall), 4),
            "f1_score_weighted": round(float(f1), 4),
        }
    }

    out_file = OUT_DIR / "eval_report.json"
    out_file.write_text(json.dumps(report, indent=2))
    
    print(f"[evaluate] Accuracy: {acc:.4f} | Weighted F1: {f1:.4f}")
    print(f"[evaluate] Saved -> {out_file.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
