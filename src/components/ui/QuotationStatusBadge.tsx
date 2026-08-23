import { STATUS_TEXT } from "../../features/quotations/constants";
import type { QuoteStatus } from "../../features/quotations/types";

export function QuotationStatusBadge({ status }: { status: QuoteStatus }) {
  return <i className={`badge ${status.toLowerCase()}`}>{STATUS_TEXT[status]}</i>;
}
