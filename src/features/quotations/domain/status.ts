import type { QuoteStatus } from "../types";

export const quotationActions = (status: QuoteStatus) => ({
  canEdit: status === "DRAFT",
  canGeneratePdf: status === "DRAFT",
  canSendEmail: status === "READY" || status === "ACCEPTED",
  canAccept: status === "READY",
  canCreateRevision: ["READY", "ACCEPTED", "EXPIRED"].includes(status),
  canCancel: ["DRAFT", "READY", "ACCEPTED", "EXPIRED"].includes(status),
  // Printing is a local browser action and must remain available for reviewing
  // both draft and completed quotations from the detail page.
  canPrint: true,
});
