// Starter page from Core. S2 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="Customers"
      slice="S2"
      ids="SUB-2"
      source="customers"
      todo={["List with server search, create / edit form"]}
    />
  );
}
