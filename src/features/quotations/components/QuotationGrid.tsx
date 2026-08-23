import { useMemo } from "react";
import {
  ClientSideRowModelModule,
  DateFilterModule,
  NumberFilterModule,
  PaginationModule,
  TextFilterModule,
  ValidationModule,
  type ColDef,
} from "ag-grid-community";
import { AgGridProvider, AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.min.css";
import "ag-grid-community/styles/ag-theme-quartz-no-font.min.css";
import { displayDate, money } from "../../../lib/format";
import { QuotationStatusBadge } from "../../../components/ui/QuotationStatusBadge";
import type { Quotation } from "../types";

const modules = [
  ClientSideRowModelModule,
  PaginationModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  ValidationModule,
];

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
        cellRenderer: ({ data }: { data?: Quotation }) =>
          data ? (
            <div className="grid-document-number">
              <b>{data.document_no}</b>
              {revisionLabel(data.revision_no) && <small>{revisionLabel(data.revision_no)}</small>}
            </div>
          ) : null,
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
    <div className="quotation-grid ag-theme-quartz">
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
        />
      </AgGridProvider>
    </div>
  );
}
