"""
evaluate_model.py — Phase 3 : Adult / Census Income

Evaluates the trained model on test data to generate fairness and bias metrics
for Demographics like Race and Sex.
"""

import json
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import accuracy_score

ROOT       = Path(__file__).resolve().parents[2]
MODELS_DIR = ROOT / "data" / "models" / "adult"
OUT_DIR    = ROOT / "data" / "outputs" / "adult"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def disparate_impact(y_pred: pd.Series, sensitive_attr: pd.Series, unprivileged: str, privileged: str) -> float:
    # Probability of positive outcome for unprivileged group divided by privileged group
    prob_unpriv = y_pred[sensitive_attr == unprivileged].mean()
    prob_priv = y_pred[sensitive_attr == privileged].mean()
    if prob_priv == 0:
        return 1.0
    return prob_unpriv / prob_priv


def statistical_parity_difference(y_pred: pd.Series, sensitive_attr: pd.Series, unprivileged: str, privileged: str) -> float:
    prob_unpriv = y_pred[sensitive_attr == unprivileged].mean()
    prob_priv = y_pred[sensitive_attr == privileged].mean()
    return prob_unpriv - prob_priv


def compute_bias_for_group(df_test: pd.DataFrame, preds: pd.Series, col: str, unprivileged: str, privileged: str) -> dict:
    if col not in df_test.columns:
        return {"disparate_impact": 1.0, "statistical_parity_diff": 0.0}
        
    di = disparate_impact(preds, df_test[col], unprivileged, privileged)
    spd = statistical_parity_difference(preds, df_test[col], unprivileged, privileged)
    
    return {
        "disparate_impact": di,
        "statistical_parity_diff": spd,
        # A simple composite "bias scalar" where 0 = no bias, higher = more bias
        # IDEAL disparate impact is 1.0. IDEAL stat parity is 0.0
        "bias_scalar": abs(1 - di) + abs(spd)
    }


def main():
    model_path = MODELS_DIR / "model.joblib"
    test_path  = MODELS_DIR / "test_data.pkl"

    if not model_path.exists() or not test_path.exists():
        print("[ERROR] Model artifacts not found. Run train_model.py first.", file=sys.stderr)
        sys.exit(1)

    print("[evaluate] Loading model and test data...")
    model = joblib.load(model_path)
    test_df = pd.read_pickle(test_path)

    y_true = test_df['income']
    X_test = test_df.drop(columns=['income'])
    
    print("[evaluate] Running predictions...")
    preds = model.predict(X_test)
    acc = accuracy_score(y_true, preds)
    
    # Calculate Bias
    # Sex: Privileged = Male, Unprivileged = Female
    sex_bias = compute_bias_for_group(X_test, pd.Series(preds, index=X_test.index), "sex", "Female", "Male")
    
    # Race: Privileged = White, Unprivileged = Black (or Non-White, simplifying for metric)
    race_col = X_test["race"].copy()
    # Group non-white for simple binary metric
    race_binary = race_col.apply(lambda x: "White" if x == "White" else "Minority")
    X_test["race_group"] = race_binary
    race_bias = compute_bias_for_group(X_test, pd.Series(preds, index=X_test.index), "race_group", "Minority", "White")
    
    report = {
        "framework": "scikit-learn",
        "dataset": "adult_census_income",
        "metrics": {
            "accuracy": acc,
        },
        "bias": {
            "gender": sex_bias,
            "race": race_bias,
            "religion": {"bias_scalar": 0.0, "note": "Religion not tracked in this dataset"}
        }
    }
    
    out_file = OUT_DIR / "eval_report.json"
    out_file.write_text(json.dumps(report, indent=2))
    
    print(f"[evaluate] Evaluation complete. Accuracy: {acc:.4f}")
    print(f"[evaluate] Gender Bias (Disparate Impact): {sex_bias['disparate_impact']:.3f} | DI < 0.8 is considered biased")
    print(f"[evaluate] Race Bias (Disparate Impact): {race_bias['disparate_impact']:.3f}")
    print(f"[evaluate] Saved to {out_file.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
