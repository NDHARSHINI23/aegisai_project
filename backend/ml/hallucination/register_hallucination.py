"""
register_hallucination.py — Phase 4 : HaluEval -> Database

Loads a sample of HaluEval pairs, runs the trained overlap-based scorer on them,
and inserts real hallucination scores into agent_trajectories so the dashboard
pipeline fires with ground-truth data instead of heuristic proxies.
"""

import json
import os
import sys
import uuid
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import psycopg2

ROOT        = Path(__file__).resolve().parents[2]
MODELS_DIR  = ROOT / "data" / "models" / "halueval"
DATA_CSV    = ROOT / "data" / "processed" / "halueval" / "halueval_processed.csv"
DB_URL      = os.environ.get("DATABASE_URL", "postgresql://postgres@127.0.0.1:5433/aegisai")

BATCH_SIZE  = 50   # insert this many trajectory rows to keep DB tidy


def tokenize(text: str) -> set:
    return set(str(text).lower().split())


def compute_overlap_features(row: pd.Series) -> list:
    knowledge_tok = tokenize(row["knowledge"])
    question_tok  = tokenize(row["question"])
    answer_tok    = tokenize(row["answer"])
    overlap_k_a  = len(knowledge_tok & answer_tok) / max(1, len(answer_tok))
    overlap_q_a  = len(question_tok & answer_tok) / max(1, len(answer_tok))
    ans_len_ratio = len(answer_tok) / max(1, len(knowledge_tok))
    oov_fraction  = len(answer_tok - knowledge_tok) / max(1, len(answer_tok))
    return [overlap_k_a, overlap_q_a, ans_len_ratio, oov_fraction, len(answer_tok), len(knowledge_tok)]


def main():
    model_path = MODELS_DIR / "halueval_model.joblib"
    if not model_path.exists():
        print(f"[ERROR] Model not found at {model_path}. Run train_model.py first.", file=sys.stderr)
        sys.exit(1)

    print("[register_hallucination] Loading model and dataset...")
    model = joblib.load(model_path)
    df    = pd.read_csv(DATA_CSV).fillna("").head(BATCH_SIZE * 2)  # take more to keep balance

    print(f"[register_hallucination] Computing overlap features for {BATCH_SIZE} rows...")
    features = np.array([compute_overlap_features(r) for _, r in df.iterrows()], dtype=np.float32)
    proba    = model.predict_proba(features)[:, 1]  # P(hallucinated)

    # Faithfulness score = 1 - P(hallucinated), clamped [0, 1]
    faithfulness_scores = np.clip(1.0 - proba, 0.0, 1.0)

    # We need an existing agentId to insert trajectories.
    try:
        conn = psycopg2.connect(DB_URL)
    except Exception as e:
        print(f"[ERROR] Cannot connect to PostgreSQL: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        with conn.cursor() as cur:
            # Find first agent
            cur.execute("SELECT id FROM agents LIMIT 1")
            row = cur.fetchone()
            if not row:
                print("[WARN] No agents found. Seeding required before registering trajectories.", file=sys.stderr)
                sys.exit(0)
            agent_id = str(row[0])

            inserted = 0
            for i, (_, sample) in enumerate(df.head(BATCH_SIZE).iterrows()):
                score = float(faithfulness_scores[i])
                cur.execute(
                    """
                    INSERT INTO agent_trajectories
                       (agent_id, session_id, tool_calls, tool_call_count, tool_success_count,
                        final_output, hallucination_score, latency_ms)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        agent_id,
                        f"halueval-{uuid.uuid4().hex[:8]}",
                        "[]",   # jsonb
                        0, 0,
                        str(sample["answer"])[:500],
                        score,
                        0
                    )
                )
                inserted += 1

        conn.commit()
        avg_faith = float(faithfulness_scores[:BATCH_SIZE].mean())
        print(f"[register_hallucination] Inserted {inserted} trajectories. Avg faithfulness: {avg_faith:.3f}")
        print("[register_hallucination] Database updated successfully.")

        # Save summary report
        summary = {
            "dataset": "HaluEval-QA",
            "trajectories_inserted": inserted,
            "avg_faithfulness_score": avg_faith,
            "min_score": float(faithfulness_scores.min()),
            "max_score": float(faithfulness_scores.max()),
        }
        out_path = ROOT / "data" / "outputs" / "halueval" / "registration_summary.json"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(summary, indent=2))
        print(f"[register_hallucination] Summary saved -> {out_path.relative_to(ROOT)}")

    except Exception as e:
        print(f"[ERROR] DB insert failed: {e}", file=sys.stderr)
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
