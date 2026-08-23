import { useMemo, useState } from "react";
import { STATUS_TEXT } from "../constants";
import QuotationGrid, { type QuotationListAction } from "./QuotationGrid";
import type { QuoteStatus, Quotation } from "../types";

type DateFilters = {
  issuedFrom: string;
  issuedTo: string;
  validFrom: string;
  validTo: string;
};

const STATUS_ORDER: QuoteStatus[] = ["DRAFT", "READY", "ACCEPTED", "EXPIRED", "CANCELLED"];

const includesText = (value: unknown, query: string) =>
  String(value || "").toLocaleLowerCase("th-TH").includes(query);

export default function QuotationListView({
  quotes,
  busy,
  loadError,
  onRetry,
  onCreate,
  onSelect,
  onAction,
}: {
  quotes: Quotation[];
  busy: boolean;
  loadError: string | null;
  onRetry: () => void;
  onCreate: () => void;
  onSelect: (quote: Quotation) => void;
  onAction: (quote: Quotation, action: QuotationListAction) => void;
}) {
  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<QuoteStatus[]>([]);
  const [dates, setDates] = useState<DateFilters>({ issuedFrom: "", issuedTo: "", validFrom: "", validTo: "" });
  const normalizedSearch = search.trim().toLocaleLowerCase("th-TH");
  const hasFilters = Boolean(normalizedSearch || statuses.length || Object.values(dates).some(Boolean));
  const counts = useMemo(
    () => Object.fromEntries(STATUS_ORDER.map((status) => [status, quotes.filter((quote) => quote.status === status).length])) as Record<QuoteStatus, number>,
    [quotes],
  );
  const filteredQuotes = useMemo(
    () => quotes.filter((quote) => {
      const matchesSearch = !normalizedSearch || [
        quote.document_no,
        quote.customer_name,
        quote.sales_name,
        quote.contact_name,
      ].some((value) => includesText(value, normalizedSearch));
      const matchesStatus = !statuses.length || statuses.includes(quote.status);
      const matchesIssued = (!dates.issuedFrom || quote.issued_at >= dates.issuedFrom)
        && (!dates.issuedTo || quote.issued_at <= dates.issuedTo);
      const matchesValidity = (!dates.validFrom || quote.valid_until >= dates.validFrom)
        && (!dates.validTo || quote.valid_until <= dates.validTo);
      return matchesSearch && matchesStatus && matchesIssued && matchesValidity;
    }),
    [quotes, normalizedSearch, statuses, dates],
  );

  const clearFilters = () => {
    setSearch("");
    setStatuses([]);
    setDates({ issuedFrom: "", issuedTo: "", validFrom: "", validTo: "" });
  };
  const toggleStatus = (status?: QuoteStatus) => {
    if (!status) return setStatuses([]);
    setStatuses((current) => current.includes(status)
      ? current.filter((value) => value !== status)
      : [...current, status]);
  };

  return (
    <>
      <section className="status-summary" aria-label="สรุปสถานะใบเสนอราคา">
        <button className={`status-summary-card ${!statuses.length ? "active" : ""}`} aria-pressed={!statuses.length} onClick={() => toggleStatus()}>
          <span>เอกสารทั้งหมด</span><strong>{quotes.length}</strong><small>รายการ</small>
        </button>
        {STATUS_ORDER.map((status) => (
          <button
            key={status}
            className={`status-summary-card ${status.toLowerCase()} ${statuses.includes(status) ? "active" : ""}`}
            aria-pressed={statuses.includes(status)}
            onClick={() => toggleStatus(status)}
          >
            <span>{STATUS_TEXT[status]}</span><strong>{counts[status]}</strong><small>รายการ</small>
          </button>
        ))}
      </section>

      <section className="quotation-list-toolbar" aria-label="ค้นหาและกรองรายการใบเสนอราคา">
        <label className="list-search">
          <span>ค้นหา</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="เลขที่เอกสาร, ลูกค้า, ผู้เสนอราคา"
          />
        </label>
        <div className="list-date-filters">
          <label><span>ออกเอกสารตั้งแต่</span><input type="date" value={dates.issuedFrom} onChange={(event) => setDates({ ...dates, issuedFrom: event.target.value })} /></label>
          <label><span>ถึง</span><input type="date" value={dates.issuedTo} onChange={(event) => setDates({ ...dates, issuedTo: event.target.value })} /></label>
          <label><span>ใช้ได้ถึงตั้งแต่</span><input type="date" value={dates.validFrom} onChange={(event) => setDates({ ...dates, validFrom: event.target.value })} /></label>
          <label><span>ถึง</span><input type="date" value={dates.validTo} onChange={(event) => setDates({ ...dates, validTo: event.target.value })} /></label>
        </div>
        <div className="list-toolbar-actions">
          <span>แสดง {filteredQuotes.length} จาก {quotes.length} รายการ</span>
          <button type="button" className="text-button" disabled={!hasFilters} onClick={clearFilters}>ล้างตัวกรอง</button>
        </div>
      </section>

      {loadError && (
        <div className="list-error" role="alert">
          <div><strong>โหลดรายการใบเสนอราคาไม่สำเร็จ</strong><span>{loadError}</span></div>
          <button type="button" disabled={busy} onClick={onRetry}>ลองใหม่</button>
        </div>
      )}

      {!loadError && quotes.length === 0 ? (
        <div className="empty">
          <span>◫</span><h3>ยังไม่มีใบเสนอราคา</h3><p>เริ่มสร้างใบเสนอราคาฉบับแรกของคุณได้เลย</p>
          <button className="primary" onClick={onCreate}>สร้างใบเสนอราคา</button>
        </div>
      ) : filteredQuotes.length ? (
        <QuotationGrid quotes={filteredQuotes} onSelect={onSelect} onAction={onAction} />
      ) : !loadError ? (
        <div className="empty list-no-results">
          <span>⌕</span><h3>ไม่พบเอกสารตามตัวกรอง</h3><p>ลองเปลี่ยนคำค้นหา วันที่ หรือสถานะที่เลือก</p>
          <button type="button" onClick={clearFilters}>ล้างตัวกรอง</button>
        </div>
      ) : null}
    </>
  );
}
