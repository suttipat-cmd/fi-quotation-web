import { STATUS_TEXT } from "../../features/quotations/constants";
import type { QuoteStatus } from "../../features/quotations/types";
import { PixelIcon } from "./PixelIcon";

const STATUS_ICON: Record<QuoteStatus, string> = {
  DRAFT: "status/status-draft",
  READY: "status/status-ready",
  ACCEPTED: "status/status-accepted",
  EXPIRED: "status/status-expired",
  CANCELLED: "status/status-cancelled",
};

export function QuotationStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <i className={`badge ${status.toLowerCase()}`}>
      <PixelIcon name={STATUS_ICON[status]} className="status-pixel-icon" />
      {STATUS_TEXT[status]}
    </i>
  );
}
