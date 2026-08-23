import { supabase } from "../../../supabase";
import type { Quotation } from "../types";

export const quotationPdfBaseName = (quotation: Pick<Quotation, "document_no" | "revision_no">) =>
  `${quotation.document_no}${quotation.revision_no > 0 ? ` (${quotation.revision_no})` : ""}`;

export const quotationPdfFileName = (quotation: Pick<Quotation, "document_no" | "revision_no">) =>
  `${quotationPdfBaseName(quotation)}.pdf`;

const edgeErrorMessage = async (error: unknown) => {
  const context = (error as { context?: { clone?: () => Response } })?.context;
  try {
    const payload = await context?.clone?.().json();
    if (payload && typeof payload.message === "string") return payload.message;
  } catch {
    try {
      const raw = await context?.clone?.().text();
      if (raw) {
        const payload = JSON.parse(raw);
        if (typeof payload?.message === "string") return payload.message;
      }
    } catch {
      // Fall back to the SDK error message below.
    }
  }
  const message = error instanceof Error ? error.message : "ไม่สามารถดำเนินการได้";
  return /non-2xx|functionshttperror/i.test(message)
    ? "บริการสร้าง PDF ตอบกลับผิดพลาด กรุณาตรวจสอบ Google Apps Script"
    : message;
};

const blobToBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

export const uploadGeneratedPdf = async (quotation: Quotation, pdf: Blob) => {
  const { data, error } = await supabase.functions.invoke("quotation-operations", {
    body: {
      action: "generate_pdf",
      quotation_id: quotation.id,
      file_name: quotationPdfFileName(quotation),
      pdf_base64: await blobToBase64(pdf),
    },
  });
  if (error) throw new Error(await edgeErrorMessage(error));
  return data as { message: string; pdf_drive_url?: string; status?: string; reused?: boolean };
};

export const sendQuotationEmail = async (input: {
  quotationId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  message: string;
}) => {
  const { data, error } = await supabase.functions.invoke("quotation-operations", {
    body: { action: "send_email", ...input },
  });
  if (error) throw new Error(await edgeErrorMessage(error));
  return data as { message: string };
};
