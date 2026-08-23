import { supabase } from "../../../supabase";
import type { Quotation } from "../types";

const edgeErrorMessage = async (error: unknown) => {
  const context = (error as { context?: { clone?: () => Response } })?.context;
  try {
    const payload = await context?.clone?.().json();
    if (payload && typeof payload.message === "string") return payload.message;
  } catch {
    // fall back to the SDK error message
  }
  return error instanceof Error ? error.message : "ไม่สามารถดำเนินการได้";
};

const blobToBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size));
  }
  return btoa(binary);
};

export const uploadGeneratedPdf = async (quotation: Quotation, pdf: Blob) => {
  const { data, error } = await supabase.functions.invoke("quotation-operations", {
    body: {
      action: "generate_pdf",
      quotation_id: quotation.id,
      file_name: `${quotation.document_no}.pdf`,
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
