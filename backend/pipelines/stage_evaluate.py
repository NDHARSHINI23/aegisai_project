from pathlib import Path
import json
import csv

ROOT = Path(__file__).resolve().parents[1]
out = ROOT / "data" / "outputs"
out.mkdir(parents=True, exist_ok=True)

scores = {}

for name in ("mmlu", "truthfulqa", "winobias"):
    proc_path = ROOT / "data" / "processed" / f"{name}_processed.csv"
    if proc_path.exists():
        correct = 0
        total = 0
        with open(proc_path, 'r', encoding='utf-8') as fin:
            reader = csv.DictReader(fin)
            for row in reader:
                total += 1
                if row["gold_answer"] == row["model_prediction"]:
                    correct += 1
        
        acc = round(correct / max(1, total), 3)
        scores[name] = {"accuracy": acc, "metric": "exact_match"}

(out / "eval_scores.json").write_text(json.dumps(scores, indent=2))
print("Computed actual evaluation metrics from processed features")
