import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# Ensure the output directory exists
output_dir = "presentation_plots"
os.makedirs(output_dir, exist_ok=True)

# Set style
sns.set_theme(style="whitegrid")

# 1. Class Distribution (Fraud / Security)
labels = ["Safe / Normal (99.8%)", "Fraud / Toxic (0.2%)"]
values = [998, 2]
plt.figure(figsize=(8, 5))
sns.barplot(x=labels, y=values, palette=["#2ecc71", "#e74c3c"], hue=labels, legend=False)
plt.title("Class Distribution (Extreme Imbalance)", fontsize=14)
plt.ylabel("Sample Count (Log Scale)", fontsize=12)
plt.yscale('log') # Log scale because of extreme imbalance
plt.tight_layout()
plt.savefig(os.path.join(output_dir, "class_distribution.png"), dpi=300)
plt.close()

# 2. Correlation Heatmap (Simulated PCA features for ML)
np.random.seed(42)
# Generate a dummy correlation matrix (mostly uncorrelated since it's PCA, but with some slight noise)
# We make an identity matrix and add noise to simulate real-world mostly independent features
data = np.eye(10) + np.random.randn(10, 10) * 0.1
corr = np.corrcoef(data)
labels_pca = [f"V{i}" for i in range(1, 11)]
plt.figure(figsize=(9, 7))
sns.heatmap(corr, annot=True, fmt=".2f", cmap="coolwarm", xticklabels=labels_pca, yticklabels=labels_pca, vmin=-1, vmax=1)
plt.title("Feature Correlation Matrix", fontsize=14)
plt.tight_layout()
plt.savefig(os.path.join(output_dir, "correlation_heatmap.png"), dpi=300)
plt.close()

# 3. Data Drift (Overlay Distribution Plot)
training_data = np.random.normal(loc=100, scale=15, size=1000)
production_data = np.random.normal(loc=115, scale=20, size=1000) # Shifted mean and wider variance to show drift

plt.figure(figsize=(8, 5))
sns.kdeplot(training_data, fill=True, label="Training Data Base", color="blue", alpha=0.3)
sns.kdeplot(production_data, fill=True, label="Production Data (Current Window)", color="orange", alpha=0.3)
plt.axvline(x=np.mean(training_data), color="blue", linestyle="--")
plt.axvline(x=np.mean(production_data), color="orange", linestyle="--")
plt.title("Data Drift Overlay (Model Monitoring)", fontsize=14)
plt.xlabel("Feature / Signal Value", fontsize=12)
plt.ylabel("Density", fontsize=12)
plt.legend()
plt.tight_layout()
plt.savefig(os.path.join(output_dir, "data_drift_overlay.png"), dpi=300)
plt.close()

print(f"Success! Your presentation plots have been saved to: {os.path.abspath(output_dir)}")
