"""
train_model.py — Phase 4 : HaluEval

Trains a hallucination detector using features derived from the relationship between
knowledge context and the generated answer. Raw TF-IDF on the answer alone has near-
zero signal; the key signal is how much the answer diverges from the context.
"""

import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

ROOT     = Path(__file__).resolve().parents[2]
DATA_CSV = ROOT / "data" / "processed" / "halueval" / "halueval_processed.csv"
OUT_DIR  = ROOT / "data" / "models" / "halueval"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def tokenize(text: str) -> set:
    return set(str(text).lower().split())


def extract_features(df: pd.DataFrame) -> np.ndarray:
    """
    Compute numerical features based on the relationship between context and answer.
    These directly measure the hallucination signal:
      - Context token overlap with answer (high overlap = grounded)
      - Question token overlap with answer
      - Answer length relative to knowledge length
      - Fraction of answer words NOT found in knowledge
    """
    rows = []
    for _, r in df.iterrows():
        knowledge_tok = tokenize(r["knowledge"])
        question_tok  = tokenize(r["question"])
        answer_tok    = tokenize(r["answer"])

        overlap_k_a  = len(knowledge_tok & answer_tok) / max(1, len(answer_tok))
        overlap_q_a  = len(question_tok & answer_tok) / max(1, len(answer_tok))
        ans_len_ratio = len(answer_tok) / max(1, len(knowledge_tok))
        oov_fraction  = len(answer_tok - knowledge_tok) / max(1, len(answer_tok))
        ans_len       = len(answer_tok)
        know_len      = len(knowledge_tok)

        rows.append([overlap_k_a, overlap_q_a, ans_len_ratio, oov_fraction, ans_len, know_len])

    return np.array(rows, dtype=np.float32)


def main():
    if not DATA_CSV.exists():
        print(f"[ERROR] Processed data not found at {DATA_CSV}", file=sys.stderr)
        sys.exit(1)

    print("[train] Loading dataset...")
    df = pd.read_csv(DATA_CSV).fillna("")

    print("[train] Engineering context-overlap features...")
    X = extract_features(df)
    y = df["is_hallucination"].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    model = RandomForestClassifier(n_estimators=200, max_depth=8, class_weight="balanced", random_state=42)

    print("[train] Training RandomForest on overlap features...")
    model.fit(X_train, y_train)

    acc = accuracy_score(y_test, model.predict(X_test))
    print(f"[train] Training complete. Test Accuracy: {acc:.4f}")

    # Save model + test split
    joblib.dump(model, OUT_DIR / "halueval_model.joblib")
    test_df = pd.DataFrame(X_test, columns=["overlap_k_a", "overlap_q_a", "ans_len_ratio", "oov_fraction", "ans_len", "know_len"])
    test_df["label"] = y_test
    test_df.to_pickle(OUT_DIR / "test_data.pkl")

    # Also save the feature extractor function name so evaluate can use it
    print(f"[train] Artifacts saved to {OUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

