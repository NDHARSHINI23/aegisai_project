"""
validate_dataset.py — Phase 5 : Civil Comments (Safety / Toxicity)

Downloads google/civil_comments from HuggingFace and validates it before training.
Civil Comments labels: toxicity, severe_toxicity, obscene, threat, insult, identity_attack.
We keep it as a binary classification: toxicity >= 0.5 => toxic.
"""

import json
import sys
from pathlib import Path

import pandas as pd
from datasets import load_dataset

ROOT    = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "data" / "processed" / "civil_comments"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# We use a capped number of rows to keep training fast
SAMPLE_SIZE = 10000

LABEL_COLS = [
    "toxicity", "severe_toxicity", "obscene",
    "threat", "insult", "identity_attack"
]


def main():
    print("[validate] Downloading google/civil_comments from HuggingFace...")
    try:
        dataset = load_dataset("google/civil_comments", split="train", trust_remote_code=True)
    except Exception as e:
        print(f"[ERROR] Failed to load dataset: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"[validate] Full dataset size: {len(dataset):,}. Sampling {SAMPLE_SIZE:,} rows...")
    df = dataset.to_pandas()

    # Balance: sample equal toxic and non-toxic rows
    df["is_toxic"] = (df["toxicity"] >= 0.5).astype(int)
    toxic_df     = df[df["is_toxic"] == 1].sample(min(SAMPLE_SIZE // 2, df["is_toxic"].sum()), random_state=42)
    non_toxic_df = df[df["is_toxic"] == 0].sample(SAMPLE_SIZE // 2, random_state=42)
    balanced     = pd.concat([toxic_df, non_toxic_df]).sample(frac=1, random_state=42).reset_index(drop=True)

    cols_present  = [c for c in LABEL_COLS + ["text"] if c in balanced.columns]
    missing_cols  = [c for c in LABEL_COLS + ["text"] if c not in balanced.columns]
    schema_passed = len(missing_cols) == 0

    null_count    = int(balanced["text"].isnull().sum()) if "text" in balanced.columns else 0
    class_balance = float(balanced["is_toxic"].mean())

    checks = {
        "schema":  {"passed": bool(schema_passed), "missing": missing_cols},
        "nulls":   {"passed": bool(null_count == 0), "null_text_rows": null_count},
        "balance": {
            "passed": bool(0.4 <= class_balance <= 0.6),
            "toxic_fraction": round(class_balance, 3),
        },
    }
    overall = bool(all(c["passed"] for c in checks.values()))

    # Drop nulls and save
    balanced = balanced.dropna(subset=["text"])
    out_csv  = OUT_DIR / "civil_comments_processed.csv"
    balanced[["text", "is_toxic", "toxicity", "severe_toxicity", "obscene",
              "threat", "insult", "identity_attack"]].to_csv(out_csv, index=False)

    report = {
        "dataset": "google/civil_comments",
        "row_count": len(balanced),
        "checks": checks,
        "overall_passed": overall,
    }
    (OUT_DIR / "validation_report.json").write_text(json.dumps(report, indent=2))

    for name, result in checks.items():
        icon = "PASS" if result["passed"] else "FAIL"
        print(f"  [{icon}]  {name}")

    if not overall:
        print("[validate] Validation FAILED.", file=sys.stderr)
        sys.exit(1)

    print(f"[validate] Saved {len(balanced):,} balanced rows -> {out_csv.relative_to(ROOT)}")
    print("[validate] All checks passed. Ready for training.")


if __name__ == "__main__":
    main()
