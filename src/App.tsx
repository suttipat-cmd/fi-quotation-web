import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import logo from "./assets/forward-insight-logo.png";

type Category = "RECURRING" | "ONE_TIME";
type Service = {
  id: string;
  name: string;
  default_category: Category;
  default_billing_type: string;
  default_calculation_mode: string;
  default_unit: string | null;
  suggested_price_satang: number | null;
};
type Item = {
  id: string;
  category: Category;
  service_id: string | null;
  service_name: string;
  billing_type: string;
  calculation_mode: string;
  reference_quantity: number;
  quantity: number;
  unit: string;
  unit_price_satang: number;
  manual_amount_satang: number;
  discount_type: string;
  discount_value: number;
};
type Quote = Record<string, any>;
type Form = {
  customer_name: string;
  customer_address: string;
  contact_name: string;
  contact_email: string;
  sales_name: string;
  issued_at: string;
  valid_until: string;
  notes: string;
  payment_terms: string;
  vat_rate: number;
  wht_rate: number;
  quotation_discount_type: string;
  quotation_discount_value: number;
  package_reference_quantity: number;
  package_reference_unit: string;
  included_users: number;
  billing_cycles: string[];
  recurring_addons: string[];
  additional_fees: string;
  promotion_terms: string;
};
type Toast = { text: string; type: "success" | "error" | "info" } | null;
type View = "dashboard" | "create" | "edit" | "detail";
type Route = { view: View; id?: string };

const appBasePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const routeFromLocation = (): Route => {
  const path = window.location.pathname
    .replace(appBasePath, "")
    .replace(/^\/+|\/+$/g, "");
  const [view, id] = path.split("/");
  if (view === "create") return { view: "create" };
  if (view === "detail" && id) return { view: "detail", id };
  if (view === "edit" && id) return { view: "edit", id };
  return { view: "dashboard" };
};
const routePath = (view: View, id?: string) =>
  view === "dashboard"
    ? `${appBasePath}/`
    : `${appBasePath}/${view}${id ? `/${id}` : ""}`;

const paymentOptions = [
  "ค่าบริการชำระรายเดือน",
  "ค่าบริการชำระราย 6 เดือน",
  "ค่าบริการชำระรายปี",
];
const softwareServiceLabel = "ค่าบริการซอฟแวร์ระบบ";
const setupChildServices = ["Setup ทะเบียนรถ", "Setup ข้อมูลทั่วไป"];
const setupLabel = "Setup";
const customFormLabel = "Custom Form";
const onsiteTrainingLabel = "Onsite Training";
const company = {
  name: "บริษัท ฟอร์เวิร์ด อินไซต์ จำกัด",
  address:
    "38 ซอย เฉลิมพระเกียรติ ร.9 ซ.42 ถนนเฉลิมพระเกียรติ ร.9 แขวงหนองบอน เขตประเวศ กรุงเทพมหานคร 10250",
  taxId: "0105565050099/สำนักงานใหญ่",
  payment:
    "ชื่อบัญชี บริษัท ฟอร์เวิร์ด อินไซต์ จำกัด\nธ.ไทยพาณิชย์ (SCB) 015-465-8438",
};
const defaultPaymentTerms =
  "1. ค่าใช้โปรแกรมประเภทรายเดือน ชำระค่าใช้โปรแกรม ทุกวันที่ 1 ของเดือน โดยเริ่มชำระเมื่อทำการย้ายข้อมูล\n2. ค่านำข้อมูลเดิมเข้าในระบบใหม่และค่าฝึกอบรม ชำระ 100% เมื่อทำสัญญา (ค่าแรกเข้า)";
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const money = (value = 0) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
  }).format((value || 0) / 100);
const fromBaht = (value: string | number) =>
  Math.round(Number(value || 0) * 100);
const toBaht = (value = 0) => ((value || 0) / 100).toFixed(2);
const categoryText = (category: Category) =>
  category === "RECURRING"
    ? softwareServiceLabel
    : "ค่าบริการชำระครั้งเดียว (ค่าแรกเข้า)";
