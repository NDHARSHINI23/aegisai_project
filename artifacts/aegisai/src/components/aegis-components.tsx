import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Activity, AlertTriangle, Bell, Bot, BrainCircuit, ChevronDown, CircleDollarSign,
  Database, FileText, FlaskConical, GitBranch, LayoutDashboard, LifeBuoy, LockKeyhole, Menu,
  LogOut, Moon, Network, RefreshCw, ScanSearch, Settings, ShieldCheck, Sun, TestTube2, UserRound, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { User } from '@/hooks/use-auth';
import { useLogout } from '@/hooks/use-auth';

const navGroups = [
  { label: 'CONTROL PLANE', items: [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/models', label: 'Model registry', icon: Database },
    { href: '/agents', label: 'Agent registry', icon: Bot },
    { href: '/evaluation', label: 'Evaluation', icon: TestTube2 },
    { href: '/prompts', label: 'Prompt versions', icon: FileText },
    { href: '/experiments', label: 'Experiments', icon: FlaskConical },
    { href: '/hallucination', label: 'Faithfulness', icon: BrainCircuit },
  ]},
  { label: 'OBSERVABILITY', items: [
    { href: '/drift', label: 'Drift monitor', icon: Activity },
    { href: '/bias', label: 'Bias & equity', icon: Network },
    { href: '/cost', label: 'Cost & tokens', icon: CircleDollarSign },
    { href: '/security', label: 'Security events', icon: LockKeyhole },
  ]},
  { label: 'OPERATIONS', items: [
    { href: '/alerts', label: 'Alert triage', icon: Bell },
    { href: '/dvc', label: 'DVC pipelines', icon: GitBranch },
    { href: '/retraining', label: 'Retraining', icon: RefreshCw },
  ]},
];

