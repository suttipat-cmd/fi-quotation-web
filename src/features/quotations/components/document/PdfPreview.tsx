import { useLayoutEffect, useRef, useState } from "react";
import { Document as PdfDocument, Page as PdfPage, pdfjs } from "react-pdf";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { Spinner } from "../../../../components/ui/Spinner";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export function PdfPreview({ file }: { file: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const updateWidth = () => setWidth(Math.max(260, Math.floor(element.clientWidth - 24)));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="pdf-canvas-preview" ref={host}>
      <PdfDocument
        file={file}
        loading={<div className="pdf-preview-loading"><Spinner /> กำลังสร้างตัวอย่าง PDF</div>}
        error={<p className="preview-overflow">ไม่สามารถแสดงตัวอย่าง PDF ได้</p>}
        onLoadSuccess={({ numPages }) => setPageCount(numPages)}
      >
        {Array.from({ length: pageCount }, (_, index) => (
          <PdfPage
            key={index}
            pageNumber={index + 1}
            width={width || undefined}
            renderAnnotationLayer={false}
            renderTextLayer={false}
          />
        ))}
      </PdfDocument>
      {pageCount > 1 && (
        <p className="preview-overflow" role="alert">
          เอกสารมี {pageCount} หน้า กรุณาลดความยาวหมายเหตุก่อนยืนยันสร้าง PDF
        </p>
      )}
    </div>
  );
}