const statusText: Record<string, string> = {
  DRAFT: "ฉบับร่าง",
  READY: "พร้อมส่ง",
  SENT: "ส่งแล้ว",
  ACCEPTED: "ตอบรับแล้ว",
  REJECTED: "ปฏิเสธ",
  EXPIRED: "หมดอายุ",
  CANCELLED: "ยกเลิก",
};
const initialForm = (salesName = ""): Form => ({
  customer_name: "",
  customer_address: "",
  contact_name: "",
  contact_email: "",
  sales_name: salesName,
  issued_at: today(),
  valid_until: plusDays(30),
  notes: "",
  payment_terms: defaultPaymentTerms,
  vat_rate: 7,
  wht_rate: 3,
  quotation_discount_type: "NONE",
  quotation_discount_value: 0,
  package_reference_quantity: 0,
  package_reference_unit: "รถ",
  included_users: 0,
  billing_cycles: ["ค่าบริการชำระรายเดือน"],
  recurring_addons: [],
  additional_fees: "",
  promotion_terms: "",
});
const makeItem = (category: Category): Item => ({
  id: crypto.randomUUID(),
  category,
  service_id: null,
  service_name: "",
  billing_type: category === "RECURRING" ? "MONTHLY" : "ONE_TIME",
  calculation_mode: "FIXED_PRICE",
  reference_quantity: 0,
  quantity: 1,
  unit: category === "RECURRING" ? "คัน" : "ครั้ง",
  unit_price_satang: 0,
  manual_amount_satang: 0,
  discount_type: "NONE",
  discount_value: 0,
});
const makeRecurringItem = (): Item => ({
  ...makeItem("RECURRING"),
  service_name: softwareServiceLabel,
  quantity: 1,
  unit: "รถ",
});
const makeServiceItem = (service: Service, quantity = 1): Item => ({
  ...makeItem("ONE_TIME"),
  service_id: service.id,
  service_name: service.name,
  billing_type: service.default_billing_type,
  calculation_mode: service.default_calculation_mode,
  quantity,
  unit: service.default_unit || "ครั้ง",
});
const makeSetupItem = (services: Service[]): Item => {
  const source = services.find((service) =>
    setupChildServices.includes(service.name),
  );
  return {
    ...makeItem("ONE_TIME"),
    service_name: setupLabel,
    billing_type: source?.default_billing_type || "ONE_TIME",
    calculation_mode: "FIXED_PRICE",
    quantity: 1,
    unit: source?.default_unit || "ครั้ง",
  };
};
const defaultItems = (services: Service[]) => [
  makeRecurringItem(),
  makeSetupItem(services),
  ...services
    .filter(
      (service) =>
        service.default_category === "ONE_TIME" &&
        !setupChildServices.includes(service.name) &&
        service.name !== customFormLabel,
    )
    .map((service) =>
      makeServiceItem(
        service,
        service.name === onsiteTrainingLabel ? 0 : 1,
      ),
    ),
];
const formFromQuote = (quote: Quote): Form => ({
  customer_name: quote.customer_name || "",
  customer_address: quote.customer_address || "",
  contact_name: quote.contact_name || "",
  contact_email: quote.contact_email || "",
  sales_name: quote.sales_name || "",
  issued_at: quote.issued_at || today(),
  valid_until: quote.valid_until || plusDays(30),
  notes: quote.notes || "",
  payment_terms: quote.payment_terms || defaultPaymentTerms,
  vat_rate: Number(quote.vat_rate || 0),
  wht_rate: Number(quote.wht_rate || 0),
  quotation_discount_type: quote.quotation_discount_type || "NONE",
  quotation_discount_value: Number(quote.quotation_discount_value || 0),
  package_reference_quantity: Number(quote.package_reference_quantity || 0),
  package_reference_unit: quote.package_reference_unit || "รถ",
  included_users: Number(quote.included_users || 0),
  billing_cycles:
    Array.isArray(quote.billing_cycles) && quote.billing_cycles.length
      ? quote.billing_cycles
      : quote.billing_cycle
        ? [quote.billing_cycle]
        : [],
  recurring_addons: Array.isArray(quote.recurring_addons)
    ? quote.recurring_addons
    : [],
  additional_fees: quote.additional_fees || "",
  promotion_terms: quote.promotion_terms || "",
});
const itemTotal = (item: Item) => {
  const raw =
    item.category === "ONE_TIME" && item.quantity === 0
      ? 0
      : item.calculation_mode === "INCLUDED"
        ? 0
        : item.calculation_mode === "MANUAL_AMOUNT"
          ? item.manual_amount_satang
          : item.calculation_mode === "QUANTITY_X_UNIT_PRICE"
            ? Math.round(item.quantity * item.unit_price_satang)
            : item.unit_price_satang;
  const discount =
    item.discount_type === "PERCENTAGE"
      ? Math.round((raw * item.discount_value) / 100)
      : item.discount_type === "FIXED_AMOUNT"
        ? fromBaht(item.discount_value)
        : 0;
  return {
    subtotal: raw,
    discount: Math.min(raw, discount),
    net: Math.max(0, raw - discount),
  };
};
function thaiBaht(value: number) {
  if (!value) return "ศูนย์บาทถ้วน";
  const digits = [
    "",
    "หนึ่ง",
    "สอง",
    "สาม",
    "สี่",
    "ห้า",
    "หก",
    "เจ็ด",
    "แปด",
    "เก้า",
  ];
  const units = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  const speak = (number: number): string => {
    if (!number) return "";
    const chunk = number % 1000000;
    let output =
      number >= 1000000 ? `${speak(Math.floor(number / 1000000))}ล้าน` : "";
    String(chunk)
      .padStart(6, "0")
      .split("")
      .forEach((char, index) => {
        const digit = Number(char);
        const position = 5 - index;
        if (digit)
          output +=
            position === 1 && digit === 1
              ? "สิบ"
              : position === 1 && digit === 2
                ? "ยี่สิบ"
                : position === 0 && digit === 1 && chunk > 1
                  ? "เอ็ด"
                  : `${digits[digit]}${units[position]}`;
      });
    return output;
  };
  const baht = Math.floor(value / 100);
  const satang = value % 100;
  return `${speak(baht)}บาท${satang ? `${speak(satang)}สตางค์` : "ถ้วน"}`;
}
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
function Spinner() {
  return <i className="spinner" aria-label="กำลังดำเนินการ" />;
}
function Brand({ hideText = false }: { hideText?: boolean }) {
  return (
    <div className="brand">
      <img src={logo} alt="Forward Insight" />
      <span className={hideText ? "sr-only" : ""}>
        FORWARD
        <br />
        INSIGHT
      </span>
    </div>
  );
}

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
  const [profile, setProfile] = useState<any>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [view, setView] = useState<View>(initialRoute.current.view);
  const [selected, setSelected] = useState<Quote | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(initialForm());
  const [items, setItems] = useState<Item[]>([
    makeItem("RECURRING"),
    makeItem("ONE_TIME"),
  ]);
  const [detailItems, setDetailItems] = useState<Item[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const locked = useRef(false);
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
    if (profileResult.error || servicesResult.error || quotesResult.error) {
      notify(
        friendlyError(
          profileResult.error?.message ||
            servicesResult.error?.message ||
            quotesResult.error?.message,
        ),
        "error",
      );
      return;
    }
    setProfile(profileResult.data);
    setServices(servicesResult.data || []);
    setQuotes(
      (quotesResult.data || []).map((row: any) => ({
        ...row,
        pdf_drive_url: row.quotation_revisions?.find(
          (revision: any) => revision.revision_no === row.revision_no,
        )?.pdf_drive_url,
      })),
    );
  }
  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + itemTotal(item).net, 0);
    const discount = Math.min(
      subtotal,
      form.quotation_discount_type === "PERCENTAGE"
        ? Math.round((subtotal * form.quotation_discount_value) / 100)
        : form.quotation_discount_type === "FIXED_AMOUNT"
          ? fromBaht(form.quotation_discount_value)
          : 0,
    );
    const taxBase = subtotal - discount;
    const vat = Math.round((taxBase * form.vat_rate) / 100);
    const wht = Math.round((taxBase * form.wht_rate) / 100);
    return { subtotal, discount, taxBase, vat, wht, net: taxBase + vat - wht };
  }, [items, form]);
  const group = (category: Category) => {
    const subtotal = items
      .filter((item) => item.category === category && item.service_name.trim())
      .reduce((sum, item) => sum + itemTotal(item).net, 0);
    const discount = totals.subtotal
      ? Math.round((totals.discount * subtotal) / totals.subtotal)
      : 0;
    const taxBase = subtotal - discount;
    const vat = Math.round((taxBase * form.vat_rate) / 100);
    const wht = Math.round((taxBase * form.wht_rate) / 100);
    return { subtotal, discount, vat, wht, net: taxBase + vat - wht };
  };
  async function run(label: string, task: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setLoading(label);
    try {
      await task();
    } catch (error) {
      notify(
        friendlyError(error instanceof Error ? error.message : undefined),
        "error",
      );
    } finally {
      locked.current = false;
      setLoading(null);
    }
  }
  const reset = () => {
    setForm(initialForm(profile?.display_name || ""));
    setItems(defaultItems(services));
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
      (service) => service.name === customFormLabel,
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
      const result = await supabase
        .from("quotation_items")
        .select("*")
        .eq("quotation_id", quote.id)
        .order("sort_order");
      if (result.error) throw result.error;
      const saved = result.data || [];
      const recurring =
        saved.find((item) => item.category === "RECURRING") ||
        makeRecurringItem();
      const savedOneTime = saved.filter((item) => item.category === "ONE_TIME");
      const savedSetup = savedOneTime.find(
        (item) => item.service_name === setupLabel,
      );
      const legacySetup = savedOneTime.filter((item) =>
        setupChildServices.includes(item.service_name),
      );
      const setup = savedSetup
        ? { ...savedSetup, id: savedSetup.id || crypto.randomUUID() }
        : legacySetup.length
          ? {
              ...makeSetupItem(services),
              unit_price_satang: legacySetup.reduce(
                (sum, item) => sum + Number(item.line_net_satang || 0),
                0,
              ),
              quantity: legacySetup.some((item) => Number(item.quantity) > 0)
                ? 1
                : 0,
            }
          : makeSetupItem(services);
      const standardItems = services
        .filter(
          (service) =>
            service.default_category === "ONE_TIME" &&
            !setupChildServices.includes(service.name) &&
            service.name !== customFormLabel,
        )
        .map((service) => {
          const found = savedOneTime.find(
            (item) =>
              item.service_id === service.id ||
              item.service_name === service.name,
          );
          return found
            ? { ...found, id: found.id || crypto.randomUUID() }
            : makeServiceItem(
                service,
                service.name === onsiteTrainingLabel ? 0 : 1,
              );
        });
      const customFormRows = savedOneTime
        .filter((item) => item.service_name === customFormLabel)
        .map((item) => ({ ...item, id: item.id || crypto.randomUUID() }));
      setForm(formFromQuote(quote));
      setItems([
        { ...recurring, id: recurring.id || crypto.randomUUID() },
        setup,
        ...standardItems,
        ...customFormRows,
      ]);
      setSelected(quote);
      setEditingId(quote.id);
      navigate("edit", quote.id);
    });
  }
  async function openDetail(quote: Quote) {
    await run("กำลังเปิดรายละเอียดใบเสนอราคา", async () => {
      const result = await supabase
        .from("quotation_items")
        .select("*")
        .eq("quotation_id", quote.id)
        .order("sort_order");
      if (result.error) throw result.error;
      setDetailItems(
        (result.data || []).map((item) => ({
          ...item,
          id: item.id || crypto.randomUUID(),
        })),
      );
      setSelected(quote);
      navigate("detail", quote.id);
    });
  }
  async function save() {
    await run("กำลังบันทึกใบเสนอราคา", async () => {
      if (
        !form.customer_name.trim() ||
        !items.some((item) => item.service_name.trim())
      ) {
        notify("กรุณาระบุชื่อลูกค้าและอย่างน้อยหนึ่งบริการ", "error");
        return;
      }
      const payload = {
        document_no: "PENDING",
        customer_name: form.customer_name.trim(),
        customer_address: form.customer_address || null,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email || null,
        sales_name: form.sales_name || profile?.display_name || null,
        issued_at: form.issued_at,
        valid_until: form.valid_until,
        notes: form.notes || null,
        payment_terms: form.payment_terms || null,
        vat_rate: form.vat_rate,
        wht_rate: form.wht_rate,
        quotation_discount_type: form.quotation_discount_type,
        quotation_discount_value: form.quotation_discount_value,
        quotation_discount_satang: totals.discount,
        subtotal_satang: totals.subtotal,
        tax_base_satang: totals.taxBase,
        vat_amount_satang: totals.vat,
        wht_amount_satang: totals.wht,
        net_amount_satang: totals.net,
        package_reference_quantity: form.package_reference_quantity || null,
        package_reference_unit: form.package_reference_unit || null,
        included_users: form.included_users || null,
        billing_cycle: form.billing_cycles[0] || null,
        billing_cycles: form.billing_cycles,
        recurring_addons: form.recurring_addons,
        additional_fees: form.additional_fees || null,
        promotion_terms: form.promotion_terms || null,
      };
      const quote = await supabase
        .from("quotations")
        .insert(payload)
        .select()
        .single();
      if (quote.error || !quote.data)
        throw new Error(quote.error?.message || "บันทึกใบเสนอราคาไม่สำเร็จ");
      const rows = items
        .filter((item) => item.service_name.trim())
        .map((item, index) => {
          const value = itemTotal(item);
          return {
            quotation_id: quote.data.id,
            category: item.category,
            service_id: item.service_id,
            service_name: item.service_name,
            billing_type: item.billing_type,
            calculation_mode: item.calculation_mode,
            reference_quantity: item.reference_quantity || null,
            quantity: item.quantity,
            unit: item.unit || null,
            unit_price_satang: item.unit_price_satang,
            manual_amount_satang: item.manual_amount_satang,
            discount_type: item.discount_type,
            discount_value: item.discount_value,
            discount_amount_satang: value.discount,
            line_subtotal_satang: value.subtotal,
            line_net_satang: value.net,
            sort_order: index,
          };
        });
      const itemResult = await supabase.from("quotation_items").insert(rows);
      if (itemResult.error) {
        await supabase.from("quotations").delete().eq("id", quote.data.id);
        throw itemResult.error;
      }
      setSelected(quote.data);
      setDetailItems(items);
      await load();
      navigate("detail", quote.data.id);
      notify(`${quote.data.document_no} บันทึกเป็นฉบับร่างแล้ว`, "success");
    });
  }
  async function saveEdit() {
    if (!editingId || !selected) return;
    await run("กำลังบันทึกการแก้ไข", async () => {
      if (
        !form.customer_name.trim() ||
        !items.some((item) => item.service_name.trim() && item.quantity > 0)
      ) {
        notify("กรุณาระบุชื่อลูกค้าและอย่างน้อยหนึ่งบริการ", "error");
        return;
      }
      const payload = {
        customer_name: form.customer_name.trim(),
        customer_address: form.customer_address || null,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email || null,
        sales_name: form.sales_name || profile?.display_name || null,
        issued_at: form.issued_at,
        valid_until: form.valid_until,
        notes: form.notes || null,
        payment_terms: form.payment_terms || null,
        vat_rate: form.vat_rate,
        wht_rate: form.wht_rate,
        quotation_discount_type: form.quotation_discount_type,
        quotation_discount_value: form.quotation_discount_value,
        quotation_discount_satang: totals.discount,
        subtotal_satang: totals.subtotal,
        tax_base_satang: totals.taxBase,
        vat_amount_satang: totals.vat,
        wht_amount_satang: totals.wht,
        net_amount_satang: totals.net,
        package_reference_quantity: form.package_reference_quantity || null,
        package_reference_unit: form.package_reference_unit || null,
        included_users: form.included_users || null,
        billing_cycle: form.billing_cycles[0] || null,
        billing_cycles: form.billing_cycles,
        recurring_addons: form.recurring_addons,
        additional_fees: form.additional_fees || null,
        promotion_terms: form.promotion_terms || null,
      };
      const quote = await supabase
        .from("quotations")
        .update(payload)
        .eq("id", editingId)
        .select()
        .single();
      if (quote.error || !quote.data)
        throw new Error(quote.error?.message || "บันทึกการแก้ไขไม่สำเร็จ");
      const deleted = await supabase
        .from("quotation_items")
        .delete()
        .eq("quotation_id", editingId);
      if (deleted.error) throw deleted.error;
      const rows = items
        .filter((item) => item.service_name.trim())
        .map((item, index) => {
          const value = itemTotal(item);
          return {
            quotation_id: editingId,
            category: item.category,
            service_id: item.service_id,
            service_name: item.service_name,
            billing_type: item.billing_type,
            calculation_mode: item.calculation_mode,
            reference_quantity: item.reference_quantity || null,
            quantity: item.quantity,
            unit: item.unit || null,
            unit_price_satang: item.unit_price_satang,
            manual_amount_satang: item.manual_amount_satang,
            discount_type: item.discount_type,
            discount_value: item.discount_value,
            discount_amount_satang: value.discount,
            line_subtotal_satang: value.subtotal,
            line_net_satang: value.net,
            sort_order: index,
          };
        });
      const inserted = await supabase.from("quotation_items").insert(rows);
      if (inserted.error) throw inserted.error;
      setSelected(quote.data);
      setDetailItems(items);
      setEditingId(null);
      await load();
      navigate("detail", quote.data.id);
      notify("บันทึกการแก้ไขเรียบร้อยแล้ว", "success");
    });
  }
  async function status(next: string) {
    if (!selected) return;
    await run("กำลังเปลี่ยนสถานะ", async () => {
      const result = await supabase.rpc("change_quotation_status", {
        p_quotation_id: selected.id,
        p_status: next,
      });
      if (result.error) throw result.error;
      setSelected(result.data);
      await load();
      notify(`เปลี่ยนสถานะเป็น “${statusText[next]}” แล้ว`, "success");
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
    const question =
      action === "generate_pdf"
        ? "ยืนยันสร้าง PDF และบันทึกใน Google Drive ใช่หรือไม่?"
        : `ยืนยันส่งอีเมลพร้อม PDF ไปที่ ${selected.contact_email || "ผู้รับที่ระบุ"} ใช่หรือไม่?`;
    if (!window.confirm(question)) return;
    await run(
      action === "generate_pdf" ? "กำลังสร้าง PDF" : "กำลังส่งอีเมล",
      async () => {
        const body =
          action === "generate_pdf"
            ? { action, quotation_id: selected.id }
            : {
                action,
                quotation_id: selected.id,
                to: selected.contact_email ? [selected.contact_email] : [],
                subject: `ใบเสนอราคา ${selected.document_no}`,
                message: `เรียน ${selected.contact_name || ""}\n\nขอส่งใบเสนอราคา ${selected.document_no} ตามเอกสารแนบ\n\nขอบคุณค่ะ\nForward Insight`,
              };
        const result = await supabase.functions.invoke("quotation-operations", {
          body,
        });
        if (result.error) throw result.error;
        if (action === "generate_pdf") {
          if (!result.data?.pdf_drive_url)
            throw new Error(result.data?.message || "สร้าง PDF ไม่สำเร็จ");
          setSelected({
            ...selected,
            status: "READY",
            pdf_drive_url: result.data.pdf_drive_url,
          });
        } else {
          const changed = await supabase.rpc("change_quotation_status", {
            p_quotation_id: selected.id,
            p_status: "SENT",
          });
          if (changed.error) throw changed.error;
          setSelected(changed.data);
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
        className={`work ${view === "create" || view === "edit" ? "editor-work" : ""}`}
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
            totals={totals}
            group={group}
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
            totals={totals}
            group={group}
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
            onBack={() => navigate("dashboard")}
            onEdit={() => void startEdit(selected)}
            onRevision={() => void revision()}
            onPdf={() => void documentAction("generate_pdf")}
            onEmail={() => void documentAction("send_email")}
            onStatus={(next) => void status(next)}
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function MoneyInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [display, setDisplay] = useState(value ? toBaht(value) : "");
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDisplay(value ? toBaht(value) : "");
  }, [value]);
  const normalize = (input: string) => {
    const cleaned = input.replace(/[^0-9.]/g, "");
    const [whole = "", ...decimals] = cleaned.split(".");
    return decimals.length ? `${whole}.${decimals.join("").slice(0, 2)}` : whole;
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder="ระบุราคา"
      value={display}
      onFocus={() => {
        focused.current = true;
        setDisplay(value ? String(value / 100) : "");
      }}
      onChange={(event) => {
        const next = normalize(event.target.value);
        setDisplay(next);
        onChange(fromBaht(next));
      }}
      onBlur={() => {
        focused.current = false;
        setDisplay(value ? toBaht(value) : "");
      }}
    />
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
      <header className="topbar">
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
          label="รอผล/ส่งแล้ว"
          value={
            quotes.filter(
              (quote) => quote.status === "READY" || quote.status === "SENT",
            ).length
          }
        />
      </section>
      <section className="card table-card">
        <div className="section-heading">
          <div>
            <h2>เอกสารล่าสุด</h2>
            <p>แสดงเฉพาะเอกสารที่คุณมีสิทธิ์เข้าถึง</p>
          </div>
        </div>
        {quotes.length ? (
          <div className="quote-table">
            <div className="quote-head">
              <span>เลขที่เอกสาร</span>
              <span>ลูกค้า</span>
              <span>วันหมดอายุ</span>
              <span>สถานะ</span>
              <span>ยอดสุทธิ</span>
            </div>
            {quotes.map((quote) => (
              <button
                key={quote.id}
                className="quote-row"
                onClick={() => onSelect(quote)}
              >
                <b>
                  {quote.document_no}
                  <small>
                    ฉบับแก้ไข {String(quote.revision_no).padStart(2, "0")}
                  </small>
                </b>
                <span>{quote.customer_name}</span>
                <span>{quote.valid_until}</span>
                <span>
                  <i className={`badge ${quote.status.toLowerCase()}`}>
                    {statusText[quote.status] || quote.status}
                  </i>
                </span>
                <strong>{money(quote.net_amount_satang)}</strong>
              </button>
            ))}
          </div>
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
  totals,
  group,
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
  totals: any;
  group: (category: Category) => any;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
  onUpdate: (id: string, patch: Partial<Item>) => void;
  onAddCustomForm: () => void;
  onRemoveItem: (id: string) => void;
}) {
  const patch = (value: Partial<Form>) => setForm({ ...form, ...value });
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
            <div className="two">
              <Field label="ผู้ติดต่อ">
                <input
                  value={form.contact_name}
                  onChange={(event) =>
                    patch({ contact_name: event.target.value })
                  }
                />
              </Field>
              <Field label="อีเมลผู้ติดต่อ">
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={(event) =>
                    patch({ contact_email: event.target.value })
                  }
                />
              </Field>
            </div>
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
          <Section title="ข้อมูลแพ็กเกจและเงื่อนไข">
            <div className="two">
              <Field label="ผู้ใช้งานที่รวม">
                <input
                  type="number"
                  min="0"
                  value={form.included_users}
                  onChange={(event) =>
                    patch({ included_users: Number(event.target.value) })
                  }
                />
              </Field>
            </div>
            <Field label="ค่าบริการเพิ่มเติม">
              <textarea
                value={form.additional_fees}
                placeholder="ระบุเป็นข้อ ๆ"
                onChange={(event) =>
                  patch({ additional_fees: event.target.value })
                }
              />
            </Field>
            <Field label="โปรโมชันและเงื่อนไขพิเศษ">
              <textarea
                value={form.promotion_terms}
                placeholder="ระบุสิทธิพิเศษหรือเงื่อนไขเพิ่มเติม"
                onChange={(event) =>
                  patch({ promotion_terms: event.target.value })
                }
              />
            </Field>
          </Section>
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
              <Field label="หัก ณ ที่จ่าย (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.wht_rate}
                  onChange={(event) =>
                    patch({ wht_rate: Number(event.target.value) })
                  }
                />
              </Field>
            </div>
          </Section>
          <Section title="ข้อความในเอกสาร">
            <Field label="หมายเหตุ">
              <textarea
                value={form.notes}
                onChange={(event) => patch({ notes: event.target.value })}
              />
            </Field>
            <Field label="เงื่อนไขการชำระเงิน">
              <textarea
                value={form.payment_terms}
                onChange={(event) =>
                  patch({ payment_terms: event.target.value })
                }
              />
            </Field>
          </Section>
        </section>
        <Preview form={form} items={items} totals={totals} group={group} />
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
    <Section title={softwareServiceLabel}>
      <p className="muted section-note">
        เลือกบริการหลักที่รวมในแพ็กเกจจาก checkbox โดยระบบจะแสดงเป็นราคา
        ค่าบริการซอฟแวร์ระบบหนึ่งรายการในใบเสนอราคา
      </p>
      <fieldset className="check-field">
        <legend>รอบชำระค่าบริการ</legend>
        <div className="check-grid">
          {paymentOptions.map((option) => (
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
                package_reference_unit: "รถ",
              })
            }
          />
        </Field>
        <Field label="ราคา (บาท)">
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
    (item) => item.service_name === customFormLabel,
  );
  return (
    <Section title={categoryText("ONE_TIME")}>
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
            {item.service_name === setupLabel && (
              <p className="item-detail">รวม: ทะเบียนรถ และข้อมูลทั่วไป</p>
            )}
            <div className="three">
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
            </div>
          </div>
          <div className="item-total">
            <strong>{money(itemTotal(item).net)}</strong>
            {item.service_name === customFormLabel && (
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
  totals,
  group,
}: {
  form: Form;
  items: Item[];
  totals: any;
  group: (category: Category) => any;
}) {
  return (
    <aside className="preview-panel">
      <p className="preview-label">ตัวอย่างใบเสนอราคา</p>
      <div className="preview-scroll">
        <QuotePaper form={form} items={items} totals={totals} group={group} />
      </div>
    </aside>
  );
}

function QuotePaper({
  form,
  items,
  totals,
  group,
}: {
  form: Form;
  items: Item[];
  totals: any;
  group: (category: Category) => any;
}) {
  return (
    <article className="paper quotation-paper">
      <div className="document-company">
        <Brand />
        <div>
          <b>{company.name}</b>
          <span>{company.address}</span>
          <span>เลขที่ประจำตัวผู้เสียภาษี {company.taxId}</span>
        </div>
      </div>
      <div className="document-title">
        <div>
          <h2>ใบเสนอราคา</h2>
          <span>QUOTATION</span>
        </div>
        <dl>
          <div>
            <dt>เลขที่</dt>
            <dd>จะออกเมื่อบันทึก</dd>
          </div>
          <div>
            <dt>วันที่</dt>
            <dd>{form.issued_at}</dd>
          </div>
          <div>
            <dt>ใช้ได้ถึง</dt>
            <dd>{form.valid_until}</dd>
          </div>
        </dl>
      </div>
      <div className="document-customer">
        <span>ชื่อลูกค้า</span>
        <p>{form.customer_name || "ชื่อลูกค้า"}</p>
        <span>ที่อยู่ลูกค้า</span>
        <p>{form.customer_address || "ที่อยู่ลูกค้า"}</p>
      </div>
      <PriceBlock
        category="RECURRING"
        form={form}
        items={items}
        summary={group("RECURRING")}
        vat={form.vat_rate}
        wht={form.wht_rate}
      />
      <PriceBlock
        category="ONE_TIME"
        form={form}
        items={items}
        summary={group("ONE_TIME")}
        vat={form.vat_rate}
        wht={form.wht_rate}
      />
      <div className="document-footer-grid">
        <section>
          <h3>หมายเหตุ</h3>
          <p className="multiline">
            {form.notes || form.promotion_terms || "-"}
          </p>
        </section>
        <section>
          <h3>เงื่อนไขการชำระเงิน</h3>
          <p className="multiline">{form.payment_terms}</p>
        </section>
        <section>
          <h3>ข้อมูลการชำระเงิน</h3>
          <p className="multiline">{company.payment}</p>
        </section>
      </div>
      <div className="signatures compact-signatures">
        <div>
          <h3>ยืนยันรับข้อเสนอ</h3>
          <span>ลงชื่อ ______________________________</span>
          <span>วันที่ ______________________________</span>
        </div>
        <div>
          <h3>ผู้เสนอราคา</h3>
          <span>ลงชื่อ {form.sales_name || "______________________"}</span>
          <span>วันที่ {form.issued_at}</span>
        </div>
      </div>
    </article>
  );
}
function PriceBlock({
  category,
  form,
  items,
  summary,
  vat,
  wht,
}: {
  category: Category;
  form: Form;
  items: Item[];
  summary: any;
  vat: number;
  wht: number;
}) {
  const rows = items.filter(
    (item) => item.category === category && item.service_name.trim(),
  );
  const recurring = category === "RECURRING";
  const main = rows[0];
  return (
    <section className="price-block">
      <div className="price-title">
        <h3>
          {recurring
            ? `1. ${softwareServiceLabel}`
            : "2. ค่าบริการชำระครั้งเดียว (ค่าแรกเข้า)"}
        </h3>
        {recurring && (
          <span>{form.billing_cycles.join(" · ") || "รอบชำระยังไม่ระบุ"}</span>
        )}
      </div>
      <div className="mini-head">
        <span>รายละเอียด</span>
        <span>{recurring ? "จำนวนรถ" : "จำนวน"}</span>
        <span>ราคา</span>
      </div>
      {recurring ? (
        <div className="mini-row">
          <span className="service-cell">
            {main?.service_name || softwareServiceLabel}
            {form.recurring_addons.length > 0 && (
              <small>
                {form.recurring_addons.map((name) => `• ${name}`).join("\n")}
              </small>
            )}
          </span>
          <span>{form.package_reference_quantity || "—"} รถ</span>
          <b>{money(summary.subtotal)}</b>
        </div>
      ) : rows.length ? (
        rows.map((item, index) => (
          <div className="mini-row" key={item.id}>
            <span className="service-cell">
              {index + 1}. {item.service_name}
              {item.service_name === setupLabel && (
                <small>ทะเบียนรถ · ข้อมูลทั่วไป</small>
              )}
            </span>
            <span>
              {item.quantity} {item.unit}
            </span>
            <b>{money(itemTotal(item).net)}</b>
          </div>
        ))
      ) : (
        <div className="mini-row muted">
          <span>ยังไม่มีรายการ</span>
          <span>—</span>
          <b>—</b>
        </div>
      )}
      <div className="price-summary">
        <p>
          <span>รวมก่อนภาษี</span>
          <b>{money(summary.subtotal)}</b>
        </p>
        {summary.discount > 0 && (
          <p>
            <span>ส่วนลด</span>
            <b>-{money(summary.discount)}</b>
          </p>
        )}
        <p>
          <span>หัก ณ ที่จ่าย {wht}%</span>
          <b>-{money(summary.wht)}</b>
        </p>
        <p>
          <span>ภาษีมูลค่าเพิ่ม {vat}%</span>
          <b>{money(summary.vat)}</b>
        </p>
        <p className="net">
          <span>ยอดรวมสุทธิ</span>
          <b>{money(summary.net)}</b>
        </p>
      </div>
    </section>
  );
}
function Detail({
  quote,
  items,
  busy,
  onBack,
  onEdit,
  onRevision,
  onPdf,
  onEmail,
  onStatus,
}: {
  quote: Quote;
  items: Item[];
  busy: boolean;
  onBack: () => void;
  onEdit: () => void;
  onRevision: () => void;
  onPdf: () => void;
  onEmail: () => void;
  onStatus: (value: string) => void;
}) {
  const form = formFromQuote(quote);
  const totals = items.reduce(
    (sum, item) => {
      const value = itemTotal(item);
      return {
        subtotal: sum.subtotal + value.net,
        discount: sum.discount,
        taxBase: sum.taxBase,
        vat: sum.vat,
        wht: sum.wht,
        net: sum.net,
      };
    },
    { subtotal: 0, discount: 0, taxBase: 0, vat: 0, wht: 0, net: 0 },
  );
  const group = (category: Category) => {
    const subtotal = items
      .filter((item) => item.category === category)
      .reduce((sum, item) => sum + itemTotal(item).net, 0);
    const vat = Math.round((subtotal * form.vat_rate) / 100);
    const wht = Math.round((subtotal * form.wht_rate) / 100);
    return { subtotal, discount: 0, vat, wht, net: subtotal + vat - wht };
  };
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">รายละเอียดใบเสนอราคา</p>
          <h1>
            {quote.document_no}{" "}
            <small>
              ฉบับแก้ไข {String(quote.revision_no).padStart(2, "0")}
            </small>
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
          {quote.status !== "DRAFT" && (
            <button disabled={busy} onClick={onRevision}>
              สร้างฉบับแก้ไข
            </button>
          )}
          <button className="primary" disabled={busy} onClick={onPdf}>
            ยืนยันสร้าง PDF
          </button>
          <button
            disabled={busy || !quote.contact_email || !quote.pdf_drive_url}
            onClick={onEmail}
          >
            ยืนยันส่งอีเมล
          </button>
        </div>
      </header>
      <section className="detail-grid">
        <article className="card quote-summary">
          <i className={`badge ${quote.status.toLowerCase()}`}>
            {statusText[quote.status] || quote.status}
          </i>
          <h2>{money(quote.net_amount_satang)}</h2>
          <p className="muted">ยอดสุทธิของเอกสาร</p>
          <hr />
          <dl>
            <dt>ลูกค้า</dt>
            <dd>{quote.customer_name}</dd>
            <dt>ผู้ติดต่อ</dt>
            <dd>{quote.contact_name || "—"}</dd>
            <dt>อีเมล</dt>
            <dd>{quote.contact_email || "—"}</dd>
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
          </dl>
        </article>
        <article className="card">
          <h2>เปลี่ยนสถานะ</h2>
          <p className="muted">เปลี่ยนได้เฉพาะเอกสารที่คุณเป็นเจ้าของ</p>
          <div className="status-actions">
            {quote.status === "DRAFT" && (
              <button disabled={busy} onClick={() => onStatus("READY")}>
                พร้อมส่ง
              </button>
            )}
            {quote.status === "READY" && (
              <>
                <button disabled={busy} onClick={() => onStatus("SENT")}>
                  ส่งแล้ว
                </button>
                <button disabled={busy} onClick={() => onStatus("CANCELLED")}>
                  ยกเลิก
                </button>
              </>
            )}
            {quote.status === "SENT" && (
              <>
                <button disabled={busy} onClick={() => onStatus("ACCEPTED")}>
                  ลูกค้าตอบรับ
                </button>
                <button disabled={busy} onClick={() => onStatus("REJECTED")}>
                  ลูกค้าปฏิเสธ
                </button>
                <button disabled={busy} onClick={() => onStatus("EXPIRED")}>
                  หมดอายุ
                </button>
              </>
            )}
          </div>
        </article>
      </section>
      <section className="detail-preview">
        <p className="preview-label">ตัวอย่างใบเสนอราคา</p>
        <div className="detail-preview-scroll">
          <QuotePaper form={form} items={items} totals={totals} group={group} />
        </div>
      </section>
    </>
  );
}
export default App;
