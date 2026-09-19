from pathlib import Path
import csv
import os

import numpy as np
from sentence_transformers import SentenceTransformer

ROOT = Path(__file__).resolve().parents[1]
raw_dir = ROOT / "data" / "raw" / "truthfulqa"
output = ROOT / "data" / "processed" / "truthfulqa_embeddings.npy"
output.parent.mkdir(parents=True, exist_ok=True)

csv_files = sorted(raw_dir.glob("*.csv"))
if not csv_files:
	raise FileNotFoundError(f"No TruthfulQA CSV found in {raw_dir}. Run the download stage first.")

with csv_files[0].open(newline="", encoding="utf-8") as file:
	texts = [f"{row['question']}\n{row['context']}" for row in csv.DictReader(file)]

if not texts:
	raise ValueError(f"TruthfulQA input is empty: {csv_files[0]}")

model_name = os.environ.get("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
model = SentenceTransformer(model_name)
vectors = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True, show_progress_bar=False)
np.save(output, vectors)
print(f"Wrote {len(vectors)} embeddings to {output}")
