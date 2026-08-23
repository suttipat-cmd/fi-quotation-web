import { useMemo, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import {
  CellStyleModule,
  ClientSideRowModelModule,
  DateFilterModule,
  LocaleModule,
  NumberFilterModule,
  PaginationModule,
  TextFilterModule,
  themeQuartz,
  ValidationModule,
  type ColDef,
} from "ag-grid-community";
import { AgGridProvider, AgGridReact } from "ag-grid-react";
import { displayDate, money } from "../../../lib/format";
import { QuotationStatusBadge } from "../../../components/ui/QuotationStatusBadge";
import { quotationActions } from "../domain/status";
import type { Quotation } from "../types";

export type QuotationListAction = "view" | "edit" | "email" | "accept" | "revision";

const modules = [
  CellStyleModule,
  ClientSideRowModelModule,
  PaginationModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  LocaleModule,
  ValidationModule,
];

const quotationGridTheme = themeQuartz.withParams({
  fontFamily: ["Noto Sans Thai", "system-ui", "sans-serif"],
  fontSize: 14,
  headerFontWeight: 700,
  headerHeight: 54,
  rowHeight: 68,
  borderRadius: 9,
  wrapperBorderRadius: 9,
  accentColor: "#16559b",
  headerBackgroundColor: "#edf3f8",
  headerTextColor: "#51647c",
  rowBorder: { style: "solid", width: 1, color: "#e4eaf1" },
});

const revisionLabel = (revisionNo: number) =>
  revisionNo > 0 ? `ฉบับแก้ไข ${String(revisionNo).padStart(2, "0")}` : null;

const THAI_GRID_TEXT = {
  page: "หน้า",
  to: "ถึง",
  of: "จาก",
  next: "ถัดไป",
  last: "สุดท้าย",
  first: "แรก",
  previous: "ก่อนหน้า",
  pageSizeSelectorLabel: "จำนวนต่อหน้า:",
  ariaPageSizeSelectorLabel: "จำนวนรายการต่อหน้า",
  noRowsToShow: "ไม่พบข้อมูล",
  loadingOoo: "กำลังโหลด...",
};

function RowActions({
  quote,
  onAction,
}: {
  quote: Quotation;
  onAction: (quote: Quotation, action: QuotationListAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const actions = quotationActions(quote.status);
  const recipientEmails = Array.isArray(quote.recipient_emails)
    ? quote.recipient_emails
    : quote.contact_email
      ? [quote.contact_email]
      : [];
  const emailReady = Boolean(quote.pdf_drive_url && recipientEmails.length);
  const choose = (action: QuotationListAction) => {
    setOpen(false);
    onAction(quote, action);
  };
  const toggleMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    setPosition({ top: bounds.bottom + 6, left: Math.max(12, bounds.right - 220) });
    setOpen((current) => !current);
  };

  return (
    <div className="grid-row-actions" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="grid-action-trigger"
        aria-label={`การดำเนินการ ${quote.document_no}`}
        aria-expanded={open}
        onClick={toggleMenu}
      >
        ⋯
      </button>
      {open && createPortal(
        <div className="grid-action-menu" role="menu" style={{ top: position.top, left: position.left }}>
          <button type="button" role="menuitem" onClick={() => choose("view")}>ดูรายละเอียด</button>
          {actions.canEdit && <button type="button" role="menuitem" onClick={() => choose("edit")}>แก้ไขฉบับร่าง</button>}
          {actions.canSendEmail && (
            <button
              type="button"
              role="menuitem"
              disabled={!emailReady}
              title={!emailReady ? "ต้องมีไฟล์ PDF บน Google Drive และอีเมลผู้รับก่อน" : undefined}
              onClick={() => choose("email")}
            >
              ส่งอีเมล
            </button>
          )}
          {actions.canAccept && <button type="button" role="menuitem" onClick={() => choose("accept")}>บันทึกลูกค้าตอบรับ</button>}
          {actions.canCreateRevision && <button type="button" role="menuitem" onClick={() => choose("revision")}>สร้างฉบับแก้ไข</button>}
        </div>,
        document.body,
      )}
    </div>
  );
}

export default function QuotationGrid({
  quotes,
  onSelect,
  onAction,
}: {
  quotes: Quotation[];
  onSelect: (quote: Quotation) => void;
  onAction: (quote: Quotation, action: QuotationListAction) => void;
}) {
  const columns = useMemo<ColDef<Quotation>[]>(
    () => [
      {
        headerName: "เลขที่เอกสาร",
        field: "document_no",
        flex: 1.1,
        minWidth: 150,
        cellClass: "grid-document-number",
        valueGetter: ({ data }) =>
          data
            ? [data.document_no, revisionLabel(data.revision_no)].filter(Boolean).join(" · ")
            : "",
      },
      { headerName: "ลูกค้า", field: "customer_name", flex: 1.8, minWidth: 220 },
      { headerName: "ใช้ได้ถึง", field: "valid_until", flex: 0.9, minWidth: 125, valueFormatter: ({ value }) => displayDate(value) },
      {
        headerName: "สถานะ",
        field: "status",
        flex: 0.9,
        minWidth: 120,
        cellRenderer: ({ value }: { value: Quotation["status"] }) => <QuotationStatusBadge status={value} />,
      },
      {
        headerName: "ยอดสุทธิ",
        field: "net_amount_satang",
        flex: 1,
        minWidth: 130,
        cellClass: "grid-money",
        valueFormatter: ({ value }) => money(Number(value || 0)),
      },
      {
        headerName: "การดำเนินการ",
        colId: "actions",
        width: 116,
        sortable: false,
        resizable: false,
        suppressHeaderMenuButton: true,
        cellClass: "grid-action-cell",
        cellRenderer: ({ data }: { data?: Quotation }) =>
          data ? <RowActions quote={data} onAction={onAction} /> : null,
      },
    ],
    [onAction],
  );

  return (
    <div className={`quotation-grid ${quotes.length <= 10 ? "compact-pagination" : ""}`}>
      <AgGridProvider modules={modules}>
        <AgGridReact<Quotation>
          rowData={quotes}
          columnDefs={columns}
          getRowId={({ data }) => data.id}
          onRowClicked={({ data }) => data && onSelect(data)}
          pagination
          paginationPageSize={10}
          paginationPageSizeSelector={[10, 25, 50]}
          suppressPaginationPanel={quotes.length <= 10}
          defaultColDef={{ sortable: true, filter: false, resizable: true, suppressHeaderMenuButton: true }}
          localeText={THAI_GRID_TEXT}
          theme={quotationGridTheme}
          headerHeight={54}
          rowHeight={68}
        />
      </AgGridProvider>
    </div>
  );
}
