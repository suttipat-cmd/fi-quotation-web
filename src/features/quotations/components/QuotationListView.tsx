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
  const [sales, setSales] = useState("");
  const [statuses, setStatuses] = useState<QuoteStatus[]>([]);
  const [dates, setDates] = useState<DateFilters>({ issuedFrom: "", issuedTo: "", validFrom: "", validTo: "" });
  const normalizedSearch = search.trim().toLocaleLowerCase("th-TH");
  const hasFilters = Boolean(normalizedSearch || sales || statuses.length || Object.values(dates).some(Boolean));
  const salesPeople = useMemo(
    () => [...new Set(quotes.map((quote) => quote.sales_name?.trim()).filter(Boolean))].sort((a, b) => a!.localeCompare(b!, "th")) as string[],
    [quotes],
  );
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
      const matchesSales = !sales || quote.sales_name === sales;
      const matchesIssued = (!dates.issuedFrom || quote.issued_at >= dates.issuedFrom)
        && (!dates.issuedTo || quote.issued_at <= dates.issuedTo);
      const matchesValidity = (!dates.validFrom || quote.valid_until >= dates.validFrom)
        && (!dates.validTo || quote.valid_until <= dates.validTo);
      return matchesSearch && matchesStatus && matchesSales && matchesIssued && matchesValidity;
    }),
    [quotes, normalizedSearch, sales, statuses, dates],
  );

  const clearFilters = () => {
    setSearch("");
    setSales("");
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
      <section className="status-summary list-panel-section" aria-label="สรุปสถานะใบเสนอราคา">
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
        <div className="list-toolbar-row">
          <label className="list-search">
            <span>ค้นหา</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="เลขที่เอกสาร, ลูกค้า, ผู้เสนอราคา"
            />
          </label>
          <label className="list-sales-filter">
            <span>ผู้เสนอราคา</span>
            <select value={sales} onChange={(event) => setSales(event.target.value)}>
              <option value="">ทั้งหมด</option>
              {salesPeople.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <div className="list-toolbar-actions">
            <span>แสดง {filteredQuotes.length} จาก {quotes.length} รายการ</span>
            <button type="button" className="text-button" disabled={!hasFilters} onClick={clearFilters}>ล้างตัวกรอง</button>
          </div>
        </div>
        <details className="quotation-advanced-filters">
          <summary>ตัวกรองเพิ่มเติม</summary>
          <div className="list-date-filters">
            <label><span>ออกเอกสารตั้งแต่</span><input type="date" value={dates.issuedFrom} onChange={(event) => setDates({ ...dates, issuedFrom: event.target.value })} /></label>
            <label><span>ถึง</span><input type="date" value={dates.issuedTo} onChange={(event) => setDates({ ...dates, issuedTo: event.target.value })} /></label>
            <label><span>ใช้ได้ถึงตั้งแต่</span><input type="date" value={dates.validFrom} onChange={(event) => setDates({ ...dates, validFrom: event.target.value })} /></label>
            <label><span>ถึง</span><input type="date" value={dates.validTo} onChange={(event) => setDates({ ...dates, validTo: event.target.value })} /></label>
          </div>
        </details>
        {hasFilters && (
          <div className="list-filter-chips" aria-live="polite" aria-label="ตัวกรองที่ใช้งาน">
            {normalizedSearch && <button type="button" onClick={() => setSearch("")}>ค้นหา: {search.trim()} <span aria-hidden="true">×</span></button>}
            {sales && <button type="button" onClick={() => setSales("")}>ผู้เสนอราคา: {sales} <span aria-hidden="true">×</span></button>}
            {statuses.length > 0 && <button type="button" onClick={() => setStatuses([])}>สถานะ: {statuses.map((status) => STATUS_TEXT[status]).join(", ")} <span aria-hidden="true">×</span></button>}
            {dates.issuedFrom && <button type="button" onClick={() => setDates({ ...dates, issuedFrom: "" })}>ออกตั้งแต่: {dates.issuedFrom} <span aria-hidden="true">×</span></button>}
            {dates.issuedTo && <button type="button" onClick={() => setDates({ ...dates, issuedTo: "" })}>ออกถึง: {dates.issuedTo} <span aria-hidden="true">×</span></button>}
            {dates.validFrom && <button type="button" onClick={() => setDates({ ...dates, validFrom: "" })}>ใช้ได้ตั้งแต่: {dates.validFrom} <span aria-hidden="true">×</span></button>}
            {dates.validTo && <button type="button" onClick={() => setDates({ ...dates, validTo: "" })}>ใช้ได้ถึง: {dates.validTo} <span aria-hidden="true">×</span></button>}
          </div>
        )}
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
        <div className="list-grid-section"><QuotationGrid quotes={filteredQuotes} onSelect={onSelect} onAction={onAction} /></div>
      ) : !loadError ? (
        <div className="empty list-no-results">
          <span>⌕</span><h3>ไม่พบเอกสารตามตัวกรอง</h3><p>ลองเปลี่ยนคำค้นหา วันที่ หรือสถานะที่เลือก</p>
          <button type="button" onClick={clearFilters}>ล้างตัวกรอง</button>
        </div>
      ) : null}
    </>
  );
}
