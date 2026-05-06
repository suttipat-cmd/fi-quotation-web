// =======================================================
// FI Quotation Web App
// Frontend v0.1: Auth + App Shell + Read-only Dashboard
// =======================================================

// 1) Replace these with values from Supabase Project Settings > API.
//    Use anon public key only. Never use service_role key here.
const SUPABASE_URL = "PASTE_SUPABASE_PROJECT_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_SUPABASE_ANON_PUBLIC_KEY_HERE";

const isConfigured =
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_ANON_KEY.length > 30 &&
  !SUPABASE_URL.includes("PASTE_") &&
  !SUPABASE_ANON_KEY.includes("PASTE_");

const supabaseClient = isConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const appState = {
  user: null,
  profile: null,
  currentPage: "dashboard",
};

const $ = (selector) => document.querySelector(selector);

const elements = {
  loginPage: $("#loginPage"),
  appShell: $("#appShell"),
  loginForm: $("#loginForm"),
  loginEmail: $("#loginEmail"),
  loginPassword: $("#loginPassword"),
  loginButton: $("#loginButton"),
  loginError: $("#loginError"),
  logoutButton: $("#logoutButton"),
  sidebarMenu: $("#sidebarMenu"),
  pageTitle: $("#pageTitle"),
  pageSubtitle: $("#pageSubtitle"),
  pageContent: $("#pageContent"),
  userName: $("#userName"),
  userRole: $("#userRole"),
  setupWarning: $("#setupWarning"),
  toast: $("#toast"),
};

document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  if (!isConfigured) {
    showLoginPage();
    showSetupWarningOnLogin();
    return;
  }

  bindEvents();

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    showLoginPage();
    showLoginError("ไม่สามารถตรวจสอบ session ได้ กรุณาเข้าสู่ระบบใหม่");
    return;
  }

  if (data.session?.user) {
    appState.user = data.session.user;
    await loadProfile();
    showAppShell();
    await renderCurrentPage();
  } else {
    showLoginPage();
  }

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      appState.user = session.user;
      await loadProfile();
      showAppShell();
      await renderCurrentPage();
    } else {
      appState.user = null;
      appState.profile = null;
      showLoginPage();
    }
  });
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.logoutButton.addEventListener("click", handleLogout);

  window.addEventListener("hashchange", async () => {
    const page = getPageFromHash();
    appState.currentPage = page;
    await renderCurrentPage();
  });
}

function showSetupWarningOnLogin() {
  elements.loginError.classList.remove("hidden");
  elements.loginError.textContent =
    "ยังไม่ได้ตั้งค่า Supabase URL และ anon key ในไฟล์ script.js";
}

async function handleLogin(event) {
  event.preventDefault();

  if (!supabaseClient) {
    showLoginError("ยังไม่ได้ตั้งค่า Supabase ใน script.js");
    return;
  }

  setLoginLoading(true);
  hideLoginError();

  const email = elements.loginEmail.value.trim();
  const password = elements.loginPassword.value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  setLoginLoading(false);

  if (error) {
    showLoginError("อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
    return;
  }

  appState.user = data.user;
  await loadProfile();
  showAppShell();
  await renderCurrentPage();
  showToast("เข้าสู่ระบบสำเร็จ");
}

async function handleLogout() {
  if (!supabaseClient) return;

  await supabaseClient.auth.signOut();
  showToast("ออกจากระบบแล้ว");
}

async function loadProfile() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", appState.user.id)
    .single();

  if (error) {
    console.error(error);
    throw new Error("Cannot load profile");
  }

  if (!data.is_active) {
    await supabaseClient.auth.signOut();
    throw new Error("บัญชีนี้ถูกปิดการใช้งาน");
  }

  appState.profile = data;
}

function showLoginPage() {
  elements.loginPage.classList.remove("hidden");
  elements.appShell.classList.add("hidden");
}

function showAppShell() {
  elements.loginPage.classList.add("hidden");
  elements.appShell.classList.remove("hidden");

  elements.userName.textContent =
    appState.profile.full_name || appState.profile.email || "-";
  elements.userRole.textContent = roleLabel(appState.profile.role);

  renderMenu();

  if (!location.hash) {
    location.hash = "#dashboard";
  } else {
    appState.currentPage = getPageFromHash();
  }
}

