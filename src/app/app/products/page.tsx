// Starter page from Core. S1 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="Products"
      slice="S1"
      ids="CAT-1, CAT-2"
      source="products"
      todo={["List with search, type filter, archived toggle", "Create / edit form; archive"]}
    />
  );
}
