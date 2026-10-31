// Starter page from Core. S4 replaces this file (docs/phase2/).
import { StarterPage } from '@/components/shell/starter';

export default function Page() {
  return (
    <StarterPage
      title="Payments"
      slice="S4"
      ids="PAY-1, PAY-2"
      source="payments"
      todo={["Paginated list with filters: dates, method, customer (GET /payments)", "Columns: date, invoice, customer, method, amount, note"]}
    />
  );
}
