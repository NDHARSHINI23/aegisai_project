from pathlib import Path
import csv
import os

from transformers import AutoTokenizer

ROOT = Path(__file__).resolve().parents[1]
out = ROOT / "data" / "processed"
out.mkdir(parents=True, exist_ok=True)
tokenizer_name = os.environ.get("AEGIS_TOKENIZER", "bert-base-uncased")
tokenizer = AutoTokenizer.from_pretrained(tokenizer_name)

for name in ("mmlu", "truthfulqa", "winobias", "pii_synthetic"):
    raw_path = ROOT / "data" / "raw" / name / f"{name}.csv"
    proc_path = out / f"{name}_processed.csv"
    
    if raw_path.exists():
        with open(raw_path, 'r', encoding='utf-8') as fin, open(proc_path, 'w', newline='', encoding='utf-8') as fout:
            reader = csv.reader(fin)
            writer = csv.writer(fout)
            headers = next(reader)
            writer.writerow(headers + ["token_length"])
            
            for row in reader:
                token_len = len(tokenizer.encode(row[1], add_special_tokens=False))
                writer.writerow(row + [token_len])

print("Preprocessed raw data and computed token features")
