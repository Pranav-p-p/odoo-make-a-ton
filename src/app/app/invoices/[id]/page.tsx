// Starter page from Core. S3 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="Invoice"
      slice="S3"
      ids="BILL-1, BILL-2, BILL-3"
      todo={["Lines with discount and tax, totals, payments", "Confirm / Cancel / Send / Print; Record payment (S4 component)"]}
    />
  );
}
