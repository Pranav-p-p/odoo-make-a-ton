// Shapes returned by /api/v1. Field names match the database columns (snake_case), SPEC §2.
// Money values are numbers with 2 decimals (INR); dates are 'YYYY-MM-DD'; timestamps are ISO strings.
// Core owns this file: slices ask the lead to add fields.

export type Role = 'admin' | 'staff' | 'customer';
export type ProductType = 'service' | 'software' | 'addon' | 'other';
export type BillingPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type SubscriptionStatus = 'draft' | 'quotation' | 'confirmed' | 'active' | 'closed';
export type PauseReason = 'manual' | 'out_of_term';
export type InvoiceStatus = 'draft' | 'confirmed' | 'paid' | 'cancelled';
export type InvoiceLineKind = 'plan_fee' | 'product';
export type DiscountKind = 'percent' | 'fixed';
export type DiscountScope = 'products' | 'subscription';
export type DiscountCondition = 'none' | 'min_purchase' | 'min_quantity';
export type RedemptionState = 'reserved' | 'committed' | 'released';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'upi' | 'cheque';
export type BillingTrigger = 'manual' | 'scheduled';
export type EmailStatus = 'sent' | 'failed' | 'skipped';
export type PaymentState = 'unpaid' | 'partially_paid' | 'paid';
/** Values of `allowed_actions` on a subscription (from sub_allowed_actions). */
export type SubscriptionAction =
  | 'quotation' | 'confirmed' | 'active' | 'closed' | 'edit' | 'edit_lines' | 'pause' | 'resume' | 'renew' | 'close';

export interface Paged<T> {
  data: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details: Record<string, unknown> };
}

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  /** Set for customers only: their customer record (null until the email is verified). */
  customer_id: string | null;
}

// ---------- Identity ----------
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  user_id: string | null;
  name: string;
  company_name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  gstin: string | null;
  created_by: string | null;
  created_at: string;
}

// ---------- Configuration (S1) ----------
export interface Tax {
  id: string;
  name: string;
  rate_percent: number;
  is_active: boolean;
}

export interface PaymentTerm {
  id: string;
  name: string;
  days: number;
  is_active: boolean;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  attribute: string;
  value: string;
  extra_price: number;
}

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  sales_price: number;
  cost_price: number;
  notes: string | null;
  default_tax_id: string | null;
  is_active: boolean;
  created_at: string;
  variants?: ProductVariant[];
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  billing_period: BillingPeriod;
  min_quantity: number;
  available_from: string;
  available_to: string | null;
  auto_close: boolean;
  allow_early_close: boolean;
  allow_pause: boolean;
  allow_renew: boolean;
  tax_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface QuoteTemplateLine {
  id: string;
  template_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  sort_order: number;
}

export interface QuoteTemplate {
  id: string;
  name: string;
  plan_id: string;
  validity_days: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  lines?: QuoteTemplateLine[];
}

export interface DiscountRule {
  id: string;
  name: string;
  kind: DiscountKind;
  value: number;
  scope: DiscountScope;
  condition: DiscountCondition;
  condition_value: number | null;
  starts_on: string;
  ends_on: string | null;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  product_ids?: string[];
}

// ---------- Subscriptions (S2) ----------
export interface Subscription {
  id: string;
  number: string;
  customer_id: string;
  plan_id: string;
  template_id: string | null;
  payment_term_id: string | null;
  status: SubscriptionStatus;
  start_date: string;
  expiry_date: string | null;
  quote_valid_until: string | null;
  is_paused: boolean;
  pause_reason: PauseReason | null;
  paused_on: string | null;
  billing_anchor: string | null;
  periods_billed: number;
  next_invoice_date: string | null;
  close_reason: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Row of the `subscription_list` view. */
export interface SubscriptionListRow {
  id: string;
  number: string;
  status: SubscriptionStatus;
  is_paused: boolean;
  pause_reason: PauseReason | null;
  start_date: string;
  expiry_date: string | null;
  quote_valid_until: string | null;
  next_invoice_date: string | null;
  created_at: string;
  customer_id: string;
  customer_name: string;
  company_name: string | null;
  plan_id: string;
  plan_name: string;
  billing_period: BillingPeriod;
  plan_price: number;
  recurring_amount: number;
  mrr: number;
  quote_expired: boolean;
  days_to_expiry: number | null;
  is_out_of_term: boolean;
}

export interface SubscriptionLine {
  id: string;
  subscription_id: string;
  product_id: string;
  variant_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_id: string | null;
  sort_order: number;
}

export interface StatusHistoryRow {
  id: number;
  subscription_id: string;
  from_status: SubscriptionStatus | null;
  to_status: SubscriptionStatus;
  event: 'transition' | 'pause' | 'resume' | 'renew' | 'out_of_term' | 'auto_close' | 'activate' | 'lines';
  note: string | null;
  changed_by: string | null;
  changed_at: string;
}

// ---------- Billing (S3) ----------
export interface BillingRun {
  id: number;
  as_of: string;
  trigger: BillingTrigger;
  triggered_by: string | null;
  started_at: string;
  finished_at: string | null;
  created_count: number;
  skipped_count: number;
  failed_count: number;
  failures: { subscription_id: string; number: string; reason: string }[];
}

export interface Invoice {
  id: string;
  number: string;
  subscription_id: string;
  customer_id: string;
  billing_run_id: number | null;
  period_start: string;
  period_end: string;
  invoice_date: string;
  due_date: string;
  status: InvoiceStatus;
  customer_snapshot: { name: string; company_name: string | null; email: string; phone: string | null; address: string | null; gstin: string | null };
  payment_term_name: string | null;
  payment_term_days: number | null;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  discount_rule_id: string | null;
  discount_name: string | null;
  confirmed_at: string | null;
  sent_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
}

/** Row of the `invoice_list` view. */
export interface InvoiceListRow {
  id: string;
  number: string;
  status: InvoiceStatus;
  invoice_date: string;
  due_date: string;
  period_start: string;
  period_end: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  created_at: string;
  sent_at: string | null;
  billing_run_id: number | null;
  customer_id: string;
  customer_name: string;
  subscription_id: string;
  subscription_number: string;
  plan_id: string;
  is_overdue: boolean;
  days_overdue: number;
  payment_state: PaymentState;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  kind: InvoiceLineKind;
  product_id: string | null;
  variant_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  discount_amount: number;
  tax_name: string | null;
  tax_rate: number;
  tax_amount: number;
  total: number;
  sort_order: number;
}

// ---------- Finance (S4) ----------
export interface Payment {
  id: string;
  invoice_id: string;
  customer_id: string;
  method: PaymentMethod;
  amount: number;
  paid_on: string;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface ReportSummary {
  from: string;
  to: string;
  active_subscriptions: number;
  paused_subscriptions: number;
  out_of_term_subscriptions: number;
  revenue_received: number;
  payments_count: number;
  invoiced: number;
  outstanding: number;
  overdue_count: number;
  overdue_amount: number;
  mrr: number;
  arr: number;
}

export interface RevenuePoint {
  period: string;
  received: number;
  invoiced: number;
}

export interface OverdueBucket {
  bucket: '0-30' | '31-60' | '61-90' | '90+';
  invoices: number;
  amount: number;
}
