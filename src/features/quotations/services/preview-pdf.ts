const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/**
 * Captures the unscaled quotation paper that is already shown in the preview.
 * The capture is placed in an isolated offscreen stage so the responsive
 * preview scale never changes the document dimensions or output quality.
 */
export const createPreviewPdf = async (paper: HTMLElement) => {
  if (paper.scrollHeight > paper.clientHeight + 1) {
    throw new Error("เนื้อหาเกิน 1 หน้า A4 กรุณาลดข้อความหมายเหตุก่อนสร้าง PDF");
  }

  const stage = document.createElement("div");
  const copy = paper.cloneNode(true) as HTMLElement;
  // html2canvas's default renderer can flatten transparent grid cells against
  // a neighbouring background. Mark this isolated source so its key fills are
  // explicitly preserved in the exported document.
  copy.classList.add("pdf-render-source");
  Object.assign(stage.style, {
    position: "fixed",
    top: "0",
    left: "-100000px",
    width: "210mm",
    height: "297mm",
    overflow: "hidden",
    background: "#ffffff",
    pointerEvents: "none",
  });
  Object.assign(copy.style, {
    width: "210mm",
    height: "297mm",
    margin: "0",
    transform: "none",
  });
  stage.appendChild(copy);
  document.body.appendChild(stage);

  try {
    // Keep these large libraries out of the initial application bundle. They
    // are only needed for the explicit PDF action.
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    // Wait for Thai web fonts and the logo image to settle before rasterising.
    await document.fonts?.ready;
    const canvas = await html2canvas(copy, {
      backgroundColor: "#ffffff",
      // 3x the browser CSS A4 size is approximately 288 DPI. It keeps Thai
      // text crisp in Drive while remaining safely below typical request-size
      // limits after base64 encoding for the Apps Script handoff.
      scale: 3,
      useCORS: true,
      logging: false,
      width: copy.scrollWidth,
      height: copy.scrollHeight,
      windowWidth: copy.scrollWidth,
      windowHeight: copy.scrollHeight,
    });
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });
    // PNG avoids JPEG chroma subsampling, which was making the pale table
    // fills appear opaque and different from the on-screen/printed preview.
    pdf.addImage(canvas, "PNG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
    return pdf.output("blob");
  } catch (error) {
    throw new Error(
      error instanceof Error ? `ไม่สามารถสร้าง PDF จากตัวอย่างได้: ${error.message}` : "ไม่สามารถสร้าง PDF จากตัวอย่างได้",
    );
  } finally {
    stage.remove();
  }
};
