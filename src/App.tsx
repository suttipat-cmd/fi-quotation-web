import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { displayDate, money, thaiBaht } from "./lib/format";
import { Brand } from "./components/ui/Brand";
import { Field } from "./components/ui/Field";
import { MoneyInput } from "./components/ui/MoneyInput";
import { Spinner } from "./components/ui/Spinner";
import { QuotationStatusBadge } from "./components/ui/QuotationStatusBadge";
import {
  CANCELLATION_REASONS,
  COMPANY_DOCUMENT_CONFIG,
  CUSTOM_FORM_LABEL,
  DEFAULT_PAYMENT_TERMS,
  ONSITE_TRAINING_LABEL,
  PAYMENT_OPTIONS,
  SETUP_LABEL,
  SOFTWARE_SERVICE_LABEL,
} from "./features/quotations/constants";
import {
  defaultQuotationItems,
  formFromQuotation,
  initialQuotationForm,
  makeServiceItem,
  normalizeQuotationItems,
  validateQuotationDraft,
} from "./features/quotations/domain/draft";
import { calculateCategoryTotals, calculateItemTotal, calculateQuotationTotals } from "./features/quotations/domain/calculator";
import { documentAddonName, documentServiceName } from "./features/quotations/domain/document";
import { quotationActions } from "./features/quotations/domain/status";
import { getQuotationItems, saveQuotationDraft } from "./features/quotations/services/quotation-service";
import { quotationPdfBaseName, sendQuotationEmail, uploadGeneratedPdf } from "./features/quotations/services/document-service";
import { createPreviewPdf } from "./features/quotations/services/preview-pdf";
import type { Profile, Quotation as Quote, QuotationForm as Form, QuotationItem as Item, Service } from "./features/quotations/types";

const QuotationGrid = lazy(() => import("./features/quotations/components/QuotationGrid"));

declare const __APP_BUILD_ID__: string;

type Toast = { text: string; type: "success" | "error" | "info" } | null;
type View = "dashboard" | "create" | "edit" | "detail" | "settings";
type Route = { view: View; id?: string };
type SettingTab = "company" | "services" | "payment_terms" | "bank_accounts";
type CompanySettings = {
  id: boolean;
  company_name: string;
  company_name_en: string | null;
  tax_id: string | null;
  branch: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  default_vat_rate: number;
  default_wht_rate: number;
  default_validity_days: number;
};
type PaymentTerm = { id: string; name: string; body: string; active: boolean; sort_order: number };
type BankAccount = { id: string; bank_name: string; account_name: string; account_number: string; branch: string | null; active: boolean; is_default: boolean };

const appBasePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const A4_WIDTH_PX = (210 / 25.4) * 96;
const A4_HEIGHT_PX = (297 / 25.4) * 96;
const routeFromLocation = (): Route => {
  const path = window.location.pathname
    .replace(appBasePath, "")
    .replace(/^\/+|\/+$/g, "");
  const [view, id] = path.split("/");
  if (view === "create") return { view: "create" };
  if (view === "settings") return { view: "settings" };
  if (view === "detail" && id) return { view: "detail", id };
  if (view === "edit" && id) return { view: "edit", id };
  return { view: "dashboard" };
};
const routePath = (view: View, id?: string) =>
  view === "dashboard"
    ? `${appBasePath}/`
    : `${appBasePath}/${view}${id ? `/${id}` : ""}`;
const revisionLabel = (revisionNo: number) =>
  revisionNo > 0 ? `ฉบับแก้ไข ${String(revisionNo).padStart(2, "0")}` : null;

const friendlyError = (message?: string) =>
  !message
    ? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
    : /invalid login/i.test(message)
      ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
      : /email not confirmed/i.test(message)
        ? "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ"
        : /network|fetch/i.test(message)
          ? "เชื่อมต่อระบบไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต"
          : message;
const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    for (const candidate of [value.message, value.details, value.hint, value.code]) {
      if (typeof candidate === "string" && candidate.trim()) return candidate;
    }
  }
  return undefined;
};
function Auth({ onSession }: { onSession: (value: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(signUp: boolean) {
    if (busy) return;
    if (!email || !password) {
      setMessage("กรุณาระบุอีเมลและรหัสผ่าน");
      return;
    }
    setBusy(true);
    const result = signUp
      ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: email.split("@")[0] } },
        })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) setMessage(friendlyError(result.error.message));
    else if (result.data.session) onSession(result.data.session);
    else setMessage("สร้างบัญชีแล้ว กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี");
  }
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Brand />
        <p className="eyebrow">ระบบจัดการใบเสนอราคา</p>
        <h1>
          สร้างใบเสนอราคา
          <br />
          ให้เป็นเรื่องง่าย
        </h1>
        <p className="muted">เข้าสู่ระบบด้วยบัญชีงานของคุณ</p>
        <Field label="อีเมล">
          <input
            disabled={busy}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="name@forwardinsight.co.th"
          />
        </Field>
        <Field label="รหัสผ่าน">
          <input
            disabled={busy}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            minLength={6}
          />
        </Field>
        <button
          className="primary full"
          disabled={busy}
          onClick={() => void submit(false)}
        >
          {busy && <Spinner />}เข้าสู่ระบบ
        </button>
        <button
          className="text-button full"
          disabled={busy}
          onClick={() => void submit(true)}
        >
          สร้างบัญชีผู้ใช้ใหม่
        </button>
        {message && <p className="auth-message">{message}</p>}
      </section>
    </main>
  );
}

