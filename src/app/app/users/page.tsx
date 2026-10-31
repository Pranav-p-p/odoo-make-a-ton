// Starter page from Core. S2 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="Users"
      slice="S2"
      ids="AUTH-5"
      source="profiles"
      todo={["Admin only: add staff (invite email), change role, deactivate"]}
    />
  );
}
