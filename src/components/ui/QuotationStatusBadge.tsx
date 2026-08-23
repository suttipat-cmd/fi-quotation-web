import { STATUS_TEXT } from "../../features/quotations/constants";
import type { QuoteStatus } from "../../features/quotations/types";

const STATUS_ICON: Record<QuoteStatus, string> = {
  DRAFT: "✎",
  READY: "✓",
  ACCEPTED: "✦",
  EXPIRED: "⌛",
  CANCELLED: "×",
};

export function QuotationStatusBadge({ status }: { status: QuoteStatus }) {
  return <i className={`badge ${status.toLowerCase()}`}><span aria-hidden="true">{STATUS_ICON[status]}</span>{STATUS_TEXT[status]}</i>;
}