function App() {
  const initialRoute = useRef<Route>(routeFromLocation());
  const restoredRoute = useRef(false);
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [view, setView] = useState<View>(initialRoute.current.view);
  const [selected, setSelected] = useState<Quote | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(initialQuotationForm());
  const [items, setItems] = useState<Item[]>([]);
  const [detailItems, setDetailItems] = useState<Item[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const locked = useRef(false);
  const detailPaperRef = useRef<HTMLElement | null>(null);
  const notify = (text: string, type: NonNullable<Toast>["type"] = "info") =>
    setToast({ text, type });
  const navigate = (next: View, id?: string, replace = false) => {
    const path = routePath(next, id);
    if (window.location.pathname !== path) {
      window.history[replace ? "replaceState" : "pushState"]({}, "", path);
    }
    setView(next);
  };
  useEffect(() => {
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    let cancelled = false;
    const checkForNewBuild = async () => {
      try {
        const response = await fetch(
          `${appBasePath}/version.json?cacheBust=${Date.now()}`,
          { cache: "no-store" },
        );
        const latest = await response.json();
        if (!cancelled && latest.build && latest.build !== __APP_BUILD_ID__) {
          const url = new URL(window.location.href);
          url.searchParams.set("v", latest.build);
          window.location.replace(url.toString());
        }
      } catch {
        // A network issue must not block normal use of the app.
      }
    };
    void checkForNewBuild();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setBooting(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setBooting(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (session) void load();
  }, [session]);
  useEffect(() => {
    if (!session || !profile || restoredRoute.current) return;
    const route = initialRoute.current;
    restoredRoute.current = true;
    if (route.view === "dashboard") return;
    if (route.view === "settings") {
      if (profile.role === "ADMIN") navigate("settings", undefined, true);
      else {
        notify("หน้านี้สำหรับผู้ดูแลระบบเท่านั้น", "error");
        navigate("dashboard", undefined, true);
      }
      return;
    }
    if (route.view === "create") {
      reset();
      navigate("create", undefined, true);
      return;
    }
    const quote = quotes.find((item) => item.id === route.id);
    if (!quote) {
      notify("ไม่พบใบเสนอราคาตามลิงก์ที่ระบุ", "error");
      navigate("dashboard", undefined, true);
      return;
    }
    if (route.view === "edit") void startEdit(quote);
    else void openDetail(quote);
  }, [session, profile, quotes]);
  async function load() {
    setLoading("กำลังโหลดข้อมูล");
    const [profileResult, servicesResult, quotesResult] = await Promise.all([
      supabase.from("profiles").select("*").single(),
      supabase
        .from("services")
        .select("*")
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("quotations")
        .select("*, quotation_revisions(pdf_drive_url, revision_no)")
        .order("created_at", { ascending: false }),
    ]);
    setLoading(null);
    // Master data must never hide quotations that were successfully loaded.
    // Each resource has an independent failure state so the dashboard remains usable.
    if (profileResult.error) {
      notify(`โหลดข้อมูลบัญชีไม่สำเร็จ: ${friendlyError(profileResult.error.message)}`, "error");
    } else {
      setProfile(profileResult.data);
    }
    if (quotesResult.error) {
      notify(`โหลดใบเสนอราคาไม่สำเร็จ: ${friendlyError(quotesResult.error.message)}`, "error");
    } else {
      setQuotes(
        (quotesResult.data || []).map((row: any) => ({
          ...row,
          pdf_drive_url: row.quotation_revisions?.find(
            (revision: any) => revision.revision_no === row.revision_no,
          )?.pdf_drive_url,
        })),
      );
    }
    if (servicesResult.error) {
      notify("โหลดรายการบริการไม่สำเร็จ แต่ใบเสนอราคาเดิมยังแสดงได้", "error");
    } else {
      setServices(servicesResult.data || []);
    }
  }
  const totals = useMemo(() => calculateQuotationTotals(form, items), [items, form]);
  async function run(label: string, task: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setLoading(label);
    try {
      await task();
    } catch (error) {
      notify(
        friendlyError(errorMessage(error)),
        "error",
      );
    } finally {
      locked.current = false;
      setLoading(null);
    }
  }
  const reset = () => {
    setForm(initialQuotationForm(profile?.display_name || ""));
    setItems(defaultQuotationItems(services));
    setSelected(null);
    setEditingId(null);
  };
  const updateItem = (id: string, patch: Partial<Item>) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  const chooseService = (id: string, serviceId: string) => {
    const service = services.find((value) => value.id === serviceId);
    if (service)
      updateItem(id, {
        service_id: service.id,
        service_name: service.name,
        billing_type: service.default_billing_type,
        calculation_mode: service.default_calculation_mode,
        unit: service.default_unit || "",
        unit_price_satang: 0,
      });
  };
  const addCustomForm = () => {
    const customForm = services.find(
      (service) => service.name === CUSTOM_FORM_LABEL,
    );
    if (!customForm) {
      notify("ไม่พบรายการ Custom Form ในรายการบริการ", "error");
      return;
    }
    setItems((current) => [
      ...current,
      makeServiceItem(customForm, 1),
    ]);
  };
  const removeItem = (id: string) =>
    setItems((current) => current.filter((item) => item.id !== id));
  async function startEdit(quote: Quote) {
    if (quote.status !== "DRAFT") {
      notify("แก้ไขได้เฉพาะใบเสนอราคาฉบับร่าง", "error");
      return;
    }
    await run("กำลังเปิดหน้าแก้ไข", async () => {
      const saved = await getQuotationItems(quote.id);
      setForm(formFromQuotation(quote));
      setItems(normalizeQuotationItems(saved, services));
      setSelected(quote);
      setEditingId(quote.id);
      navigate("edit", quote.id);
    });
  }
  async function openDetail(quote: Quote) {
    await run("กำลังเปิดรายละเอียดใบเสนอราคา", async () => {
      setDetailItems(await getQuotationItems(quote.id));
      setSelected(quote);
      navigate("detail", quote.id);
    });
  }
  async function save() {
    await run("กำลังบันทึกใบเสนอราคา", async () => {
      const validationError = validateQuotationDraft(items, form);
      if (validationError) {
        notify(validationError, "error");
        return;
      }
      const quote = await saveQuotationDraft({ form, items, totals, profile });
      setSelected(quote);
      setDetailItems(items);
      await load();
      navigate("detail", quote.id);
      notify(`${quote.document_no} บันทึกเป็นฉบับร่างแล้ว`, "success");
    });
  }
  async function saveEdit() {
    if (!editingId || !selected) return;
    await run("กำลังบันทึกการแก้ไข", async () => {
      const validationError = validateQuotationDraft(items, form);
      if (validationError) {
        notify(validationError, "error");
        return;
      }
      const quote = await saveQuotationDraft({ id: editingId, form, items, totals, profile });
      setSelected(quote);
      setDetailItems(items);
      setEditingId(null);
      await load();
      navigate("detail", quote.id);
      notify("บันทึกการแก้ไขเรียบร้อยแล้ว", "success");
    });
  }
  async function acceptQuotation() {
    if (!selected) return;
    if (!window.confirm("ยืนยันว่าลูกค้าตอบรับใบเสนอราคานี้แล้วใช่หรือไม่?")) return;
    await run("กำลังบันทึกการตอบรับ", async () => {
      const result = await supabase.rpc("change_quotation_status", {
        p_quotation_id: selected.id,
        p_status: "ACCEPTED",
      });
      if (result.error) throw result.error;
      setSelected(result.data);
      await load();
      notify("บันทึกการตอบรับเรียบร้อยแล้ว", "success");
    });
  }
  async function cancelQuotation(reason: string, note: string) {
    if (!selected) return;
    if (!window.confirm("ยืนยันการยกเลิกใบเสนอราคานี้ใช่หรือไม่? การดำเนินการนี้จะทำให้เอกสารดูได้อย่างเดียว")) return;
    await run("กำลังยกเลิกใบเสนอราคา", async () => {
      const result = await supabase.rpc("cancel_quotation", {
        p_quotation_id: selected.id,
        p_reason: reason,
        p_note: note || null,
      });
      if (result.error) throw result.error;
      setSelected(result.data);
      await load();
      notify("ยกเลิกใบเสนอราคาเรียบร้อยแล้ว", "success");
    });
  }
  async function revision() {
    if (
      !selected ||
      !window.confirm(
        `ต้องการสร้างฉบับแก้ไข ${String(selected.revision_no + 1).padStart(2, "0")} ใช่หรือไม่?`,
      )
    )
      return;
    await run("กำลังสร้างฉบับแก้ไข", async () => {
      const result = await supabase.rpc("create_quotation_revision", {
        p_quotation_id: selected.id,
      });
      if (result.error) throw result.error;
      setSelected(result.data);
      await load();
      notify("สร้างฉบับแก้ไขเรียบร้อยแล้ว", "success");
    });
  }
  async function documentAction(action: "generate_pdf" | "send_email") {
    if (!selected) return;
    const recipients = Array.isArray(selected.recipient_emails)
      ? selected.recipient_emails
      : selected.contact_email
        ? [selected.contact_email]
        : [];
    const question =
      action === "generate_pdf"
        ? "ยืนยันสร้าง PDF และบันทึกใน Google Drive ใช่หรือไม่?"
        : `ยืนยันส่งอีเมลพร้อม PDF ไปที่ ${recipients.join(", ") || "ผู้รับที่ระบุ"} ใช่หรือไม่?`;
    if (!window.confirm(question)) return;
    await run(
      action === "generate_pdf" ? "กำลังสร้าง PDF" : "กำลังส่งอีเมล",
      async () => {
        if (action === "generate_pdf") {
          if (!detailPaperRef.current) {
            throw new Error("ยังไม่พร้อมสร้าง PDF กรุณารอสักครู่แล้วลองใหม่");
          }
          const pdf = await createPreviewPdf(detailPaperRef.current);
          const result = await uploadGeneratedPdf(selected, pdf);
          if (!result.pdf_drive_url) throw new Error(result.message || "สร้าง PDF ไม่สำเร็จ");
          setSelected({
            ...selected,
            status: (result.status || "READY") as Quote["status"],
            pdf_drive_url: result.pdf_drive_url,
          });
        } else {
          await sendQuotationEmail({
            quotationId: selected.id,
            to: recipients,
            subject: `ใบเสนอราคา ${selected.document_no}`,
            message: `เรียน ${selected.contact_name || ""}\n\nขอส่งใบเสนอราคา ${selected.document_no} ตามเอกสารแนบ\n\nขอบคุณค่ะ\nForward Insight`,
          });
        }
        await load();
        notify(
          action === "generate_pdf"
            ? "สร้าง PDF เรียบร้อยแล้ว"
            : "ส่งอีเมลเรียบร้อยแล้ว",
          "success",
        );
      },
    );
  }
  async function printSelectedQuotation() {
    if (!selected) return;
    const previousTitle = document.title;
    document.title = quotationPdfBaseName(selected) || "ใบเสนอราคา";
    window.addEventListener("afterprint", () => { document.title = previousTitle; }, { once: true });
    window.print();
  }
  if (booting)
    return (
      <main className="page-loader">
        <Spinner />
        <span>กำลังเปิดระบบ</span>
      </main>
    );
  if (!session) return <Auth onSession={setSession} />;
  const busy = Boolean(loading);
  const nav = (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="side-top">
        <Brand hideText={collapsed} />
        <button
          className="icon-button"
          aria-label="ย่อหรือขยายเมนู"
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>
      <nav>
        <button
          className={view === "dashboard" ? "active" : ""}
          onClick={() => navigate("dashboard")}
        >
          <span>▦</span>
          <b>ภาพรวม</b>
        </button>
        <button
          className={view === "create" ? "active" : ""}
          onClick={() => {
            reset();
            navigate("create");
          }}
        >
          <span>＋</span>
          <b>สร้างใบเสนอราคา</b>
        </button>
        {profile?.role === "ADMIN" && (
          <button
            className={view === "settings" ? "active" : ""}
            onClick={() => navigate("settings")}
          >
            <span>⚙</span>
            <b>ตั้งค่า</b>
          </button>
        )}
      </nav>
      <div className="account">
        <strong>{profile?.display_name || session.user.email}</strong>
        <small>
          {profile?.role === "ADMIN"
            ? "ผู้ดูแลระบบ"
            : profile?.role === "SALE"
              ? "ฝ่ายขาย"
              : "ผู้ใช้งาน"}
        </small>
        <button
          className="text-button"
          disabled={busy}
          onClick={() =>
            void run("กำลังออกจากระบบ", async () => {
              const result = await supabase.auth.signOut();
              if (result.error) throw result.error;
              setSession(null);
            })
          }
        >
          <span>↪</span>
          <b>ออกจากระบบ</b>
        </button>
      </div>
    </aside>
  );
  return (
    <div className="app-shell">
      {nav}
      <main
        className={`work ${view === "create" || view === "edit" || view === "detail" ? "editor-work" : ""}`}
      >
        {view === "dashboard" && (
          <Dashboard
            quotes={quotes}
            busy={busy}
            onCreate={() => {
              reset();
              navigate("create");
            }}
            onSelect={(quote) => void openDetail(quote)}
          />
        )}
        {view === "create" && (
          <Editor
            mode="create"
            form={form}
            setForm={setForm}
            items={items}
            services={services}
            busy={busy}
            onSave={() => void save()}
            onCancel={() => navigate("dashboard")}
            onUpdate={updateItem}
            onAddCustomForm={addCustomForm}
            onRemoveItem={removeItem}
          />
        )}
        {view === "edit" && (
          <Editor
            mode="edit"
            form={form}
            setForm={setForm}
            items={items}
            services={services}
            busy={busy}
            onSave={() => void saveEdit()}
            onCancel={() => {
              setEditingId(null);
              navigate("detail", selected?.id);
            }}
            onUpdate={updateItem}
            onAddCustomForm={addCustomForm}
            onRemoveItem={removeItem}
          />
        )}
        {view === "detail" && selected && (
          <Detail
            quote={selected}
            items={detailItems}
            busy={busy}
            paperRef={detailPaperRef}
            onBack={() => navigate("dashboard")}
            onEdit={() => void startEdit(selected)}
            onRevision={() => void revision()}
            onPdf={() => void documentAction("generate_pdf")}
            onEmail={() => void documentAction("send_email")}
            onPrint={() => void printSelectedQuotation()}
            onAccept={() => void acceptQuotation()}
            onCancel={(reason, note) => void cancelQuotation(reason, note)}
          />
        )}
        {view === "settings" && profile?.role === "ADMIN" && (
          <Settings busy={busy} notify={notify} onSaved={() => void load()} />
        )}
        {view === "settings" && profile?.role !== "ADMIN" && (
          <Dashboard
            quotes={quotes}
            busy={busy}
            onCreate={() => {
              reset();
              navigate("create");
            }}
            onSelect={(quote) => void openDetail(quote)}
          />
        )}
      </main>
      {loading && (
        <div className="operation">
          <Spinner />
          {loading}
        </div>
      )}
      {toast && (
        <button
          className={`toast ${toast.type}`}
          onClick={() => setToast(null)}
        >
          {toast.type === "success" ? "✓" : toast.type === "error" ? "!" : "i"}
          <span>{toast.text}</span>
          <small>×</small>
        </button>
      )}
    </div>
  );
}

function EmailTags({
  emails,
  onChange,
}: {
  emails: string[];
  onChange: (emails: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim().toLowerCase();
    if (!value) return;
    if (!/^\S+@\S+\.\S+$/.test(value)) return;
    if (!emails.includes(value)) onChange([...emails, value]);
    setDraft("");
  };
  return (
    <label className="field">
      <span>อีเมลผู้รับเอกสาร</span>
      <div className="email-tags" onClick={(event) => event.currentTarget.querySelector("input")?.focus()}>
        {emails.map((email) => (
          <span key={email}>
            {email}
            <button
              type="button"
              aria-label={`ลบ ${email}`}
              onClick={() => onChange(emails.filter((item) => item !== email))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="email"
          value={draft}
          placeholder={emails.length ? "เพิ่มอีเมลแล้วกด Enter" : "พิมพ์อีเมลแล้วกด Enter"}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add();
            }
          }}
          onBlur={add}
        />
      </div>
      <small className="field-help">กด Enter เพื่อเพิ่มอีเมลได้มากกว่าหนึ่งรายการ</small>
    </label>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="form-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function Dashboard({
  quotes,
  busy,
  onCreate,
  onSelect,
}: {
  quotes: Quote[];
  busy: boolean;
  onCreate: () => void;
  onSelect: (quote: Quote) => void;
}) {
  const drafts = quotes.filter((quote) => quote.status === "DRAFT").length;
  return (
    <>
      <header className="topbar editor-topbar">
        <div>
          <p className="eyebrow">ภาพรวมระบบ</p>
          <h1>ใบเสนอราคาของคุณ</h1>
          <p className="muted">ติดตามและจัดการเอกสารได้จากที่เดียว</p>
        </div>
        <button className="primary" disabled={busy} onClick={onCreate}>
          ＋ สร้างใบเสนอราคา
        </button>
      </header>
      <section className="stats">
        <Stat label="เอกสารทั้งหมด" value={quotes.length} />
        <Stat label="ฉบับร่าง" value={drafts} />
        <Stat
          label="ยืนยันแล้ว"
          value={quotes.filter((quote) => quote.status === "READY").length}
        />
      </section>
      <section className="card table-card">
        <div className="section-heading">
          <div>
            <h2>เอกสารล่าสุด</h2>
          </div>
        </div>
        {quotes.length ? (
          <Suspense fallback={<div className="empty"><Spinner /><p>กำลังโหลดตารางข้อมูล</p></div>}>
            <QuotationGrid quotes={quotes} onSelect={onSelect} />
          </Suspense>
        ) : (
          <div className="empty">
            <span>◫</span>
            <h3>ยังไม่มีใบเสนอราคา</h3>
            <p>เริ่มสร้างใบเสนอราคาฉบับแรกของคุณได้เลย</p>
            <button className="primary" onClick={onCreate}>
              สร้างใบเสนอราคา
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function Settings({
  busy,
  notify,
  onSaved,
}: {
  busy: boolean;
  notify: (text: string, type?: NonNullable<Toast>["type"]) => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<SettingTab>("company");
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [settingServices, setSettingServices] = useState<Service[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    setLoadingSettings(true);
    const [companyResult, servicesResult, termsResult, banksResult] = await Promise.all([
      supabase.from("company_settings").select("*").eq("id", true).maybeSingle(),
      supabase.from("services").select("*").order("sort_order"),
      supabase.from("payment_terms").select("*").order("sort_order"),
      supabase.from("bank_accounts").select("*").order("is_default", { ascending: false }),
    ]);
    setLoadingSettings(false);
    const errors = [companyResult.error, servicesResult.error, termsResult.error, banksResult.error].filter(Boolean);
    if (errors.length) {
      notify(`โหลดข้อมูลตั้งค่าไม่สำเร็จ: ${friendlyError(errors[0]?.message)}`, "error");
      return;
    }
    setCompany(companyResult.data as CompanySettings | null);
    setSettingServices((servicesResult.data || []) as Service[]);
    setPaymentTerms((termsResult.data || []) as PaymentTerm[]);
    setBankAccounts((banksResult.data || []) as BankAccount[]);
  };

  useEffect(() => { void loadSettings(); }, []);

  const save = async () => {
    if (saving || busy) return;
    setSaving(true);
    try {
      let error: { message?: string } | null = null;
      if (tab === "company" && company) {
        ({ error } = await supabase.from("company_settings").update({
          company_name: company.company_name.trim(),
          company_name_en: company.company_name_en || null,
          tax_id: company.tax_id || null,
          branch: company.branch || null,
          address: company.address || null,
          phone: company.phone || null,
          email: company.email || null,
          website: company.website || null,
          default_vat_rate: Number(company.default_vat_rate || 0),
          default_wht_rate: Number(company.default_wht_rate || 0),
          default_validity_days: Number(company.default_validity_days || 30),
        }).eq("id", true));
      }
      if (tab === "services") {
        ({ error } = await supabase.from("services").upsert(settingServices.map((service, index) => ({
          id: service.id,
          code: service.code?.trim(),
          name: service.name.trim(),
          default_description: service.default_description || null,
          default_category: service.default_category,
          default_billing_type: service.default_billing_type,
          default_calculation_mode: service.default_calculation_mode,
          default_unit: service.default_unit || null,
          suggested_price_satang: service.suggested_price_satang || null,
          active: service.active !== false,
          sort_order: service.sort_order ?? (index + 1) * 10,
        }))));
      }
      if (tab === "payment_terms") {
        ({ error } = await supabase.from("payment_terms").upsert(paymentTerms.map((term, index) => ({
          id: term.id,
          name: term.name.trim(),
          body: term.body.trim(),
          active: term.active,
          sort_order: term.sort_order || (index + 1) * 10,
        }))));
      }
      if (tab === "bank_accounts") {
        ({ error } = await supabase.from("bank_accounts").upsert(bankAccounts.map((account) => ({
          id: account.id,
          bank_name: account.bank_name.trim(),
          account_name: account.account_name.trim(),
          account_number: account.account_number.trim(),
          branch: account.branch || null,
          active: account.active,
          is_default: account.is_default,
        }))));
      }
      if (error) throw error;
      notify("บันทึกการตั้งค่าเรียบร้อยแล้ว", "success");
      onSaved();
      await loadSettings();
    } catch (error) {
      notify(friendlyError(errorMessage(error)), "error");
    } finally {
      setSaving(false);
    }
  };

  const updateService = (id: string, patch: Partial<Service>) =>
    setSettingServices((current) => current.map((service) => service.id === id ? { ...service, ...patch } : service));
  const updateTerm = (id: string, patch: Partial<PaymentTerm>) =>
    setPaymentTerms((current) => current.map((term) => term.id === id ? { ...term, ...patch } : term));
  const updateBank = (id: string, patch: Partial<BankAccount>) =>
    setBankAccounts((current) => current.map((account) => account.id === id ? { ...account, ...patch } : account));
  const addService = () => setSettingServices((current) => [...current, {
    id: crypto.randomUUID(), code: `SERVICE_${Date.now()}`, name: "บริการใหม่", default_category: "ONE_TIME",
    default_billing_type: "ONE_TIME", default_calculation_mode: "FIXED_PRICE", default_unit: "ครั้ง",
    suggested_price_satang: null, active: true, sort_order: (current.length + 1) * 10,
  }]);
  const addTerm = () => setPaymentTerms((current) => [...current, {
    id: crypto.randomUUID(), name: "เงื่อนไขใหม่", body: "", active: true, sort_order: (current.length + 1) * 10,
  }]);
  const addBank = () => setBankAccounts((current) => [...current, {
    id: crypto.randomUUID(), bank_name: "", account_name: "", account_number: "", branch: null, active: true, is_default: current.length === 0,
  }]);

  return (
    <>
      <header className="topbar editor-topbar">
        <div>
          <p className="eyebrow">ผู้ดูแลระบบ</p>
          <h1>ตั้งค่าระบบ</h1>
          <p className="muted">จัดการข้อมูลตั้งต้นที่ใช้ในใบเสนอราคา</p>
        </div>
        <div className="actions">
          {tab === "services" && <button disabled={saving || busy} onClick={addService}>＋ เพิ่มบริการ</button>}
          {tab === "payment_terms" && <button disabled={saving || busy} onClick={addTerm}>＋ เพิ่มเงื่อนไข</button>}
          {tab === "bank_accounts" && <button disabled={saving || busy} onClick={addBank}>＋ เพิ่มบัญชี</button>}
          <button className="primary" disabled={saving || busy || loadingSettings} onClick={() => void save()}>
            {saving && <Spinner />}บันทึกการตั้งค่า
          </button>
        </div>
      </header>
      <section className="settings-tabs" aria-label="หมวดการตั้งค่า">
        {([
          ["company", "ข้อมูลบริษัท"],
          ["services", "บริการและราคา"],
          ["payment_terms", "เงื่อนไขชำระเงิน"],
          ["bank_accounts", "บัญชีธนาคาร"],
        ] as Array<[SettingTab, string]>).map(([value, label]) => (
          <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{label}</button>
        ))}
      </section>
      {loadingSettings ? <main className="page-loader"><Spinner /><span>กำลังโหลดการตั้งค่า</span></main> : (
        <section className="settings-panel">
          {tab === "company" && company && (
            <div className="settings-form">
              <div className="two"><Field label="ชื่อบริษัท"><input value={company.company_name} onChange={(event) => setCompany({ ...company, company_name: event.target.value })} /></Field><Field label="ชื่อบริษัท (อังกฤษ)"><input value={company.company_name_en || ""} onChange={(event) => setCompany({ ...company, company_name_en: event.target.value })} /></Field></div>
              <div className="two"><Field label="เลขประจำตัวผู้เสียภาษี"><input value={company.tax_id || ""} onChange={(event) => setCompany({ ...company, tax_id: event.target.value })} /></Field><Field label="สาขา"><input value={company.branch || ""} onChange={(event) => setCompany({ ...company, branch: event.target.value })} /></Field></div>
              <Field label="ที่อยู่"><textarea value={company.address || ""} onChange={(event) => setCompany({ ...company, address: event.target.value })} /></Field>
              <div className="three"><Field label="โทรศัพท์"><input value={company.phone || ""} onChange={(event) => setCompany({ ...company, phone: event.target.value })} /></Field><Field label="อีเมล"><input value={company.email || ""} onChange={(event) => setCompany({ ...company, email: event.target.value })} /></Field><Field label="เว็บไซต์"><input value={company.website || ""} onChange={(event) => setCompany({ ...company, website: event.target.value })} /></Field></div>
              <div className="three"><Field label="VAT เริ่มต้น (%)"><input type="number" min="0" max="100" value={company.default_vat_rate} onChange={(event) => setCompany({ ...company, default_vat_rate: Number(event.target.value) })} /></Field><Field label="หัก ณ ที่จ่ายเริ่มต้น (%)"><input type="number" min="0" max="100" value={company.default_wht_rate} onChange={(event) => setCompany({ ...company, default_wht_rate: Number(event.target.value) })} /></Field><Field label="อายุใบเสนอราคาเริ่มต้น (วัน)"><input type="number" min="1" value={company.default_validity_days} onChange={(event) => setCompany({ ...company, default_validity_days: Number(event.target.value) })} /></Field></div>
            </div>
          )}
          {tab === "services" && <div className="settings-list">{settingServices.map((service) => <article className="settings-row" key={service.id}><div className="two"><Field label="รหัสบริการ"><input value={service.code || ""} onChange={(event) => updateService(service.id, { code: event.target.value })} /></Field><Field label="ชื่อบริการ"><input value={service.name} onChange={(event) => updateService(service.id, { name: event.target.value })} /></Field></div><div className="four"><Field label="ประเภท"><select value={service.default_category} onChange={(event) => updateService(service.id, { default_category: event.target.value as Service["default_category"] })}><option value="RECURRING">รายเดือน</option><option value="ONE_TIME">ครั้งเดียว</option></select></Field><Field label="หน่วย"><input value={service.default_unit || ""} onChange={(event) => updateService(service.id, { default_unit: event.target.value })} /></Field><Field label="ราคาแนะนำ (บาท)"><MoneyInput value={service.suggested_price_satang || 0} onChange={(value) => updateService(service.id, { suggested_price_satang: value })} /></Field><label className="toggle-field"><input type="checkbox" checked={service.active !== false} onChange={(event) => updateService(service.id, { active: event.target.checked })} /> เปิดใช้งาน</label></div></article>)}</div>}
          {tab === "payment_terms" && <div className="settings-list">{paymentTerms.map((term) => <article className="settings-row" key={term.id}><Field label="ชื่อเงื่อนไข"><input value={term.name} onChange={(event) => updateTerm(term.id, { name: event.target.value })} /></Field><Field label="เนื้อหา"><textarea value={term.body} onChange={(event) => updateTerm(term.id, { body: event.target.value })} /></Field><label className="toggle-field"><input type="checkbox" checked={term.active} onChange={(event) => updateTerm(term.id, { active: event.target.checked })} /> เปิดใช้งาน</label></article>)}</div>}
          {tab === "bank_accounts" && <div className="settings-list">{bankAccounts.map((account) => <article className="settings-row" key={account.id}><div className="two"><Field label="ธนาคาร"><input value={account.bank_name} onChange={(event) => updateBank(account.id, { bank_name: event.target.value })} /></Field><Field label="ชื่อบัญชี"><input value={account.account_name} onChange={(event) => updateBank(account.id, { account_name: event.target.value })} /></Field></div><div className="two"><Field label="เลขที่บัญชี"><input value={account.account_number} onChange={(event) => updateBank(account.id, { account_number: event.target.value })} /></Field><Field label="สาขา"><input value={account.branch || ""} onChange={(event) => updateBank(account.id, { branch: event.target.value })} /></Field></div><div className="settings-toggles"><label className="toggle-field"><input type="checkbox" checked={account.active} onChange={(event) => updateBank(account.id, { active: event.target.checked })} /> เปิดใช้งาน</label><label className="toggle-field"><input type="radio" name="default-bank" checked={account.is_default} onChange={() => setBankAccounts((current) => current.map((item) => ({ ...item, is_default: item.id === account.id })))} /> บัญชีเริ่มต้น</label></div></article>)}</div>}
        </section>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <article className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>รายการ</small>
    </article>
  );
}

function Editor({
  mode,
  form,
  setForm,
  items,
  services,
  busy,
  onSave,
  onCancel,
  onUpdate,
  onAddCustomForm,
  onRemoveItem,
}: {
  mode: "create" | "edit";
  form: Form;
  setForm: (form: Form) => void;
  items: Item[];
  services: Service[];
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
  onUpdate: (id: string, patch: Partial<Item>) => void;
  onAddCustomForm: () => void;
  onRemoveItem: (id: string) => void;
}) {
  const patch = (value: Partial<Form>) => setForm({ ...form, ...value });
  const limitNotesToNineLines = (value: string) => value.replace(/\r/g, "").split("\n").slice(0, 9).join("\n");
  return (
    <>
      <header className="topbar editor-topbar">
        <div>
          <p className="eyebrow">
            {mode === "create" ? "ใบเสนอราคาใหม่" : "แก้ไขใบเสนอราคา"}
          </p>
          <h1>{mode === "create" ? "สร้างใบเสนอราคา" : "แก้ไขใบเสนอราคา"}</h1>
          <p className="muted">
            {mode === "create"
              ? "บันทึกเป็นฉบับร่างก่อนยืนยันสร้าง PDF"
              : "แก้ไขข้อมูลฉบับร่างก่อนยืนยันสร้าง PDF"}
          </p>
        </div>
        <div className="actions">
          <button disabled={busy} onClick={onCancel}>
            ยกเลิก
          </button>
          <button className="primary" disabled={busy} onClick={onSave}>
            {busy && <Spinner />}
            {mode === "create" ? "บันทึกฉบับร่าง" : "บันทึกการแก้ไข"}
          </button>
        </div>
      </header>
      <div className="editor">
        <section className="form-panel">
          <Section title="ข้อมูลเอกสาร">
            <div className="two">
              <Field label="วันที่ออกเอกสาร">
                <input
                  type="date"
                  value={form.issued_at}
                  onChange={(event) => patch({ issued_at: event.target.value })}
                />
              </Field>
              <Field label="ใช้ได้ถึง">
                <input
                  type="date"
                  value={form.valid_until}
                  onChange={(event) =>
                    patch({ valid_until: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="ผู้เสนอราคา">
              <input
                value={form.sales_name}
                onChange={(event) => patch({ sales_name: event.target.value })}
              />
            </Field>
          </Section>
          <Section title="ข้อมูลลูกค้า">
            <Field label="ชื่อลูกค้า">
              <input
                value={form.customer_name}
                placeholder="บริษัท … จำกัด"
                onChange={(event) =>
                  patch({ customer_name: event.target.value })
                }
              />
            </Field>
            <Field label="ที่อยู่">
              <textarea
                value={form.customer_address}
                onChange={(event) =>
                  patch({ customer_address: event.target.value })
                }
              />
            </Field>
          </Section>
          <Section title="ข้อมูลผู้รับเอกสาร">
            <div className="two">
              <Field label="ผู้รับ">
                <input
                  value={form.contact_name}
                  onChange={(event) =>
                    patch({ contact_name: event.target.value })
                  }
                />
              </Field>
              <Field label="ตำแหน่ง">
                <input
                  value={form.contact_position}
                  onChange={(event) =>
                    patch({ contact_position: event.target.value })
                  }
                />
              </Field>
            </div>
            <EmailTags
              emails={form.recipient_emails}
              onChange={(recipient_emails) =>
                patch({
                  recipient_emails,
                  contact_email: recipient_emails[0] || "",
                })
              }
            />
          </Section>
          <RecurringPlan
            form={form}
            patch={patch}
            item={items.find((item) => item.category === "RECURRING")!}
            services={services}
            onUpdate={onUpdate}
          />
          <OneTimeItems
            items={items.filter((item) => item.category === "ONE_TIME")}
            onUpdate={onUpdate}
            onAddCustomForm={onAddCustomForm}
            onRemoveItem={onRemoveItem}
          />
          <Section title="ส่วนลดและภาษี">
            <div className="two">
              <Field label="รูปแบบส่วนลด">
                <select
                  value={form.quotation_discount_type}
                  onChange={(event) =>
                    patch({ quotation_discount_type: event.target.value })
                  }
                >
                  <option value="NONE">ไม่มีส่วนลด</option>
                  <option value="PERCENTAGE">เปอร์เซ็นต์</option>
                  <option value="FIXED_AMOUNT">จำนวนเงิน</option>
                </select>
              </Field>
              <Field
                label={
                  form.quotation_discount_type === "PERCENTAGE"
                    ? "ส่วนลด (%)"
                    : "ส่วนลด (บาท)"
                }
              >
                <input
                  disabled={form.quotation_discount_type === "NONE"}
                  type="number"
                  min="0"
                  value={form.quotation_discount_value}
                  onChange={(event) =>
                    patch({
                      quotation_discount_value: Number(event.target.value),
                    })
                  }
                />
              </Field>
              <Field label="ภาษีมูลค่าเพิ่ม (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.vat_rate}
                  onChange={(event) =>
                    patch({ vat_rate: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="หัก ณ ที่จ่าย">
                <select
                  value={form.wht_rate}
                  onChange={(event) =>
                    patch({ wht_rate: Number(event.target.value) })
                  }
                >
                  <option value="0">ไม่หัก ณ ที่จ่าย</option>
                  <option value="3">หัก ณ ที่จ่าย 3%</option>
                </select>
              </Field>
            </div>
          </Section>
          <Section title="หมายเหตุในเอกสาร">
            <Field label="หมายเหตุ">
              <textarea
                value={form.notes}
                rows={9}
                onChange={(event) => patch({ notes: limitNotesToNineLines(event.target.value) })}
              />
            </Field>
          </Section>
        </section>
        <Preview form={form} items={items} />
      </div>
    </>
  );
}

function RecurringPlan({
  form,
  patch,
  item,
  services,
  onUpdate,
}: {
  form: Form;
  patch: (value: Partial<Form>) => void;
  item: Item;
  services: Service[];
  onUpdate: (id: string, patch: Partial<Item>) => void;
}) {
  const recurring = services.filter(
    (service) => service.default_category === "RECURRING",
  );
  const toggle = (key: "billing_cycles" | "recurring_addons", value: string) =>
    patch({
      [key]: form[key].includes(value)
        ? form[key].filter((option) => option !== value)
        : [...form[key], value],
    } as Partial<Form>);
  return (
    <Section title={SOFTWARE_SERVICE_LABEL}>
      <p className="muted section-note">
        เลือกบริการหลักที่รวมในแพ็กเกจจาก checkbox โดยระบบจะแสดงเป็นราคา
        ค่าบริการซอฟต์แวร์หนึ่งรายการในใบเสนอราคา
      </p>
      <fieldset className="check-field">
        <legend>รอบชำระค่าบริการ</legend>
        <div className="check-grid">
          {PAYMENT_OPTIONS.map((option) => (
            <label className="check-row" key={option}>
              <input
                type="checkbox"
                checked={form.billing_cycles.includes(option)}
                onChange={() => toggle("billing_cycles", option)}
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="check-field">
        <legend>บริการหลักที่รวมในแพ็กเกจ</legend>
        <div className="check-grid">
          {recurring.length ? (
            recurring.map((service) => (
              <label className="check-row" key={service.id}>
                <input
                  type="checkbox"
                  checked={form.recurring_addons.includes(service.name)}
                  onChange={() => toggle("recurring_addons", service.name)}
                />
                {service.name}
              </label>
            ))
          ) : (
            <span className="muted">ยังไม่มีบริการประจำในรายการบริการ</span>
          )}
        </div>
      </fieldset>
      <div className="two">
        <Field label="จำนวนรถ">
          <input
            type="number"
            min="0"
            value={form.package_reference_quantity || ""}
            placeholder="ระบุจำนวนรถ"
            onChange={(event) =>
              patch({
                package_reference_quantity: Number(event.target.value),
                package_reference_unit: "คัน",
              })
            }
          />
        </Field>
        <Field label="ราคารวม (บาท)">
          <MoneyInput
            value={item.unit_price_satang}
            onChange={(unit_price_satang) =>
              onUpdate(item.id, {
                unit_price_satang,
                calculation_mode: "FIXED_PRICE",
              })
            }
          />
        </Field>
      </div>
    </Section>
  );
}
function OneTimeItems({
  items,
  onUpdate,
  onAddCustomForm,
  onRemoveItem,
}: {
  items: Item[];
  onUpdate: (id: string, patch: Partial<Item>) => void;
  onAddCustomForm: () => void;
  onRemoveItem: (id: string) => void;
}) {
  const hasCustomForm = items.some(
    (item) => item.service_name === CUSTOM_FORM_LABEL,
  );
  return (
    <Section title="ค่าบริการชำระครั้งเดียว (ค่าแรกเข้า)">
      <div className="section-heading">
        <p className="muted">
          Setup มีทะเบียนรถและข้อมูลทั่วไปรวมอยู่ในรายการเดียว สามารถแก้ไขจำนวน
          และราคาได้
        </p>
        <button
          className="small-button"
          type="button"
          disabled={hasCustomForm}
          onClick={onAddCustomForm}
        >
          {hasCustomForm ? "เพิ่ม Custom Form แล้ว" : "+ เพิ่ม Custom Form"}
        </button>
      </div>
      {items.map((item, index) => (
        <article className="item-editor" key={item.id}>
          <b className="item-number">{index + 1}</b>
          <div>
            <Field label="บริการ">
              <input value={item.service_name} readOnly />
            </Field>
            {item.service_name === SETUP_LABEL && (
              <p className="item-detail">รวม: ทะเบียนรถ และข้อมูลทั่วไป</p>
            )}
            <div
              className={
                item.service_name === ONSITE_TRAINING_LABEL ? "two" : "three"
              }
            >
              <Field label="จำนวน">
                <input
                  type="number"
                  min="0"
                  value={item.quantity}
                  onChange={(event) =>
                    onUpdate(item.id, {
                      quantity: Number(event.target.value),
                      calculation_mode: "QUANTITY_X_UNIT_PRICE",
                    })
                  }
                />
              </Field>
              <Field label="หน่วย">
                <input
                  value={item.unit}
                  onChange={(event) =>
                    onUpdate(item.id, { unit: event.target.value })
                  }
                />
              </Field>
              {item.service_name !== ONSITE_TRAINING_LABEL && (
                <Field label="ราคา/หน่วย">
                  <MoneyInput
                    value={item.unit_price_satang}
                    onChange={(unit_price_satang) =>
                      onUpdate(item.id, {
                        unit_price_satang,
                        calculation_mode:
                          item.quantity > 1
                            ? "QUANTITY_X_UNIT_PRICE"
                            : "FIXED_PRICE",
                      })
                    }
                  />
                </Field>
              )}
            </div>
          </div>
          <div className="item-total">
            <strong>{money(calculateItemTotal(item).net)}</strong>
            {item.service_name === CUSTOM_FORM_LABEL && (
              <button
                className="text-button danger-text"
                type="button"
                onClick={() => onRemoveItem(item.id)}
              >
                ลบ
              </button>
            )}
          </div>
        </article>
      ))}
    </Section>
  );
}

function Preview({
  form,
  items,
  quotation,
  paperRef: externalPaperRef,
}: {
  form: Form;
  items: Item[];
  quotation?: Quote | null;
  paperRef?: { current: HTMLElement | null };
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [isPaperOverflow, setIsPaperOverflow] = useState(false);
  const totals = useMemo(() => calculateQuotationTotals(form, items), [form, items]);
  const group = (category: Item["category"]) => calculateCategoryTotals(category, form, items, totals);
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const updateScale = () => setScale(Math.min(1, node.clientWidth / A4_WIDTH_PX));
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const checkOverflow = () => {
      const paper = paperRef.current?.querySelector<HTMLElement>(".quotation-paper");
      setIsPaperOverflow(Boolean(paper && paper.scrollHeight > paper.clientHeight + 1));
    };
    const frame = requestAnimationFrame(checkOverflow);
    const observer = new ResizeObserver(checkOverflow);
    if (paperRef.current) observer.observe(paperRef.current);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [form, items, totals, scale]);
  return (
    <aside className="preview-panel">
      <p className="preview-label">ตัวอย่างใบเสนอราคา</p>
      {isPaperOverflow && <p className="preview-overflow" role="alert">เนื้อหาเกิน 1 หน้า A4 — ลดหรือย่อข้อความหมายเหตุก่อนบันทึก PDF</p>}
      <div className="preview-scroll" ref={scrollRef}>
        <div className="preview-paper-frame" style={{ width: `${A4_WIDTH_PX * scale}px`, height: `${A4_HEIGHT_PX * scale}px` }}>
          <div className="preview-paper-scale" ref={paperRef} style={{ transform: `scale(${scale})` }}>
            <QuotePaper form={form} items={items} group={group} documentNo={quotation?.document_no} paperRef={externalPaperRef} />
          </div>
        </div>
      </div>
    </aside>
  );
}

function QuotePaper({ form, items, group, documentNo, paperRef }: { form: Form; items: Item[]; group: (category: Item["category"]) => ReturnType<typeof calculateCategoryTotals>; documentNo?: string; paperRef?: { current: HTMLElement | null } }) {
  return (
    <article className="paper quotation-paper" ref={paperRef}>
      <div className="document-topline">
        <div className="document-company"><Brand /><div><b>{COMPANY_DOCUMENT_CONFIG.name}</b><span>{COMPANY_DOCUMENT_CONFIG.addressLine1}</span><span>{COMPANY_DOCUMENT_CONFIG.addressLine2}</span><span>เลขที่ประจำตัวผู้เสียภาษี {COMPANY_DOCUMENT_CONFIG.taxId}</span></div></div>
        <div className="document-title"><h2>ใบเสนอราคา</h2><span>QUOTATION</span></div>
      </div>
      <dl className="document-facts"><div><dt>เลขที่</dt><dd>{documentNo || "จะออกเมื่อบันทึก"}</dd></div><div><dt>วันที่</dt><dd>{displayDate(form.issued_at)}</dd></div><div><dt>ใช้ได้ถึง</dt><dd>{displayDate(form.valid_until)}</dd></div></dl>
      <div className="document-customer"><div><span>ลูกค้า</span><p>{form.customer_name || "ชื่อลูกค้า"}</p></div><div><span>ที่อยู่</span><p>{form.customer_address || "ที่อยู่ลูกค้า"}</p></div></div>
      <PriceBlock category="RECURRING" form={form} items={items} summary={group("RECURRING")} />
      <PriceBlock category="ONE_TIME" form={form} items={items} summary={group("ONE_TIME")} />
      <div className="document-footer-grid">
        <section className="document-notes"><h3>หมายเหตุ</h3>{form.notes && <p className="multiline">{form.notes}</p>}</section>
        <section className="document-payment-terms"><h3>เงื่อนไขการชำระเงิน</h3><p className="multiline">{form.payment_terms || DEFAULT_PAYMENT_TERMS}</p></section>
        <section className="document-payment-info"><h3>ข้อมูลการชำระเงิน</h3><p className="multiline">{COMPANY_DOCUMENT_CONFIG.payment}</p></section>
      </div>
      <div className="signatures compact-signatures">
        <div><h3>ยืนยันรับข้อเสนอ</h3><span><label>ลงชื่อ</label><i /></span><span><label>วันที่</label><i /></span></div>
        <div><h3>ผู้เสนอราคา</h3><span><label>ลงชื่อ</label><i>{form.sales_name && <b>{form.sales_name}</b>}</i></span><span><label>วันที่</label><i><b>{displayDate(form.issued_at)}</b></i></span></div>
      </div>
    </article>
  );
}

function PriceBlock({ category, form, items, summary }: { category: Item["category"]; form: Form; items: Item[]; summary: ReturnType<typeof calculateCategoryTotals> }) {
  const rows = items.filter((item) => item.category === category && item.service_name.trim());
  const recurring = category === "RECURRING";
  const main = rows[0];
  return (
    <section className={`price-block ${recurring ? "recurring-price-block" : "one-time-price-block"}`}>
      <div className="price-title"><h3>{recurring ? `1. ${form.billing_cycles.join(" / ") || SOFTWARE_SERVICE_LABEL}` : "2. ค่าบริการชำระครั้งเดียว (ค่าแรกเข้า)"}</h3></div>
      <div className="mini-head"><span>รายละเอียด</span><span>{recurring ? "จำนวนรถ" : "จำนวน"}</span><span>ราคารวม</span></div>
      <div className="price-rows">{recurring ? <div className="mini-row"><span className="service-cell">{documentServiceName(main?.service_name)}{form.recurring_addons.length > 0 && <small>{form.recurring_addons.map(documentAddonName).join(", ")}</small>}</span><span>{form.package_reference_quantity || "—"} คัน</span><b>{money(summary.subtotal)}</b></div> : rows.length ? rows.map((item, index) => <div className="mini-row" key={item.id}><span className="service-cell">{index + 1}. {item.service_name}{item.service_name === SETUP_LABEL && <small>ทะเบียนรถ, ข้อมูลทั่วไป</small>}</span><span>{item.quantity} {item.unit}</span><b>{money(calculateItemTotal(item).net)}</b></div>) : <div className="mini-row muted"><span>ยังไม่มีรายการ</span><span>—</span><b>—</b></div>}</div>
      <div className="price-summary price-summary-card"><span className="summary-kicker">สรุปค่าบริการ</span><p><span>รวมก่อนภาษี</span><b>{money(summary.subtotal)}</b></p>{summary.discount > 0 && <p><span>ส่วนลด</span><b>-{money(summary.discount)}</b></p>}<p><span>หัก ณ ที่จ่าย {form.wht_rate}%</span><b>-{money(summary.wht)}</b></p><p><span>ภาษีมูลค่าเพิ่ม {form.vat_rate}%</span><b>{money(summary.vat)}</b></p><p className="net"><span>ยอดรวมสุทธิ</span><b>{money(summary.net)}</b></p></div>
      <p className="table-amount-in-words">{thaiBaht(summary.net)}</p>
    </section>
  );
}

function Detail({
  quote,
  items,
  busy,
  paperRef,
  onBack,
  onEdit,
  onRevision,
  onPdf,
  onEmail,
  onPrint,
  onAccept,
  onCancel,
}: {
  quote: Quote;
  items: Item[];
  busy: boolean;
  paperRef: { current: HTMLElement | null };
  onBack: () => void;
  onEdit: () => void;
  onRevision: () => void;
  onPdf: () => void;
  onEmail: () => void;
  onPrint: () => void;
  onAccept: () => void;
  onCancel: (reason: string, note: string) => void;
}) {
  const [showCancellation, setShowCancellation] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationNote, setCancellationNote] = useState("");
  const form = formFromQuotation(quote);
  const actions = quotationActions(quote.status);
  const emailReady =
    Boolean(quote.pdf_drive_url) &&
    Boolean(quote.recipient_emails?.length || quote.contact_email);
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">รายละเอียดใบเสนอราคา</p>
          <h1>
            {quote.document_no}
            {revisionLabel(quote.revision_no) && <small> {revisionLabel(quote.revision_no)}</small>}
          </h1>
          <p className="muted">{quote.customer_name}</p>
        </div>
        <div className="actions">
          <button disabled={busy} onClick={onBack}>
            กลับรายการ
          </button>
          {quote.status === "DRAFT" && (
            <button disabled={busy} onClick={onEdit}>
              แก้ไขฉบับร่าง
            </button>
          )}
          {actions.canCreateRevision && (
            <button disabled={busy} onClick={onRevision}>
              สร้างฉบับแก้ไข
            </button>
          )}
          {quote.status === "DRAFT" && (
            <button className="primary" disabled={busy} onClick={onPdf}>
              ยืนยันสร้าง PDF
            </button>
          )}
          {actions.canSendEmail && (
            <button
              disabled={busy || !emailReady}
              title={!emailReady ? "ต้องมีไฟล์ PDF บน Google Drive และอีเมลผู้รับก่อน" : undefined}
              onClick={onEmail}
            >
              ส่งอีเมล
            </button>
          )}
          {actions.canPrint && (
            <button type="button" disabled={busy} onClick={onPrint}>
              พิมพ์
            </button>
          )}
          {quote.status === "READY" && (
            <button className="primary" disabled={busy} onClick={onAccept}>
              บันทึกลูกค้าตอบรับ
            </button>
          )}
          {actions.canCancel && !showCancellation && (
            <button className="danger" disabled={busy} onClick={() => setShowCancellation(true)}>
              ยกเลิกใบเสนอราคา
            </button>
          )}
        </div>
      </header>
      <div className="editor detail-editor">
        <section className="form-panel">
          <Section title="สถานะเอกสาร">
          <QuotationStatusBadge status={quote.status} />
          <h2 className="detail-total">{money(quote.net_amount_satang ?? 0)}</h2>
          <p className="muted">ยอดสุทธิของเอกสาร</p>
          <hr />
          <dl>
            <dt>ลูกค้า</dt>
            <dd>{quote.customer_name}</dd>
            <dt>ผู้ติดต่อ</dt>
            <dd>{quote.contact_name || "—"}</dd>
            <dt>ตำแหน่ง</dt>
            <dd>{quote.contact_position || "—"}</dd>
            <dt>อีเมล</dt>
            <dd>
              {Array.isArray(quote.recipient_emails) && quote.recipient_emails.length
                ? quote.recipient_emails.join(", ")
                : quote.contact_email || "—"}
            </dd>
            <dt>ไฟล์ PDF</dt>
            <dd>
              {quote.pdf_drive_url ? (
                <a target="_blank" rel="noreferrer" href={quote.pdf_drive_url}>
                  เปิดไฟล์จาก Google Drive
                </a>
              ) : (
                "ยังไม่ได้สร้าง PDF"
              )}
            </dd>
            {quote.status === "CANCELLED" && (
              <>
                <dt>เหตุผลยกเลิก</dt>
                <dd>{quote.cancellation_reason || "—"}</dd>
                {quote.cancellation_note && (
                  <>
                    <dt>หมายเหตุ</dt>
                    <dd>{quote.cancellation_note}</dd>
                  </>
                )}
              </>
            )}
          </dl>
          </Section>
          {showCancellation && (
            <Section title="ยืนยันการยกเลิกใบเสนอราคา">
            <div className="cancellation-form">
              <label className="field">
                <span>เหตุผลการยกเลิก <em>*</em></span>
                <select
                  value={cancellationReason}
                  onChange={(event) => setCancellationReason(event.target.value)}
                >
                  <option value="">เลือกเหตุผล</option>
                  {CANCELLATION_REASONS.map((reason) => (
                    <option value={reason} key={reason}>{reason}</option>
                  ))}
                </select>
              </label>
              {cancellationReason === "อื่น ๆ" && (
                <label className="field">
                  <span>หมายเหตุการยกเลิก <em>*</em></span>
                  <textarea
                    value={cancellationNote}
                    onChange={(event) => setCancellationNote(event.target.value)}
                    placeholder="ระบุเหตุผลเพิ่มเติม"
                  />
                </label>
              )}
              <div className="inline-actions">
                <button type="button" disabled={busy} onClick={() => setShowCancellation(false)}>
                  กลับ
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={
                    busy ||
                    !cancellationReason ||
                    (cancellationReason === "อื่น ๆ" && !cancellationNote.trim())
                  }
                  onClick={() => onCancel(cancellationReason, cancellationNote)}
                >
                  ยืนยันยกเลิก
                </button>
              </div>
            </div>
            </Section>
          )}
          {quote.status === "CANCELLED" && (
            <p className="muted">เอกสารที่ยกเลิกแล้วดูรายละเอียดได้อย่างเดียว</p>
          )}
          {quote.status === "EXPIRED" && (
            <p className="muted">เอกสารหมดอายุตามวันใช้ได้ถึง และสามารถยกเลิกเพื่อปิดรายการได้</p>
          )}
        </section>
        <Preview form={form} items={items} quotation={quote} paperRef={paperRef} />
      </div>
    </>
  );
}
export default App;
