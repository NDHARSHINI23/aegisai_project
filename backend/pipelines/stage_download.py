from pathlib import Path
import os
from urllib.request import urlretrieve

ROOT = Path(__file__).resolve().parents[1]

sources = {
    "mmlu": os.environ.get("AEGIS_MMLU_URL"),
    "truthfulqa": os.environ.get("AEGIS_TRUTHFULQA_URL"),
    "winobias": os.environ.get("AEGIS_WINOBIAS_URL"),
    "pii_synthetic": os.environ.get("AEGIS_PII_SYNTHETIC_URL"),
}

for name, source in sources.items():
    target = ROOT / "data" / "raw" / name
    target.mkdir(parents=True, exist_ok=True)
    if not source:
        raise RuntimeError(f"Set AEGIS_{name.upper()}_URL to the approved source CSV before downloading data")
    urlretrieve(source, target / f"{name}.csv")

print("Downloaded configured source datasets for MMLU, TruthfulQA, WinoBias, and PII data")
