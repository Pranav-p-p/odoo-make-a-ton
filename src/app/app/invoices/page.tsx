// Starter page from Core. S3 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="Invoices"
      slice="S3"
      ids="BILL-3, PAY-2"
      source="invoice_list"
      todo={["Tabs Draft / Confirmed / Overdue / Paid / Cancelled, filters, search", "Bulk confirm (POST /invoices/confirm)"]}
    />
  );
}
