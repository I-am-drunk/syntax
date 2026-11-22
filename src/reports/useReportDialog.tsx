import { lazy, Suspense, useState } from 'react';
import type { ReportContext } from '../services/reports';
const ReportDialog = lazy(() => import('./ReportDialog'));

export function useReportDialog() {
  const [session, setSession] = useState<{ id: string; context: ReportContext; trigger: HTMLElement | null }>();
  return {
    open(context: ReportContext) {
      setSession({ id: crypto.randomUUID(), context: structuredClone(context), trigger: document.activeElement as HTMLElement | null });
    },
    dialog: session && <Suspense fallback={<div className="toast" role="status">Loading report…</div>}>
      <ReportDialog key={session.id} context={session.context} onClose={() => {
        setSession(undefined);
        requestAnimationFrame(() => {
          if (session.trigger?.isConnected && !document.querySelector('[data-report-host]')) session.trigger.focus({ preventScroll: true });
        });
      }} />
    </Suspense>,
  };
}
