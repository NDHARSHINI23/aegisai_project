from pathlib import Path
import json
import csv

ROOT = Path(__file__).resolve().parents[1]
out = ROOT / "data" / "outputs"
out.mkdir(parents=True, exist_ok=True)

# Base distributions
dist = [0 for _ in range(10)]
total_len = 0
count = 0

proc_path = ROOT / "data" / "processed" / "mmlu_processed.csv"
if proc_path.exists():
    with open(proc_path, 'r', encoding='utf-8') as fin:
        reader = csv.DictReader(fin)
        for row in reader:
            token_len = int(row["token_length"])
            bin_idx = min(9, token_len // 5)
            dist[bin_idx] += 1
            total_len += token_len
            count += 1

normalized_dist = [d / max(1, count) for d in dist]
baseline = {
    "reference_distribution": normalized_dist,
    "mean_prompt_length": round(total_len / max(1, count), 2)
}

(out / "drift_baseline.json").write_text(json.dumps(baseline, indent=2))
print("Computed actual baseline reference distribution for PSI data drift")
