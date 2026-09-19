"""
validate_dataset.py — Phase 4 : HaluEval

Downloads and validates the HaluEval QA dataset (pminervini/HaluEval).
We map 'right_answer' to faithful (label=0) and 'hallucinated_answer' to hallucinated (label=1).
"""

import json
import sys
from pathlib import Path

import pandas as pd
from datasets import load_dataset

ROOT     = Path(__file__).resolve().parents[2]
RAW_DIR  = ROOT / "data" / "raw" / "halueval"
OUT_DIR  = ROOT / "data" / "processed" / "halueval"
RAW_DIR.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)

SAMPLES_TO_PULL = 5000

def main():
    print("[validate] Downloading HaluEval dataset (QA split)...")
    try:
        # HaluEval dataset structure has multiple tasks, QA is one of them.
        dataset = load_dataset("pminervini/HaluEval", "qa", split="data")
    except Exception as e:
        print(f"[ERROR] Failed to load dataset: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"[validate] Processing {SAMPLES_TO_PULL} samples to balance...")
    # Convert HF dataset to pandas
    df_raw = dataset.to_pandas().head(SAMPLES_TO_PULL)
    
    records = []
    for _, row in df_raw.iterrows():
        # Faithful Record
        records.append({
            "knowledge": row.get("knowledge", ""),
            "question": row.get("question", ""),
            "answer": row.get("right_answer", ""),
            "is_hallucination": 0
        })
        # Hallucinated Record
        records.append({
            "knowledge": row.get("knowledge", ""),
            "question": row.get("question", ""),
            "answer": row.get("hallucinated_answer", ""),
            "is_hallucination": 1
        })
        
    df = pd.DataFrame(records)
    
    # Validation checks
    checks = {
        "schema": {"passed": bool(set(["knowledge", "question", "answer", "is_hallucination"]).issubset(df.columns))},
        "null_values": {"passed": bool(int(df.isnull().sum().sum()) == 0)},
        "balance": {"passed": bool(df["is_hallucination"].mean() == 0.5)}
    }
    overall = bool(all(c["passed"] for c in checks.values()))
    
    # Save processed CSV for training
    processed_path = OUT_DIR / "halueval_processed.csv"
    df.to_csv(processed_path, index=False)
    
    report = {
        "dataset": "HaluEval-QA",
        "row_count": len(df),
        "checks": checks,
        "overall_passed": overall
    }
    
    report_path = OUT_DIR / "validation_report.json"
    report_path.write_text(json.dumps(report, indent=2))
    print(f"[validate] Report saved -> {report_path.relative_to(ROOT)}")

    if not overall:
        print("[validate] Dataset validation failed.", file=sys.stderr)
        sys.exit(1)
        
    print("[validate] Validation successful. Ready for training.")

if __name__ == "__main__":
    main()
