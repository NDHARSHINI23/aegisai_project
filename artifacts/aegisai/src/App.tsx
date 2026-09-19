import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { AegisShell } from '@/components/aegis-components';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  AlertsPage,
  BiasPage,
  CostPage,
  DashboardPage,
  DvcPage,
  DriftPage,
  EvaluationPage,
  HallucinationPage,
  ModelsPage,
  RetrainingPage,
  SecurityPage,
} from '@/pages/workspace-pages';
import { AgentsPage } from '@/pages/agents-page';
import { PromptsPage } from '@/pages/prompts-page';
import { ExperimentsPage } from '@/pages/experiments-page';
import { LoginPage } from '@/pages/login-page';
import { AccessDeniedPage } from '@/pages/access-denied';
import { AuditLogsPage, SettingsPage } from '@/pages/settings-page';
import { useCurrentUser } from '@/hooks/use-auth';
import { LoadingState } from '@/components/aegis-components';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/403" component={AccessDeniedPage} />
        <Route>
          <ProtectedApp />
        </Route>
      </Switch>
    </RoutedErrorBoundary>
  );
}

function ProtectedApp() {
  const auth = useCurrentUser();
  const [location, navigate] = useLocation();
  useEffect(() => { if (!auth.isLoading && !auth.data?.user) navigate('/login'); }, [auth.isLoading, auth.data?.user, navigate]);
  if (auth.isLoading) return <LoadingState />;
  if (!auth.data?.user) return null;
  const allowed: Record<string, string[]> = { '/prompts': ['admin'], '/experiments': ['admin', 'engineer'], '/hallucination': ['admin', 'security'], '/faithfulness': ['admin', 'security'], '/drift': ['admin', 'engineer'], '/bias': ['admin', 'security'], '/cost': ['admin'], '/security': ['admin', 'security'], '/alerts': ['admin', 'security'], '/dvc': ['admin', 'engineer'], '/retraining': ['admin', 'engineer'], '/audit-logs': ['admin', 'security'] };
  const roles = allowed[location];
  if (roles && !roles.includes(auth.data.user.role)) return <AegisShell user={auth.data.user}><AccessDeniedPage /></AegisShell>;
  return <AegisShell user={auth.data.user}>
    <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/overview" component={DashboardPage} />
          <Route path="/models" component={ModelsPage} />
          <Route path="/agents" component={AgentsPage} />
          <Route path="/evaluation" component={EvaluationPage} />
          <Route path="/prompts" component={PromptsPage} />
          <Route path="/experiments" component={ExperimentsPage} />
          <Route path="/hallucination" component={HallucinationPage} />
          <Route path="/faithfulness" component={HallucinationPage} />
          <Route path="/drift" component={DriftPage} />
          <Route path="/bias" component={BiasPage} />
          <Route path="/cost" component={CostPage} />
          <Route path="/security" component={SecurityPage} />
          <Route path="/alerts" component={AlertsPage} />
          <Route path="/dvc" component={DvcPage} />
          <Route path="/retraining" component={RetrainingPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/audit-logs" component={AuditLogsPage} />
          <Route path="/access-denied" component={AccessDeniedPage} />
          <Route component={NotFound} />
    </Switch>
  </AegisShell>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
