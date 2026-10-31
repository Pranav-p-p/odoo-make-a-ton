// Starter page from Core. S2 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="Subscription"
      slice="S2"
      ids="PORTAL-1, CAT-4"
      todo={["Details, lines, invoices; Pause / Resume / Renew / Close only when the plan allows (allowed_actions)"]}
    />
  );
}
