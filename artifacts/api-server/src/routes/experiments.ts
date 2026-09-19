import { Router, type IRouter } from "express";
import { mlflowClient, mlflowUiUrl } from "../services/mlflow_client";

const router: IRouter = Router();

function mapRun(run: Awaited<ReturnType<typeof mlflowClient.getRun>>) {
  const params = Object.fromEntries((run.data?.params ?? []).map((p) => [p.key, p.value]));
  const metrics = Object.fromEntries((run.data?.metrics ?? []).map((m) => [m.key, m.value]));
  const tags = Object.fromEntries((run.data?.tags ?? []).map((t) => [t.key, t.value]));
  return {
    run_id: run.info.run_id,
    experiment_id: run.info.experiment_id,
    run_name: run.info.run_name ?? tags["mlflow.runName"] ?? run.info.run_id,
    status: run.info.status,
    start_time: run.info.start_time,
    end_time: run.info.end_time ?? null,
    params,
    metrics,
    tags,
  };
}

router.get("/experiments", async (_req, res): Promise<void> => {
  const experiments = await mlflowClient.searchExperiments();
  const enriched = await Promise.all(
    experiments.map(async (experiment) => {
      const runs = await mlflowClient.searchRuns(experiment.experiment_id);
      return {
        experiment_id: experiment.experiment_id,
        name: experiment.name,
        run_count: runs.length,
      };
    }),
  );
  res.json(enriched);
});

router.get("/experiments/runs/compare", async (req, res): Promise<void> => {
  const runIds = String(req.query.run_ids ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (runIds.length < 2) {
    res.status(400).json({ error: "run_ids must include at least two ids" });
    return;
  }
  const runs = await Promise.all(runIds.map((id) => mlflowClient.getRun(id)));
  const mapped = runs.map(mapRun);
  const paramKeys = [...new Set(mapped.flatMap((run) => Object.keys(run.params)))];
  const metricKeys = [...new Set(mapped.flatMap((run) => Object.keys(run.metrics)))];
  res.json({
    runs: mapped,
    params: paramKeys.map((key) => ({
      key,
      values: mapped.map((run) => ({ run_id: run.run_id, value: run.params[key] ?? null })),
    })),
    metrics: metricKeys.map((key) => ({
      key,
      values: mapped.map((run) => ({ run_id: run.run_id, value: run.metrics[key] ?? null })),
    })),
  });
});

router.get("/experiments/runs/:runId", async (req, res): Promise<void> => {
  const run = await mlflowClient.getRun(req.params.runId);
  const metricKeys = [...new Set((run.data?.metrics ?? []).map((m) => m.key))];
  const metricHistory = await Promise.all(
    metricKeys.map(async (key) => ({
      key,
      points: (await mlflowClient.getMetricHistory(req.params.runId, key)).map((point) => ({
        step: point.step,
        value: point.value,
        timestamp: point.timestamp,
      })),
    })),
  );
  const artifacts = await mlflowClient.listArtifacts(req.params.runId);
  res.json({
    ...mapRun(run),
    metric_history: metricHistory,
    artifacts: (artifacts.files ?? []).map((file) => ({
      path: file.path,
      is_dir: file.is_dir,
      file_size: file.file_size ?? null,
      download_url: file.is_dir
        ? null
        : `/api/experiments/runs/${req.params.runId}/artifacts?path=${encodeURIComponent(file.path)}`,
    })),
    mlflow_ui_url: `${mlflowUiUrl}/#/experiments/${run.info.experiment_id}/runs/${run.info.run_id}`,
  });
});

router.get("/experiments/runs/:runId/artifacts", async (req, res): Promise<void> => {
  const artifactPath = String(req.query.path ?? "");
  if (!artifactPath) {
    res.status(400).json({ error: "path is required" });
    return;
  }
  const response = await mlflowClient.downloadArtifact(req.params.runId, artifactPath);
  const contentType = response.headers.get("content-type");
  if (contentType) res.setHeader("content-type", contentType);
  const buffer = Buffer.from(await response.arrayBuffer());
  res.send(buffer);
});

router.get("/experiments/:experimentId/runs", async (req, res): Promise<void> => {
  const orderBy = typeof req.query.order_by === "string" ? req.query.order_by : undefined;
  const runs = await mlflowClient.searchRuns(req.params.experimentId, orderBy);
  res.json(runs.map(mapRun));
});

export default router;
