import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
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
import { categoryNetAmount, onsiteTraining } from "../domain/list-summary";
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
  headerHeight: 48,
  rowHeight: 60,
  borderRadius: 9,
  wrapperBorderRadius: 9,
  accentColor: "#16559b",
  headerBackgroundColor: "#edf3f8",
  headerTextColor: "#51647c",
  rowBorder: { style: "solid", width: 1, color: "#e4eaf1" },
});

const revisionLabel = (revisionNo: number) =>
  revisionNo > 0 ? `(${revisionNo})` : null;

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
  open,
  onAction,
  onOpenChange,
}: {
  quote: Quotation;
  open: boolean;
  onAction: (quote: Quotation, action: QuotationListAction) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const actions = quotationActions(quote.status);
  const recipientEmails = Array.isArray(quote.recipient_emails)
    ? quote.recipient_emails
    : quote.contact_email
      ? [quote.contact_email]
      : [];
  const emailReady = Boolean(quote.pdf_drive_url && recipientEmails.length);
  const choose = (action: QuotationListAction) => {
    onOpenChange(false);
    onAction(quote, action);
  };
  const placeMenu = () => {
    const bounds = triggerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const width = 210;
    const actionCount = 1
      + Number(actions.canEdit)
      + Number(actions.canSendEmail)
      + Number(actions.canAccept)
      + Number(actions.canCreateRevision);
    const height = 10 + actionCount * 39;
    const left = Math.max(12, Math.min(bounds.right - width, window.innerWidth - width - 12));
    const top = bounds.bottom + height + 8 > window.innerHeight
      ? Math.max(12, bounds.top - height - 8)
      : bounds.bottom + 8;
    setPosition({ top, left });
  };
  useLayoutEffect(() => {
    if (!open) return;
    placeMenu();
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [open]);
  const toggleMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onOpenChange(!open);
  };

  return (
    <div
      className="grid-row-actions"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        ref={triggerRef}
        className="grid-action-trigger"
        aria-label={`การดำเนินการ ${quote.document_no}`}
        aria-expanded={open}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={toggleMenu}
      >
        ⋯
      </button>
      {open && createPortal(
        <>
          <button type="button" className="grid-action-backdrop" aria-label="ปิดเมนูการดำเนินการ" onClick={() => onOpenChange(false)} />
          <div className="grid-action-menu" role="menu" style={{ top: position.top, left: position.left }}>
          <button type="button" role="menuitem" onClick={() => choose("view")}>ดูรายละเอียด</button>
          {actions.canEdit && <button type="button" role="menuitem" onClick={() => choose("edit")}>แก้ไข</button>}
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
          {actions.canAccept && <button className="menu-accept" type="button" role="menuitem" onClick={() => choose("accept")}>ตอบรับ</button>}
          {actions.canCreateRevision && <button type="button" role="menuitem" onClick={() => choose("revision")}>สร้างสำเนา</button>}
          </div>
        </>,
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
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const columns = useMemo<ColDef<Quotation>[]>(
    () => [
      {
        headerName: "เลขที่เอกสาร",
        field: "document_no",
        flex: 1.1,
        minWidth: 136,
        cellClass: "grid-document-number",
        valueGetter: ({ data }) =>
          data
            ? [data.document_no, revisionLabel(data.revision_no)].filter(Boolean).join(" ")
            : "",
      },
      {
        headerName: "ลูกค้า",
        field: "customer_name",
        flex: 1.5,
        minWidth: 210,
        cellRenderer: ({ data, value }: { data?: Quotation; value?: string }) => (
          <div className="grid-customer-cell">
            <strong>{value || "-"}</strong>
            {data?.contact_name && <span>{data.contact_name}</span>}
          </div>
        ),
      },
      {
        headerName: "จำนวนรถ",
        colId: "vehicles",
        flex: 0.7,
        minWidth: 94,
        valueGetter: ({ data }) => data?.package_reference_quantity || 0,
        valueFormatter: ({ value }) => Number(value) ? `${value} คัน` : "—",
      },
      {
        headerName: "บริการหลัก",
        colId: "services",
        flex: 1.2,
        minWidth: 160,
        valueGetter: ({ data }) => data?.recurring_addons?.join(", ") || "—",
        cellClass: "grid-service-list",
      },
      {
        headerName: "นอกสถานที่",
        colId: "onsite",
        flex: 0.85,
        minWidth: 118,
        valueGetter: ({ data }) => {
          const item = data ? onsiteTraining(data) : undefined;
          return item && Number(item.quantity) ? `${item.quantity} ${item.unit || "ครั้ง"}` : "—";
        },
      },
      {
        headerName: "ยอดเงิน",
        colId: "recurringAmount",
        flex: 0.9,
        minWidth: 120,
        cellClass: "grid-money",
        valueGetter: ({ data }) => data ? categoryNetAmount(data, "RECURRING") : 0,
        valueFormatter: ({ value }) => money(Number(value || 0)),
      },
      {
        headerName: "ค่าแรกเข้า",
        colId: "oneTimeAmount",
        flex: 0.9,
        minWidth: 120,
        cellClass: "grid-money",
        valueGetter: ({ data }) => data ? categoryNetAmount(data, "ONE_TIME") : 0,
        valueFormatter: ({ value }) => money(Number(value || 0)),
      },
      { headerName: "วันที่ออก", field: "issued_at", flex: 0.82, minWidth: 112, valueFormatter: ({ value }) => displayDate(value) },
      {
        headerName: "สถานะ",
        field: "status",
        flex: 0.75,
        minWidth: 104,
        cellRenderer: ({ value }: { value: Quotation["status"] }) => <QuotationStatusBadge status={value} />,
      },
      {
        headerName: "",
        colId: "actions",
        width: 62,
        pinned: "right",
        sortable: false,
        resizable: false,
        suppressHeaderMenuButton: true,
        cellClass: "grid-action-cell",
        cellRenderer: ({ data }: { data?: Quotation }) =>
          data ? <RowActions quote={data} open={activeActionId === data.id} onAction={onAction} onOpenChange={(open) => setActiveActionId(open ? data.id : null)} /> : null,
      },
    ],
    [activeActionId, onAction],
  );

  return (
    <div className={`quotation-grid ${quotes.length <= 10 ? "compact-pagination" : ""}`}>
      <AgGridProvider modules={modules}>
        <AgGridReact<Quotation>
          rowData={quotes}
          columnDefs={columns}
          getRowId={({ data }) => data.id}
          onRowClicked={({ data, event }) => {
            const target = event?.target;
            if (target instanceof Element && target.closest(".grid-row-actions")) return;
            if (data) onSelect(data);
          }}
          pagination
          paginationPageSize={10}
          paginationPageSizeSelector={[10, 25, 50]}
          suppressPaginationPanel={quotes.length <= 10}
          defaultColDef={{ sortable: true, filter: false, resizable: true, suppressHeaderMenuButton: true, wrapHeaderText: true, autoHeaderHeight: true }}
          localeText={THAI_GRID_TEXT}
          theme={quotationGridTheme}
          rowHeight={60}
        />
      </AgGridProvider>
    </div>
  );
}
