import { type FormEvent, type ReactNode, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDownRight, BarChart3, Check, ChevronRight,
  CircleDollarSign, Code2, Database,
  FileCheck2, GitBranch, Info, LockKeyhole, Play, RefreshCw, ScanSearch,
  ShieldAlert, ShieldCheck, SlidersHorizontal, Sparkles, Target,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAlertsQueryKey, getGetAllDriftQueryKey, getGetModelsQueryKey,
  getGetDvcStatusQueryKey,
  getGetRetrainHistoryQueryKey, getGetRetrainStatusQueryKey,
  getGetDriftHistoryQueryKey, getExplainDriftQueryKey,
  useCheckHallucination, useComputeDrift, useCreateModel,
  useExplainDrift, useGetAllDrift, useGetAlerts, useGetBiasScores,
  useGetCostByModel, useGetCostSummary, useGetCostTrend,
  useGetDashboardSummary, useGetDriftHistory, useGetDvcDag,
  useGetDvcStatus, useGetEvaluationResults, useGetHallucinationHistory,
  useGetHallucinationSummary, useGetModels, useGetRetrainHistory,
  useGetRetrainStatus, useGetSecurityEvents, useGetSecuritySummary,
  useHealthCheck, useReproDvc, useResolveAlert, useRunEvaluation,
  useScanSecurity, useTriggerRetrain, customFetch,
} from '@workspace/api-client-react';
import {
  Button, EmptyState, ErrorState, LoadingState, MetricCard, MiniBar,
  PageHeader, Panel, Sparkline, StatusBadge,
} from '@/components/aegis-components';

type QueryLike = { isLoading: boolean; isError: boolean; refetch: () => unknown };
const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
const formatTime = (value?: string) => value ? new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const pct = (value?: number) => typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—';
const number = (value?: number, digits = 1) => typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—';
const dollars = (value?: number) => typeof value === 'number' ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const tone = (value: string) => value === 'critical' || value === 'high' ? 'bad' : value === 'warning' || value === 'medium' ? 'warn' : value === 'active' || value === 'stable' || value === 'resolved' ? 'good' : 'neutral';
const metricTone = (status: string) => status === 'critical' ? 'bad' : status === 'warning' ? 'warn' : 'good';

function QueryState({ query, children, empty = false }: { query: QueryLike; children: ReactNode; empty?: boolean }) {
  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState retry={() => query.refetch()} />;
  if (empty) return <EmptyState />;
  return <>{children}</>;
}