function renderMenu() {
  const role = appState.profile.role;

  const allMenus = [
    { key: "dashboard", label: "Dashboard", roles: ["admin", "manager", "sales"] },
    { key: "quotations", label: "ใบเสนอราคา", roles: ["admin", "manager", "sales"] },
    { key: "customers", label: "ลูกค้า", roles: ["admin", "manager", "sales"] },
    { key: "products", label: "สินค้า/บริการ", roles: ["admin", "manager", "sales"] },
    { key: "company", label: "Company Profile", roles: ["admin"] },
    { key: "settings", label: "Settings", roles: ["admin"] },
  ];

  const menus = allMenus.filter((item) => item.roles.includes(role));

  elements.sidebarMenu.innerHTML = menus
    .map((item) => {
      const activeClass = item.key === appState.currentPage ? "active" : "";
      return `
        <button class="menu-item ${activeClass}" data-page="${item.key}">
          <span>${menuIcon(item.key)}</span>
          <span>${item.label}</span>
        </button>
      `;
    })
    .join("");

  elements.sidebarMenu.querySelectorAll(".menu-item").forEach((button) => {
    button.addEventListener("click", () => {
      location.hash = `#${button.dataset.page}`;
    });
  });
}

function getPageFromHash() {
  return (location.hash || "#dashboard").replace("#", "");
}

