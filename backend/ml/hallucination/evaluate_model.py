"""
evaluate_model.py — Phase 4 : HaluEval

Evaluates the Hallucination detection model mathematically on precision/recall metrics.
"""

import json
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import accuracy_score, precision_recall_fscore_support

ROOT       = Path(__file__).resolve().parents[2]
MODELS_DIR = ROOT / "data" / "models" / "halueval"
OUT_DIR    = ROOT / "data" / "outputs" / "halueval"
OUT_DIR.mkdir(parents=True, exist_ok=True)

def main():
    model_path = MODELS_DIR / "halueval_model.joblib"
    test_path  = MODELS_DIR / "test_data.pkl"

    if not model_path.exists() or not test_path.exists():
        print("[ERROR] Model artifacts not found. Run train_model.py first.", file=sys.stderr)
        sys.exit(1)

    print("[evaluate] Loading model and test data...")
    model = joblib.load(model_path)
    test_df = pd.read_pickle(test_path)

    feature_cols = ["overlap_k_a", "overlap_q_a", "ans_len_ratio", "oov_fraction", "ans_len", "know_len"]
    X_test = test_df[feature_cols].values
    y_true = test_df["label"].values
    
    print("[evaluate] Inferencing on test set...")
    y_pred = model.predict(X_test)
    
    accuracy = accuracy_score(y_true, y_pred)
    precision, recall, f1, _ = precision_recall_fscore_support(y_true, y_pred, average="binary")
    
    report = {
        "framework": "scikit-learn (TF-IDF)",
        "dataset": "HaluEval-QA",
        "metrics": {
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "f1_score": f1
        }
    }
    
    out_file = OUT_DIR / "eval_report.json"
    out_file.write_text(json.dumps(report, indent=2))
    
    print(f"[evaluate] Evaluation complete. Accuracy: {accuracy:.4f}")
    print(f"[evaluate] F1-Score: {f1:.4f} (Precision: {precision:.4f}, Recall: {recall:.4f})")
    print(f"[evaluate] Saved to {out_file.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