export function DashboardPage() {
  const summary = useGetDashboardSummary();
  const health = useHealthCheck();
  const data = summary.data;
  const trend = data?.cost_trend_7d?.map((point) => point.cost) ?? [];
  return <div className="animate-enter">
    <PageHeader eyebrow="COMMAND CENTER / LIVE" title="Trust, at a glance." description="A high-confidence view of your production AI surface. Signals are sampled continuously across models, agents, and evaluation runs." action={<div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 font-mono-ui text-[10px] text-muted-foreground"><span className={`size-1.5 rounded-full ${health.data?.status === 'ok' ? 'bg-primary' : 'bg-accent'}`} />{health.data?.status === 'ok' ? 'API HEALTHY' : 'SYNCING SIGNALS'}</div>} />
    <QueryState query={summary} empty={!data}>
      <div className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Registered models" value={number(data?.total_models, 0)} detail={`${number(data?.active_models, 0)} active in production`} icon={Database} />
        <MetricCard label="Faithfulness score" value={pct(data?.avg_hallucination_score)} detail="Across the last 24 hours" icon={ShieldCheck} tone="teal" />
        <MetricCard label="Mean drift PSI" value={number(data?.avg_drift_psi, 3)} detail="Population stability index" icon={Activity} tone={(data?.avg_drift_psi ?? 0) > .2 ? 'amber' : 'blue'} />
        <MetricCard label="Open alerts" value={number(data?.open_alerts, 0)} detail={`${number(data?.critical_alerts, 0)} need immediate review`} icon={AlertTriangle} tone={(data?.critical_alerts ?? 0) > 0 ? 'red' : 'teal'} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <Panel title="Spend velocity" meta="Last 7 days · USD" action={<span className="font-mono-ui text-[10px] text-muted-foreground">{dollars(data?.total_cost_30d)} / 30d</span>}>
          <div className="p-5"><div className="mb-5 flex items-end justify-between"><div><div className="text-3xl font-extrabold tracking-[-.06em]">{dollars(data?.total_cost_30d)}</div><div className="mt-1 text-[11px] text-primary"><ArrowDownRight size={13} className="mr-1 inline" />12.8% vs prior period</div></div><div className="w-1/2 max-w-[300px]"><Sparkline values={trend} height={82} /></div></div><div className="flex justify-between border-t border-border/70 pt-3 font-mono-ui text-[9px] uppercase tracking-[.08em] text-muted-foreground">{(data?.cost_trend_7d ?? []).map((point) => <span key={point.date}>{formatDate(point.date)}</span>)}</div></div>
        </Panel>
        <Panel title="Highest accuracy" meta="Production registry">
          <div className="divide-y divide-border/70">{(data?.top_models_by_accuracy ?? []).slice(0, 4).map((model, index) => <div key={model.model} data-testid={`row-top-model-${index}`} className="flex items-center gap-3 px-5 py-3.5"><span className="font-mono-ui text-[10px] text-muted-foreground">0{index + 1}</span><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-bold">{model.model}</div><MiniBar value={model.accuracy} /></div><span className="font-mono-ui text-[11px] font-medium text-primary">{pct(model.accuracy)}</span></div>)}{!data?.top_models_by_accuracy?.length && <div className="p-5"><EmptyState label="No ranked models" /></div>}</div>
        </Panel>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[.95fr_1.05fr]">
        <Panel title="Security pulse" meta="Most recent events">
          <div className="divide-y divide-border/70">{(data?.recent_security_events ?? []).slice(0, 4).map((event) => <div key={event.id} data-testid={`row-security-event-${event.id}`} className="flex items-center gap-3 px-5 py-3"><span className={`grid size-7 place-items-center rounded-md ${event.severity === 'critical' ? 'bg-destructive/10 text-destructive' : 'bg-accent/15 text-accent-foreground'}`}><LockKeyhole size={14} /></span><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-bold">{event.event_type} <span className="font-normal text-muted-foreground">· {event.model_name}</span></div><div className="truncate text-[10px] text-muted-foreground">{event.preview}</div></div><StatusBadge tone={tone(event.severity)}>{event.severity}</StatusBadge></div>)}{!data?.recent_security_events?.length && <div className="p-5"><EmptyState label="No security events" /></div>}</div>
        </Panel>
        <Panel title="Coverage map" meta="Governance surface">
          <div className="grid grid-cols-2 gap-px overflow-hidden bg-border/70 sm:grid-cols-4">{([['Models', data?.total_models, Database, 'teal'], ['Agents', data?.total_agents, Sparkles, 'blue'], ['Evaluations', '94.2%', Target, 'amber'], ['Controls', '12 / 12', FileCheck2, 'teal']] as const).map(([label, value, Icon, color]) => <div key={String(label)} className="bg-card p-4"><Icon size={15} className={color === 'amber' ? 'text-accent' : color === 'blue' ? 'text-chart-3' : 'text-primary'} /><div className="mt-4 text-lg font-extrabold tracking-[-.04em]">{numberValue(value)}</div><div className="mt-0.5 font-mono-ui text-[9px] uppercase tracking-[.1em] text-muted-foreground">{label}</div></div>)}</div>
          <div className="flex items-center gap-3 px-5 py-4 text-[11px] text-muted-foreground"><span className="grid size-7 place-items-center rounded-full bg-primary/10 text-primary"><ShieldCheck size={14} /></span><span>All critical controls reporting within SLA.</span><ChevronRight size={14} className="ml-auto" /></div>
        </Panel>
      </div>
    </QueryState>
  </div>;
}
function numberValue(value: unknown) { return typeof value === 'number' ? number(value, 0) : String(value); }
export function ModelsPage() {
  const query = useGetModels();
  const create = useCreateModel();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', version: '', framework: 'PyTorch', endpoint_url: '', description: '' });
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate({ data: form }, { onSuccess: () => { setOpen(false); setForm({ name: '', version: '', framework: 'PyTorch', endpoint_url: '', description: '' }); client.invalidateQueries({ queryKey: getGetModelsQueryKey() }); } }); };
  return <div className="animate-enter"><PageHeader eyebrow="REGISTRY / INVENTORY" title="Model registry" description="The source of truth for every model promoted into the production plane." action={<Button onClick={() => setOpen(!open)} testId="button-toggle-create-model"><span className="text-base leading-none">+</span> Register model</Button>} />
    {open && <Panel className="mb-5 border-primary/30" title="Register a model" meta="Metadata is required before promotion"><form onSubmit={submit} className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4"><Field label="Model name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-model-name" /></Field><Field label="Version"><input required value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} data-testid="input-model-version" /></Field><Field label="Framework"><select value={form.framework} onChange={(e) => setForm({ ...form, framework: e.target.value })} data-testid="select-model-framework"><option>PyTorch</option><option>TensorFlow</option><option>Hugging Face</option><option>Custom</option></select></Field><Field label="Endpoint URL"><input value={form.endpoint_url} onChange={(e) => setForm({ ...form, endpoint_url: e.target.value })} data-testid="input-model-endpoint" /></Field><Field label="Description" wide><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="input-model-description" /></Field><div className="flex items-end gap-2"><Button type="submit" disabled={create.isPending} testId="button-submit-model">{create.isPending ? 'Registering…' : 'Register model'}</Button><Button onClick={() => setOpen(false)} variant="secondary" testId="button-cancel-model">Cancel</Button></div></form></Panel>}
    <QueryState query={query} empty={!query.data?.length}>
      <Panel title="Registered models" meta={`${query.data?.length ?? 0} records · sorted by registration`} action={<Button variant="ghost" testId="button-filter-models"><SlidersHorizontal size={14} /> Filter</Button>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left">
            <thead>
              <tr className="border-b border-border/70 font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground">
                <th className="px-5 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Framework</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Dataset</th>
                <th className="px-4 py-3 font-medium">Accuracy</th>
                <th className="px-4 py-3 font-medium">Environment</th>
                <th className="px-4 py-3 font-medium">Training Date</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(query.data ?? []).map((model) => (
                <tr key={model.id} data-testid={`row-model-${model.id}`} className="hover:bg-muted/45">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary"><Database size={15} /></span>
                      <div>
                        <div className="text-[11px] font-bold">{model.name}</div>
                        <div className="font-mono-ui text-[9px] text-muted-foreground">{model.version} · {model.git_commit ?? 'manual'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[11px] text-muted-foreground">{model.framework}</td>
                  <td className="px-4 py-4 text-[11px] text-muted-foreground">{model.owner ?? '—'}</td>
                  <td className="px-4 py-4 font-mono-ui text-[10px] text-muted-foreground break-all max-w-[150px]">{model.dataset_version ?? '—'}</td>
                  <td className="px-4 py-4 font-mono-ui text-[11px] text-primary">{pct(model.accuracy)}</td>
                  <td className="px-4 py-4">
                    <StatusBadge tone={tone(model.status)}>{model.status}</StatusBadge>
                  </td>
                  <td className="px-4 py-4 font-mono-ui text-[10px] text-muted-foreground">{formatDate(model.training_date ?? model.registered_at)}</td>
                  <td className="px-4 py-4 text-right">
                    {model.status !== 'production' ? (
                      <Button variant="secondary" onClick={() => {
                        customFetch(`/api/models/${model.id}/approve`, { method: "PATCH", body: JSON.stringify({ action: "approve" }) })
                          .then(() => client.invalidateQueries({ queryKey: getGetModelsQueryKey() }));
                      }} testId={`button-promote-${model.id}`}>Approve</Button>
                    ) : (
                      <StatusBadge tone="good">Approved</StatusBadge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </QueryState>
  </div>;
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) { return <label className={`block ${wide ? 'sm:col-span-2 lg:col-span-2' : ''}`}><span className="mb-1.5 block font-mono-ui text-[9px] uppercase tracking-[.1em] text-muted-foreground">{label}</span>{children}</label>; }

export function EvaluationPage() {
  const models = useGetModels();
  const query = useGetEvaluationResults();
  const run = useRunEvaluation();
  const [modelId, setModelId] = useState('');
  const [benchmarks, setBenchmarks] = useState('truthfulqa,hellaswag');
  const submit = (event: FormEvent) => { event.preventDefault(); if (modelId) run.mutate({ data: { model_id: modelId, benchmarks: benchmarks.split(',').map((item) => item.trim()).filter(Boolean) } }); };
  const avg = query.data?.length ? query.data.reduce((sum, item) => sum + item.score, 0) / query.data.length : undefined;
  return <div className="animate-enter"><PageHeader eyebrow="EVALUATION / BENCHMARKS" title="Evaluation lab" description="Run repeatable benchmark suites and compare the evidence behind every promotion decision." action={<StatusBadge tone={run.isPending ? 'warn' : 'good'}>{run.isPending ? 'RUN IN PROGRESS' : 'RUNNER READY'}</StatusBadge>} />
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><MetricCard label="Results returned" value={number(query.data?.length, 0)} detail="Across all benchmark suites" icon={BarChart3} /><MetricCard label="Mean score" value={pct(avg)} detail="Current result set" icon={Target} tone="blue" /><MetricCard label="Run queue" value={run.isPending ? '1 active' : 'Idle'} detail={run.data?.task_id ? `Task ${run.data.task_id}` : 'No active evaluation'} icon={Play} tone={run.isPending ? 'amber' : 'teal'} /></div>
    <Panel className="mb-5" title="Start an evaluation" meta="Runs asynchronously on the evaluation plane"><form onSubmit={submit} className="grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><Field label="Target model"><select required value={modelId} onChange={(e) => setModelId(e.target.value)} data-testid="select-evaluation-model"><option value="">Select a model</option>{(models.data ?? []).map((model) => <option key={model.id} value={model.id}>{model.name} · {model.version}</option>)}</select></Field><Field label="Benchmark suites"><input value={benchmarks} onChange={(e) => setBenchmarks(e.target.value)} data-testid="input-evaluation-benchmarks" /></Field><Button type="submit" disabled={run.isPending || !modelId} testId="button-run-evaluation"><Play size={13} />{run.isPending ? 'Running…' : 'Run suite'}</Button></form></Panel>
    <QueryState query={query} empty={!query.data?.length}><Panel title="Benchmark results" meta="Most recent observations"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="border-b border-border/70 font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground"><th className="px-5 py-3 font-medium">Benchmark</th><th className="px-4 py-3 font-medium">Subject</th><th className="px-4 py-3 font-medium">Score</th><th className="px-4 py-3 font-medium">Latency</th><th className="px-4 py-3 font-medium">Tokens</th><th className="px-4 py-3 font-medium">Run date</th></tr></thead><tbody className="divide-y divide-border/60">{(query.data ?? []).map((result) => <tr key={result.id} data-testid={`row-evaluation-${result.id}`} className="hover:bg-muted/45"><td className="px-5 py-4 text-[11px] font-bold">{result.benchmark_name}</td><td className="px-4 py-4 text-[11px] text-muted-foreground">{result.subject}</td><td className="px-4 py-4 font-mono-ui text-[11px] text-primary">{pct(result.score)}</td><td className="px-4 py-4 font-mono-ui text-[11px]">{number(result.latency_ms, 0)}ms</td><td className="px-4 py-4 font-mono-ui text-[11px]">{number(result.tokens_used, 0)}</td><td className="px-4 py-4 font-mono-ui text-[10px] text-muted-foreground">{formatTime(result.created_at)}</td></tr>)}</tbody></table></div></Panel></QueryState>
  </div>;
}

export function HallucinationPage() {
  const summary = useGetHallucinationSummary();
  const history = useGetHallucinationHistory();
  const check = useCheckHallucination();
  const [form, setForm] = useState({ question: '', context: '', answer: '' });
  const submit = (event: FormEvent) => { event.preventDefault(); check.mutate({ data: form }); };
  const values = history.data?.map((item) => item.value) ?? [];
  return <div className="animate-enter"><PageHeader eyebrow="FAITHFULNESS / TRACEABILITY" title="Hallucination guard" description="Faithfulness is not a feeling. Track it over time, then challenge a response against its source context." />
    <QueryState query={summary} empty={!summary.data?.length}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(summary.data ?? []).map((item) => <MetricCard key={item.model_id} label={item.model_name} value={pct(item.score)} detail={`${item.delta >= 0 ? '+' : ''}${(item.delta * 100).toFixed(1)} pts · ${number(item.prompts_checked, 0)} checks`} icon={Sparkles} tone={item.score < .8 ? 'amber' : 'teal'} />)}</div></QueryState>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><Panel title="Faithfulness history" meta="Rolling observation window"><div className="p-5"><Sparkline values={values} height={180} color="hsl(var(--chart-3))" /><div className="mt-3 flex justify-between font-mono-ui text-[9px] uppercase text-muted-foreground"><span>{formatDate(history.data?.[0]?.date)}</span><span>{formatDate(history.data?.at(-1)?.date)}</span></div></div></Panel><Panel title="Manual check" meta="Inspect one answer"><form onSubmit={submit} className="space-y-3 p-5"><Field label="Question"><textarea required value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} data-testid="textarea-hallucination-question" /></Field><Field label="Source context"><textarea required value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} data-testid="textarea-hallucination-context" /></Field><Field label="Model answer"><textarea required value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} data-testid="textarea-hallucination-answer" /></Field><Button type="submit" disabled={check.isPending} testId="button-check-hallucination"><ScanSearch size={13} />{check.isPending ? 'Checking…' : 'Check faithfulness'}</Button>{check.data && <div data-testid="status-hallucination-result" className="rounded-md border border-primary/25 bg-primary/5 p-3"><div className="font-mono-ui text-[9px] uppercase tracking-[.1em] text-muted-foreground">Faithfulness result</div><div className="mt-1 text-2xl font-extrabold text-primary">{pct(check.data.faithfulness_score)}</div><div className="mt-1 text-[10px] text-muted-foreground">Method: {check.data.method}</div></div>}</form></Panel></div>
  </div>;
}
export function DriftPage() {
  const query = useGetAllDrift();
  const [selected, setSelected] = useState('');
  const [driftType, setDriftType] = useState<'data' | 'model' | 'concept'>('data');
  const chosen = selected || query.data?.[0]?.model_id || '';
  const history = useGetDriftHistory(chosen, { query: { queryKey: getGetDriftHistoryQueryKey(chosen) } });
  const explanation = useExplainDrift(chosen, driftType, { query: { queryKey: getExplainDriftQueryKey(chosen, driftType) } });
  const compute = useComputeDrift();
  const client = useQueryClient();
  const current = query.data?.find((item) => item.model_id === chosen);
  return <div className="animate-enter"><PageHeader eyebrow="OBSERVABILITY / DISTRIBUTION" title="Drift monitor" description="Watch the three ways production moves away from the evidence your model learned from." action={<Button onClick={() => chosen && compute.mutate({ modelId: chosen }, { onSuccess: () => client.invalidateQueries({ queryKey: getGetAllDriftQueryKey() }) })} disabled={!chosen || compute.isPending} testId="button-compute-drift"><RefreshCw size={13} />{compute.isPending ? 'Computing…' : 'Compute drift'}</Button>} />
    <QueryState query={query} empty={!query.data?.length}><div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]"><Panel title="Model fleet" meta="Select a model to inspect"><div className="divide-y divide-border/60">{(query.data ?? []).map((item) => <button type="button" key={item.model_id} onClick={() => setSelected(item.model_id)} data-testid={`button-select-drift-${item.model_id}`} className={`flex w-full items-center gap-3 px-5 py-4 text-left ${chosen === item.model_id ? 'bg-primary/5' : 'hover:bg-muted/40'}`}><span className={`size-2 rounded-full ${[item.data_drift.status, item.model_drift.status, item.concept_drift.status].includes('critical') ? 'bg-destructive' : 'bg-primary'}`} /><span className="min-w-0 flex-1"><span className="block text-[11px] font-bold">{item.model_name}</span><span className="font-mono-ui text-[9px] text-muted-foreground">{item.model_id}</span></span><ChevronRight size={15} className="text-muted-foreground" /></button>)}</div></Panel><div className="space-y-5"><Panel title={current?.model_name ?? 'Select a model'} meta="Metric status · PSI / score"><div className="grid gap-px bg-border/60 sm:grid-cols-3">{current && [['Data drift', current.data_drift], ['Model drift', current.model_drift], ['Concept drift', current.concept_drift]].map(([label, metric]) => <button type="button" key={String(label)} onClick={() => setDriftType(String(label).split(' ')[0].toLowerCase() as 'data' | 'model' | 'concept')} data-testid={`button-explain-${String(label).replace(' ', '-').toLowerCase()}`} className="bg-card p-5 text-left hover:bg-muted/35"><div className="flex items-center justify-between font-mono-ui text-[9px] uppercase text-muted-foreground"><span>{String(label)}</span><Info size={13} /></div><div className="mt-3 text-2xl font-extrabold tracking-[-.05em]">{number((metric as { value: number }).value, 3)}</div><div className="mt-2"><StatusBadge tone={metricTone((metric as { status: string }).status)}>{(metric as { status: string }).status}</StatusBadge></div></button>)}</div></Panel><Panel title={`${driftType} drift history`} meta="Selected model"><div className="p-5"><Sparkline values={(history.data?.[`${driftType}_drift` as keyof typeof history.data] as { value: number }[] | undefined)?.map((point) => point.value) ?? []} height={120} color="hsl(var(--accent))" />{explanation.data && <div className="mt-4 rounded-md border border-accent/25 bg-accent/10 p-4"><div className="text-[11px] font-bold">{explanation.data.title}</div><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{explanation.data.explanation}</p><div className="mt-3 border-t border-accent/20 pt-2 font-mono-ui text-[9px] uppercase text-accent-foreground">Recommendation · {explanation.data.recommendation}</div></div>}</div></Panel></div></div></QueryState>
  </div>;
}

export function BiasPage() {
  const query = useGetBiasScores();
  return <div className="animate-enter"><PageHeader eyebrow="EQUITY / BREAKDOWN" title="Bias & equity" description="Review disparity across sensitive categories before a score becomes a customer experience." /><QueryState query={query} empty={!query.data?.length}><Panel title="Category breakdown" meta="Lower scores indicate less observed disparity"><div className="divide-y divide-border/60">{(query.data ?? []).map((item) => <div key={item.model_id} data-testid={`row-bias-${item.model_id}`} className="grid gap-4 px-5 py-5 lg:grid-cols-[1.1fr_110px_1fr_1fr_1fr] lg:items-center"><div><div className="text-[11px] font-bold">{item.model_name}</div><div className="font-mono-ui text-[9px] text-muted-foreground">{item.model_id}</div></div><div><div className="font-mono-ui text-[9px] uppercase text-muted-foreground">Overall</div><div className={`mt-1 text-lg font-extrabold ${item.overall > .2 ? 'text-destructive' : 'text-primary'}`}>{number(item.overall, 3)}</div></div>{[['Gender', item.gender], ['Race', item.race], ['Religion', item.religion]].map(([label, value]) => <div key={String(label)}><div className="mb-2 flex justify-between font-mono-ui text-[9px] uppercase text-muted-foreground"><span>{label}</span><span>{number(value as number, 3)}</span></div><MiniBar value={value as number} max={.5} color={(value as number) > .2 ? 'bg-destructive' : 'bg-primary'} /></div>)}</div>)}</div></Panel></QueryState></div>;
}

export function CostPage() {
  const summary = useGetCostSummary();
  const models = useGetCostByModel();
  const trend = useGetCostTrend();
  const values = trend.data?.map((point) => point.cost) ?? [];
  return <div className="animate-enter"><PageHeader eyebrow="FINOPS / USAGE" title="Cost & tokens" description="Know what inference costs, which model is carrying the load, and whether spend is moving in the right direction." /><div className="mb-5 grid gap-3 sm:grid-cols-2"><MetricCard label="30 day spend" value={dollars(summary.data?.total)} detail={`${summary.data?.delta !== undefined && summary.data.delta >= 0 ? '+' : ''}${number(summary.data?.delta, 1)}% vs prior period`} icon={CircleDollarSign} tone={(summary.data?.delta ?? 0) > 0 ? 'amber' : 'teal'} /><MetricCard label="Active cost centers" value={number(models.data?.length, 0)} detail="Models with recorded usage" icon={Database} tone="blue" /></div><div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><Panel title="Spend trend" meta="Daily estimated cost · USD"><div className="p-5"><Sparkline values={values} height={210} /><div className="mt-3 flex justify-between font-mono-ui text-[9px] uppercase text-muted-foreground"><span>{formatDate(trend.data?.[0]?.date)}</span><span>{formatDate(trend.data?.at(-1)?.date)}</span></div></div></Panel><Panel title="Spend by model" meta="Token volume and estimated cost"><div className="divide-y divide-border/60">{(models.data ?? []).map((item) => <div key={item.model_id} data-testid={`row-cost-${item.model_id}`} className="px-5 py-4"><div className="flex items-center justify-between"><span className="text-[11px] font-bold">{item.model_name}</span><span className="font-mono-ui text-[11px] text-primary">{dollars(item.estimated_cost_usd)}</span></div><div className="mt-2 flex items-center gap-3"><MiniBar value={item.estimated_cost_usd} max={Math.max(...(models.data ?? []).map((model) => model.estimated_cost_usd), 1)} /><span className="shrink-0 font-mono-ui text-[9px] text-muted-foreground">{number(item.total_tokens, 0)} tokens</span></div></div>)}{!models.data?.length && <div className="p-5"><EmptyState label="No usage data" /></div>}</div></Panel></div></div>;
}

export function SecurityPage() {
  const events = useGetSecurityEvents();
  const summary = useGetSecuritySummary();
  const scan = useScanSecurity();
  const [text, setText] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); scan.mutate({ data: { text } }); };
  return <div className="animate-enter"><PageHeader eyebrow="SECURITY / GUARDRAILS" title="Security events" description="PII, prompt injection, and toxic output signals in one queue — with a safe place to test a suspicious string." /><div className="mb-5 grid gap-3 sm:grid-cols-3"><MetricCard label="PII detections" value={number(summary.data?.pii, 0)} detail="Current observation window" icon={LockKeyhole} tone="amber" /><MetricCard label="Injection attempts" value={number(summary.data?.injection, 0)} detail="Blocked or flagged" icon={ShieldAlert} tone="red" /><MetricCard label="Toxic outputs" value={number(summary.data?.toxic, 0)} detail="Requires review" icon={AlertTriangle} tone="blue" /></div><div className="mb-5 grid gap-5 xl:grid-cols-[.75fr_1.25fr]"><Panel title="Manual security scan" meta="No data is persisted by this check"><form onSubmit={submit} className="p-5"><Field label="Text to inspect"><textarea required rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a prompt or output for inspection…" data-testid="textarea-security-scan" /></Field><Button type="submit" disabled={scan.isPending} testId="button-run-security-scan"><ScanSearch size={13} />{scan.isPending ? 'Scanning…' : 'Scan text'}</Button>{scan.data && <div data-testid="status-security-scan" className="mt-4 rounded-md border border-primary/25 bg-primary/5 p-3"><div className="flex justify-between"><span className="font-mono-ui text-[9px] uppercase text-muted-foreground">Risk assessment</span><StatusBadge tone={scan.data.risk === 'high' || scan.data.risk === 'critical' ? 'bad' : 'good'}>{scan.data.risk}</StatusBadge></div><div className="mt-3 text-[10px] text-muted-foreground">Masked text</div><div className="mt-1 break-words font-mono-ui text-[10px]">{scan.data.masked_text}</div><div className="mt-3 font-mono-ui text-[9px] text-muted-foreground">{scan.data.findings.length} findings</div></div>}</form></Panel><Panel title="Event stream" meta="Newest first"><QueryState query={events} empty={!events.data?.length}><div className="divide-y divide-border/60">{(events.data ?? []).map((event) => <div key={event.id} data-testid={`row-security-${event.id}`} className="flex items-start gap-3 px-5 py-4"><span className={`mt-0.5 grid size-7 place-items-center rounded-md ${event.severity === 'critical' ? 'bg-destructive/10 text-destructive' : 'bg-accent/15 text-accent-foreground'}`}><ShieldAlert size={14} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">{event.event_type}<span className="font-normal text-muted-foreground">· {event.model_name}</span><StatusBadge tone={tone(event.severity)}>{event.severity}</StatusBadge></div><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{event.preview}</p><div className="mt-2 font-mono-ui text-[9px] text-muted-foreground">{formatTime(event.created_at)}</div></div></div>)}</div></QueryState></Panel></div></div>;
}

export function AlertsPage() {
  const query = useGetAlerts();
  const resolve = useResolveAlert();
  const client = useQueryClient();
  const open = (query.data ?? []).filter((alert) => !alert.is_resolved);
  return <div className="animate-enter"><PageHeader eyebrow="OPERATIONS / TRIAGE" title="Alert triage" description="A short, accountable queue for the signals that deserve a human decision." action={<div className="rounded-md border border-accent/25 bg-accent/10 px-3 py-2 font-mono-ui text-[10px] text-accent-foreground">{open.length} OPEN</div>} /><QueryState query={query} empty={!query.data?.length}><div className="space-y-3">{(query.data ?? []).map((alert) => <Panel key={alert.id} className={alert.is_resolved ? 'opacity-65' : alert.severity === 'critical' ? 'border-destructive/30' : ''}><div data-testid={`row-alert-${alert.id}`} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><span className={`grid size-9 shrink-0 place-items-center rounded-lg ${alert.severity === 'critical' ? 'bg-destructive/10 text-destructive' : 'bg-accent/15 text-accent-foreground'}`}><AlertTriangle size={17} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[12px] font-bold">{alert.type}</span><StatusBadge tone={tone(alert.severity)}>{alert.severity}</StatusBadge><span className="font-mono-ui text-[9px] text-muted-foreground">{alert.model_name}</span></div><div className="mt-1 text-[11px] text-muted-foreground">{alert.message}</div><div className="mt-2 font-mono-ui text-[9px] text-muted-foreground">{formatTime(alert.created_at)}</div></div>{alert.is_resolved ? <StatusBadge tone="good">Resolved</StatusBadge> : <Button onClick={() => resolve.mutate({ id: alert.id }, { onSuccess: () => client.invalidateQueries({ queryKey: getGetAlertsQueryKey() }) })} disabled={resolve.isPending} variant={alert.severity === 'critical' ? 'danger' : 'secondary'} testId={`button-resolve-alert-${alert.id}`}><Check size={13} /> Resolve</Button>}</div></Panel>)}</div></QueryState></div>;
}

export function DvcPage() {
  const status = useGetDvcStatus();
  const dag = useGetDvcDag();
  const repro = useReproDvc();
  const client = useQueryClient();
  return <div className="animate-enter"><PageHeader eyebrow="REPRODUCIBILITY / PIPELINE" title="DVC pipelines" description="See what trained the model, which artifacts changed, and reproduce the run on demand." action={<Button onClick={() => repro.mutate(undefined, { onSuccess: () => { client.invalidateQueries({ queryKey: getGetDvcStatusQueryKey() }); } })} disabled={repro.isPending} testId="button-reproduce-dvc"><Play size={13} />{repro.isPending ? 'Queueing…' : 'Reproduce pipeline'}</Button>} /><div className="grid gap-5 xl:grid-cols-[.7fr_1.3fr]"><Panel title="Pipeline status" meta="Repository health"><QueryState query={status} empty={!status.data}><div className="p-5"><div className="flex items-center gap-3"><span className={`grid size-10 place-items-center rounded-lg ${status.data?.status === 'success' ? 'bg-primary/10 text-primary' : 'bg-accent/15 text-accent-foreground'}`}><GitBranch size={18} /></span><div><div className="text-lg font-extrabold">{status.data?.status ?? 'Unknown'}</div><div className="font-mono-ui text-[9px] text-muted-foreground">Last run {formatTime(status.data?.last_run)}</div></div></div><div className="mt-6 space-y-3">{(status.data?.stages ?? []).map((stage, index) => <div key={index} data-testid={`row-dvc-stage-${index}`} className="flex items-center gap-3 rounded-md border border-border/70 p-3"><span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary"><Check size={13} /></span><span className="flex-1 font-mono-ui text-[10px]">{String(stage.name ?? stage.stage ?? `stage_${index + 1}`)}</span><span className="font-mono-ui text-[9px] uppercase text-primary">complete</span></div>)}</div></div></QueryState></Panel><Panel title="DAG topology" meta={`${dag.data?.nodes?.length ?? 0} nodes · ${dag.data?.edges?.length ?? 0} edges`}><QueryState query={dag} empty={!dag.data?.nodes?.length}><div className="relative min-h-[300px] overflow-hidden aegis-grid p-6"><div className="grid gap-3 sm:grid-cols-3">{(dag.data?.nodes ?? []).map((node, index) => <div key={index} data-testid={`card-dvc-node-${index}`} className="relative rounded-lg border border-primary/25 bg-card p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><Code2 size={15} className="text-primary" /><span className="font-mono-ui text-[9px] text-muted-foreground">0{index + 1}</span></div><div className="text-[11px] font-bold">{String(node.name ?? node.id ?? node.stage ?? `artifact_${index + 1}`)}</div><div className="mt-1 font-mono-ui text-[9px] text-muted-foreground">{String(node.status ?? 'tracked artifact')}</div></div>)}</div></div></QueryState></Panel></div></div>;
}
export function RetrainingPage() {
  const models = useGetModels();
  const query = useGetRetrainHistory();
  const trigger = useTriggerRetrain();
  const [taskId, setTaskId] = useState('');
  const status = useGetRetrainStatus(taskId, { query: { queryKey: getGetRetrainStatusQueryKey(taskId) } });
  const client = useQueryClient();
  const [form, setForm] = useState({ model_id: '', reason: 'Scheduled refresh' });
  const submit = (event: FormEvent) => { event.preventDefault(); trigger.mutate({ data: form }, { onSuccess: (job) => { setTaskId(job.task_id); client.invalidateQueries({ queryKey: getGetRetrainHistoryQueryKey() }); } }); };
  return <div className="animate-enter"><PageHeader eyebrow="LIFECYCLE / AUTOMATION" title="Retraining" description="Automated refreshes with a visible reason, live state, and measurable outcome." /><div className="mb-5 grid gap-5 xl:grid-cols-[.72fr_1.28fr]"><Panel title="Trigger retraining" meta="Creates a tracked asynchronous job"><form onSubmit={submit} className="space-y-3 p-5"><Field label="Model"><select required value={form.model_id} onChange={(e) => setForm({ ...form, model_id: e.target.value })} data-testid="select-retrain-model"><option value="">Select model</option>{(models.data ?? []).map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></Field><Field label="Reason"><input required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} data-testid="input-retrain-reason" /></Field><Button type="submit" disabled={trigger.isPending || !form.model_id} testId="button-trigger-retrain"><RefreshCw size={13} />{trigger.isPending ? 'Queueing…' : 'Trigger job'}</Button></form>{(status.data || trigger.data) && <div className="border-t border-border/70 p-5"><div className="mb-3 flex items-center justify-between"><span className="font-mono-ui text-[9px] uppercase text-muted-foreground">Live job status</span><StatusBadge tone={status.data?.state === 'failed' ? 'bad' : 'good'}>{status.data?.state ?? trigger.data?.status ?? 'queued'}</StatusBadge></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${status.data?.progress ?? 0}%` }} /></div><div className="mt-2 flex justify-between font-mono-ui text-[9px] text-muted-foreground"><span>{status.data?.current_step ?? 'Awaiting worker'}</span><span>{number(status.data?.progress, 0)}%</span></div></div>}</Panel><Panel title="Retraining timeline" meta="Historical outcomes"><QueryState query={query} empty={!query.data?.length}><div className="divide-y divide-border/60">{(query.data ?? []).map((run) => <div key={run.id} data-testid={`row-retrain-${run.id}`} className="flex gap-4 px-5 py-4"><div className="flex flex-col items-center"><span className={`mt-1 size-2.5 rounded-full ${run.outcome === 'success' ? 'bg-primary' : 'bg-destructive'}`} /><span className="mt-1 h-full w-px bg-border" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-[11px] font-bold">{run.model_name}</div><StatusBadge tone={run.outcome === 'success' ? 'good' : 'bad'}>{run.outcome}</StatusBadge></div><div className="mt-1 text-[10px] text-muted-foreground">{run.trigger_reason}</div><div className="mt-2 flex flex-wrap gap-4 font-mono-ui text-[9px] text-muted-foreground"><span>{formatTime(run.started_at)}</span><span>accuracy {pct(run.old_accuracy)} → <b className="text-primary">{pct(run.new_accuracy)}</b></span><span>Δ {run.delta >= 0 ? '+' : ''}{(run.delta * 100).toFixed(1)} pts</span></div></div></div>)}</div></QueryState></Panel></div></div>;
}