async function renderCurrentPage() {
  if (!appState.profile) return;

  renderMenu();

  const page = appState.currentPage;

  try {
    if (page === "dashboard") {
      await renderDashboardPage();
    } else if (page === "quotations") {
      await renderQuotationsPage();
    } else if (page === "customers") {
      await renderCustomersPage();
    } else if (page === "products") {
      await renderProductsPage();
    } else if (page === "company") {
      await renderCompanyPage();
    } else if (page === "settings") {
      await renderSettingsPage();
    } else {
      appState.currentPage = "dashboard";
      location.hash = "#dashboard";
    }
  } catch (error) {
    console.error(error);
    renderError("ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
  }
}

async function renderDashboardPage() {
  setPageHeader("Dashboard", "ภาพรวมระบบใบเสนอราคา");
  renderLoading();

  const role = appState.profile.role;

  if (role === "sales") {
    const { data, error } = await supabaseClient
      .from("v_dashboard_sales")
      .select("*")
      .eq("owner_id", appState.user.id)
      .maybeSingle();

    if (error) throw error;

    const metrics = data || emptyDashboardMetrics();
    elements.pageContent.innerHTML = renderDashboardMetrics(metrics);
    return;
  }

  const { data, error } = await supabaseClient
    .from("v_dashboard_manager")
    .select("*")
    .order("owner_name", { ascending: true });

  if (error) throw error;

  const summary = summarizeManagerDashboard(data || []);

  elements.pageContent.innerHTML = `
    ${renderDashboardMetrics(summary)}
    <div class="card">
      <div class="card-header">
        <div>
          <h3>ยอดรวมตาม Sales</h3>
          <p>ข้อมูลจากใบเสนอราคาที่อยู่ในระบบ</p>
        </div>
      </div>
      ${renderSalesSummaryTable(data || [])}
    </div>
  `;
}

async function renderQuotationsPage() {
  const title =
    appState.profile.role === "sales"
      ? "ใบเสนอราคาของฉัน"
      : "ใบเสนอราคาทั้งหมด";

  setPageHeader(title, "ค้นหา กรอง และติดตามสถานะใบเสนอราคา");
  renderLoading();

  const { data, error } = await supabaseClient
    .from("v_quotations_list")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  renderQuotationList(data || []);
}

function renderQuotationList(rows) {
  elements.pageContent.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>รายการใบเสนอราคา</h3>
          <p>Draft จะยังไม่มีเลขเอกสาร เลขจะถูกสร้างเมื่อ Confirm</p>
        </div>
        <button class="btn btn-primary" disabled title="จะทำใน Step ถัดไป">
          + สร้างใบเสนอราคา
        </button>
      </div>

      <div class="filter-bar">
        <input id="quotationSearch" type="search" placeholder="ค้นหาลูกค้า / เลขเอกสาร" />
        <select id="quotationStatusFilter">
          <option value="">ทุกสถานะ</option>
          <option value="draft">ร่าง</option>
          <option value="confirmed">ยืนยันแล้ว</option>
          <option value="sent">ส่งแล้ว</option>
          <option value="expired">หมดอายุ</option>
          <option value="cancelled">ยกเลิก</option>
        </select>
      </div>

      <div id="quotationTable"></div>
    </div>
  `;

  const searchInput = $("#quotationSearch");
  const statusFilter = $("#quotationStatusFilter");
  const tableTarget = $("#quotationTable");

  function updateTable() {
    const keyword = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value;

    const filtered = rows.filter((row) => {
      const text = `${row.quotation_no || ""} ${row.customer_name || ""}`.toLowerCase();
      const matchText = !keyword || text.includes(keyword);
      const matchStatus = !status || row.effective_status === status;
      return matchText && matchStatus;
    });

    tableTarget.innerHTML = renderQuotationTable(filtered);
  }

  searchInput.addEventListener("input", updateTable);
  statusFilter.addEventListener("change", updateTable);

  updateTable();
}

async function renderCustomersPage() {
  setPageHeader("ลูกค้า", "รายชื่อลูกค้าจากประวัติใบเสนอราคา");
  renderLoading();

  const { data, error } = await supabaseClient
    .from("v_customers_from_quotations")
    .select("*")
    .order("latest_quote_date", { ascending: false });

  if (error) throw error;

  elements.pageContent.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>ลูกค้าจากประวัติใบเสนอราคา</h3>
          <p>หากสะกดชื่อลูกค้าต่างกัน ระบบอาจแสดงเป็นคนละรายการ</p>
        </div>
      </div>
      ${renderCustomerTable(data || [])}
    </div>
  `;
}

async function renderProductsPage() {
  setPageHeader("สินค้า/บริการ", "Master Data สำหรับใช้ในใบเสนอราคา");
  renderLoading();

  const { data, error } = await supabaseClient
    .from("products")
    .select("id, code, name, description, default_unit, is_active")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const canEdit = appState.profile.role === "admin";

  elements.pageContent.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>สินค้า/บริการ</h3>
          <p>${canEdit ? "Admin จัดการสินค้าได้" : "หน้านี้เป็น read-only สำหรับ role ของคุณ"}</p>
        </div>
        <button class="btn btn-primary" disabled title="จะทำใน Step ถัดไป">
          + เพิ่มสินค้า
        </button>
      </div>
      ${renderProductsTable(data || [])}
    </div>
  `;
}

async function renderCompanyPage() {
  if (appState.profile.role !== "admin") {
    renderError("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
    return;
  }

  setPageHeader("Company Profile", "ข้อมูลบริษัทและบัญชีธนาคารที่ใช้บนใบเสนอราคา");
  renderLoading();

  const { data, error } = await supabaseClient
    .from("company_profile")
    .select("*")
    .eq("is_default", true)
    .maybeSingle();

  if (error) throw error;

  elements.pageContent.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>ข้อมูลบริษัท</h3>
          <p>ข้อมูลนี้จะถูก snapshot ตอน Confirm ใบเสนอราคา</p>
        </div>
        <button class="btn btn-primary" disabled title="จะทำใน Step ถัดไป">
          แก้ไขข้อมูล
        </button>
      </div>
      ${renderCompanyProfile(data)}
    </div>
  `;
}

async function renderSettingsPage() {
  if (appState.profile.role !== "admin") {
    renderError("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
    return;
  }

  setPageHeader("Settings", "ตั้งค่าระบบ");
  elements.pageContent.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>User Roles</h3>
          <p>MVP นี้ Admin สร้าง User ผ่าน Supabase Dashboard แล้วตั้ง role ใน profiles</p>
        </div>
      </div>
      <p class="helper-text">
        ใน phase ถัดไปสามารถเพิ่มหน้าแก้ role และเปิด/ปิด user ได้จากระบบ
      </p>
    </div>
  `;
}

function renderDashboardMetrics(metrics) {
  return `
    <div class="metric-grid">
      <div class="metric-card">
        <span>ทั้งหมด</span>
        <strong>${number(metrics.total_count)}</strong>
      </div>
      <div class="metric-card">
        <span>Draft</span>
        <strong>${number(metrics.draft_count)}</strong>
      </div>
      <div class="metric-card">
        <span>Confirmed</span>
        <strong>${number(metrics.confirmed_count)}</strong>
      </div>
      <div class="metric-card">
        <span>Sent</span>
        <strong>${number(metrics.sent_count)}</strong>
      </div>
      <div class="metric-card">
        <span>ยอดเดือนนี้</span>
        <strong>${formatTHB(metrics.total_amount_this_month)}</strong>
      </div>
    </div>
  `;
}

function renderSalesSummaryTable(rows) {
  if (!rows.length) {
    return `<div class="empty-state">ยังไม่มีข้อมูลใบเสนอราคา</div>`;
  }

  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Sales</th>
            <th>ทั้งหมด</th>
            <th>Draft</th>
            <th>Confirmed</th>
            <th>Sent</th>
            <th>Expired</th>
            <th>ยอดเดือนนี้</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHTML(row.owner_name || "-")}</td>
              <td>${number(row.total_count)}</td>
              <td>${number(row.draft_count)}</td>
              <td>${number(row.confirmed_count)}</td>
              <td>${number(row.sent_count)}</td>
              <td>${number(row.expired_count)}</td>
              <td>${formatTHB(row.total_amount_this_month)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderQuotationTable(rows) {
  if (!rows.length) {
    return `<div class="empty-state">ยังไม่มีใบเสนอราคา</div>`;
  }

  const showSales = appState.profile.role !== "sales";

  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>เลขที่</th>
            <th>ลูกค้า</th>
            <th>ประเภท</th>
            ${showSales ? "<th>Sales</th>" : ""}
            <th>วันที่</th>
            <th>หมดอายุ</th>
            <th>ยอดรวม</th>
            <th>สถานะ</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td><strong>${escapeHTML(row.quotation_no || "ยังไม่ออกเลข")}</strong></td>
              <td>${escapeHTML(row.customer_name || "-")}</td>
              <td>${billingTypeLabel(row.billing_type)}</td>
              ${showSales ? `<td>${escapeHTML(row.owner_name || "-")}</td>` : ""}
              <td>${formatDate(row.quote_date)}</td>
              <td>${formatDate(row.valid_until)}</td>
              <td>${formatTHB(row.grand_total_display)}</td>
              <td>${statusBadge(row.effective_status)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderCustomerTable(rows) {
  if (!rows.length) {
    return `<div class="empty-state">ยังไม่มีข้อมูลลูกค้า</div>`;
  }

  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>ลูกค้า</th>
            <th>ที่อยู่ล่าสุด</th>
            <th>จำนวนใบเสนอราคา</th>
            <th>เสนอล่าสุด</th>
            <th>ยอดล่าสุด</th>
            <th>Sales ล่าสุด</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td><strong>${escapeHTML(row.customer_name || "-")}</strong></td>
              <td>${escapeHTML(row.latest_customer_address || "-")}</td>
              <td>${number(row.quotation_count)}</td>
              <td>${formatDate(row.latest_quote_date)}</td>
              <td>${formatTHB(row.latest_grand_total)}</td>
              <td>${escapeHTML(row.latest_sales_name || "-")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderProductsTable(rows) {
  if (!rows.length) {
    return `<div class="empty-state">ยังไม่มีสินค้า/บริการ</div>`;
  }

  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>ชื่อสินค้า/บริการ</th>
            <th>รายละเอียด</th>
            <th>หน่วย</th>
            <th>สถานะ</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td><strong>${escapeHTML(row.code || "-")}</strong></td>
              <td>${escapeHTML(row.name || "-")}</td>
              <td>${escapeHTML(row.description || "-")}</td>
              <td>${escapeHTML(row.default_unit || "-")}</td>
              <td>${row.is_active ? statusPill("Active", "confirmed") : statusPill("Inactive", "cancelled")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderCompanyProfile(company) {
  if (!company) {
    return `<div class="empty-state">ยังไม่มีข้อมูลบริษัท</div>`;
  }

  const rows = [
    ["ชื่อบริษัท", company.company_name],
    ["เลขประจำตัวผู้เสียภาษี", company.tax_id],
    ["สาขา", company.branch_name],
    ["ที่อยู่", company.address],
    ["ธนาคาร", company.bank_name],
    ["ชื่อบัญชี", company.bank_account_name],
    ["เลขบัญชี", company.bank_account_no],
    ["ข้อความแจ้งชำระเงิน", company.payment_note],
  ];

  return `
    <div class="kv-list">
      ${rows.map(([label, value]) => `
        <div class="kv-row">
          <span>${label}</span>
          <strong>${escapeHTML(value || "-")}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function emptyDashboardMetrics() {
  return {
    total_count: 0,
    draft_count: 0,
    confirmed_count: 0,
    sent_count: 0,
    expired_count: 0,
    cancelled_count: 0,
    total_amount_this_month: 0,
  };
}

function summarizeManagerDashboard(rows) {
  return rows.reduce((acc, row) => {
    acc.total_count += Number(row.total_count || 0);
    acc.draft_count += Number(row.draft_count || 0);
    acc.confirmed_count += Number(row.confirmed_count || 0);
    acc.sent_count += Number(row.sent_count || 0);
    acc.expired_count += Number(row.expired_count || 0);
    acc.cancelled_count += Number(row.cancelled_count || 0);
    acc.total_amount_this_month += Number(row.total_amount_this_month || 0);
    return acc;
  }, emptyDashboardMetrics());
}

function setPageHeader(title, subtitle) {
  elements.pageTitle.textContent = title;
  elements.pageSubtitle.textContent = subtitle;
}

function renderLoading() {
  elements.pageContent.innerHTML = `<div class="loading-card">กำลังโหลดข้อมูล...</div>`;
}

function renderError(message) {
  elements.pageContent.innerHTML = `
    <div class="alert alert-error">${escapeHTML(message)}</div>
  `;
}

function showLoginError(message) {
  elements.loginError.classList.remove("hidden");
  elements.loginError.textContent = message;
}

function hideLoginError() {
  elements.loginError.classList.add("hidden");
  elements.loginError.textContent = "";
}

function setLoginLoading(isLoading) {
  elements.loginButton.disabled = isLoading;
  elements.loginButton.textContent = isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ";
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");

  setTimeout(() => {
    elements.toast.classList.add("hidden");
  }, 2600);
}

function statusBadge(status) {
  return `<span class="status-badge status-${status}">${statusLabel(status)}</span>`;
}

function statusPill(label, style) {
  return `<span class="status-badge status-${style}">${label}</span>`;
}

function statusLabel(status) {
  const map = {
    draft: "ร่าง",
    confirmed: "ยืนยันแล้ว",
    sent: "ส่งแล้ว",
    expired: "หมดอายุ",
    cancelled: "ยกเลิก",
  };

  return map[status] || status || "-";
}

function roleLabel(role) {
  const map = {
    admin: "Admin",
    manager: "Manager",
    sales: "Sales",
  };

  return map[role] || role || "-";
}

function billingTypeLabel(type) {
  const map = {
    monthly: "รายเดือน",
    yearly: "รายปี",
  };

  return map[type] || "-";
}

function menuIcon(key) {
  const icons = {
    dashboard: "📊",
    quotations: "📄",
    customers: "🏢",
    products: "📦",
    company: "🏛️",
    settings: "⚙️",
  };

  return icons[key] || "•";
}

function formatTHB(value) {
  const numberValue = Number(value || 0);

  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
  }).format(numberValue);
}

function formatDate(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

function number(value) {
  return new Intl.NumberFormat("th-TH").format(Number(value || 0));
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
