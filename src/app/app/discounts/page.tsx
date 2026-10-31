// Starter page from Core. S1 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="Discount rules"
      slice="S1"
      ids="DISC-1, DISC-2"
      source="discount_rules"
      todo={["List with used / limit and Active / Scheduled / Expired / Used up badges"]}
    />
  );
}
