// Starter page from Core. S3 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="Billing runs"
      slice="S3"
      ids="BILL-1, BILL-4"
      source="billing_runs"
      todo={["Run billing with an as-of date (POST /billing/run) and the result card", "History of runs with failures (GET /billing/runs)"]}
    />
  );
}
