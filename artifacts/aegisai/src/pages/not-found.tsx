import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="aegis-grid flex min-h-[70dvh] w-full items-center justify-center">
      <Card className="mx-4 w-full max-w-md border-card-border bg-card">
        <CardContent className="pt-6">
          <div className="mb-4 flex gap-3">
            <AlertCircle className="h-8 w-8 text-accent" />
            <div><div className="font-mono-ui text-[9px] uppercase tracking-[.16em] text-muted-foreground">Signal lost / 404</div><h1 className="mt-1 text-2xl font-extrabold tracking-[-.04em]">Route not found</h1></div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">This workspace path is not registered in the control plane.</p>
          <Link href="/" data-testid="link-return-overview" className="mt-5 inline-flex rounded-md bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground">Return to overview</Link>
        </CardContent>
      </Card>
    </div>
  );
}
