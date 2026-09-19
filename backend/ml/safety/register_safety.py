"""
register_safety.py — Phase 5 : Civil Comments (Safety / Toxicity)

Uses the trained toxicity classifier to score a sample of real comments,
then inserts the hazardous ones directly into the `security_events` PostgreSQL table.
"""

import json
import os
import sys
import uuid
import hashlib
from pathlib import Path

import joblib
import pandas as pd
import psycopg2

ROOT       = Path(__file__).resolve().parents[2]
MODELS_DIR = ROOT / "data" / "models" / "civil_comments"
DATA_CSV   = ROOT / "data" / "processed" / "civil_comments" / "civil_comments_processed.csv"
DB_URL     = os.environ.get("DATABASE_URL", "postgresql://postgres@127.0.0.1:5433/aegisai")

# Number of rows to scan and insert if toxic
SCAN_SIZE  = 100


def main():
    model_path = MODELS_DIR / "toxicity_model.joblib"
    if not model_path.exists():
        print(f"[ERROR] Model not found at {model_path}. Run train_model.py first.", file=sys.stderr)
        sys.exit(1)

    print("[register_safety] Loading model and dataset...")
    model = joblib.load(model_path)
    # We take a sample of records (some true toxic, some not)
    df = pd.read_csv(DATA_CSV).dropna(subset=["text"]).sample(SCAN_SIZE, random_state=42)

    X_test = df["text"]
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    # Filter only those we predicted as toxic
    toxic_mask = y_pred == 1
    toxic_texts = X_test[toxic_mask].tolist()
    toxic_probs = y_prob[toxic_mask].tolist()
    true_labels = df.loc[toxic_mask, "is_toxic"].tolist()
    
    print(f"[register_safety] Scanned {SCAN_SIZE} comments. Found {len(toxic_texts)} toxic.")

    try:
        conn = psycopg2.connect(DB_URL)
    except Exception as e:
        print(f"[ERROR] Cannot connect to PostgreSQL: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        with conn.cursor() as cur:
            # Get a valid model ID to attach the events to, fallback to random if none
            cur.execute("SELECT id, name FROM registered_models LIMIT 1")
            row = cur.fetchone()
            if row:
                model_id, model_name = str(row[0]), str(row[1])
            else:
                model_id, model_name = None, "Unknown Model"

            inserted = 0
            for text, prob, is_true_toxic in zip(toxic_texts, toxic_probs, true_labels):
                # Severity based on probability
                severity = "critical" if prob > 0.85 else "high" if prob > 0.65 else "medium"
                event_type = "toxic_output"
                
                # Preview summarizes the finding
                preview = f"Toxicity score: {prob:.2f}"
                if "kill" in text.lower() or "fuck" in text.lower():
                     preview += " (Severe Obscenity/Threat detected)"
                
                raw_hash = hashlib.sha256(text.encode('utf-8')).hexdigest()
                
                # Check for duplicate hash to avoid spamming the same event
                cur.execute("SELECT id FROM security_events WHERE raw_text_hash = %s", (raw_hash,))
                if cur.fetchone():
                    continue

                cur.execute(
                    """
                    INSERT INTO security_events (model_id, model_name, event_type, severity, preview, raw_text_hash)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (model_id, model_name, event_type, severity, preview, raw_hash)
                )
                inserted += 1

        conn.commit()
        print(f"[register_safety] Inserted {inserted} new security events.")
        
        summary = {
            "dataset": "google/civil_comments",
            "scanned": SCAN_SIZE,
            "toxic_detected": len(toxic_texts),
            "new_events_inserted": inserted
        }
        out_path = ROOT / "data" / "outputs" / "civil_comments" / "registration_summary.json"
        out_path.write_text(json.dumps(summary, indent=2))
        print(f"[register_safety] Saved to {out_path.relative_to(ROOT)}")
        
    except Exception as e:
        print(f"[ERROR] DB insert failed: {e}", file=sys.stderr)
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
