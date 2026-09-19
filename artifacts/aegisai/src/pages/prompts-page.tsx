import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import * as Diff from 'diff';
import { FileText } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPromptsQueryKey,
  useCreatePrompt,
  useEvaluatePrompt,
  useGetPromptDiff,
  useGetPrompts,
  useGetPromptVersions,
} from '@workspace/api-client-react';
import {
  Button, EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatusBadge,
} from '@/components/aegis-components';

type QueryLike = { isLoading: boolean; isError: boolean; refetch: () => unknown };
const pct = (value?: number | null) => typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—';
const dollars = (value?: number | null) => typeof value === 'number' ? `$${value.toFixed(4)}` : '—';

function QueryState({ query, children, empty = false }: { query: QueryLike; children: ReactNode; empty?: boolean }) {
  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState retry={() => query.refetch()} />;
  if (empty) return <EmptyState />;
  return <>{children}</>;
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`block ${wide ? 'sm:col-span-2' : ''}`}><span className="mb-1.5 block font-mono-ui text-[9px] uppercase tracking-[.1em] text-muted-foreground">{label}</span>{children}</label>;
}

function DiffView({ from, to }: { from: string; to: string }) {
  const parts = useMemo(() => Diff.diffLines(from, to), [from, to]);
  return <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 p-4 text-[11px] leading-5">{parts.map((part, index) => <span key={index} className={part.added ? 'bg-primary/15 text-primary' : part.removed ? 'bg-destructive/15 text-destructive line-through' : ''}>{part.value}</span>)}</pre>;
}

export function PromptsPage() {
  const query = useGetPrompts();
  const client = useQueryClient();
  const create = useCreatePrompt();
  const evaluate = useEvaluatePrompt();
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const versions = useGetPromptVersions(selectedName ?? '', { query: { enabled: Boolean(selectedName) } });
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);
  const compare: [number, number] | null =
    selectedVersions.length === 2 ? [selectedVersions[0], selectedVersions[1]] : null;
  const diff = useGetPromptDiff(selectedName ?? '', { from: compare?.[0] ?? 0, to: compare?.[1] ?? 0 }, { query: { enabled: Boolean(selectedName && compare) } });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', content: '', parent_id: '' });
  const [lastEval, setLastEval] = useState<{ score: number; cost: number } | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({
      data: {
        name: form.name,
        content: form.content,
        parent_id: form.parent_id || undefined,
      },
    }, {
      onSuccess: (version) => {
        evaluate.mutate({ id: version.id }, {
          onSuccess: (result) => {
            setLastEval({ score: result.eval_score, cost: result.avg_cost_usd });
            client.invalidateQueries({ queryKey: getGetPromptsQueryKey() });
            setOpen(false);
            setForm({ name: '', content: '', parent_id: '' });
          },
        });
      },
    });
  };

  return <div className="animate-enter">
    <PageHeader eyebrow="CONTROL PLANE / PROMPTS" title="Prompt versions" description="Versioned prompts with real evaluation scores from stored TruthfulQA samples." action={<Button onClick={() => setOpen(!open)} testId="button-toggle-create-prompt"><span className="text-base leading-none">+</span> New version</Button>} />
    {open && <Panel className="mb-5 border-primary/30" title="Create prompt version" meta="Auto-evaluates on save"><form onSubmit={submit} className="space-y-3 p-5"><Field label="Prompt name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-prompt-name" /></Field><Field label="Parent version id (optional)"><input value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })} data-testid="input-prompt-parent" /></Field><Field label="Content" wide><textarea required rows={8} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} data-testid="textarea-prompt-content" /></Field><Button type="submit" disabled={create.isPending || evaluate.isPending} testId="button-submit-prompt">{create.isPending || evaluate.isPending ? 'Saving…' : 'Save & evaluate'}</Button>{lastEval && <div className="text-[11px] text-primary">Latest eval: {pct(lastEval.score)} · {dollars(lastEval.cost)} / call</div>}</form></Panel>}
    <QueryState query={query} empty={!query.data?.length}>
      <Panel title="Prompt catalog" meta="Latest version per name"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-border/70 font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground"><th className="px-5 py-3">Name</th><th className="px-4 py-3">Version</th><th className="px-4 py-3">Model / Agent</th><th className="px-4 py-3">Eval score</th><th className="px-4 py-3">Cost / call</th><th className="px-4 py-3">Updated</th></tr></thead><tbody className="divide-y divide-border/60">{(query.data ?? []).map((row) => <tr key={row.id} onClick={() => setSelectedName(row.name)} className="cursor-pointer hover:bg-muted/45" data-testid={`row-prompt-${row.name}`}><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary"><FileText size={15} /></span><span className="text-[11px] font-bold">{row.name}</span></div></td><td className="px-4 py-4 font-mono-ui text-[11px]">v{row.version_number}</td><td className="px-4 py-4 text-[11px] text-muted-foreground">{row.model_name ?? '—'}{row.agent_name ? ` · ${row.agent_name}` : ''}</td><td className="px-4 py-4 font-mono-ui text-[11px] text-primary">{pct(row.eval_score)}</td><td className="px-4 py-4 font-mono-ui text-[11px]">{dollars(row.avg_cost_usd)}</td><td className="px-4 py-4 font-mono-ui text-[10px] text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div></Panel>
    </QueryState>
    {selectedName && <Panel className="mt-5" title={`${selectedName} history`} meta="Select two versions to compare"><QueryState query={versions} empty={!versions.data?.length}><div className="divide-y divide-border/60">{(versions.data ?? []).map((version) => <label key={version.id} className="flex items-center gap-4 px-5 py-4"><input type="checkbox" checked={selectedVersions.includes(version.version_number)} onChange={(e) => { setSelectedVersions((current) => { if (!e.target.checked) return current.filter((v) => v !== version.version_number); if (current.includes(version.version_number)) return current; if (current.length >= 2) return [current[1], version.version_number]; return [...current, version.version_number]; }); }} /><div className="flex-1"><div className="text-[11px] font-bold">v{version.version_number}</div><div className="text-[10px] text-muted-foreground">{pct(version.eval_score)} · {dollars(version.avg_cost_usd)}</div></div><StatusBadge tone="neutral">{version.id.slice(0, 8)}</StatusBadge></label>)}</div>{compare && diff.data && <div className="border-t border-border/70 p-5"><div className="mb-3 text-[11px] font-bold">Compare v{compare[0]} → v{compare[1]}</div><DiffView from={diff.data.from_content} to={diff.data.to_content} /></div>}</QueryState></Panel>}
  </div>;
}
