"""
train_model.py — Phase 5 : Civil Comments (Safety / Toxicity)

Trains a TF-IDF + LogisticRegression toxicity classifier.
This works well here (unlike HaluEval) because the signal IS in the
raw text — toxic language has distinct vocabulary (slurs, threats, etc.).
"""

import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

ROOT     = Path(__file__).resolve().parents[2]
DATA_CSV = ROOT / "data" / "processed" / "civil_comments" / "civil_comments_processed.csv"
OUT_DIR  = ROOT / "data" / "models" / "civil_comments"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def main():
    if not DATA_CSV.exists():
        print(f"[ERROR] Processed data not found at {DATA_CSV}", file=sys.stderr)
        sys.exit(1)

    print("[train] Loading Civil Comments dataset...")
    df = pd.read_csv(DATA_CSV).dropna(subset=["text"])

    X = df["text"]
    y = df["is_toxic"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = Pipeline([
        ("tfidf", TfidfVectorizer(
            max_features=20000,
            stop_words="english",
            ngram_range=(1, 2),
            sublinear_tf=True
        )),
        ("clf", LogisticRegression(
            C=4.0,
            max_iter=1000,
            class_weight="balanced",
            random_state=42
        ))
    ])

    print("[train] Training TF-IDF + Logistic Regression toxicity classifier...")
    model.fit(X_train, y_train)

    acc = accuracy_score(y_test, model.predict(X_test))
    print(f"[train] Training complete. Test Accuracy: {acc:.4f}")

    # Save model + test split
    joblib.dump(model, OUT_DIR / "toxicity_model.joblib")
    test_df = pd.DataFrame({"text": X_test, "label": y_test})
    test_df.to_pickle(OUT_DIR / "test_data.pkl")

    print(f"[train] Artifacts saved to {OUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
