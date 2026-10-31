import { ApiClientError } from '@/lib/client/api';

/** Friendly text for the error codes the API can return. Add to it as you meet new ones. */
const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: 'Your session ended. Please sign in again.',
  FORBIDDEN: 'You don’t have permission to do that.',
  NOT_FOUND: 'That record doesn’t exist.',
  INVALID_CREDENTIALS: 'Wrong email or password.',
  EMAIL_NOT_CONFIRMED: 'Confirm your email first: open the link we sent you.',
  LINK_EXPIRED: 'This link has expired or was already used. Ask for a new one.',
  SAME_PASSWORD: 'Choose a password you haven’t used before.',
  EMAIL_TAKEN: 'An account or customer with this email already exists.',
  NAME_TAKEN: 'That name is already used.',
  VARIANT_EXISTS: 'This variant already exists for the product.',
  INVALID_TRANSITION: 'That change isn’t allowed from the current status.',
  QUOTATION_EXPIRED: 'This quotation has expired.',
  BELOW_MIN_QUANTITY: 'The main product quantity is below the plan’s minimum.',
  PLAN_NOT_AVAILABLE: 'The plan isn’t available on this start date.',
  PLAN_NOT_PAUSABLE: 'This plan doesn’t allow pausing.',
  PLAN_NOT_CLOSABLE: 'This plan doesn’t allow closing before the expiry date.',
  PLAN_NOT_RENEWABLE: 'This plan can’t be renewed.',
  OUT_OF_TERM_RENEW_REQUIRED: 'This subscription has expired. Renew or close it.',
  NOT_EDITABLE: 'This can only be changed in Draft or Quotation.',
  ALREADY_BILLED: 'This period has already been invoiced.',
  BILLING_RUN_IN_PROGRESS: 'Another billing run is in progress. Try again in a moment.',
  INVOICE_NOT_CONFIRMED: 'Confirm the invoice first.',
  AMOUNT_EXCEEDS_DUE: 'The amount is more than the balance due.',
  CANNOT_CANCEL: 'Only Draft or Confirmed invoices without payments can be cancelled.',
  IN_USE: 'This record is in use and can’t be removed.',
};

export function errorMessage(e: unknown): string {
  if (e instanceof ApiClientError) {
    if (e.code === 'VALIDATION_ERROR') {
      const first = Object.entries(e.fieldErrors)[0];
      return first ? `${first[0].replace(/_/g, ' ')} ${first[1][0]}` : e.message;
    }
    return MESSAGES[e.code] ?? e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}
