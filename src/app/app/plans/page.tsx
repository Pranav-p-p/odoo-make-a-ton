// Starter page from Core. S1 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="Plans"
      slice="S1"
      ids="CAT-3, CAT-4"
      source="plans"
      todo={["List with availability status"]}
    />
  );
}
