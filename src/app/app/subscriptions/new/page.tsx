// Starter page from Core. S2 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="New subscription"
      slice="S2"
      ids="SUB-1, SUB-2"
      todo={["From template: template + customer + start, expiry, payment terms", "Blank: plan + lines", "POST /subscriptions → create_subscription_from_template / sub_set_lines"]}
    />
  );
}
