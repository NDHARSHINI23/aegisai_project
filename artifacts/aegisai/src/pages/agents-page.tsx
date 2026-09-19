import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { Bot, ChevronRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAgentsQueryKey,
  useCreateAgent,
  useGetAgent,
  useGetAgents,
  useGetModels,
} from '@workspace/api-client-react';
import {
  Button, EmptyState, ErrorState, LoadingState, MetricCard, PageHeader, Panel, Sparkline, StatusBadge,
} from '@/components/aegis-components';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

type QueryLike = { isLoading: boolean; isError: boolean; refetch: () => unknown };
const pct = (value?: number) => typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—';
const number = (value?: number, digits = 1) => typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—';
const tone = (value: string) => value === 'critical' || value === 'archived' ? 'bad' : value === 'staging' || value === 'warning' ? 'warn' : 'good';

function QueryState({ query, children, empty = false }: { query: QueryLike; children: ReactNode; empty?: boolean }) {
  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState retry={() => query.refetch()} />;
  if (empty) return <EmptyState />;
  return <>{children}</>;
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`block ${wide ? 'sm:col-span-2' : ''}`}><span className="mb-1.5 block font-mono-ui text-[9px] uppercase tracking-[.1em] text-muted-foreground">{label}</span>{children}</label>;
}

export function AgentsPage() {
  const query = useGetAgents();
  const models = useGetModels();
  const create = useCreateAgent();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useGetAgent(selectedId ?? '', { query: { enabled: Boolean(selectedId) } });
  const [form, setForm] = useState({ name: '', description: '', llm_model_id: '', tools: 'lookup_order,issue_refund', max_tool_depth: 5 });

  const chartValues = useMemo(
    () => (detail.data?.recent_trajectories ?? []).slice(0, 30).reverse().map((item) => item.hallucination_score ?? 0),
    [detail.data?.recent_trajectories],
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({
      data: {
        name: form.name,
        description: form.description,
        llm_model_id: form.llm_model_id,
        tools: form.tools.split(',').map((item) => item.trim()).filter(Boolean),
        max_tool_depth: form.max_tool_depth,
      },
    }, {
      onSuccess: () => {
        setOpen(false);
        setForm({ name: '', description: '', llm_model_id: '', tools: 'lookup_order,issue_refund', max_tool_depth: 5 });
        client.invalidateQueries({ queryKey: getGetAgentsQueryKey() });
      },
    });
  };

  return <div className="animate-enter">
    <PageHeader eyebrow="REGISTRY / AGENTS" title="Agent registry" description="Registered agents with live trajectory metrics from stored evaluation runs." action={<Button onClick={() => setOpen(!open)} testId="button-toggle-create-agent"><span className="text-base leading-none">+</span> Register agent</Button>} />
    {open && <Panel className="mb-5 border-primary/30" title="Register an agent" meta="Link to a registered model"><form onSubmit={submit} className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4"><Field label="Name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-agent-name" /></Field><Field label="Model"><select required value={form.llm_model_id} onChange={(e) => setForm({ ...form, llm_model_id: e.target.value })} data-testid="select-agent-model"><option value="">Select model</option>{(models.data ?? []).map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></Field><Field label="Tools (comma-separated)"><input value={form.tools} onChange={(e) => setForm({ ...form, tools: e.target.value })} data-testid="input-agent-tools" /></Field><Field label="Max tool depth"><input type="number" min={1} max={20} value={form.max_tool_depth} onChange={(e) => setForm({ ...form, max_tool_depth: Number(e.target.value) })} data-testid="input-agent-depth" /></Field><Field label="Description" wide><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="input-agent-description" /></Field><div className="flex items-end gap-2"><Button type="submit" disabled={create.isPending} testId="button-submit-agent">{create.isPending ? 'Registering…' : 'Register agent'}</Button><Button onClick={() => setOpen(false)} variant="secondary" testId="button-cancel-agent">Cancel</Button></div></form></Panel>}
    <QueryState query={query} empty={!query.data?.length}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(query.data ?? []).map((agent) => <button type="button" key={agent.id} onClick={() => setSelectedId(agent.id)} data-testid={`card-agent-${agent.id}`} className="rounded-xl border border-card-border bg-card p-5 text-left shadow-[0_2px_10px_hsl(var(--foreground)/.025)] hover:border-primary/30">
          <div className="mb-4 flex items-start justify-between"><span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary"><Bot size={16} /></span><StatusBadge tone={tone(agent.status)}>{agent.status}</StatusBadge></div>
          <div className="text-[13px] font-bold">{agent.name}</div>
          <div className="mt-1 font-mono-ui text-[9px] text-muted-foreground">{agent.model_name} · {agent.model_version}</div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-[10px]"><div><div className="font-mono-ui text-[9px] uppercase text-muted-foreground">Tools</div><div className="font-bold">{agent.tools.length}</div></div><div><div className="font-mono-ui text-[9px] uppercase text-muted-foreground">Trajectories</div><div className="font-bold">{agent.trajectory_count}</div></div><div><div className="font-mono-ui text-[9px] uppercase text-muted-foreground">Hallucination</div><div className="font-bold text-primary">{pct(agent.avg_hallucination_score)}</div></div><div><div className="font-mono-ui text-[9px] uppercase text-muted-foreground">Tool success</div><div className="font-bold">{pct(agent.tool_success_rate)}</div></div></div>
          <div className="mt-4 flex items-center gap-1 text-[10px] text-muted-foreground">View trajectories <ChevronRight size={14} /></div>
        </button>)}
      </div>
    </QueryState>
    <Sheet open={Boolean(selectedId)} onOpenChange={(value) => !value && setSelectedId(null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader><SheetTitle>{detail.data?.name ?? 'Agent detail'}</SheetTitle></SheetHeader>
        {detail.isLoading ? <LoadingState /> : detail.data && <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><MetricCard label="Hallucination rate" value={pct(detail.data.avg_hallucination_score)} detail="Average across trajectories" icon={Bot} tone="teal" /><MetricCard label="Tool success" value={pct(detail.data.tool_success_rate)} detail={`${detail.data.trajectory_count} trajectories`} icon={Bot} tone="blue" /></div>
          <Panel className="mt-5" title="Hallucination trend" meta="Last 30 trajectories"><div className="p-5"><Sparkline values={chartValues} height={140} /></div></Panel>
          <Panel className="mt-5" title="Recent trajectories" meta="Latest 20 runs"><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left"><thead><tr className="border-b border-border/70 font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground"><th className="px-4 py-3">Session</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Tools</th><th className="px-4 py-3">Latency</th></tr></thead><tbody className="divide-y divide-border/60">{(detail.data.recent_trajectories ?? []).map((row) => <tr key={row.id}><td className="px-4 py-3 font-mono-ui text-[10px]">{row.session_id.slice(0, 12)}…</td><td className="px-4 py-3 font-mono-ui text-[11px] text-primary">{pct(row.hallucination_score ?? undefined)}</td><td className="px-4 py-3 text-[11px]">{row.tool_success_count}/{row.tool_call_count}</td><td className="px-4 py-3 font-mono-ui text-[10px]">{number(row.latency_ms, 0)}ms</td></tr>)}</tbody></table></div></Panel>
        </>}
      </SheetContent>
    </Sheet>
  </div>;
}
