"""
train_model.py — Phase 3 : Adult / Census Income

Trains a LightGBM or Random Forest model on the adult income dataset.
Includes category preprocessing, imputation for ' ?', and standard scaling.
"""

import os
import sys
from pathlib import Path
import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT     = Path(__file__).resolve().parents[2]
RAW_PATH = ROOT / "data" / "raw" / "adult" / "adult.csv"
OUT_DIR  = ROOT / "data" / "models" / "adult"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SENSITIVE_COLS = ["race", "sex"]
TARGET_COL     = "income"

def main():
    if not RAW_PATH.exists():
        print(f"[ERROR] Dataset not found at {RAW_PATH}", file=sys.stderr)
        sys.exit(1)

    print(f"[train] Loading adult dataset from {RAW_PATH.name}")
    df = pd.read_csv(RAW_PATH, header=None, names=[
        "age", "workclass", "fnlwgt", "education", "education-num",
        "marital-status", "occupation", "relationship", "race", "sex",
        "capital-gain", "capital-loss", "hours-per-week", "native-country", "income"
    ]) if not pd.api.types.is_string_dtype(pd.read_csv(RAW_PATH, nrows=1).iloc[:,0]) else pd.read_csv(RAW_PATH)

    # Clean strings
    for col in df.select_dtypes(['object']).columns:
        df[col] = df[col].str.strip()

    import numpy as np
    # Drop missing values replaced with '?'
    df = df.replace('?', np.nan)

    # Clean target
    df[TARGET_COL] = df[TARGET_COL].astype(str).str.strip()
    y = (df[TARGET_COL] == ">50K").astype(int)
    X = df.drop(columns=[TARGET_COL])

    # Keep track of sensitive cols in test set by saving X_test
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    num_cols = X.select_dtypes(include=['int64', 'float64']).columns.tolist()
    cat_cols = X.select_dtypes(include=['object']).columns.tolist()

    preprocessor = ColumnTransformer([
        ("num", Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler())
        ]), num_cols),
        ("cat", Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False))
        ]), cat_cols)
    ])

    model = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", RandomForestClassifier(n_estimators=100, class_weight="balanced", random_state=42))
    ])

    print("[train] Training model pipeline...")
    model.fit(X_train, y_train)
    acc = model.score(X_test, y_test)
    print(f"[train] Training complete. Test Accuracy: {acc:.4f}")

    model_path = OUT_DIR / "model.joblib"
    joblib.dump(model, model_path)
    
    # Save test set for evaluation
    test_path = OUT_DIR / "test_data.pkl"
    X_test['income'] = y_test
    X_test.to_pickle(test_path)

    print(f"[train] Model artifacts saved to {OUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
