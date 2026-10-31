// Starter page from Core. S1 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="Plan"
      slice="S1"
      ids="CAT-3, CAT-4"
      todo={["Price, period, minimum quantity, availability, tax and the four switches"]}
    />
  );
}
