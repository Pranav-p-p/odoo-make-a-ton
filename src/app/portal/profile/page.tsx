// Starter page from Core. S2 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="Profile"
      slice="S2"
      ids="PORTAL-1"
      todo={["Edit name, phone, address; email read-only; change password"]}
    />
  );
}
