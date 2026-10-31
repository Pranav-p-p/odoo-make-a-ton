// Starter page from Core. S3 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="Printable invoice"
      slice="S3"
      ids="BILL-3"
      todo={["A4 invoice: bill-to snapshot, lines, discount, tax, totals; opens the print dialog"]}
    />
  );
}
