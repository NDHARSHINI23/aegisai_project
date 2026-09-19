import { type FormEvent, useState } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Link } from 'wouter';
import { useLogin, useRegister } from '@/hooks/use-auth';

export function LoginPage() {
  const [registering, setRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', organization: '', role: 'viewer' as 'viewer' | 'engineer' | 'security' });
  const login = useLogin();
  const register = useRegister();
  const mutation = registering ? register : login;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (registering && form.password !== form.confirm) return;
    if (registering) register.mutate({ name: form.name, email: form.email, password: form.password, organization: form.organization, role: form.role }, { onSuccess: () => window.location.assign('/') });
    else login.mutate({ email: form.email, password: form.password }, { onSuccess: () => window.location.assign('/') });
  };
  const error = mutation.error instanceof Error ? mutation.error.message.replace(/^HTTP \d+ [^:]+: /, '') : null;
  return <main className="grid min-h-[100dvh] place-items-center bg-background px-4 py-10 text-foreground">
    <section className="w-full max-w-[440px] rounded-xl border border-card-border bg-card p-7 shadow-[0_8px_30px_hsl(var(--foreground)/.08)]">
      <div className="mb-8 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[0_0_0_4px_hsl(var(--primary)/.12)]"><ShieldCheck size={22} /></span><span><span className="block text-lg font-extrabold">Aegis<span className="text-primary">AI</span></span><span className="font-mono-ui block text-[9px] uppercase tracking-[.18em] text-muted-foreground">trust workspace</span></span></div>
      <div className="mb-6"><div className="mb-2 font-mono-ui text-[10px] uppercase tracking-[.16em] text-primary">Secure access</div><h1 className="text-2xl font-extrabold">{registering ? 'Create your workspace account' : 'Welcome back'}</h1><p className="mt-1 text-xs text-muted-foreground">{registering ? 'Join your organization’s governance workspace.' : 'Sign in to the AegisAI control plane.'}</p></div>
      <form onSubmit={submit} className="space-y-4">
        {registering && <><label className="block text-xs font-semibold">Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full" /></label><label className="block text-xs font-semibold">Organization<input required value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} className="mt-1 w-full" /></label></>}
        <label className="block text-xs font-semibold">Work email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full" /></label>
        {registering && <label className="block text-xs font-semibold">Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })} className="mt-1 w-full"><option value="viewer">Viewer</option><option value="engineer">AI/ML Engineer</option><option value="security">Security/Compliance</option></select></label>}
        <label className="block text-xs font-semibold">Password<div className="relative mt-1"><input required minLength={8} type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full pr-10" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
        {registering && <label className="block text-xs font-semibold">Confirm password<input required minLength={8} type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} className="mt-1 w-full" /></label>}
        {!registering && <div className="flex items-center justify-between text-[11px]"><label className="flex items-center gap-2"><input type="checkbox" />Remember me</label><button type="button" className="text-primary">Forgot password?</button></div>}
        {error && <div role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>}
        {registering && form.password !== form.confirm && form.confirm && <div role="alert" className="text-xs text-destructive">Passwords do not match.</div>}
        <button type="submit" disabled={mutation.isPending || (registering && form.password !== form.confirm)} className="w-full rounded-md bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50">{mutation.isPending ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}</button>
      </form>
      <div className="mt-6 text-center text-xs text-muted-foreground">{registering ? 'Already have an account?' : 'Need an account?'} <button type="button" onClick={() => { setRegistering(!registering); mutation.reset(); }} className="font-bold text-primary">{registering ? 'Sign in' : 'Register'}</button></div>
      <Link href="/" className="mt-5 block text-center font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground">Back to workspace</Link>
    </section>
  </main>;
}