export function AegisShell({ children, user }: { children: ReactNode; user: User }) {
  const [location] = useLocation();
  const [dark, setDark] = useStateTheme();
  const [open, setOpen] = useStateLocal(false);
  const logout = useLogout();
  const currentLabel = location === '/overview' ? 'Overview' : location === '/faithfulness' ? 'Faithfulness' : location === '/audit-logs' ? 'Audit logs' : location === '/settings' ? 'Settings' : navGroups.flatMap((group) => group.items).find((item) => item.href === location)?.label ?? 'Overview';
  const visibleGroups = navGroups;
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[74px] items-center justify-between border-b border-sidebar-border px-5">
          <Link href="/" data-testid="link-brand" className="translate-y-1 flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_0_4px_hsl(var(--sidebar-primary)/.12)]"><ShieldCheck size={19} strokeWidth={2.4} /></span>
            <span><span className="block text-[15px] font-extrabold tracking-[-.03em] text-white">Aegis<span className="text-sidebar-primary">AI</span></span><span className="font-mono-ui block text-[9px] uppercase tracking-[.18em] text-sidebar-foreground/55">trust workspace</span></span>
          </Link>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation" data-testid="button-close-navigation" className="rounded-md p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-white lg:hidden"><X size={18} /></button>
        </div>
        <div className="shrink-0 px-3 pt-6">
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/70 px-3 py-2.5">
            <span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-sidebar-primary opacity-50" /><span className="relative inline-flex size-2.5 rounded-full bg-sidebar-primary" /></span>
            <span className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-sidebar-foreground/70">Production plane</span>
            <ChevronDown size={13} className="ml-auto text-sidebar-foreground/45" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 [scrollbar-color:hsl(var(--sidebar-border))_transparent] [scrollbar-width:thin]">
          {visibleGroups.map((group) => (
            <div key={group.label} className="mb-6">
              <div className="mb-2 px-3 font-mono-ui text-[9px] font-medium tracking-[.18em] text-sidebar-foreground/42">{group.label}</div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = location === item.href;
                  const Icon = item.icon;
                  return <Link key={item.href} href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`} className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-[12px] font-semibold ${active ? 'bg-sidebar-primary/15 text-sidebar-primary' : 'text-sidebar-foreground/67 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}>
                    <Icon size={16} strokeWidth={active ? 2.4 : 1.8} /><span>{item.label}</span>{item.href === '/alerts' && <span className="ml-auto rounded bg-accent px-1.5 py-0.5 font-mono-ui text-[9px] font-medium text-accent-foreground">04</span>}
                  </Link>;
                })}
              </div>
            </div>
          ))}
          <div className="mb-6">
            <div className="mb-2 px-3 font-mono-ui text-[9px] font-medium tracking-[.18em] text-sidebar-foreground/42">GOVERNANCE</div>
            <div className="space-y-0.5">
              <Link href="/audit-logs" className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-[12px] font-semibold ${location === '/audit-logs' ? 'bg-sidebar-primary/15 text-sidebar-primary' : 'text-sidebar-foreground/67 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}><ShieldCheck size={16} /><span>Audit logs</span></Link>
              <Link href="/settings" className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-[12px] font-semibold ${location === '/settings' ? 'bg-sidebar-primary/15 text-sidebar-primary' : 'text-sidebar-foreground/67 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}><Settings size={16} /><span>Settings</span></Link>
            </div>
          </div>
        </div>
        <div className="mt-auto border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="grid size-8 place-items-center rounded-full bg-sidebar-accent font-mono-ui text-[11px] font-medium text-sidebar-primary">SR</div>
            <div className="min-w-0"><div className="truncate text-[11px] font-bold text-sidebar-foreground">{user.name}</div><div className="truncate font-mono-ui text-[9px] uppercase text-sidebar-foreground/45">{user.role} · {user.organization}</div></div>
            <button type="button" data-testid="button-open-support" className="ml-auto text-sidebar-foreground/45 hover:text-sidebar-primary" title="Support"><LifeBuoy size={15} /></button>
          </div>
          <div className="flex items-center justify-between rounded-md px-2 py-1 text-[10px] text-sidebar-foreground/45"><span>v0.8.4 · healthy</span><span className="font-mono-ui">UTC</span></div>
        </div>
      </aside>
      {open && <button type="button" aria-label="Close menu overlay" data-testid="button-close-menu-overlay" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-foreground/20 lg:hidden" />}
      <div className="min-h-[100dvh] lg:pl-[250px]">
        <header className="sticky top-0 z-20 flex h-[74px] items-center gap-4 border-b border-border/80 bg-background/90 px-4 backdrop-blur-md sm:px-7">
          <button type="button" aria-label="Open navigation" data-testid="button-open-navigation" onClick={() => setOpen(true)} className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"><Menu size={19} /></button>
          <div className="min-w-0"><div className="font-mono-ui text-[9px] uppercase tracking-[.15em] text-muted-foreground">AegisAI / workspace</div><h1 className="truncate text-[15px] font-bold tracking-[-.02em]">{currentLabel}</h1></div>
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 sm:flex"><span className="size-1.5 rounded-full bg-primary" /><span className="font-mono-ui text-[10px] text-muted-foreground">ALL SYSTEMS NOMINAL</span></div>
            <div className="relative flex items-center gap-2"><details><summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs font-bold"><span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary"><UserRound size={14} /></span><span className="hidden max-w-28 truncate sm:block">{user.name}</span></summary><div className="absolute right-0 top-11 z-50 w-44 rounded-lg border border-border bg-card p-1 shadow-lg"><Link href="/settings" className="block rounded px-3 py-2 text-xs hover:bg-muted">Profile & Settings</Link>{user.role !== 'viewer' && <Link href="/audit-logs" className="block rounded px-3 py-2 text-xs hover:bg-muted">Audit Logs</Link>}<button type="button" onClick={() => logout.mutate()} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-destructive hover:bg-muted"><LogOut size={13} />Logout</button></div></details></div>
            <button type="button" onClick={() => setDark(!dark)} aria-label="Toggle color theme" data-testid="button-toggle-theme" className="rounded-md border border-border bg-card p-2 text-muted-foreground hover:text-foreground">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
            <button type="button" aria-label="Open notifications" data-testid="button-open-notifications" className="relative rounded-md border border-border bg-card p-2 text-muted-foreground hover:text-foreground"><Bell size={16} /><span className="absolute -right-1 -top-1 size-2 rounded-full border-2 border-background bg-accent" /></button>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-7 lg:px-9">{children}</main>
      </div>
    </div>
  );
}

function useStateLocal(initial: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = requireReactState(initial);
  return [value, setValue];
}
function useStateTheme(): [boolean, (value: boolean) => void] {
  const [dark, setDark] = requireReactState(false);
  useEffectTheme(dark);
  return [dark, setDark];
}
function requireReactState(initial: boolean) {
  // Kept as a tiny wrapper so the shell's state reads clearly at the callsite.
  return useState(initial);
}
function useEffectTheme(dark: boolean) {
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 flex items-center gap-2 font-mono-ui text-[10px] font-medium uppercase tracking-[.17em] text-primary"><span className="size-1.5 rounded-full bg-primary" />{eyebrow}</div><h2 className="text-[28px] font-extrabold tracking-[-.045em] sm:text-[34px]">{title}</h2><p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-muted-foreground">{description}</p></div>{action}</div>;
}

export function Panel({ children, className = '', title, meta, action }: { children: ReactNode; className?: string; title?: string; meta?: string; action?: ReactNode }) {
  return <section className={`rounded-xl border border-card-border bg-card shadow-[0_2px_10px_hsl(var(--foreground)/.025)] ${className}`}><div className={title ? 'flex items-center justify-between border-b border-border/70 px-5 py-4' : ''}>{title && <div><h3 className="text-[12px] font-bold tracking-[-.01em]">{title}</h3>{meta && <div className="mt-0.5 font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground">{meta}</div>}</div>}{action}</div>{children}</section>;
}

export function MetricCard({ label, value, detail, icon: Icon, tone = 'teal' }: { label: string; value: ReactNode; detail: string; icon: LucideIcon; tone?: 'teal' | 'amber' | 'red' | 'blue' }) {
  const colors = { teal: 'text-primary bg-primary/10', amber: 'text-accent bg-accent/15', red: 'text-destructive bg-destructive/10', blue: 'text-chart-3 bg-chart-3/10' };
  return <div className="rounded-xl border border-card-border bg-card p-4 shadow-[0_2px_10px_hsl(var(--foreground)/.025)]"><div className="flex items-start justify-between"><div className="font-mono-ui text-[9px] uppercase tracking-[.14em] text-muted-foreground">{label}</div><span className={`grid size-7 place-items-center rounded-md ${colors[tone]}`}><Icon size={15} /></span></div><div className="mt-3 text-[24px] font-extrabold tracking-[-.05em]">{value}</div><div className="mt-1 text-[10px] text-muted-foreground">{detail}</div></div>;
}

export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'good' | 'warn' | 'bad' | 'neutral' }) {
  const styles = { good: 'bg-primary/10 text-primary border-primary/20', warn: 'bg-accent/15 text-accent-foreground border-accent/25', bad: 'bg-destructive/10 text-destructive border-destructive/20', neutral: 'bg-muted text-muted-foreground border-border' };
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono-ui text-[9px] uppercase tracking-[.08em] ${styles[tone]}`}><span className="size-1 rounded-full bg-current" />{children}</span>;
}

export function Button({ children, onClick, disabled, variant = 'primary', type = 'button', testId }: { children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; type?: 'button' | 'submit'; testId: string }) {
  const styles = { primary: 'bg-primary text-primary-foreground hover:opacity-90', secondary: 'border border-border bg-card text-foreground hover:bg-muted', ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground', danger: 'border border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15' };
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[11px] font-bold disabled:cursor-not-allowed disabled:opacity-45 ${styles[variant]}`}>{children}</button>;
}

export function LoadingState() {
  return <div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl border border-border bg-muted/60" />)}</div>;
}
export function ErrorState({ message = 'Signal unavailable', retry }: { message?: string; retry?: () => void }) {
  return <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/25 bg-destructive/5 px-6 py-14 text-center"><AlertTriangle size={22} className="mb-3 text-destructive" /><div className="text-sm font-bold">{message}</div><div className="mt-1 text-xs text-muted-foreground">The workspace could not read this stream.</div>{retry && <Button onClick={retry} variant="danger" testId="button-retry-query"><RefreshCw size={13} /> Retry</Button>}</div>;
}
export function EmptyState({ label = 'No observations yet', detail = 'New signal will appear here when the service reports it.' }: { label?: string; detail?: string }) {
  return <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-14 text-center"><ScanSearch size={22} className="mb-3 text-muted-foreground/60" /><div className="text-sm font-bold">{label}</div><div className="mt-1 text-xs text-muted-foreground">{detail}</div></div>;
}

export function Sparkline({ values, color = 'hsl(var(--primary))', height = 70 }: { values: number[]; color?: string; height?: number }) {
  if (!values.length) return <div style={{ height }} className="grid place-items-center font-mono-ui text-[9px] text-muted-foreground">NO DATA</div>;
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${height - 8 - ((value - min) / range) * (height - 18)}`).join(' ');
  return <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full overflow-visible" style={{ height }} aria-label="Trend chart"><polyline points={points} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" className="signal-line" /><circle cx={points.split(' ').at(-1)?.split(',')[0]} cy={points.split(' ').at(-1)?.split(',')[1]} r="2.5" fill={color} /></svg>;
}

export function MiniBar({ value, max = 1, color = 'bg-primary' }: { value: number; max?: number; color?: string }) {
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(4, value / max * 100))}%` }} /></div>;
}