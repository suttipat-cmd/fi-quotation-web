import { useEffect, useMemo, useRef, useState } from "react";
import { STATUS_TEXT } from "../constants";
import QuotationGrid, { type QuotationListAction } from "./QuotationGrid";
import type { QuoteStatus, Quotation } from "../types";
import { onsiteTraining } from "../domain/list-summary";

type DateRange = { from: string; to: string };

const STATUS_ORDER: QuoteStatus[] = ["DRAFT", "READY", "ACCEPTED", "EXPIRED", "CANCELLED"];

const includesText = (value: unknown, query: string) =>
  String(value || "").toLocaleLowerCase("th-TH").includes(query);
// Date inputs represent local calendar days. Using toISOString() converts to UTC,
// which moves Bangkok dates back one day and can put the range in the prior month.
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const monthRange = (offset = 0): DateRange => {
  const date = new Date();
  date.setMonth(date.getMonth() + offset, 1);
  const from = new Date(date.getFullYear(), date.getMonth(), 1);
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { from: isoDate(from), to: isoDate(to) };
};
const yearRange = (offset = 0): DateRange => {
  const year = new Date().getFullYear() + offset;
  return { from: `${year}-01-01`, to: `${year}-12-31` };
};
const displayRange = (range: DateRange) =>
  `${range.from ? range.from.split("-").reverse().join("-") : "ไม่กำหนด"} - ${range.to ? range.to.split("-").reverse().join("-") : "ไม่กำหนด"}`;

