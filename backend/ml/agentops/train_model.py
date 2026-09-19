"""
train_model.py — Phase 6 : AgentOps (BANKING77)

Trains an intent classification model (TF-IDF + LinearSVC).
Linear SVC is highly effective for large-class intent recognition tasks.
"""

import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

ROOT     = Path(__file__).resolve().parents[2]
DATA_CSV = ROOT / "data" / "processed" / "banking77" / "banking77_processed.csv"
OUT_DIR  = ROOT / "data" / "models" / "banking77"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def main():
    if not DATA_CSV.exists():
        print(f"[ERROR] Data not found at {DATA_CSV}", file=sys.stderr)
        sys.exit(1)

    print("[train] Loading BANKING77 processed dataset...")
    df = pd.read_csv(DATA_CSV)
    
    X = df["text"]
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.15, random_state=42, stratify=y
    )

    model = Pipeline([
        ("tfidf", TfidfVectorizer(max_features=15000, stop_words="english", ngram_range=(1, 2))),
        ("clf", LinearSVC(C=1.0, dual="auto", random_state=42, max_iter=2000))
    ])

    print(f"[train] Training LinearSVC for 77 intents on {len(X_train)} samples...")
    model.fit(X_train, y_train)

    acc = accuracy_score(y_test, model.predict(X_test))
    print(f"[train] Training complete. Test Accuracy on holdout: {acc:.4f}")

    joblib.dump(model, OUT_DIR / "intent_model.joblib")
    
    test_df = pd.DataFrame({"text": X_test, "label": y_test})
    test_df.to_pickle(OUT_DIR / "test_data.pkl")

    print(f"[train] Model saved -> {OUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
