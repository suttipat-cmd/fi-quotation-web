export type Category = "RECURRING" | "ONE_TIME";

export type QuoteStatus =
  | "DRAFT"
  | "READY"
  | "ACCEPTED"
  | "EXPIRED"
  | "CANCELLED";

export type Service = {
  id: string;
  code?: string;
  name: string;
  default_description?: string | null;
  default_category: Category;
  default_billing_type: string;
  default_calculation_mode: string;
  default_unit: string | null;
  suggested_price_satang: number | null;
  active?: boolean;
  sort_order?: number;
};

export type QuotationItem = {
  id: string;
  category: Category;
  service_id: string | null;
  service_name: string;
  billing_type: string;
  calculation_mode: string;
  reference_quantity: number;
  quantity: number;
  unit: string;
  unit_price_satang: number;
  manual_amount_satang: number;
  discount_type: string;
  discount_value: number;
};

export type QuotationForm = {
  sales_profile_id?: string;
  customer_name: string;
  customer_address: string;
  contact_name: string;
  contact_position: string;
  contact_email: string;
  recipient_emails: string[];
  sales_name: string;
  sales_title: string;
  issued_at: string;
  valid_until: string;
  notes: string;
  payment_terms: string;
  vat_rate: number;
  wht_rate: number;
  quotation_discount_type: string;
  quotation_discount_value: number;
  package_reference_quantity: number;
  package_reference_unit: string;
  included_users: number;
  billing_cycles: string[];
  recurring_addons: string[];
  additional_fees: string;
  promotion_terms: string;
};

export type Quotation = {
  id: string;
  document_no: string;
  revision_no: number;
  status: QuoteStatus;
  owner_id?: string;
  customer_name: string;
  customer_address?: string | null;
  contact_name?: string | null;
  contact_position?: string | null;
  contact_email?: string | null;
  recipient_emails?: string[] | null;
  sales_name?: string | null;
  sales_profile_id?: string | null;
  sales_title?: string | null;
  sales_phone?: string | null;
  sales_email?: string | null;
  issued_at: string;
  valid_until: string;
  notes?: string | null;
  payment_terms?: string | null;
  vat_rate: number;
  wht_rate: number;
  quotation_discount_type?: string | null;
  quotation_discount_value?: number | null;
  quotation_discount_satang?: number | null;
  subtotal_satang?: number | null;
  tax_base_satang?: number | null;
  vat_amount_satang?: number | null;
  wht_amount_satang?: number | null;
  net_amount_satang?: number | null;
  package_reference_quantity?: number | null;
  package_reference_unit?: string | null;
  included_users?: number | null;
  billing_cycle?: string | null;
  billing_cycles?: string[] | null;
  recurring_addons?: string[] | null;
  additional_fees?: string | null;
  promotion_terms?: string | null;
  pdf_drive_url?: string | null;
  cancellation_reason?: string | null;
  cancellation_note?: string | null;
  list_items?: QuotationListItemSummary[];
  created_at?: string;
};

export type QuotationListItemSummary = {
  category: Category;
  service_name: string;
  quantity: number | null;
  unit: string | null;
  line_net_satang: number | null;
};

export type QuotationTotals = {
  subtotal: number;
  discount: number;
  taxBase: number;
  vat: number;
  wht: number;
  net: number;
};

export type QuoteGroupTotals = Omit<QuotationTotals, "taxBase">;

export type Profile = {
  id: string;
  display_name: string | null;
  role: "ADMIN" | "SALE" | "USER";
  email?: string;
  job_title?: string | null;
  phone?: string | null;
  work_email?: string | null;
  active?: boolean;
  avatar_url?: string | null;
  app_background_key?: "terraria" | "battlefield" | "shinchan" | "custom";
  app_background_url?: string | null;
};
