// Starter page from Core. S2 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="Subscription"
      slice="S2"
      ids="SUB-2, SUB-3, D-7…D-13"
      todo={["Header, lines editor (PUT /subscriptions/:id/lines)", "Action buttons from allowed_actions", "Status timeline and invoices"]}
    />
  );
}
