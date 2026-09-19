"""
validate_dataset.py — Phase 6 : AgentOps (BANKING77)

Downloads the PolyAI/banking77 dataset for intent classification,
which mimics banking customer service requests.
"""

import json
import sys
from pathlib import Path

import pandas as pd
from datasets import load_dataset

ROOT    = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "data" / "processed" / "banking77"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def main():
    print("[validate] Downloading PolyAI/banking77 from HuggingFace...")
    try:
        dataset = load_dataset("mteb/banking77", split="train", trust_remote_code=True)
    except Exception as e:
        print(f"[ERROR] Failed to load dataset: {e}", file=sys.stderr)
        sys.exit(1)

    df = dataset.to_pandas()
    print(f"[validate] Banking77 dataset loaded: {len(df):,} rows.")

    null_count = int(df.isnull().sum().sum())
    unique_intents = int(df["label"].nunique())

    checks = {
        "columns_present": {"passed": set(["text", "label"]).issubset(df.columns)},
        "no_nulls": {"passed": bool(null_count == 0)},
        "intent_count": {"passed": bool(unique_intents == 77), "found": unique_intents},
    }

    overall = bool(all(c["passed"] for c in checks.values()))

    out_csv = OUT_DIR / "banking77_processed.csv"
    df.to_csv(out_csv, index=False)

    report = {
        "dataset": "PolyAI/banking77",
        "row_count": len(df),
        "checks": checks,
        "overall_passed": overall
    }
    
    report_path = OUT_DIR / "validation_report.json"
    report_path.write_text(json.dumps(report, indent=2))
    
    print(f"[validate] Saved processed dataset -> {out_csv.relative_to(ROOT)}")
    for name, result in checks.items():
        icon = "PASS" if result["passed"] else "FAIL"
        print(f"  [{icon}]  {name}")

    if not overall:
        print("[validate] Validation FAILED.", file=sys.stderr)
        sys.exit(1)
    print("[validate] Ready for training.")


if __name__ == "__main__":
    main()
