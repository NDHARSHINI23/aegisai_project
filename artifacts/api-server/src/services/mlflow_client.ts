const trackingUri = process.env.MLFLOW_TRACKING_URI ?? "http://127.0.0.1:5001";
export const mlflowUiUrl = process.env.MLFLOW_UI_URL ?? "http://localhost:5001";

type MlflowRun = {
  info: {
    run_id: string;
    experiment_id: string;
    run_name?: string;
    status: string;
    start_time: number;
    end_time?: number;
  };
  data: {
    params: Array<{ key: string; value: string }>;
    metrics: Array<{ key: string; value: number; timestamp: number; step: number }>;
    tags: Array<{ key: string; value: string }>;
  };
};

async function mlflowFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${trackingUri.replace(/\/$/, "")}/api/2.0/mlflow${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`MLflow ${response.status}: ${body}`);
  }
  return response.json() as Promise<T>;
}

export const mlflowClient = {
  async searchExperiments() {
    const data = await mlflowFetch<{ experiments: Array<{ experiment_id: string; name: string }> }>(
      "/experiments/search",
      {
        method: "POST",
        body: JSON.stringify({ max_results: 100 }),
      },
    );
    return data.experiments ?? [];
  },

  async searchRuns(experimentId: string, orderBy?: string) {
    const data = await mlflowFetch<{ runs: MlflowRun[] }>("/runs/search", {
      method: "POST",
      body: JSON.stringify({
        experiment_ids: [experimentId],
        max_results: 200,
        order_by: orderBy ? [orderBy] : undefined,
      }),
    });
    return data.runs ?? [];
  },

  async getRun(runId: string) {
    const response = await fetch(
      `${trackingUri.replace(/\/$/, "")}/api/2.0/mlflow/runs/get?run_id=${encodeURIComponent(runId)}`,
    );
    if (!response.ok) throw new Error(`MLflow run not found: ${runId}`);
    const data = (await response.json()) as { run: MlflowRun };
    return data.run;
  },

  async getMetricHistory(runId: string, key: string) {
    const response = await fetch(
      `${trackingUri.replace(/\/$/, "")}/api/2.0/mlflow/metrics/get-history?run_id=${encodeURIComponent(runId)}&metric_key=${encodeURIComponent(key)}`,
    );
    if (!response.ok) return [];
    const data = (await response.json()) as {
      metrics: Array<{ key: string; value: number; timestamp: number; step: number }>;
    };
    return data.metrics ?? [];
  },

  async listArtifacts(runId: string, path = "") {
    const response = await fetch(
      `${trackingUri.replace(/\/$/, "")}/api/2.0/mlflow/artifacts/list?run_id=${encodeURIComponent(runId)}&path=${encodeURIComponent(path)}`,
    );
    if (!response.ok) return { root_uri: "", files: [] as Array<{ path: string; is_dir: boolean; file_size?: number }> };
    const data = (await response.json()) as {
      root_uri: string;
      files: Array<{ path: string; is_dir: boolean; file_size?: number }>;
    };
    return data;
  },

  async downloadArtifact(runId: string, artifactPath: string) {
    const response = await fetch(
      `${trackingUri.replace(/\/$/, "")}/get-artifact?path=${encodeURIComponent(artifactPath)}&run_uuid=${encodeURIComponent(runId)}`,
    );
    if (!response.ok) {
      throw new Error(`Artifact download failed: ${artifactPath}`);
    }
    return response;
  },

  async createRun(experimentName: string, runName: string) {
    const experiments = await this.searchExperiments();
    let experiment = experiments.find((item) => item.name === experimentName);
    if (!experiment) {
      const created = await mlflowFetch<{ experiment_id: string }>("/experiments/create", {
        method: "POST",
        body: JSON.stringify({ name: experimentName }),
      });
      experiment = { experiment_id: created.experiment_id, name: experimentName };
    }
    const run = await mlflowFetch<{ run: MlflowRun }>("/runs/create", {
      method: "POST",
      body: JSON.stringify({
        experiment_id: experiment.experiment_id,
        start_time: Date.now(),
        run_name: runName,
      }),
    });
    return { runId: run.run.info.run_id, experimentId: experiment.experiment_id };
  },

  async logParam(runId: string, key: string, value: string) {
    await mlflowFetch("/runs/log-parameter", {
      method: "POST",
      body: JSON.stringify({ run_id: runId, key, value }),
    });
  },

  async logMetric(runId: string, key: string, value: number, step: number) {
    await mlflowFetch("/runs/log-metric", {
      method: "POST",
      body: JSON.stringify({
        run_id: runId,
        key,
        value,
        timestamp: Date.now(),
        step,
      }),
    });
  },

  async finishRun(runId: string, status: "FINISHED" | "FAILED" = "FINISHED") {
    await mlflowFetch("/runs/update", {
      method: "POST",
      body: JSON.stringify({
        run_id: runId,
        status,
        end_time: Date.now(),
      }),
    });
  },
};

export type { MlflowRun };
