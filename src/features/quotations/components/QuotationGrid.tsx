import { useMemo } from "react";
import {
  CellStyleModule,
  ClientSideRowModelModule,
  DateFilterModule,
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
import type { Quotation } from "../types";

const modules = [
  CellStyleModule,
  ClientSideRowModelModule,
  PaginationModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
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

export default function QuotationGrid({
  quotes,
  onSelect,
}: {
  quotes: Quotation[];
  onSelect: (quote: Quotation) => void;
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
    ],
    [],
  );

  return (
    <div className="quotation-grid">
      <AgGridProvider modules={modules}>
        <AgGridReact<Quotation>
          rowData={quotes}
          columnDefs={columns}
          getRowId={({ data }) => data.id}
          onRowClicked={({ data }) => data && onSelect(data)}
          pagination
          paginationPageSize={10}
          paginationPageSizeSelector={[10, 25, 50]}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
          theme={quotationGridTheme}
          headerHeight={54}
          rowHeight={68}
        />
      </AgGridProvider>
    </div>
  );
}
