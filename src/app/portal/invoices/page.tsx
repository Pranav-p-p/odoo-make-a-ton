// Starter page from Core. S2 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="My invoices"
      slice="S2"
      ids="PORTAL-1"
      source="invoices"
      todo={["The customer’s own invoices (never Draft) with paid / unpaid state"]}
    />
  );
}
