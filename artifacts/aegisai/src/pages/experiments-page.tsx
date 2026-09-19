import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import {
  useCompareExperimentRuns,
  useGetExperimentRun,
  useGetExperimentRuns,
  useGetExperiments,
} from '@workspace/api-client-react';
import {
  Button, EmptyState, ErrorState, LoadingState, PageHeader, Panel, Sparkline, StatusBadge,
} from '@/components/aegis-components';

type QueryLike = { isLoading: boolean; isError: boolean; refetch: () => unknown };

function QueryState({ query, children, empty = false }: { query: QueryLike; children: ReactNode; empty?: boolean }) {
  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState retry={() => query.refetch()} />;
  if (empty) return <EmptyState />;
  return <>{children}</>;
}

export function ExperimentsPage() {
  const experiments = useGetExperiments();
  const [experimentId, setExperimentId] = useState('');
  const [orderBy, setOrderBy] = useState('metrics.avg_faithfulness DESC');
  const runs = useGetExperimentRuns(experimentId, { order_by: orderBy }, { query: { enabled: Boolean(experimentId) } });
  const [selectedRuns, setSelectedRuns] = useState<string[]>([]);
  const [detailRunId, setDetailRunId] = useState<string | null>(null);
  const detail = useGetExperimentRun(detailRunId ?? '', { query: { enabled: Boolean(detailRunId) } });
  const compare = useCompareExperimentRuns({ run_ids: selectedRuns.join(',') }, { query: { enabled: selectedRuns.length >= 2 } });

  const metricKeys = useMemo(() => {
    const keys = new Set<string>();
    (runs.data ?? []).forEach((run) => Object.keys(run.metrics).forEach((key) => keys.add(key)));
    return [...keys];
  }, [runs.data]);

  const chartSeries = useMemo(() => {
    const first = detail.data?.metric_history?.[0];
    return first?.points.map((point) => point.value) ?? [];
  }, [detail.data?.metric_history]);

  useEffect(() => {
    if (!experimentId && experiments.data?.length) {
      setExperimentId(experiments.data[0].experiment_id);
    }
  }, [experimentId, experiments.data]);

  return <div className="animate-enter">
    <PageHeader eyebrow="CONTROL PLANE / MLFLOW" title="Experiments" description="Live experiment and run data proxied from MLflow." />
    <QueryState query={experiments} empty={!experiments.data?.length}>
      <Panel title="Experiment picker" meta="Select an experiment to inspect runs"><div className="flex flex-wrap items-center gap-3 p-5"><select className="min-w-[260px] rounded-md border border-border bg-card px-3 py-2 text-[11px]" value={experimentId} onChange={(e) => { setExperimentId(e.target.value); setSelectedRuns([]); setDetailRunId(null); }} data-testid="select-experiment">{(experiments.data ?? []).map((item) => <option key={item.experiment_id} value={item.experiment_id}>{item.name} ({item.run_count})</option>)}</select><select className="rounded-md border border-border bg-card px-3 py-2 text-[11px]" value={orderBy} onChange={(e) => setOrderBy(e.target.value)} data-testid="select-run-order"><option value="metrics.avg_faithfulness DESC">avg_faithfulness DESC</option><option value="metrics.avg_cost_usd ASC">avg_cost_usd ASC</option><option value="start_time DESC">start_time DESC</option></select></div></Panel>
    </QueryState>
    {experimentId && <QueryState query={runs} empty={!runs.data?.length}>
      <Panel className="mt-5" title="Runs" meta={`${runs.data?.length ?? 0} runs`}><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr className="border-b border-border/70 font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground"><th className="px-4 py-3">Select</th><th className="px-4 py-3">Run</th><th className="px-4 py-3">Status</th>{metricKeys.map((key) => <th key={key} className="px-4 py-3">{key}</th>)}<th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-border/60">{(runs.data ?? []).map((run) => <tr key={run.run_id} className="hover:bg-muted/45"><td className="px-4 py-3"><input type="checkbox" checked={selectedRuns.includes(run.run_id)} onChange={(e) => setSelectedRuns((current) => e.target.checked ? [...current, run.run_id] : current.filter((id) => id !== run.run_id))} /></td><td className="px-4 py-3"><div className="flex items-center gap-2"><FlaskConical size={14} className="text-primary" /><span className="text-[11px] font-bold">{run.run_name}</span></div><div className="font-mono-ui text-[9px] text-muted-foreground">{run.run_id}</div></td><td className="px-4 py-3"><StatusBadge tone={run.status === 'FINISHED' ? 'good' : 'warn'}>{run.status}</StatusBadge></td>{metricKeys.map((key) => <td key={key} className="px-4 py-3 font-mono-ui text-[10px]">{run.metrics[key]?.toFixed?.(3) ?? '—'}</td>)}<td className="px-4 py-3"><Button variant="ghost" onClick={() => setDetailRunId(run.run_id)} testId={`button-run-detail-${run.run_id}`}>Detail</Button></td></tr>)}</tbody></table></div></Panel>
    </QueryState>}
    {selectedRuns.length >= 2 && compare.data && <Panel className="mt-5" title="Run comparison" meta={`${selectedRuns.length} runs selected`}><div className="grid gap-4 p-5 lg:grid-cols-2">{compare.data.metrics.map((metric) => <div key={metric.key as string} className="rounded-md border border-border p-4"><div className="mb-2 text-[11px] font-bold">{String(metric.key)}</div><div className="space-y-1">{metric.values.map((item) => <div key={item.run_id} className="flex justify-between font-mono-ui text-[10px]"><span>{item.run_id.slice(0, 8)}…</span><span className="text-primary">{item.value ?? '—'}</span></div>)}</div></div>)}</div></Panel>}
    {detailRunId && detail.data && <Panel className="mt-5" title={detail.data.run_name} meta="Metric history and artifacts"><div className="grid gap-5 p-5 lg:grid-cols-[1fr_1fr]"><div><div className="mb-2 text-[11px] font-bold">Params</div><div className="space-y-1 font-mono-ui text-[10px]">{Object.entries(detail.data.params).map(([key, value]) => <div key={key}><span className="text-muted-foreground">{key}:</span> {value}</div>)}</div><div className="mt-4"><Button variant="secondary" testId="button-open-mlflow"><a href={detail.data.mlflow_ui_url} target="_blank" rel="noreferrer">Open in MLflow UI</a></Button></div></div><div><div className="mb-2 text-[11px] font-bold">Metric history</div><Sparkline values={chartSeries} height={120} /><div className="mt-4 text-[11px] font-bold">Artifacts</div><div className="mt-2 space-y-1">{detail.data.artifacts.map((artifact) => <div key={artifact.path as string} className="font-mono-ui text-[10px]">{artifact.is_dir ? '📁' : '📄'} {String(artifact.path)}{artifact.download_url ? <a className="ml-2 text-primary" href={artifact.download_url as string}>download</a> : null}</div>)}</div></div></div></Panel>}
  </div>;
}
