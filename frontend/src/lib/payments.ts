import api from "@/lib/api";

/**
 * Stripe card brand — left open-ended because Stripe adds support for
 * new brands over time (Cartes Bancaires, etc.).
 */
export type CardBrand = string;

export interface PaymentMethod {
  id: string;
  brand: CardBrand | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
}

export interface PaymentMethodsResponse {
  data: PaymentMethod[];
  meta: {
    stripe_configured: boolean;
    default_payment_method_id: string | null;
  };
}

export interface SetupIntentResponse {
  data: {
    client_secret: string;
    customer_id: string;
    publishable_key: string;
  };
}

/**
 * Whether the build has a Stripe publishable key. Used to decide between
 * the live Elements flow and the "Stripe setup pending" placeholder at
 * the route level before we even call the API.
 */
export function hasStripePublishableKey(): boolean {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  return typeof key === "string" && key.length > 0;
}

export async function listPaymentMethods(): Promise<PaymentMethodsResponse> {
  const res = await api.get<PaymentMethodsResponse>("/api/me/payment-methods");
  return res.data;
}

export async function createSetupIntent(): Promise<SetupIntentResponse["data"]> {
  const res = await api.post<SetupIntentResponse>("/api/payments/setup-intent");
  return res.data.data;
}

export async function detachPaymentMethod(paymentMethodId: string): Promise<void> {
  await api.delete(`/api/me/payment-methods/${paymentMethodId}`);
}

export async function setDefaultPaymentMethod(paymentMethodId: string): Promise<string> {
  const res = await api.patch<{ data: { default_payment_method_id: string } }>(
    "/api/me/payment-methods/default",
    { payment_method_id: paymentMethodId },
  );
  return res.data.data.default_payment_method_id;
}

/**
 * Human-readable card brand label. Stripe returns lowercase strings like
 * "visa", "mastercard", "amex".
 */
export function brandLabel(brand: CardBrand | null): string {
  if (!brand) return "Card";
  const map: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
    discover: "Discover",
    diners: "Diners Club",
    jcb: "JCB",
    unionpay: "UnionPay",
    cartes_bancaires: "Cartes Bancaires",
  };
  return map[brand.toLowerCase()] ?? brand.toUpperCase();
}

export function formatExpiry(month: number | null, year: number | null): string {
  if (month === null || year === null) return "—";
  const mm = String(month).padStart(2, "0");
  const yy = String(year).slice(-2);
  return `${mm}/${yy}`;
}
