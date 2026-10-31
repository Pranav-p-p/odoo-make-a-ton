// Starter page from Core. S2 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="Invoice"
      slice="S2"
      ids="PORTAL-1"
      todo={["Invoice detail with a Print link to /print/invoices/[id]"]}
    />
  );
}
