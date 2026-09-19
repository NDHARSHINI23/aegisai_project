"""
register_model.py — AegisAI Phase 1 + 2 (Database hook)

Reads the evaluation report JSON and metadata, connects to PostgreSQL,
and upserts the model into the `registered_models` table so it appears
in the UI dashboard with full Phase 2 provenance metadata.
"""

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg2

ROOT        = Path(__file__).resolve().parents[1]
MODELS_DIR  = ROOT / "data" / "models" / "fraud"
OUT_DIR     = ROOT / "data" / "outputs" / "fraud"

DB_URL = os.environ.get("DATABASE_URL", "postgresql://postgres@127.0.0.1:5433/aegisai")

def get_git_commit():
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, timeout=5
        )
        return result.stdout.strip() if result.returncode == 0 else "unknown"
    except Exception:
        return "unknown"

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

    report        = json.loads(eval_path.read_text())
    model_name    = "Credit Card Fraud Predictor"
    version       = "v1.0"
    framework     = report.get("framework", "scikit-learn")
    accuracy      = report.get("metrics", {}).get("accuracy", 0.0)
    metrics       = report.get("metrics", {})
    git_commit    = get_git_commit()
    training_date = datetime.now(timezone.utc).isoformat()

    print(f"[register] Registering '{model_name}' ({version}) | accuracy={accuracy:.4f} | commit={git_commit}")

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM registered_models WHERE name = %s", (model_name,))
            row = cur.fetchone()

            if row:
                model_id = row[0]
                print(f"[register] Updating existing model (id: {model_id})...")
                cur.execute(
                    """
                    UPDATE registered_models
                    SET  version = %s, framework = %s, accuracy = %s,
                         owner = %s, dataset_version = %s, environment = %s,
                         git_commit = %s, training_date = %s,
                         benchmark_results = %s, status = %s
                    WHERE id = %s
                    """,
                    (
                        version, framework, accuracy,
                        "aegisai-ml-team",
                        "kaggle-creditcardfraud-v1",
                        "local",
                        git_commit,
                        training_date,
                        json.dumps(metrics),
                        "staging",
                        model_id,
                    )
                )
            else:
                print("[register] Inserting new model...")
                cur.execute(
                    """
                    INSERT INTO registered_models
                      (name, version, framework, description, status, accuracy, latency_ms,
                       owner, dataset_version, environment, git_commit, training_date, benchmark_results)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        model_name, version, framework,
                        "Random Forest classifier trained on the Kaggle Credit Card Fraud Detection dataset.",
                        "staging", accuracy, 15,
                        "aegisai-ml-team",
                        "kaggle-creditcardfraud-v1",
                        "local",
                        git_commit,
                        training_date,
                        json.dumps(metrics),
                    )
                )
        conn.commit()
        print("[register] Database updated successfully. ✅")
    except Exception as e:
        print(f"[ERROR] Failed to save metadata: {e}", file=sys.stderr)
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()


