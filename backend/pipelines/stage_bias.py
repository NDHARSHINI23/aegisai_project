from pathlib import Path
import csv

ROOT = Path(__file__).resolve().parents[1]
out = ROOT / "data" / "outputs"
out.mkdir(parents=True, exist_ok=True)

winobias_path = ROOT / "data" / "processed" / "winobias_processed.csv"
if not winobias_path.exists():
    raise FileNotFoundError(f"Missing processed WinoBias data: {winobias_path}")

groups = {}
with winobias_path.open("r", encoding="utf-8") as file:
    reader = csv.DictReader(file)
    required = {"gender", "race", "religion", "model_prediction", "gold_answer"}
    if not required.issubset(reader.fieldnames or set()):
        raise ValueError("WinoBias data must include gender, race, religion, model_prediction, and gold_answer columns")
    for row in reader:
        for dimension in ("gender", "race", "religion"):
            groups.setdefault(dimension, {}).setdefault(row[dimension], []).append(row["model_prediction"] == row["gold_answer"])

bias_data = {}
for dimension, cohorts in groups.items():
    accuracies = [sum(values) / len(values) for values in cohorts.values() if values]
    if len(accuracies) < 2:
        raise ValueError(f"Need at least two {dimension} cohorts to compute demographic parity")
    bias_data[f"{dimension}_gap"] = round(max(accuracies) - min(accuracies), 3)

(out / "bias_metrics.json").write_text(json.dumps(bias_data, indent=2))
print("Computed actual demographic parity bias gaps from WinoBias metrics")
