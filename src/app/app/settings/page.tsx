// Starter page from Core. S1 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="Taxes & payment terms"
      slice="S1"
      ids="CAT-5"
      source="taxes"
      todo={["Inline add / edit / archive for taxes (name, rate %) and payment terms (name, days)"]}
    />
  );
}
