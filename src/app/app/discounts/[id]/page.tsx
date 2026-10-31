// Starter page from Core. S1 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="Discount rule"
      slice="S1"
      ids="DISC-1, DISC-2"
      todo={["Kind, value, scope + products, one condition, dates, usage limit"]}
    />
  );
}
