// Starter page from Core. S4 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="Dashboard"
      slice="S4"
      ids="REP-1, REP-2, NFR-1"
      source="invoices"
      todo={["KPI cards: active, paused / out of term, revenue received, invoiced, outstanding, overdue, MRR, ARR (GET /reports/summary)", "Filters: date range, plan, customer", "Revenue chart: received vs invoiced per month (GET /reports/revenue)", "Overdue list by age bucket, linking to invoices (GET /reports/overdue)"]}
    />
  );
}
