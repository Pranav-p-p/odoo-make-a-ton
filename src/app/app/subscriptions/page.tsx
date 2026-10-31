// Starter page from Core. S2 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="Subscriptions"
      slice="S2"
      ids="SUB-2, SUB-3"
      source="subscription_list"
      todo={["List from subscription_list with status, plan, customer filters and search", "Badges: status, Paused, Expired renewal needed, Quote expired"]}
    />
  );
}