function DateRangePopover({ range, onChange, onClose }: { range: DateRange; onChange: (range: DateRange) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(range);
  const popoverRef = useRef<HTMLElement>(null);
  const apply = () => { onChange(draft); onClose(); };
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (popoverRef.current?.contains(event.target as Node)) return;
      if ((event.target as Element).closest(".date-range-trigger")) return;
      onClose();
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [onClose]);
  return (
      <section ref={popoverRef} className="date-range-popover" role="dialog" aria-label="เลือกช่วงวันที่ออกเอกสาร">
        <div className="date-range-heading"><div><strong>เลือกช่วงเวลา</strong></div><button type="button" aria-label="ปิด" onClick={onClose}>×</button></div>
        <div className="date-presets">
          <button type="button" onClick={() => setDraft(monthRange())}>เดือนนี้</button>
          <button type="button" onClick={() => setDraft(monthRange(-1))}>เดือนที่แล้ว</button>
          <button type="button" onClick={() => setDraft(yearRange())}>ปีนี้</button>
          <button type="button" onClick={() => setDraft(yearRange(-1))}>ปีที่แล้ว</button>
        </div>
        <div className="date-range-fields">
          <label><span>จากวันที่</span><input type="date" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} /></label>
          <label><span>ถึงวันที่</span><input type="date" value={draft.to} min={draft.from || undefined} onChange={(event) => setDraft({ ...draft, to: event.target.value })} /></label>
        </div>
        <div className="date-range-actions"><button type="button" className="text-button" onClick={() => setDraft({ from: "", to: "" })}>ล้างค่า</button><span /><button type="button" onClick={onClose}>ยกเลิก</button><button type="button" className="primary" onClick={apply}>บันทึก</button></div>
      </section>
  );
}

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
  const [sales, setSales] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<QuoteStatus[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [onsite, setOnsite] = useState<"" | "WITH" | "WITHOUT">("");
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const normalizedSearch = search.trim().toLocaleLowerCase("th-TH");
  const hasFilters = Boolean(normalizedSearch || sales.length || statuses.length || services.length || onsite || dateRange.from || dateRange.to);
  const salesPeople = useMemo(
    () => [...new Set(quotes.map((quote) => quote.sales_name?.trim()).filter(Boolean))].sort((a, b) => a!.localeCompare(b!, "th")) as string[],
    [quotes],
  );
  const counts = useMemo(
    () => Object.fromEntries(STATUS_ORDER.map((status) => [status, quotes.filter((quote) => quote.status === status).length])) as Record<QuoteStatus, number>,
    [quotes],
  );
  const serviceOptions = useMemo(
    () => [...new Set(quotes.flatMap((quote) => quote.recurring_addons || []))].sort((a, b) => a.localeCompare(b, "th")),
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
      const matchesSales = !sales.length || sales.includes(quote.sales_name || "");
      const matchesServices = !services.length || services.some((service) => quote.recurring_addons?.includes(service));
      const hasOnsite = Boolean(onsiteTraining(quote)?.quantity);
      const matchesOnsite = !onsite || (onsite === "WITH" ? hasOnsite : !hasOnsite);
      const matchesIssued = (!dateRange.from || quote.issued_at >= dateRange.from)
        && (!dateRange.to || quote.issued_at <= dateRange.to);
      return matchesSearch && matchesStatus && matchesSales && matchesServices && matchesOnsite && matchesIssued;
    }),
    [quotes, normalizedSearch, sales, statuses, services, onsite, dateRange],
  );

  const clearFilters = () => {
    setSearch("");
    setSales([]);
    setStatuses([]);
    setServices([]);
    setOnsite("");
    setDateRange({ from: "", to: "" });
  };
  const toggleValue = <T,>(value: T, current: T[], setValue: (next: T[]) => void) => setValue(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
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

      <details className="quotation-filter-disclosure" aria-label="ค้นหาและกรองรายการใบเสนอราคา">
        <summary><span aria-hidden="true">⌄</span> ค้นหาและตัวกรอง</summary>
        <div className="quotation-list-toolbar">
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
          <div className="date-range-control">
            <button type="button" className={`date-range-trigger${dateRange.from || dateRange.to ? " active" : ""}`} aria-haspopup="dialog" aria-expanded={dateRangeOpen} onClick={() => setDateRangeOpen((open) => !open)}><span>ช่วงวันที่ออกเอกสาร</span><strong>{displayRange(dateRange)}</strong></button>
            {dateRangeOpen && <DateRangePopover range={dateRange} onChange={setDateRange} onClose={() => setDateRangeOpen(false)} />}
          </div>
          <div className="list-toolbar-actions">
            <span>แสดง {filteredQuotes.length} จาก {quotes.length} รายการ</span>
            <button type="button" className="text-button" disabled={!hasFilters} onClick={clearFilters}>ล้างตัวกรอง</button>
          </div>
          </div>
          <div className="list-filter-groups">
            <fieldset><legend>สถานะ</legend>{STATUS_ORDER.map((status) => <label key={status}><input type="checkbox" checked={statuses.includes(status)} onChange={() => toggleStatus(status)} />{STATUS_TEXT[status]}</label>)}</fieldset>
            <fieldset><legend>ผู้เสนอราคา</legend>{salesPeople.length ? salesPeople.map((name) => <label key={name}><input type="checkbox" checked={sales.includes(name)} onChange={() => toggleValue(name, sales, setSales)} />{name}</label>) : <small>ยังไม่มีข้อมูล</small>}</fieldset>
            <fieldset><legend>บริการหลัก</legend>{serviceOptions.length ? serviceOptions.map((service) => <label key={service}><input type="checkbox" checked={services.includes(service)} onChange={() => toggleValue(service, services, setServices)} />{service}</label>) : <small>ยังไม่มีข้อมูล</small>}</fieldset>
            <fieldset><legend>นอกสถานที่</legend><label><input type="radio" name="onsite-filter" checked={!onsite} onChange={() => setOnsite("")} />ทั้งหมด</label><label><input type="radio" name="onsite-filter" checked={onsite === "WITH"} onChange={() => setOnsite("WITH")} />มีบริการ</label><label><input type="radio" name="onsite-filter" checked={onsite === "WITHOUT"} onChange={() => setOnsite("WITHOUT")} />ไม่มีบริการ</label></fieldset>
          </div>
        {hasFilters && (
          <div className="list-filter-chips" aria-live="polite" aria-label="ตัวกรองที่ใช้งาน">
            {normalizedSearch && <button type="button" onClick={() => setSearch("")}>ค้นหา: {search.trim()} <span aria-hidden="true">×</span></button>}
            {(dateRange.from || dateRange.to) && <button type="button" onClick={() => setDateRange({ from: "", to: "" })}>วันที่ออก: {displayRange(dateRange)} <span aria-hidden="true">×</span></button>}
            {sales.length > 0 && <button type="button" onClick={() => setSales([])}>ผู้เสนอราคา: {sales.join(", ")} <span aria-hidden="true">×</span></button>}
            {statuses.length > 0 && <button type="button" onClick={() => setStatuses([])}>สถานะ: {statuses.map((status) => STATUS_TEXT[status]).join(", ")} <span aria-hidden="true">×</span></button>}
            {services.length > 0 && <button type="button" onClick={() => setServices([])}>บริการ: {services.join(", ")} <span aria-hidden="true">×</span></button>}
            {onsite && <button type="button" onClick={() => setOnsite("")}>นอกสถานที่: {onsite === "WITH" ? "มีบริการ" : "ไม่มีบริการ"} <span aria-hidden="true">×</span></button>}
          </div>
        )}
        </div>
      </details>

      {loadError && (
        <div className="list-error" role="alert">
          <div><strong>โหลดรายการใบเสนอราคาไม่สำเร็จ</strong><span>{loadError}</span></div>
          <button type="button" disabled={busy} onClick={onRetry}>ลองใหม่</button>
        </div>
      )}

      {!loadError && quotes.length === 0 ? (
        <div className="empty empty-documents">
          <span aria-hidden="true">▤</span><h3>คลังเอกสารยังว่าง</h3><p>เริ่มสร้างใบเสนอราคาฉบับแรกเพื่อเพิ่มลงในคลังของคุณ</p>
          <button className="primary" onClick={onCreate}>สร้างใบเสนอราคา</button>
        </div>
      ) : filteredQuotes.length ? (
        <div className="list-grid-section"><QuotationGrid quotes={filteredQuotes} onSelect={onSelect} onAction={onAction} /></div>
      ) : !loadError ? (
        <div className="empty empty-search list-no-results">
          <span aria-hidden="true">⌕</span><h3>ไม่พบเอกสารในพื้นที่ค้นหา</h3><p>ลองเปลี่ยนคำค้นหา วันที่ หรือสถานะที่เลือก</p>
          <button type="button" onClick={clearFilters}>ล้างตัวกรอง</button>
        </div>
      ) : null}
    </>
  );
}
