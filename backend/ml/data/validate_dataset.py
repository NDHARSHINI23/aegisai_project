"""
validate_dataset.py — AegisAI Phase 1 (Dataset 1: Credit Card Fraud Detection)

Loads the creditcard.csv from data/raw/fraud/,
runs a suite of validation checks, and writes the
validation report to data/processed/fraud/validation_report.json.

Place creditcard.csv at:
    backend/data/raw/fraud/creditcard.csv
(Downloaded from https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud)

Validation Checks:
 1. Schema — all expected columns present
 2. Missing values — none tolerated in feature columns
 3. Duplicate rows
 4. Class imbalance — flag if minority class < 1 %
 5. Feature range — V1-V28 should be float; Amount >= 0
"""

import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]           # backend/
RAW_PATH = ROOT / "data" / "raw" / "fraud" / "creditcard.csv"
OUT_DIR  = ROOT / "data" / "processed" / "fraud"
OUT_DIR.mkdir(parents=True, exist_ok=True)

REQUIRED_COLUMNS = (
    ["Time"] + [f"V{i}" for i in range(1, 29)] + ["Amount", "Class"]
)
FEATURE_COLS = [f"V{i}" for i in range(1, 29)] + ["Amount"]

# ── helpers ────────────────────────────────────────────────────────────────────

def check_schema(df: pd.DataFrame) -> dict:
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    return {"passed": len(missing) == 0, "missing_columns": missing}


def check_missing_values(df: pd.DataFrame) -> dict:
    total_missing = int(df[FEATURE_COLS + ["Class"]].isnull().sum().sum())
    return {
        "passed": total_missing == 0,
        "total_missing_cells": total_missing,
        "by_column": df.isnull().sum()[df.isnull().sum() > 0].to_dict(),
    }


def check_duplicates(df: pd.DataFrame) -> dict:
    n_dupe = int(df.duplicated().sum())
    return {
        "passed": True,  # Treat as a warning, not a failure
        "duplicate_rows": n_dupe,
        "warning": f"Found {n_dupe} duplicate rows" if n_dupe > 0 else None,
    }


def check_class_imbalance(df: pd.DataFrame) -> dict:
    counts = df["Class"].value_counts().to_dict()
    total  = sum(counts.values())
    minority_fraction = min(counts.values()) / total if total else 0
    flagged = minority_fraction < 0.01
    return {
        # Not a hard failure — imbalanced fraud data is expected.
        # The model uses class_weight='balanced' to compensate.
        "passed": True,
        "class_counts": {str(k): int(v) for k, v in counts.items()},
        "minority_fraction": round(minority_fraction, 5),
        "warning": "Severe class imbalance detected (<1%) — model will use class_weight='balanced'" if flagged else None,
    }


def check_feature_ranges(df: pd.DataFrame) -> dict:
    issues = []
    for col in [f"V{i}" for i in range(1, 29)]:
        if not pd.api.types.is_float_dtype(df[col]):
            issues.append(f"{col} is not float")
    if (df["Amount"] < 0).any():
        issues.append("Amount has negative values")
    return {"passed": len(issues) == 0, "issues": issues}


# ── main ───────────────────────────────────────────────────────────────────────

def main():
    if not RAW_PATH.exists():
        print(
            f"[ERROR] Dataset not found at {RAW_PATH}\n"
            "Please download creditcard.csv from:\n"
            "  https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud\n"
            "and place it at:  backend/data/raw/fraud/creditcard.csv",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"[validate] Loading dataset from {RAW_PATH} …")
    df = pd.read_csv(RAW_PATH)
    print(f"[validate] Loaded {len(df):,} rows × {len(df.columns)} columns")

    report = {
        "dataset": "credit_card_fraud",
        "row_count": len(df),
        "column_count": len(df.columns),
        "checks": {
            "schema":           check_schema(df),
            "missing_values":   check_missing_values(df),
            "duplicates":       check_duplicates(df),
            "class_imbalance":  check_class_imbalance(df),
            "feature_ranges":   check_feature_ranges(df),
        },
    }

    all_passed = all(v["passed"] for v in report["checks"].values())
    report["overall_passed"] = all_passed

    out_path = OUT_DIR / "validation_report.json"
    out_path.write_text(json.dumps(report, indent=2))
    print(f"[validate] Report written to {out_path}")

    # Print a quick summary to stdout
    for name, result in report["checks"].items():
        status = "✅ PASS" if result["passed"] else "❌ FAIL"
        print(f"  {status}  {name}")
        if not result["passed"]:
            print(f"         → {result}")

    if not all_passed:
        print("\n[validate] One or more checks failed — inspect the report before training.")
        sys.exit(2)

    print("\n[validate] All checks passed. Ready for preprocessing.")


if __name__ == "__main__":
    main()
