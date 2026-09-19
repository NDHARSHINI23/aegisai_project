import { ShieldAlert } from 'lucide-react';
import { Link } from 'wouter';

export function AccessDeniedPage() {
  return <div className="grid min-h-[60vh] place-items-center"><div className="max-w-md text-center"><ShieldAlert size={32} className="mx-auto mb-4 text-destructive" /><h2 className="text-2xl font-extrabold">Access denied</h2><p className="mt-2 text-sm text-muted-foreground">Your role does not have permission to view this module.</p><Link href="/" className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Return to overview</Link></div></div>;
}
