"""
register_bias.py — Phase 3 : Database hook for Bias Metrics

Reads the fairness evaluation report and upserts the bias scores 
into the `bias_scores` table for the Adult Income model.
"""

import json
import os
import sys
from pathlib import Path

import psycopg2

ROOT       = Path(__file__).resolve().parents[2]
OUT_DIR    = ROOT / "data" / "outputs" / "adult"
DB_URL     = os.environ.get("DATABASE_URL", "postgresql://postgres@127.0.0.1:5433/aegisai")

def get_db_connection():
    try:
        return psycopg2.connect(DB_URL)
    except Exception as e:
        print(f"[ERROR] Could not connect to PostgreSQL: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    eval_path = OUT_DIR / "eval_report.json"
    if not eval_path.exists():
        print(f"[ERROR] Evaluation report not found at {eval_path}", file=sys.stderr)
        sys.exit(1)

    report = json.loads(eval_path.read_text())
    
    # Model Metadata for Registration
    model_name = "Census Income Classifier"
    version    = "v2.1"
    framework  = report.get("framework", "scikit-learn")
    accuracy   = report.get("metrics", {}).get("accuracy", 0.0)
    
    gender_bias   = report.get("bias", {}).get("gender", {}).get("bias_scalar", 0.0)
    race_bias     = report.get("bias", {}).get("race", {}).get("bias_scalar", 0.0)
    religion_bias = report.get("bias", {}).get("religion", {}).get("bias_scalar", 0.0)
    overall_bias  = (gender_bias + race_bias + religion_bias) / 2.0  # simple average of non-zero

    print(f"[register_bias] Syncing Bias Scores for '{model_name}'...")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # 1. Ensure Model exists in registered_models
            cur.execute("SELECT id FROM registered_models WHERE name = %s", (model_name,))
            row = cur.fetchone()
            
            if row:
                model_id = row[0]
            else:
                print(f"[register_bias] Registering model '{model_name}' first...")
                cur.execute(
                    """
                    INSERT INTO registered_models
                        (name, version, framework, status, accuracy, latency_ms)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (model_name, version, framework, "production", accuracy, 22)
                )
                model_id = cur.fetchone()[0]
                
            # 2. Insert/Update bias_scores
            cur.execute("SELECT id FROM bias_scores WHERE model_id = %s", (model_id,))
            bias_row = cur.fetchone()
            
            if bias_row:
                print("[register_bias] Updating existing bias scores...")
                cur.execute(
                    """
                    UPDATE bias_scores
                    SET overall = %s, gender = %s, race = %s, religion = %s, computed_at = NOW()
                    WHERE model_id = %s
                    """,
                    (overall_bias, gender_bias, race_bias, religion_bias, model_id)
                )
            else:
                print("[register_bias] Inserting new bias scores...")
                cur.execute(
                    """
                    INSERT INTO bias_scores (model_id, overall, gender, race, religion)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (model_id, overall_bias, gender_bias, race_bias, religion_bias)
                )
        conn.commit()
        print("[register_bias] Database updated successfully. ✅")
    except Exception as e:
        print(f"[ERROR] Database operation failed: {e}", file=sys.stderr)
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
