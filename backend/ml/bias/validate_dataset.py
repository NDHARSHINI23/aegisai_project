"""
bias/validate_dataset.py — Phase 3 : Adult / Census Income

Validates the UCI Adult dataset (adult.csv) before fairness analysis.
Expected columns: age, workclass, fnlwgt, education, education-num,
marital-status, occupation, relationship, race, sex, capital-gain,
capital-loss, hours-per-week, native-country, income
"""

import json
import sys
from pathlib import Path

import pandas as pd

ROOT     = Path(__file__).resolve().parents[2]   # backend/
RAW_PATH = ROOT / "data" / "raw" / "adult" / "adult.csv"
OUT_DIR  = ROOT / "data" / "processed" / "adult"
OUT_DIR.mkdir(parents=True, exist_ok=True)

REQUIRED_COLUMNS = [
    "age", "workclass", "fnlwgt", "education", "education-num",
    "marital-status", "occupation", "relationship", "race", "sex",
    "capital-gain", "capital-loss", "hours-per-week", "native-country", "income",
]

SENSITIVE_COLS = ["race", "sex"]


def check_schema(df: pd.DataFrame) -> dict:
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    return {"passed": len(missing) == 0, "missing_columns": missing}


def check_missing_values(df: pd.DataFrame) -> dict:
    # Adult dataset uses ' ?' for unknowns
    unknown_counts = (df == " ?").sum()
    unknowns = {k: int(v) for k, v in unknown_counts.items() if v > 0}
    return {
        "passed": True,  # unknowns are expected – we'll handle in preprocessing
        "unknown_placeholder_cells": unknowns,
        "warning": f"{sum(unknowns.values())} cells with ' ?' placeholder" if unknowns else None,
    }


def check_sensitive_attribute_distribution(df: pd.DataFrame) -> dict:
    dist = {}
    for col in SENSITIVE_COLS:
        if col in df.columns:
            vc = df[col].value_counts().to_dict()
            dist[col] = {str(k).strip(): int(v) for k, v in vc.items()}
    return {"passed": True, "distributions": dist}


def check_label_balance(df: pd.DataFrame) -> dict:
    income_col = "income"
    if income_col not in df.columns:
        return {"passed": False, "error": "income column missing"}
    counts = df[income_col].str.strip().value_counts().to_dict()
    return {
        "passed": True,
        "income_counts": {str(k): int(v) for k, v in counts.items()},
        "warning": "Class imbalance in income label — model will use class_weight='balanced'"
        if min(counts.values()) / sum(counts.values()) < 0.3 else None,
    }


def main():
    if not RAW_PATH.exists():
        print(f"[ERROR] Dataset not found at {RAW_PATH}", file=sys.stderr)
        print("  ➜  Download from https://archive.ics.uci.edu/dataset/2/adult", file=sys.stderr)
        print(f"  ➜  Place adult.csv at: {RAW_PATH}", file=sys.stderr)
        sys.exit(1)

    print(f"[validate] Loading dataset … {RAW_PATH.name}")
    df = pd.read_csv(RAW_PATH, header=0)
    # If there's no header, re-read with column names
    if df.columns[0].strip().lstrip('-').isdigit() or df.columns[0].strip() == "39":
        df = pd.read_csv(RAW_PATH, header=None, names=REQUIRED_COLUMNS)

    print(f"[validate] Shape: {df.shape[0]:,} rows × {df.shape[1]} columns")

    checks = {
        "schema": check_schema(df),
        "missing_values": check_missing_values(df),
        "sensitive_distribution": check_sensitive_attribute_distribution(df),
        "label_balance": check_label_balance(df),
    }

    overall = all(c["passed"] for c in checks.values())
    report = {
        "dataset": "adult_census_income",
        "row_count": len(df),
        "column_count": len(df.columns),
        "checks": checks,
        "overall_passed": overall,
    }

    out_path = OUT_DIR / "validation_report.json"
    out_path.write_text(json.dumps(report, indent=2))
    print(f"[validate] Report saved → {out_path.relative_to(ROOT)}")

    for name, result in checks.items():
        status = "✅ PASS" if result["passed"] else "❌ FAIL"
        warn   = result.get("warning", "")
        print(f"  {status}  {name}" + (f"  ⚠  {warn}" if warn else ""))

    if not overall:
        print("\n[validate] Validation FAILED. Fix issues before training.", file=sys.stderr)
        sys.exit(1)
    print("\n[validate] All checks passed. Ready for training.")


if __name__ == "__main__":
    main()
