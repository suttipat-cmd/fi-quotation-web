const SUPABASE_URL = "https://fjncvrsegkmrowvryttu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqbmN2cnNlZ2ttcm93dnJ5dHR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzkzMjYsImV4cCI6MjA5MzY1NTMyNn0.d8III1KlP5kJFes7ujFkfwZ9ombMYc-_4vNIazIg6zw";

const isConfigured =
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_ANON_KEY.length > 30 &&
  !SUPABASE_URL.includes("PASTE_") &&
  !SUPABASE_ANON_KEY.includes("PASTE_");

const supabaseClient = isConfigured && window.supabase?.createClient
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
    appState.currentPage = getPageFromHash();
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
      const isActive =
        item.key === appState.currentPage ||
        (item.key === "quotations" && appState.currentPage.startsWith("quotation-"));

      const activeClass = isActive ? "active" : "";

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
    } else if (page === "quotation-new") {
      await renderQuotationCreatePage();
    } else if (page.startsWith("quotation-view/")) {
      const quotationId = page.replace("quotation-view/", "");
      await renderQuotationViewPage(quotationId);
    } else if (page.startsWith("quotation-print/")) {
      const quotationId = page.replace("quotation-print/", "");
      await renderQuotationPrintPage(quotationId);
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
    renderError(error.message || "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
  }
}

// =======================================================
// Dashboard
// =======================================================

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

// =======================================================
// Quotation List
// =======================================================

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
  const canCreate = appState.profile.role !== "manager";

  elements.pageContent.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>รายการใบเสนอราคา</h3>
          <p>Draft จะยังไม่มีเลขเอกสาร เลขจะถูกสร้างเมื่อ Confirm</p>
        </div>

        ${
          canCreate
            ? `<button id="newQuotationButton" class="btn btn-primary">+ สร้างใบเสนอราคา</button>`
            : ``
        }
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
  const newButton = $("#newQuotationButton");

  if (newButton) {
    newButton.addEventListener("click", () => {
      location.hash = "#quotation-new";
    });
  }

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
    bindQuotationTableActions();
  }

  searchInput.addEventListener("input", updateTable);
  statusFilter.addEventListener("change", updateTable);

  updateTable();
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
            <th>Action</th>
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
              <td>
                <button class="btn btn-ghost" data-action="view" data-id="${row.id}">
                  ดูรายละเอียด
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function bindQuotationTableActions() {
  document.querySelectorAll("[data-action='view']").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      location.hash = `#quotation-view/${id}`;
    });
  });
}

// =======================================================
// Create Draft
// =======================================================

async function renderQuotationCreatePage() {
  if (appState.profile.role === "manager") {
    renderError("Manager สามารถดูและ Export/Print ได้ แต่ไม่สามารถสร้างใบเสนอราคาใน MVP นี้");
    return;
  }

  setPageHeader("สร้างใบเสนอราคา", "บันทึกเป็น Draft ก่อน ระบบจะสร้างเลขเอกสารเมื่อ Confirm");
  renderLoading();

  const [productsResult, companyResult] = await Promise.all([
    supabaseClient
      .from("products")
      .select("id, code, name, description, default_unit, is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: true }),

    supabaseClient
      .from("company_profile")
      .select("*")
      .eq("is_default", true)
      .maybeSingle(),
  ]);

  if (productsResult.error) throw productsResult.error;
  if (companyResult.error) throw companyResult.error;

  const products = productsResult.data || [];
  const company = companyResult.data;

  if (!products.length) {
    renderError("ยังไม่มีสินค้า/บริการ กรุณาเพิ่ม Product Master ก่อน");
    return;
  }

  const today = toDateInputValue(new Date());
  const validUntil = toDateInputValue(addDays(new Date(), 30));

  elements.pageContent.innerHTML = `
    <form id="quotationDraftForm" class="form-layout">
      <div class="form-main">
        <section class="form-section">
          <h3>1. ข้อมูลลูกค้า</h3>
          <div class="form-grid">
            <div class="field full">
              <label for="draftCustomerName">ชื่อลูกค้า *</label>
              <input id="draftCustomerName" type="text" placeholder="เช่น บริษัท ตัวอย่าง จำกัด" required />
            </div>

            <div class="field full">
              <label for="draftCustomerAddress">ที่อยู่ลูกค้า</label>
              <textarea id="draftCustomerAddress" rows="3" placeholder="ที่อยู่สำหรับแสดงบนใบเสนอราคา"></textarea>
            </div>
          </div>
        </section>

        <section class="form-section">
          <h3>2. ข้อมูลเอกสาร</h3>
          <div class="form-grid">
            <div class="field">
              <label>เลขที่เอกสาร</label>
              <input type="text" value="จะสร้างเมื่อ Confirm" disabled />
              <div class="inline-note">Draft จะยังไม่มีเลขใบเสนอราคา</div>
            </div>

            <div class="field">
              <label for="draftQuoteDate">วันที่ออกเอกสาร</label>
              <input id="draftQuoteDate" type="date" value="${today}" />
            </div>

            <div class="field">
              <label for="draftValidUntil">วันหมดอายุ</label>
              <input id="draftValidUntil" type="date" value="${validUntil}" />
            </div>

            <div class="field">
              <label>ผู้ขาย</label>
              <input type="text" value="${escapeHTML(appState.profile.full_name || appState.profile.email)}" disabled />
            </div>
          </div>
        </section>

        <section class="form-section">
          <h3>3. ประเภทการชำระเงิน</h3>
          <div class="field">
            <label for="draftBillingType">เลือกประเภท</label>
            <select id="draftBillingType">
              <option value="monthly">รายเดือน</option>
              <option value="yearly">รายปี</option>
            </select>
          </div>
        </section>

        <section class="form-section">
          <h3 id="draftRecurringTitle">4. ค่าบริการชำระรายเดือน</h3>

          <div class="line-box">
            <div class="form-grid">
              <div class="field">
                <label for="draftProductId">สินค้า/บริการ *</label>
                <select id="draftProductId" required>
                  ${products.map((product) => `
                    <option value="${product.id}">
                      ${escapeHTML(product.code || "")} ${escapeHTML(product.name)}
                    </option>
                  `).join("")}
                </select>
              </div>

              <div class="field">
                <label for="draftQuantity">จำนวนรถ</label>
                <input id="draftQuantity" type="number" min="0" step="1" value="20" />
                <div class="inline-note">ใช้เป็นเงื่อนไขราคา ไม่ได้นำไปคูณกับราคา</div>
              </div>

              <div class="field">
                <label for="draftUnitPrice">ราคา</label>
                <input id="draftUnitPrice" type="number" min="0" step="0.01" value="4500" />
                <div class="inline-note">ราคาสำหรับจำนวนรถและประเภทที่เลือก</div>
              </div>

              <div class="field">
                <label>หน่วย</label>
                <input id="draftUnit" type="text" value="${escapeHTML(products[0].default_unit || "คัน")}" />
              </div>

              <div class="field full">
                <label for="draftRecurringDescription">รายละเอียดเพิ่มเติม</label>
                <textarea id="draftRecurringDescription" rows="2" placeholder="รายละเอียดเพิ่มเติมของค่าบริการรายเดือน/รายปี"></textarea>
              </div>
            </div>
          </div>
        </section>

        <section class="form-section">
          <h3>5. ค่าบริการชำระครั้งเดียวจบ</h3>

          <div class="line-box">
            <div class="form-grid">
              <div class="field full">
                <label for="draftOneTimeName">รายการ</label>
                <input id="draftOneTimeName" type="text" value="ค่าบริการเซ็ตอัพข้อมูล" />
              </div>

              <div class="field">
                <label for="draftOneTimeQty">จำนวนครั้ง</label>
                <input id="draftOneTimeQty" type="number" min="0" step="1" value="1" />
              </div>

              <div class="field">
                <label for="draftOneTimePrice">ราคา/หน่วย</label>
                <input id="draftOneTimePrice" type="number" min="0" step="0.01" value="4500" />
              </div>

              <div class="field full">
                <label for="draftOneTimeDescription">รายละเอียดเพิ่มเติม</label>
                <textarea id="draftOneTimeDescription" rows="2">ค่าบริการเซ็ตอัพข้อมูลทั่วไปของหน่วยงาน\nค่าบริการฝึกอบรมซอฟต์แวร์ระบบ\nค่าบริการเซ็ตอัพทะเบียนรถ</textarea>
              </div>
            </div>
          </div>
        </section>

        <section class="form-section">
          <h3>6. ส่วนลด ภาษี และการปัดเศษ</h3>
          <div class="form-grid">
            <div class="field">
              <label for="draftDiscountPercent">ส่วนลดท้ายบิล (%)</label>
              <input id="draftDiscountPercent" type="number" min="0" max="100" step="0.01" value="0" />
            </div>

            <label class="checkbox-row">
              <input id="draftVatEnabled" type="checkbox" checked />
              <span>คิด VAT 7%</span>
            </label>

            <label class="checkbox-row">
              <input id="draftWhtEnabled" type="checkbox" checked />
              <span>หัก ณ ที่จ่าย 3%</span>
            </label>

            <label class="checkbox-row">
              <input id="draftRoundingEnabled" type="checkbox" />
              <span>ปัดยอดรวมเป็นจำนวนเต็ม</span>
            </label>
          </div>
        </section>

        <section class="form-section">
          <h3>7. หมายเหตุและเงื่อนไข</h3>
          <div class="form-grid">
            <div class="field full">
              <label for="draftNote">หมายเหตุ</label>
              <textarea id="draftNote" rows="6">${escapeHTML(company?.default_note || "")}</textarea>
            </div>

            <div class="field full">
              <label for="draftPaymentTerms">เงื่อนไขการชำระเงิน</label>
              <textarea id="draftPaymentTerms" rows="4">${escapeHTML(company?.default_payment_terms || "")}</textarea>
            </div>
          </div>
        </section>

        <div class="form-actions">
          <button type="button" id="cancelDraftButton" class="btn btn-ghost">
            ยกเลิก
          </button>
          <button type="submit" id="saveDraftButton" class="btn btn-primary">
            บันทึกร่าง
          </button>
        </div>
      </div>

      <aside class="summary-panel">
        <div class="summary-card">
          <h3>สรุปยอด</h3>

          <div class="summary-row">
            <span>มูลค่าก่อนภาษี</span>
            <strong id="summarySubtotal">0.00</strong>
          </div>

          <div class="summary-row">
            <span>ส่วนลด</span>
            <strong id="summaryDiscount">0.00</strong>
          </div>

          <div class="summary-row">
            <span>ฐานคำนวณภาษี</span>
            <strong id="summaryTaxable">0.00</strong>
          </div>

          <div class="summary-row">
            <span>VAT 7%</span>
            <strong id="summaryVat">0.00</strong>
          </div>

          <div class="summary-row">
            <span>หัก ณ ที่จ่าย 3%</span>
            <strong id="summaryWht">-0.00</strong>
          </div>

          <div class="summary-row">
            <span>ส่วนต่างปัดเศษ</span>
            <strong id="summaryRounding">0.00</strong>
          </div>

          <div class="summary-total">
            <span>ยอดรวมสุทธิ</span>
            <strong id="summaryGrandTotal">0.00</strong>
          </div>

          <p class="inline-note">
            จำนวนเงินตัวอักษรจะสร้างจาก Database เมื่อบันทึก/ยืนยันเอกสาร
          </p>
        </div>

        <div class="alert alert-warning">
          หลังจาก Confirm แล้ว ระบบจะล็อกเอกสาร หากต้องแก้ไขให้ Duplicate เป็นใบใหม่
        </div>
      </aside>
    </form>
  `;

  bindQuotationDraftForm(products);
  updateDraftSummary();
}

function bindQuotationDraftForm(products) {
  const form = $("#quotationDraftForm");
  const cancelButton = $("#cancelDraftButton");
  const billingType = $("#draftBillingType");
  const productSelect = $("#draftProductId");

  const calculationInputs = [
    "#draftBillingType",
    "#draftQuantity",
    "#draftUnitPrice",
    "#draftOneTimeQty",
    "#draftOneTimePrice",
    "#draftDiscountPercent",
    "#draftVatEnabled",
    "#draftWhtEnabled",
    "#draftRoundingEnabled",
  ];

  calculationInputs.forEach((selector) => {
    const input = $(selector);
    if (!input) return;

    input.addEventListener("input", updateDraftSummary);
    input.addEventListener("change", updateDraftSummary);
  });

  billingType.addEventListener("change", () => {
    applyBillingDefaults();
    updateDraftSummary();
  });

  productSelect.addEventListener("change", () => {
    const product = products.find((item) => item.id === productSelect.value);
    if (product) {
      $("#draftUnit").value = product.default_unit || "คัน";
    }
  });

  cancelButton.addEventListener("click", () => {
    location.hash = "#quotations";
  });

  form.addEventListener("submit", async (event) => {
    await handleSaveQuotationDraft(event, products);
  });
}

function applyBillingDefaults() {
  const billingType = $("#draftBillingType").value;
  const recurringTitle = $("#draftRecurringTitle");
  const unitPrice = $("#draftUnitPrice");
  const oneTimePrice = $("#draftOneTimePrice");

  if (billingType === "yearly") {
    recurringTitle.textContent = "4. ค่าบริการชำระรายปี";
    unitPrice.value = "54000";
    oneTimePrice.value = "0";
  } else {
    recurringTitle.textContent = "4. ค่าบริการชำระรายเดือน";
    unitPrice.value = "4500";
    oneTimePrice.value = "4500";
  }
}

function updateDraftSummary() {
  const unitPrice = readNumber("#draftUnitPrice");
  const oneTimeQty = readNumber("#draftOneTimeQty");
  const oneTimePrice = readNumber("#draftOneTimePrice");
  const discountPercent = readNumber("#draftDiscountPercent");

  const vatEnabled = $("#draftVatEnabled")?.checked ?? true;
  const whtEnabled = $("#draftWhtEnabled")?.checked ?? true;
  const roundingEnabled = $("#draftRoundingEnabled")?.checked ?? false;

  const recurringSubtotal = unitPrice;
  const oneTimeSubtotal = oneTimeQty * oneTimePrice;
  const subtotal = roundMoney(recurringSubtotal + oneTimeSubtotal);

  const discount = roundMoney(subtotal * discountPercent / 100);
  const taxable = roundMoney(subtotal - discount);
  const vat = vatEnabled ? roundMoney(taxable * 0.07) : 0;
  const wht = whtEnabled ? roundMoney(taxable * 0.03) : 0;
  const grandTotal = roundMoney(taxable + vat - wht);

  const displayTotal = roundingEnabled ? Math.round(grandTotal) : grandTotal;
  const rounding = roundMoney(displayTotal - grandTotal);

  $("#summarySubtotal").textContent = formatTHB(subtotal);
  $("#summaryDiscount").textContent = formatTHB(discount);
  $("#summaryTaxable").textContent = formatTHB(taxable);
  $("#summaryVat").textContent = formatTHB(vat);
  $("#summaryWht").textContent = `-${formatTHB(wht)}`;
  $("#summaryRounding").textContent = formatTHB(rounding);
  $("#summaryGrandTotal").textContent = formatTHB(displayTotal);
}

async function handleSaveQuotationDraft(event, products) {
  event.preventDefault();

  const saveButton = $("#saveDraftButton");
  saveButton.disabled = true;
  saveButton.textContent = "กำลังบันทึก...";

  try {
    const product = products.find((item) => item.id === $("#draftProductId").value);

    if (!product) {
      throw new Error("กรุณาเลือกสินค้า/บริการ");
    }

    const customerName = $("#draftCustomerName").value.trim();

    if (!customerName) {
      throw new Error("กรุณากรอกชื่อลูกค้า");
    }

    const quotePayload = {
      owner_id: appState.user.id,
      billing_type: $("#draftBillingType").value,
      customer_name: customerName,
      customer_address: $("#draftCustomerAddress").value.trim(),
      quote_date: $("#draftQuoteDate").value,
      valid_until: $("#draftValidUntil").value,

      vat_enabled: $("#draftVatEnabled").checked,
      vat_rate: 7,
      wht_enabled: $("#draftWhtEnabled").checked,
      wht_rate: 3,
      discount_percent: readNumber("#draftDiscountPercent"),
      rounding_enabled: $("#draftRoundingEnabled").checked,

      note: $("#draftNote").value.trim(),
      payment_terms: $("#draftPaymentTerms").value.trim(),
    };

    const { data: quotation, error: quotationError } = await supabaseClient
      .from("quotations")
      .insert(quotePayload)
      .select("id")
      .single();

    if (quotationError) throw quotationError;

    const quotationItems = [
      {
        quotation_id: quotation.id,
        section_type: "recurring",
        product_id: product.id,
        product_name_snapshot: product.name,
        description: $("#draftRecurringDescription")?.value.trim() || "",
        quantity_label: "จำนวนรถ",
        quantity: readNumber("#draftQuantity"),
        unit: $("#draftUnit").value.trim() || product.default_unit || "คัน",
        unit_price: readNumber("#draftUnitPrice"),
        sort_order: 1,
      },
      {
        quotation_id: quotation.id,
        section_type: "one_time",
        product_id: null,
        product_name_snapshot: $("#draftOneTimeName").value.trim() || "ค่าบริการชำระครั้งเดียว",
        description: $("#draftOneTimeDescription").value.trim(),
        quantity_label: "จำนวนครั้ง",
        quantity: readNumber("#draftOneTimeQty"),
        unit: "ครั้ง",
        unit_price: readNumber("#draftOneTimePrice"),
        sort_order: 1,
      },
    ];

    const { error: itemError } = await supabaseClient
      .from("quotation_items")
      .insert(quotationItems);

    if (itemError) throw itemError;

    await updateQuotationTotalsSnapshot(quotation.id);

    showToast("บันทึกร่างสำเร็จ");
    location.hash = `#quotation-view/${quotation.id}`;
  } catch (error) {
    console.error(error);
    showToast(error.message || "ไม่สามารถบันทึกร่างได้");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "บันทึกร่าง";
  }
}

async function updateQuotationTotalsSnapshot(quotationId) {
  const { data, error } = await supabaseClient.rpc("calculate_quotation_totals", {
    p_quotation_id: quotationId,
  });

  if (error) throw error;

  const totals = Array.isArray(data) ? data[0] : data;

  if (!totals) return;

  const { error: updateError } = await supabaseClient
    .from("quotations")
    .update({
      subtotal_amount: totals.subtotal_amount,
      discount_amount: totals.discount_amount,
      taxable_amount: totals.taxable_amount,
      vat_amount: totals.vat_amount,
      wht_amount: totals.wht_amount,
      grand_total: totals.grand_total,
      rounding_adjustment: totals.rounding_adjustment,
      grand_total_display: totals.grand_total_display,
      amount_text_th: totals.amount_text_th,
    })
    .eq("id", quotationId);

  if (updateError) throw updateError;
}

// =======================================================
// Quotation View / Actions
// =======================================================

async function renderQuotationViewPage(quotationId) {
  if (!quotationId) {
    renderError("ไม่พบรหัสใบเสนอราคา");
    return;
  }

  setPageHeader("รายละเอียดใบเสนอราคา", "ตรวจสอบข้อมูลก่อน Confirm หรือส่งออกเอกสาร");
  renderLoading();

  const [quotationResult, itemsResult] = await Promise.all([
    supabaseClient
      .from("quotations")
      .select("*")
      .eq("id", quotationId)
      .single(),

    supabaseClient
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("section_type", { ascending: false })
      .order("sort_order", { ascending: true }),
  ]);

  if (quotationResult.error) throw quotationResult.error;
  if (itemsResult.error) throw itemsResult.error;

  const quotation = quotationResult.data;
  const items = itemsResult.data || [];

  const ownerResult = await supabaseClient
    .from("profiles")
    .select("full_name, email")
    .eq("id", quotation.owner_id)
    .maybeSingle();

  const ownerName =
    quotation.sales_name_snapshot ||
    ownerResult.data?.full_name ||
    ownerResult.data?.email ||
    "-";

  const recurringItems = items.filter((item) => item.section_type === "recurring");
  const oneTimeItems = items.filter((item) => item.section_type === "one_time");
  const effectiveStatus = getEffectiveStatusFromQuotation(quotation);

  elements.pageContent.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>${escapeHTML(quotation.quotation_no || "ยังไม่ออกเลขเอกสาร")}</h3>
          <p>${escapeHTML(quotation.customer_name || "-")} · ${billingTypeLabel(quotation.billing_type)}</p>
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end;">
          <button id="backToListButton" class="btn btn-ghost">กลับไปหน้ารายการ</button>
          ${renderQuotationActionButtons(quotation, effectiveStatus)}
        </div>
      </div>

      <div class="alert alert-warning ${quotation.status === "draft" ? "" : "hidden"}">
        เอกสารนี้ยังเป็น Draft และยังไม่มีเลขใบเสนอราคา กด Confirm เพื่อสร้างเลขและล็อกเอกสาร
      </div>

      <div class="kv-list">
        <div class="kv-row">
          <span>สถานะ</span>
          <strong>${statusBadge(effectiveStatus)}</strong>
        </div>
        <div class="kv-row">
          <span>ลูกค้า</span>
          <strong>${escapeHTML(quotation.customer_name || "-")}</strong>
        </div>
        <div class="kv-row">
          <span>ที่อยู่ลูกค้า</span>
          <strong>${escapeHTML(quotation.customer_address || "-")}</strong>
        </div>
        <div class="kv-row">
          <span>วันที่ออกเอกสาร</span>
          <strong>${formatDate(quotation.quote_date)}</strong>
        </div>
        <div class="kv-row">
          <span>วันหมดอายุ</span>
          <strong>${formatDate(quotation.valid_until)}</strong>
        </div>
        <div class="kv-row">
          <span>ผู้ขาย</span>
          <strong>${escapeHTML(ownerName)}</strong>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3>${quotation.billing_type === "yearly" ? "ค่าบริการชำระรายปี" : "ค่าบริการชำระรายเดือน"}</h3>
          <p>จำนวนรถใช้เป็นเงื่อนไขราคา ไม่ได้นำไปคูณกับราคา</p>
        </div>
      </div>
      ${renderQuotationItemsTable(recurringItems)}
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3>ค่าบริการชำระครั้งเดียวจบ</h3>
          <p>ค่าแรกเข้า / Setup / Training</p>
        </div>
      </div>
      ${renderQuotationItemsTable(oneTimeItems)}
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3>สรุปยอด</h3>
          <p>${escapeHTML(quotation.amount_text_th || "-")}</p>
        </div>
      </div>

      <div class="kv-list">
        <div class="kv-row">
          <span>มูลค่าก่อนภาษี</span>
          <strong>${formatTHB(quotation.subtotal_amount)}</strong>
        </div>
        <div class="kv-row">
          <span>ส่วนลด</span>
          <strong>${formatTHB(quotation.discount_amount)}</strong>
        </div>
        <div class="kv-row">
          <span>ฐานคำนวณภาษี</span>
          <strong>${formatTHB(quotation.taxable_amount)}</strong>
        </div>
        <div class="kv-row">
          <span>VAT ${Number(quotation.vat_rate || 0)}%</span>
          <strong>${formatTHB(quotation.vat_amount)}</strong>
        </div>
        <div class="kv-row">
          <span>หัก ณ ที่จ่าย ${Number(quotation.wht_rate || 0)}%</span>
          <strong>-${formatTHB(quotation.wht_amount)}</strong>
        </div>
        <div class="kv-row">
          <span>ส่วนต่างปัดเศษ</span>
          <strong>${formatTHB(quotation.rounding_adjustment)}</strong>
        </div>
        <div class="kv-row">
          <span>ยอดรวมสุทธิ</span>
          <strong style="font-size:22px;">${formatTHB(quotation.grand_total_display)}</strong>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3>หมายเหตุและเงื่อนไข</h3>
          <p>ข้อความที่จะแสดงในเอกสาร</p>
        </div>
      </div>

      <div class="kv-list">
        <div class="kv-row">
          <span>หมายเหตุ</span>
          <strong style="white-space:pre-wrap;">${escapeHTML(quotation.note || "-")}</strong>
        </div>
        <div class="kv-row">
          <span>เงื่อนไขการชำระเงิน</span>
          <strong style="white-space:pre-wrap;">${escapeHTML(quotation.payment_terms || "-")}</strong>
        </div>
      </div>
    </div>
  `;

  bindQuotationViewActions(quotation);
}

function renderQuotationActionButtons(quotation, effectiveStatus) {
  const role = appState.profile.role;
  const isOwner = quotation.owner_id === appState.user.id;
  const canModify = role === "admin" || (role === "sales" && isOwner);

  if (!canModify) {
    return "";
  }

  const buttons = [];

  if (quotation.status === "draft") {
    buttons.push(`
      <button id="confirmQuotationButton" class="btn btn-primary">
        Confirm และสร้างเลข
      </button>
    `);
  }

  if (quotation.status === "confirmed" && effectiveStatus === "confirmed") {
    buttons.push(`
      <button id="markSentButton" class="btn btn-primary">
        เปลี่ยนเป็นส่งแล้ว
      </button>
    `);
  }

  if (quotation.status !== "draft") {
    buttons.push(`
      <button id="printPreviewButton" class="btn btn-primary">
        Preview / Print
      </button>
    `);

    buttons.push(`
      <button id="duplicateQuotationButton" class="btn btn-ghost">
        สร้างสำเนา
      </button>
    `);
  }

  return buttons.join("");
}

function bindQuotationViewActions(quotation) {
  const backButton = $("#backToListButton");
  const confirmButton = $("#confirmQuotationButton");
  const markSentButton = $("#markSentButton");
  const printPreviewButton = $("#printPreviewButton");
  const duplicateButton = $("#duplicateQuotationButton");

  if (backButton) {
    backButton.addEventListener("click", () => {
      location.hash = "#quotations";
    });
  }

  if (confirmButton) {
    confirmButton.addEventListener("click", async () => {
      await confirmQuotation(quotation.id);
    });
  }

  if (markSentButton) {
    markSentButton.addEventListener("click", async () => {
      await markQuotationAsSent(quotation.id);
    });
  }

  if (printPreviewButton) {
    printPreviewButton.addEventListener("click", () => {
      location.hash = `#quotation-print/${quotation.id}`;
    });
  }

  if (duplicateButton) {
    duplicateButton.addEventListener("click", async () => {
      await duplicateQuotation(quotation.id);
    });
  }
}

async function confirmQuotation(quotationId) {
  const ok = window.confirm(
    "ยืนยันใบเสนอราคา?\n\nระบบจะสร้างเลขใบเสนอราคาและล็อกเอกสารนี้ หลังจาก Confirm แล้วจะแก้ไขไม่ได้ หากต้องการแก้ไขต้องสร้างสำเนาเป็นใบใหม่"
  );

  if (!ok) return;

  try {
    showToast("กำลัง Confirm ใบเสนอราคา...");

    const { data, error } = await supabaseClient.rpc("confirm_quotation", {
      p_quotation_id: quotationId,
    });

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    const quotationNo = result?.quotation_no || "สร้างเลขสำเร็จ";

    showToast(`Confirm สำเร็จ: ${quotationNo}`);
    await renderQuotationViewPage(quotationId);
  } catch (error) {
    console.error(error);
    showToast(error.message || "ไม่สามารถ Confirm ใบเสนอราคาได้");
  }
}

async function markQuotationAsSent(quotationId) {
  const ok = window.confirm("เปลี่ยนสถานะใบเสนอราคานี้เป็น “ส่งแล้ว” ใช่ไหม?");
  if (!ok) return;

  try {
    showToast("กำลังเปลี่ยนสถานะ...");

    const { error } = await supabaseClient.rpc("change_quotation_status", {
      p_quotation_id: quotationId,
      p_new_status: "sent",
    });

    if (error) throw error;

    showToast("เปลี่ยนสถานะเป็นส่งแล้ว");
    await renderQuotationViewPage(quotationId);
  } catch (error) {
    console.error(error);
    showToast(error.message || "ไม่สามารถเปลี่ยนสถานะได้");
  }
}

async function duplicateQuotation(quotationId) {
  const ok = window.confirm("สร้างสำเนาใบเสนอราคานี้เป็น Draft ใหม่ใช่ไหม?");
  if (!ok) return;

  try {
    showToast("กำลังสร้างสำเนา...");

    const { data, error } = await supabaseClient.rpc("duplicate_quotation", {
      p_quotation_id: quotationId,
    });

    if (error) throw error;

    const newId = Array.isArray(data) ? data[0] : data;

    showToast("สร้างสำเนาสำเร็จ");
    location.hash = `#quotation-view/${newId}`;
  } catch (error) {
    console.error(error);
    showToast(error.message || "ไม่สามารถสร้างสำเนาได้");
  }
}

function renderQuotationItemsTable(items) {
  if (!items.length) {
    return `<div class="empty-state">ไม่มีรายการในส่วนนี้</div>`;
  }

  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>ลำดับ</th>
            <th>รายละเอียด</th>
            <th>จำนวน</th>
            <th>หน่วย</th>
            <th>ราคา</th>
            <th>มูลค่าก่อนภาษี</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => {
            const lineSubtotal =
              item.line_subtotal ??
              (item.section_type === "recurring"
                ? item.unit_price
                : Number(item.quantity || 0) * Number(item.unit_price || 0));

            return `
              <tr>
                <td>${index + 1}</td>
                <td>
                  <strong>${escapeHTML(item.product_name_snapshot || "-")}</strong>
                  ${
                    item.description
                      ? `<div class="inline-note">${escapeHTML(item.description)}</div>`
                      : ""
                  }
                </td>
                <td>${number(item.quantity)}</td>
                <td>${escapeHTML(item.unit || "-")}</td>
                <td>${formatTHB(item.unit_price)}</td>
                <td>${formatTHB(lineSubtotal)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function getEffectiveStatusFromQuotation(quotation) {
  if (
    ["confirmed", "sent"].includes(quotation.status) &&
    quotation.valid_until &&
    new Date(quotation.valid_until) < startOfToday()
  ) {
    return "expired";
  }

  return quotation.status;
}


// =======================================================
// Print-friendly Quotation Page
// =======================================================

async function renderQuotationPrintPage(quotationId) {
  if (!quotationId) {
    renderError("ไม่พบรหัสใบเสนอราคา");
    return;
  }

  setPageHeader("Preview / Print", "ตรวจสอบเอกสารก่อนพิมพ์หรือบันทึกเป็น PDF");
  renderLoading();

  const [quotationResult, itemsResult, defaultCompanyResult] = await Promise.all([
    supabaseClient
      .from("quotations")
      .select("*")
      .eq("id", quotationId)
      .single(),

    supabaseClient
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("section_type", { ascending: false })
      .order("sort_order", { ascending: true }),

    supabaseClient
      .from("company_profile")
      .select("*")
      .eq("is_default", true)
      .maybeSingle(),
  ]);

  if (quotationResult.error) throw quotationResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (defaultCompanyResult.error) throw defaultCompanyResult.error;

  const quotation = quotationResult.data;
  const items = itemsResult.data || [];
  const defaultCompany = defaultCompanyResult.data || {};

  if (quotation.status === "draft") {
    elements.pageContent.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3>ยังไม่สามารถ Preview / Print ได้</h3>
            <p>ต้อง Confirm ใบเสนอราคาเพื่อสร้างเลขเอกสารก่อน</p>
          </div>
          <button class="btn btn-ghost" onclick="location.hash='quotation-view/${quotation.id}'">
            กลับไปหน้ารายละเอียด
          </button>
        </div>
      </div>
    `;
    return;
  }

  const ownerResult = await supabaseClient
    .from("profiles")
    .select("full_name, email")
    .eq("id", quotation.owner_id)
    .maybeSingle();

  const ownerName =
    quotation.sales_name_snapshot ||
    ownerResult.data?.full_name ||
    ownerResult.data?.email ||
    "-";

  const company = getCompanySnapshot(quotation, defaultCompany);
  const recurringItems = items.filter((item) => item.section_type === "recurring");
  const oneTimeItems = items.filter((item) => item.section_type === "one_time");

  elements.pageContent.innerHTML = `
    <div class="print-toolbar">
      <div>
        <strong>${escapeHTML(quotation.quotation_no || "-")}</strong>
        <div class="print-muted">${escapeHTML(quotation.customer_name || "-")}</div>
      </div>

      <div class="print-toolbar-actions">
        <button id="backFromPrintButton" class="btn btn-ghost">กลับไปหน้ารายละเอียด</button>
        <button id="printButton" class="btn btn-primary">พิมพ์ / บันทึกเป็น PDF</button>
      </div>
    </div>

    <div class="print-page-wrap">
      <article class="print-page">
        <header class="print-header">
          <div class="print-company">
            ${company.logo_url ? `<img class="print-logo" src="${escapeHTML(company.logo_url)}" alt="logo" />` : `<div class="print-logo">FI</div>`}
            <div>
              <h1>${escapeHTML(company.company_name || "-")}</h1>
              <p>${escapeHTML(company.address || "-")}</p>
              <p>เลขประจำตัวผู้เสียภาษี: ${escapeHTML(company.tax_id || "-")} ${company.branch_name ? `(${escapeHTML(company.branch_name)})` : ""}</p>
              <p>โทร: ${escapeHTML(company.phone || "-")} · อีเมล: ${escapeHTML(company.email || "-")}</p>
            </div>
          </div>

          <div class="print-doc-title">
            <h1>ใบเสนอราคา</h1>
            <p>QUOTATION</p>
          </div>
        </header>

        <section class="print-info-grid">
          <div class="print-box">
            <h3>ข้อมูลลูกค้า</h3>
            <div class="print-row"><span>เรียน</span><strong>${escapeHTML(quotation.customer_name || "-")}</strong></div>
            <div class="print-row"><span>ที่อยู่</span><strong>${escapeHTML(quotation.customer_address || "-")}</strong></div>
          </div>

          <div class="print-box">
            <h3>ข้อมูลเอกสาร</h3>
            <div class="print-row"><span>เลขที่</span><strong>${escapeHTML(quotation.quotation_no || "-")}</strong></div>
            <div class="print-row"><span>วันที่</span><strong>${formatDate(quotation.quote_date)}</strong></div>
            <div class="print-row"><span>วันหมดอายุ</span><strong>${formatDate(quotation.valid_until)}</strong></div>
            <div class="print-row"><span>ผู้เสนอราคา</span><strong>${escapeHTML(ownerName)}</strong></div>
          </div>
        </section>

        <section class="print-section">
          <h2 class="print-section-title">${quotation.billing_type === "yearly" ? "ค่าบริการชำระรายปี" : "ค่าบริการชำระรายเดือน"}</h2>
          ${renderPrintItemsTable(recurringItems, true)}
        </section>

        <section class="print-section">
          <h2 class="print-section-title">ค่าบริการชำระครั้งเดียวจบ</h2>
          ${renderPrintItemsTable(oneTimeItems, false)}
        </section>

        <section class="print-summary-grid">
          <div>
            <div class="print-note-box"><strong>หมายเหตุ</strong>\n${escapeHTML(quotation.note || "-")}</div>
            <div class="print-note-box" style="margin-top:10px;"><strong>เงื่อนไขการชำระเงิน</strong>\n${escapeHTML(quotation.payment_terms || "-")}</div>
          </div>

          <div>
            ${renderPrintSummary(quotation)}
            <div class="print-amount-text">${escapeHTML(quotation.amount_text_th || "-")}</div>
          </div>
        </section>

        <section class="print-bank-box">
          <strong>ข้อมูลบัญชีสำหรับชำระเงิน</strong>
          <div class="print-row"><span>ธนาคาร</span><strong>${escapeHTML(company.bank_name || "-")}</strong></div>
          <div class="print-row"><span>ชื่อบัญชี</span><strong>${escapeHTML(company.bank_account_name || "-")}</strong></div>
          <div class="print-row"><span>เลขบัญชี</span><strong>${escapeHTML(company.bank_account_no || "-")}</strong></div>
          <div class="print-row"><span>หมายเหตุ</span><strong>${escapeHTML(company.payment_note || "-")}</strong></div>
        </section>

        <footer class="print-footer-grid">
          <div class="print-signature-box">
            <strong>ยืนยันรับราคา / ลูกค้า</strong>
            <div class="print-signature-line"></div>
            <div>วันที่ ______ / ______ / ______</div>
          </div>

          <div class="print-signature-box">
            <strong>ผู้เสนอราคา</strong>
            <div class="print-signature-line"></div>
            <div>${escapeHTML(ownerName)}</div>
          </div>
        </footer>
      </article>
    </div>
  `;

  const printButton = $("#printButton");
  const backButton = $("#backFromPrintButton");

  if (printButton) {
    printButton.addEventListener("click", () => window.print());
  }

  if (backButton) {
    backButton.addEventListener("click", () => {
      location.hash = `#quotation-view/${quotation.id}`;
    });
  }
}

function getCompanySnapshot(quotation, fallbackCompany) {
  return {
    company_name: quotation.company_name_snapshot || fallbackCompany.company_name,
    tax_id: quotation.company_tax_id_snapshot || fallbackCompany.tax_id,
    branch_name: quotation.company_branch_name_snapshot || fallbackCompany.branch_name,
    address: quotation.company_address_snapshot || fallbackCompany.address,
    phone: quotation.company_phone_snapshot || fallbackCompany.phone,
    email: quotation.company_email_snapshot || fallbackCompany.email,
    logo_url: quotation.company_logo_url_snapshot || fallbackCompany.logo_url,
    bank_name: quotation.bank_name_snapshot || fallbackCompany.bank_name,
    bank_account_name: quotation.bank_account_name_snapshot || fallbackCompany.bank_account_name,
    bank_account_no: quotation.bank_account_no_snapshot || fallbackCompany.bank_account_no,
    payment_note: quotation.payment_note_snapshot || fallbackCompany.payment_note,
  };
}

function renderPrintItemsTable(items, isRecurring) {
  if (!items.length) {
    return `
      <table class="print-table">
        <tbody><tr><td>ไม่มีรายการ</td></tr></tbody>
      </table>
    `;
  }

  return `
    <table class="print-table">
      <thead>
        <tr>
          <th class="center" style="width:12mm;">ลำดับ</th>
          <th>รายละเอียด</th>
          <th class="num" style="width:22mm;">${isRecurring ? "จำนวนรถ" : "จำนวน"}</th>
          <th class="center" style="width:18mm;">หน่วย</th>
          <th class="num" style="width:30mm;">ราคา</th>
          <th class="num" style="width:32mm;">มูลค่าก่อนภาษี</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, index) => {
          const lineSubtotal =
            item.line_subtotal ??
            (item.section_type === "recurring"
              ? item.unit_price
              : Number(item.quantity || 0) * Number(item.unit_price || 0));

          return `
            <tr>
              <td class="center">${index + 1}</td>
              <td>
                <strong>${escapeHTML(item.product_name_snapshot || "-")}</strong>
                ${item.description ? `<div class="print-muted">${escapeHTML(item.description)}</div>` : ""}
              </td>
              <td class="num">${number(item.quantity)}</td>
              <td class="center">${escapeHTML(item.unit || "-")}</td>
              <td class="num">${formatTHB(item.unit_price)}</td>
              <td class="num">${formatTHB(lineSubtotal)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderPrintSummary(quotation) {
  return `
    <table class="print-summary-table">
      <tbody>
        <tr><td>มูลค่าก่อนภาษี</td><td>${formatTHB(quotation.subtotal_amount)}</td></tr>
        <tr><td>ส่วนลด</td><td>${formatTHB(quotation.discount_amount)}</td></tr>
        <tr><td>ฐานคำนวณภาษี</td><td>${formatTHB(quotation.taxable_amount)}</td></tr>
        <tr><td>VAT ${Number(quotation.vat_rate || 0)}%</td><td>${formatTHB(quotation.vat_amount)}</td></tr>
        <tr><td>หัก ณ ที่จ่าย ${Number(quotation.wht_rate || 0)}%</td><td>-${formatTHB(quotation.wht_amount)}</td></tr>
        <tr><td>ส่วนต่างปัดเศษ</td><td>${formatTHB(quotation.rounding_adjustment)}</td></tr>
        <tr class="print-grand-total"><td>ยอดรวมสุทธิ</td><td>${formatTHB(quotation.grand_total_display)}</td></tr>
      </tbody>
    </table>
  `;
}

// =======================================================
// Customers / Products / Company / Settings
// =======================================================

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

// =======================================================
// Render Helpers
// =======================================================

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

// =======================================================
// UI Utilities
// =======================================================

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

  return new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
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

function readNumber(selector) {
  const value = Number($(selector)?.value || 0);
  return Number.isFinite(value) ? value : 0;
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toDateInputValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

// =======================================================
// v0.5 Overrides: Edit Draft + Price Lookup
// =======================================================

async function renderCurrentPage() {
  if (!appState.profile) return;

  renderMenu();

  const page = appState.currentPage;

  try {
    if (page === "dashboard") {
      await renderDashboardPage();
    } else if (page === "quotations") {
      await renderQuotationsPage();
    } else if (page === "quotation-new") {
      await renderQuotationCreatePage();
    } else if (page.startsWith("quotation-edit/")) {
      const quotationId = page.replace("quotation-edit/", "");
      await renderQuotationEditPage(quotationId);
    } else if (page.startsWith("quotation-view/")) {
      const quotationId = page.replace("quotation-view/", "");
      await renderQuotationViewPage(quotationId);
    } else if (page.startsWith("quotation-print/")) {
      const quotationId = page.replace("quotation-print/", "");
      await renderQuotationPrintPage(quotationId);
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
    renderError(error.message || "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
  }
}

async function renderQuotationCreatePage() {
  await renderQuotationFormPage({
    mode: "create",
    quotationId: null,
  });
}

async function renderQuotationEditPage(quotationId) {
  await renderQuotationFormPage({
    mode: "edit",
    quotationId,
  });
}

async function renderQuotationFormPage({ mode, quotationId }) {
  if (appState.profile.role === "manager") {
    renderError("Manager สามารถดูและ Export/Print ได้ แต่ไม่สามารถสร้างหรือแก้ไขใบเสนอราคาใน MVP นี้");
    return;
  }

  const isEdit = mode === "edit";

  setPageHeader(
    isEdit ? "แก้ไข Draft" : "สร้างใบเสนอราคา",
    isEdit
      ? "แก้ไขได้เฉพาะเอกสารสถานะ Draft เท่านั้น"
      : "บันทึกเป็น Draft ก่อน ระบบจะสร้างเลขเอกสารเมื่อ Confirm"
  );
  renderLoading();

  const [productsResult, companyResult] = await Promise.all([
    supabaseClient
      .from("products")
      .select("id, code, name, description, default_unit, is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: true }),

    supabaseClient
      .from("company_profile")
      .select("*")
      .eq("is_default", true)
      .maybeSingle(),
  ]);

  if (productsResult.error) throw productsResult.error;
  if (companyResult.error) throw companyResult.error;

  const products = productsResult.data || [];
  const company = companyResult.data;

  if (!products.length) {
    renderError("ยังไม่มีสินค้า/บริการ กรุณาเพิ่ม Product Master ก่อน");
    return;
  }

  let quotation = null;
  let items = [];

  if (isEdit) {
    const [quotationResult, itemsResult] = await Promise.all([
      supabaseClient
        .from("quotations")
        .select("*")
        .eq("id", quotationId)
        .single(),

      supabaseClient
        .from("quotation_items")
        .select("*")
        .eq("quotation_id", quotationId)
        .order("section_type", { ascending: false })
        .order("sort_order", { ascending: true }),
    ]);

    if (quotationResult.error) throw quotationResult.error;
    if (itemsResult.error) throw itemsResult.error;

    quotation = quotationResult.data;
    items = itemsResult.data || [];

    const isOwner = quotation.owner_id === appState.user.id;
    const canEdit = appState.profile.role === "admin" || (appState.profile.role === "sales" && isOwner);

    if (!canEdit) {
      renderError("คุณไม่มีสิทธิ์แก้ไขใบเสนอราคานี้");
      return;
    }

    if (quotation.status !== "draft") {
      renderError("แก้ไขได้เฉพาะใบเสนอราคาสถานะ Draft เท่านั้น หากต้องการแก้ไขเอกสารที่ Confirm แล้วให้ใช้ปุ่มสร้างสำเนา");
      return;
    }
  }

  const recurringItem = items.find((item) => item.section_type === "recurring") || {};
  const oneTimeItem = items.find((item) => item.section_type === "one_time") || {};

  const selectedProductId = recurringItem.product_id || products[0].id;
  const selectedProduct = products.find((product) => product.id === selectedProductId) || products[0];

  const today = toDateInputValue(new Date());
  const validUntil = toDateInputValue(addDays(new Date(), 30));

  const formValues = {
    customerName: quotation?.customer_name || "",
    customerAddress: quotation?.customer_address || "",
    quoteDate: quotation?.quote_date || today,
    validUntil: quotation?.valid_until || validUntil,
    billingType: quotation?.billing_type || "monthly",
    productId: selectedProductId,
    quantity: recurringItem.quantity ?? 20,
    unitPrice: recurringItem.unit_price ?? 4500,
    unit: recurringItem.unit || selectedProduct.default_unit || "คัน",
    recurringDescription: recurringItem.description || "",
    oneTimeName: oneTimeItem.product_name_snapshot || "ค่าบริการเซ็ตอัพข้อมูล",
    oneTimeQty: oneTimeItem.quantity ?? 1,
    oneTimePrice: oneTimeItem.unit_price ?? 4500,
    oneTimeDescription:
      oneTimeItem.description ||
      "ค่าบริการเซ็ตอัพข้อมูลทั่วไปของหน่วยงาน\nค่าบริการฝึกอบรมซอฟต์แวร์ระบบ\nค่าบริการเซ็ตอัพทะเบียนรถ",
    discountPercent: quotation?.discount_percent ?? 0,
    vatEnabled: quotation?.vat_enabled ?? true,
    whtEnabled: quotation?.wht_enabled ?? true,
    roundingEnabled: quotation?.rounding_enabled ?? false,
    note: quotation?.note ?? company?.default_note ?? "",
    paymentTerms: quotation?.payment_terms ?? company?.default_payment_terms ?? "",
  };

  elements.pageContent.innerHTML = `
    <form id="quotationDraftForm" class="form-layout">
      <div class="form-main">
        <div class="form-status-note">
          ${
            isEdit
              ? "กำลังแก้ไข Draft เดิม ระบบจะยังไม่สร้างเลขเอกสารจนกว่าจะกด Confirm"
              : "สร้าง Draft ใหม่ เลขใบเสนอราคาจะถูกสร้างตอนกด Confirm เท่านั้น"
          }
        </div>

        <section class="form-section">
          <h3>1. ข้อมูลลูกค้า</h3>
          <div class="form-grid">
            <div class="field full">
              <label for="draftCustomerName">ชื่อลูกค้า *</label>
              <input id="draftCustomerName" type="text" placeholder="เช่น บริษัท ตัวอย่าง จำกัด" value="${escapeHTML(formValues.customerName)}" required />
            </div>

            <div class="field full">
              <label for="draftCustomerAddress">ที่อยู่ลูกค้า</label>
              <textarea id="draftCustomerAddress" rows="3" placeholder="ที่อยู่สำหรับแสดงบนใบเสนอราคา">${escapeHTML(formValues.customerAddress)}</textarea>
            </div>
          </div>
        </section>

        <section class="form-section">
          <h3>2. ข้อมูลเอกสาร</h3>
          <div class="form-grid">
            <div class="field">
              <label>เลขที่เอกสาร</label>
              <input type="text" value="จะสร้างเมื่อ Confirm" disabled />
              <div class="inline-note">Draft จะยังไม่มีเลขใบเสนอราคา</div>
            </div>

            <div class="field">
              <label for="draftQuoteDate">วันที่ออกเอกสาร</label>
              <input id="draftQuoteDate" type="date" value="${escapeHTML(formValues.quoteDate)}" />
            </div>

            <div class="field">
              <label for="draftValidUntil">วันหมดอายุ</label>
              <input id="draftValidUntil" type="date" value="${escapeHTML(formValues.validUntil)}" />
            </div>

            <div class="field">
              <label>ผู้ขาย</label>
              <input type="text" value="${escapeHTML(appState.profile.full_name || appState.profile.email)}" disabled />
            </div>
          </div>
        </section>

        <section class="form-section">
          <h3>3. ประเภทการชำระเงิน</h3>
          <div class="field">
            <label for="draftBillingType">เลือกประเภท</label>
            <select id="draftBillingType">
              <option value="monthly" ${formValues.billingType === "monthly" ? "selected" : ""}>รายเดือน</option>
              <option value="yearly" ${formValues.billingType === "yearly" ? "selected" : ""}>รายปี</option>
            </select>
          </div>
        </section>

        <section class="form-section">
          <h3 id="draftRecurringTitle">${formValues.billingType === "yearly" ? "4. ค่าบริการชำระรายปี" : "4. ค่าบริการชำระรายเดือน"}</h3>

          <div class="line-box">
            <div class="form-grid">
              <div class="field">
                <label for="draftProductId">สินค้า/บริการ *</label>
                <select id="draftProductId" required>
                  ${products.map((product) => `
                    <option value="${product.id}" ${product.id === selectedProductId ? "selected" : ""}>
                      ${escapeHTML(product.code || "")} ${escapeHTML(product.name)}
                    </option>
                  `).join("")}
                </select>
              </div>

              <div class="field">
                <label for="draftQuantity">จำนวนรถ</label>
                <input id="draftQuantity" type="number" min="0" step="1" value="${escapeHTML(formValues.quantity)}" />
                <div class="inline-note">ใช้เป็นเงื่อนไขราคา ไม่ได้นำไปคูณกับราคา</div>
              </div>

              <div class="field">
                <label for="draftUnitPrice">ราคา</label>
                <input id="draftUnitPrice" type="number" min="0" step="0.01" value="${escapeHTML(formValues.unitPrice)}" />
                <div class="inline-note">ราคาสำหรับจำนวนรถและประเภทที่เลือก</div>
              </div>

              <div class="field">
                <label>หน่วย</label>
                <input id="draftUnit" type="text" value="${escapeHTML(formValues.unit)}" />
              </div>

              <div class="field full">
                <label for="draftRecurringDescription">รายละเอียดเพิ่มเติม</label>
                <textarea id="draftRecurringDescription" rows="2" placeholder="รายละเอียดเพิ่มเติมของค่าบริการรายเดือน/รายปี">${escapeHTML(formValues.recurringDescription)}</textarea>
              </div>

              <div class="field full">
                <button type="button" id="priceLookupButton" class="btn btn-ghost">
                  ค้นหาราคาเดิมจาก History
                </button>
                <div id="priceLookupResult"></div>
              </div>
            </div>
          </div>
        </section>

        <section class="form-section">
          <h3>5. ค่าบริการชำระครั้งเดียวจบ</h3>

          <div class="line-box">
            <div class="form-grid">
              <div class="field full">
                <label for="draftOneTimeName">รายการ</label>
                <input id="draftOneTimeName" type="text" value="${escapeHTML(formValues.oneTimeName)}" />
              </div>

              <div class="field">
                <label for="draftOneTimeQty">จำนวนครั้ง</label>
                <input id="draftOneTimeQty" type="number" min="0" step="1" value="${escapeHTML(formValues.oneTimeQty)}" />
              </div>

              <div class="field">
                <label for="draftOneTimePrice">ราคา/หน่วย</label>
                <input id="draftOneTimePrice" type="number" min="0" step="0.01" value="${escapeHTML(formValues.oneTimePrice)}" />
              </div>

              <div class="field full">
                <label for="draftOneTimeDescription">รายละเอียดเพิ่มเติม</label>
                <textarea id="draftOneTimeDescription" rows="2">${escapeHTML(formValues.oneTimeDescription)}</textarea>
              </div>
            </div>
          </div>
        </section>

        <section class="form-section">
          <h3>6. ส่วนลด ภาษี และการปัดเศษ</h3>
          <div class="form-grid">
            <div class="field">
              <label for="draftDiscountPercent">ส่วนลดท้ายบิล (%)</label>
              <input id="draftDiscountPercent" type="number" min="0" max="100" step="0.01" value="${escapeHTML(formValues.discountPercent)}" />
            </div>

            <label class="checkbox-row">
              <input id="draftVatEnabled" type="checkbox" ${formValues.vatEnabled ? "checked" : ""} />
              <span>คิด VAT 7%</span>
            </label>

            <label class="checkbox-row">
              <input id="draftWhtEnabled" type="checkbox" ${formValues.whtEnabled ? "checked" : ""} />
              <span>หัก ณ ที่จ่าย 3%</span>
            </label>

            <label class="checkbox-row">
              <input id="draftRoundingEnabled" type="checkbox" ${formValues.roundingEnabled ? "checked" : ""} />
              <span>ปัดยอดรวมเป็นจำนวนเต็ม</span>
            </label>
          </div>
        </section>

        <section class="form-section">
          <h3>7. หมายเหตุและเงื่อนไข</h3>
          <div class="form-grid">
            <div class="field full">
              <label for="draftNote">หมายเหตุ</label>
              <textarea id="draftNote" rows="6">${escapeHTML(formValues.note)}</textarea>
            </div>

            <div class="field full">
              <label for="draftPaymentTerms">เงื่อนไขการชำระเงิน</label>
              <textarea id="draftPaymentTerms" rows="4">${escapeHTML(formValues.paymentTerms)}</textarea>
            </div>
          </div>
        </section>

        <div class="form-actions">
          <button type="button" id="cancelDraftButton" class="btn btn-ghost">
            ยกเลิก
          </button>
          <button type="submit" id="saveDraftButton" class="btn btn-primary">
            ${isEdit ? "บันทึกการแก้ไข" : "บันทึกร่าง"}
          </button>
        </div>
      </div>

      <aside class="summary-panel">
        <div class="summary-card">
          <h3>สรุปยอด</h3>

          <div class="summary-row"><span>มูลค่าก่อนภาษี</span><strong id="summarySubtotal">0.00</strong></div>
          <div class="summary-row"><span>ส่วนลด</span><strong id="summaryDiscount">0.00</strong></div>
          <div class="summary-row"><span>ฐานคำนวณภาษี</span><strong id="summaryTaxable">0.00</strong></div>
          <div class="summary-row"><span>VAT 7%</span><strong id="summaryVat">0.00</strong></div>
          <div class="summary-row"><span>หัก ณ ที่จ่าย 3%</span><strong id="summaryWht">-0.00</strong></div>
          <div class="summary-row"><span>ส่วนต่างปัดเศษ</span><strong id="summaryRounding">0.00</strong></div>

          <div class="summary-total">
            <span>ยอดรวมสุทธิ</span>
            <strong id="summaryGrandTotal">0.00</strong>
          </div>

          <p class="inline-note">จำนวนเงินตัวอักษรจะสร้างจาก Database เมื่อบันทึก/ยืนยันเอกสาร</p>
        </div>

        <div class="alert alert-warning">
          หลังจาก Confirm แล้ว ระบบจะล็อกเอกสาร หากต้องแก้ไขให้ Duplicate เป็นใบใหม่
        </div>
      </aside>
    </form>
  `;

  bindQuotationDraftForm(products, {
    mode,
    quotationId,
  });

  updateDraftSummary();
}

function bindQuotationDraftForm(products, options = {}) {
  const form = $("#quotationDraftForm");
  const cancelButton = $("#cancelDraftButton");
  const billingType = $("#draftBillingType");
  const productSelect = $("#draftProductId");
  const priceLookupButton = $("#priceLookupButton");

  const calculationInputs = [
    "#draftBillingType",
    "#draftQuantity",
    "#draftUnitPrice",
    "#draftOneTimeQty",
    "#draftOneTimePrice",
    "#draftDiscountPercent",
    "#draftVatEnabled",
    "#draftWhtEnabled",
    "#draftRoundingEnabled",
  ];

  calculationInputs.forEach((selector) => {
    const input = $(selector);
    if (!input) return;

    input.addEventListener("input", updateDraftSummary);
    input.addEventListener("change", updateDraftSummary);
  });

  billingType.addEventListener("change", () => {
    applyBillingDefaults();
    updateDraftSummary();
  });

  productSelect.addEventListener("change", () => {
    const product = products.find((item) => item.id === productSelect.value);
    if (product) {
      $("#draftUnit").value = product.default_unit || "คัน";
    }
  });

  if (priceLookupButton) {
    priceLookupButton.addEventListener("click", async () => {
      await handlePriceLookup();
    });
  }

  cancelButton.addEventListener("click", () => {
    if (options.mode === "edit" && options.quotationId) {
      location.hash = `#quotation-view/${options.quotationId}`;
      return;
    }

    location.hash = "#quotations";
  });

  form.addEventListener("submit", async (event) => {
    await handleSaveQuotationDraft(event, products, options);
  });
}

async function handleSaveQuotationDraft(event, products, options = {}) {
  event.preventDefault();

  const isEdit = options.mode === "edit";
  const quotationId = options.quotationId;

  const saveButton = $("#saveDraftButton");
  saveButton.disabled = true;
  saveButton.textContent = isEdit ? "กำลังบันทึกการแก้ไข..." : "กำลังบันทึก...";

  try {
    const product = products.find((item) => item.id === $("#draftProductId").value);

    if (!product) {
      throw new Error("กรุณาเลือกสินค้า/บริการ");
    }

    const customerName = $("#draftCustomerName").value.trim();

    if (!customerName) {
      throw new Error("กรุณากรอกชื่อลูกค้า");
    }

    const quotePayload = {
      owner_id: appState.user.id,
      billing_type: $("#draftBillingType").value,
      customer_name: customerName,
      customer_address: $("#draftCustomerAddress").value.trim(),
      quote_date: $("#draftQuoteDate").value,
      valid_until: $("#draftValidUntil").value,

      vat_enabled: $("#draftVatEnabled").checked,
      vat_rate: 7,
      wht_enabled: $("#draftWhtEnabled").checked,
      wht_rate: 3,
      discount_percent: readNumber("#draftDiscountPercent"),
      rounding_enabled: $("#draftRoundingEnabled").checked,

      note: $("#draftNote").value.trim(),
      payment_terms: $("#draftPaymentTerms").value.trim(),
    };

    let savedQuotationId = quotationId;

    if (isEdit) {
      const { data: updatedQuotation, error: updateError } = await supabaseClient
        .from("quotations")
        .update(quotePayload)
        .eq("id", quotationId)
        .select("id")
        .single();

      if (updateError) throw updateError;

      savedQuotationId = updatedQuotation.id;

      const { error: deleteError } = await supabaseClient
        .from("quotation_items")
        .delete()
        .eq("quotation_id", savedQuotationId);

      if (deleteError) throw deleteError;
    } else {
      const { data: quotation, error: quotationError } = await supabaseClient
        .from("quotations")
        .insert(quotePayload)
        .select("id")
        .single();

      if (quotationError) throw quotationError;
      savedQuotationId = quotation.id;
    }

    const quotationItems = [
      {
        quotation_id: savedQuotationId,
        section_type: "recurring",
        product_id: product.id,
        product_name_snapshot: product.name,
        description: $("#draftRecurringDescription")?.value.trim() || "",
        quantity_label: "จำนวนรถ",
        quantity: readNumber("#draftQuantity"),
        unit: $("#draftUnit").value.trim() || product.default_unit || "คัน",
        unit_price: readNumber("#draftUnitPrice"),
        sort_order: 1,
      },
      {
        quotation_id: savedQuotationId,
        section_type: "one_time",
        product_id: null,
        product_name_snapshot: $("#draftOneTimeName").value.trim() || "ค่าบริการชำระครั้งเดียว",
        description: $("#draftOneTimeDescription").value.trim(),
        quantity_label: "จำนวนครั้ง",
        quantity: readNumber("#draftOneTimeQty"),
        unit: "ครั้ง",
        unit_price: readNumber("#draftOneTimePrice"),
        sort_order: 1,
      },
    ];

    const { error: itemError } = await supabaseClient
      .from("quotation_items")
      .insert(quotationItems);

    if (itemError) throw itemError;

    await updateQuotationTotalsSnapshot(savedQuotationId);

    showToast(isEdit ? "บันทึกการแก้ไขสำเร็จ" : "บันทึกร่างสำเร็จ");
    location.hash = `#quotation-view/${savedQuotationId}`;
  } catch (error) {
    console.error(error);
    showToast(error.message || (isEdit ? "ไม่สามารถบันทึกการแก้ไขได้" : "ไม่สามารถบันทึกร่างได้"));
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = isEdit ? "บันทึกการแก้ไข" : "บันทึกร่าง";
  }
}

async function handlePriceLookup() {
  const resultTarget = $("#priceLookupResult");

  if (!resultTarget) return;

  const productId = $("#draftProductId").value;
  const billingType = $("#draftBillingType").value;
  const quantity = readNumber("#draftQuantity");

  if (!productId) {
    resultTarget.innerHTML = `<div class="alert alert-error">กรุณาเลือกสินค้า/บริการก่อนค้นหาราคา</div>`;
    return;
  }

  if (!quantity || quantity <= 0) {
    resultTarget.innerHTML = `<div class="alert alert-error">กรุณากรอกจำนวนรถให้ถูกต้องก่อนค้นหาราคา</div>`;
    return;
  }

  resultTarget.innerHTML = `
    <div class="lookup-panel">
      <div class="lookup-panel-header">
        <div>
          <strong>กำลังค้นหาราคาเดิม...</strong>
          <span>ค้นหาจากใบเสนอราคาที่ Confirmed หรือ Sent แล้ว</span>
        </div>
      </div>
    </div>
  `;

  try {
    const { data, error } = await supabaseClient.rpc("search_price_history", {
      p_product_id: productId,
      p_billing_type: billingType,
      p_quantity: quantity,
      p_limit: 10,
    });

    if (error) throw error;

    const rows = data || [];

    if (!rows.length) {
      resultTarget.innerHTML = `
        <div class="lookup-panel">
          <div class="lookup-panel-header">
            <div>
              <strong>ไม่พบราคาที่เคยเสนอ</strong>
              <span>กรุณากรอกราคาเอง แล้วระบบจะใช้เป็นประวัติหลัง Confirm</span>
            </div>
          </div>
        </div>
      `;
      return;
    }

    resultTarget.innerHTML = `
      <div class="lookup-panel">
        <div class="lookup-panel-header">
          <div>
            <strong>พบราคาเดิม ${number(rows.length)} รายการ</strong>
            <span>เลือกใช้ราคาจากประวัติที่ตรงกับสินค้า ประเภท และจำนวนรถ</span>
          </div>
        </div>

        <div class="lookup-list">
          ${rows.map((row) => `
            <div class="lookup-item">
              <div>
                <div class="lookup-price">${formatTHB(row.unit_price)}</div>
                <div class="lookup-meta">
                  <span>${escapeHTML(row.quotation_no || "-")}</span>
                  <span>${escapeHTML(row.customer_name || "-")}</span>
                  <span>${formatDate(row.quote_date)}</span>
                  <span>${escapeHTML(row.sales_name || "-")}</span>
                </div>
              </div>

              <button type="button" class="btn btn-primary" data-history-price="${Number(row.unit_price || 0)}">
                ใช้ราคานี้
              </button>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    resultTarget.querySelectorAll("[data-history-price]").forEach((button) => {
      button.addEventListener("click", () => {
        $("#draftUnitPrice").value = button.dataset.historyPrice;
        updateDraftSummary();
        showToast("ใช้ราคาจากประวัติแล้ว");
      });
    });
  } catch (error) {
    console.error(error);
    resultTarget.innerHTML = `<div class="alert alert-error">${escapeHTML(error.message || "ไม่สามารถค้นหาราคาเดิมได้")}</div>`;
  }
}

function renderQuotationActionButtons(quotation, effectiveStatus) {
  const role = appState.profile.role;
  const isOwner = quotation.owner_id === appState.user.id;
  const canModify = role === "admin" || (role === "sales" && isOwner);

  if (!canModify) {
    return "";
  }

  const buttons = [];

  if (quotation.status === "draft") {
    buttons.push(`
      <button id="editDraftButton" class="btn btn-ghost">
        แก้ไข Draft
      </button>
    `);

    buttons.push(`
      <button id="confirmQuotationButton" class="btn btn-primary">
        Confirm และสร้างเลข
      </button>
    `);
  }

  if (quotation.status === "confirmed" && effectiveStatus === "confirmed") {
    buttons.push(`
      <button id="markSentButton" class="btn btn-primary">
        เปลี่ยนเป็นส่งแล้ว
      </button>
    `);
  }

  if (quotation.status !== "draft") {
    buttons.push(`
      <button id="printPreviewButton" class="btn btn-primary">
        Preview / Print
      </button>
    `);

    buttons.push(`
      <button id="duplicateQuotationButton" class="btn btn-ghost">
        สร้างสำเนา
      </button>
    `);
  }

  return buttons.join("");
}

function bindQuotationViewActions(quotation) {
  const backButton = $("#backToListButton");
  const editDraftButton = $("#editDraftButton");
  const confirmButton = $("#confirmQuotationButton");
  const markSentButton = $("#markSentButton");
  const printPreviewButton = $("#printPreviewButton");
  const duplicateButton = $("#duplicateQuotationButton");

  if (backButton) {
    backButton.addEventListener("click", () => {
      location.hash = "#quotations";
    });
  }

  if (editDraftButton) {
    editDraftButton.addEventListener("click", () => {
      location.hash = `#quotation-edit/${quotation.id}`;
    });
  }

  if (confirmButton) {
    confirmButton.addEventListener("click", async () => {
      await confirmQuotation(quotation.id);
    });
  }

  if (markSentButton) {
    markSentButton.addEventListener("click", async () => {
      await markQuotationAsSent(quotation.id);
    });
  }

  if (printPreviewButton) {
    printPreviewButton.addEventListener("click", () => {
      location.hash = `#quotation-print/${quotation.id}`;
    });
  }

  if (duplicateButton) {
    duplicateButton.addEventListener("click", async () => {
      await duplicateQuotation(quotation.id);
    });
  }
}


// =======================================================
// v1.0 Consolidated Release
// Print polish + Product Management + Company Profile
// Dashboard improvements + Cancel Draft + CSV Export
// Validation hardening
// =======================================================

async function renderCurrentPage() {
  if (!appState.profile) return;

  renderMenu();

  const page = appState.currentPage;

  try {
    if (page === "dashboard") {
      await renderDashboardPage();
    } else if (page === "quotations") {
      await renderQuotationsPage();
    } else if (page === "quotation-new") {
      await renderQuotationCreatePage();
    } else if (page.startsWith("quotation-edit/")) {
      const quotationId = page.replace("quotation-edit/", "");
      await renderQuotationEditPage(quotationId);
    } else if (page.startsWith("quotation-view/")) {
      const quotationId = page.replace("quotation-view/", "");
      await renderQuotationViewPage(quotationId);
    } else if (page.startsWith("quotation-print/")) {
      const quotationId = page.replace("quotation-print/", "");
      await renderQuotationPrintPage(quotationId);
    } else if (page === "customers") {
      await renderCustomersPage();
    } else if (page === "products") {
      await renderProductsPage();
    } else if (page === "product-new") {
      await renderProductFormPage({ mode: "create", productId: null });
    } else if (page.startsWith("product-edit/")) {
      const productId = page.replace("product-edit/", "");
      await renderProductFormPage({ mode: "edit", productId });
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
    renderError(error.message || "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
  }
}

async function renderDashboardPage() {
  setPageHeader("Dashboard", "ภาพรวมระบบใบเสนอราคาและรายการที่ต้องติดตาม");
  renderLoading();

  const role = appState.profile.role;
  const isSales = role === "sales";

  const [dashboardResult, quotationsResult] = await Promise.all([
    isSales
      ? supabaseClient
          .from("v_dashboard_sales")
          .select("*")
          .eq("owner_id", appState.user.id)
          .maybeSingle()
      : supabaseClient
          .from("v_dashboard_manager")
          .select("*")
          .order("owner_name", { ascending: true }),

    supabaseClient
      .from("v_quotations_list")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(120),
  ]);

  if (dashboardResult.error) throw dashboardResult.error;
  if (quotationsResult.error) throw quotationsResult.error;

  const quotations = quotationsResult.data || [];
  const metrics = isSales
    ? dashboardResult.data || emptyDashboardMetrics()
    : summarizeManagerDashboard(dashboardResult.data || []);

  const now = startOfToday();
  const soon = addDays(now, 7);
  const expiringSoon = quotations
    .filter((row) => ["confirmed", "sent"].includes(row.effective_status))
    .filter((row) => row.valid_until && new Date(row.valid_until) >= now && new Date(row.valid_until) <= soon)
    .slice(0, 8);

  const recentDrafts = quotations
    .filter((row) => row.effective_status === "draft")
    .slice(0, 8);

  const recentDocs = quotations.slice(0, 8);

  elements.pageContent.innerHTML = `
    ${renderDashboardMetrics(metrics)}

    <div class="dashboard-grid">
      <div class="card">
        <div class="card-header">
          <div>
            <h3>เอกสารใกล้หมดอายุ</h3>
            <p>Confirmed / Sent ที่จะหมดอายุภายใน 7 วัน</p>
          </div>
        </div>
        ${renderCompactQuotationList(expiringSoon, "ยังไม่มีเอกสารใกล้หมดอายุ")}
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h3>Draft ล่าสุด</h3>
            <p>เอกสารที่ยังไม่ได้ Confirm</p>
          </div>
        </div>
        ${renderCompactQuotationList(recentDrafts, "ยังไม่มี Draft")}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3>อัปเดตล่าสุด</h3>
          <p>เอกสารล่าสุดที่มีการแก้ไขหรือสร้างใหม่</p>
        </div>
      </div>
      ${renderCompactQuotationList(recentDocs, "ยังไม่มีใบเสนอราคา")}
    </div>

    ${!isSales ? `
      <div class="card">
        <div class="card-header">
          <div>
            <h3>ยอดรวมตาม Sales</h3>
            <p>มุมมองสำหรับ Manager / Admin</p>
          </div>
        </div>
        ${renderSalesSummaryTable(dashboardResult.data || [])}
      </div>
    ` : ""}
  `;

  bindCompactQuotationLinks();
}

function renderCompactQuotationList(rows, emptyText) {
  if (!rows.length) {
    return `<div class="empty-state compact">${escapeHTML(emptyText)}</div>`;
  }

  return `
    <div class="compact-list">
      ${rows.map((row) => `
        <button type="button" class="compact-item" data-quotation-link="${row.id}">
          <div>
            <strong>${escapeHTML(row.quotation_no || "ยังไม่ออกเลข")}</strong>
            <span>${escapeHTML(row.customer_name || "-")}</span>
          </div>
          <div class="compact-item-right">
            ${statusBadge(row.effective_status)}
            <span>${formatTHB(row.grand_total_display)}</span>
          </div>
        </button>
      `).join("")}
    </div>
  `;
}

function bindCompactQuotationLinks() {
  document.querySelectorAll("[data-quotation-link]").forEach((button) => {
    button.addEventListener("click", () => {
      location.hash = `#quotation-view/${button.dataset.quotationLink}`;
    });
  });
}

function renderQuotationList(rows) {
  const canCreate = appState.profile.role !== "manager";

  elements.pageContent.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>รายการใบเสนอราคา</h3>
          <p>ค้นหา กรอง ส่งออก CSV และเปิดดูรายละเอียด</p>
        </div>

        <div class="table-actions">
          <button id="exportQuotationsCsvButton" class="btn btn-ghost">Export Excel/CSV</button>
          ${canCreate ? `<button id="newQuotationButton" class="btn btn-primary">+ สร้างใบเสนอราคา</button>` : ``}
        </div>
      </div>

      <div class="filter-bar">
        <input id="quotationSearch" type="search" placeholder="ค้นหาลูกค้า / เลขเอกสาร / Sales" />
        <select id="quotationStatusFilter">
          <option value="">ทุกสถานะ</option>
          <option value="draft">ร่าง</option>
          <option value="confirmed">ยืนยันแล้ว</option>
          <option value="sent">ส่งแล้ว</option>
          <option value="expired">หมดอายุ</option>
          <option value="cancelled">ยกเลิก</option>
        </select>
        <select id="quotationBillingFilter">
          <option value="">ทุกประเภท</option>
          <option value="monthly">รายเดือน</option>
          <option value="yearly">รายปี</option>
        </select>
      </div>

      <div id="quotationTable"></div>
    </div>
  `;

  const searchInput = $("#quotationSearch");
  const statusFilter = $("#quotationStatusFilter");
  const billingFilter = $("#quotationBillingFilter");
  const tableTarget = $("#quotationTable");
  const newButton = $("#newQuotationButton");
  const exportButton = $("#exportQuotationsCsvButton");

  let currentFilteredRows = rows;

  if (newButton) {
    newButton.addEventListener("click", () => {
      location.hash = "#quotation-new";
    });
  }

  if (exportButton) {
    exportButton.addEventListener("click", () => exportQuotationsCsv(currentFilteredRows));
  }

  function updateTable() {
    const keyword = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value;
    const billingType = billingFilter.value;

    currentFilteredRows = rows.filter((row) => {
      const text = `${row.quotation_no || ""} ${row.customer_name || ""} ${row.owner_name || ""}`.toLowerCase();
      const matchText = !keyword || text.includes(keyword);
      const matchStatus = !status || row.effective_status === status;
      const matchBilling = !billingType || row.billing_type === billingType;
      return matchText && matchStatus && matchBilling;
    });

    tableTarget.innerHTML = renderQuotationTable(currentFilteredRows);
    bindQuotationTableActions();
  }

  searchInput.addEventListener("input", updateTable);
  statusFilter.addEventListener("change", updateTable);
  billingFilter.addEventListener("change", updateTable);

  updateTable();
}

function exportQuotationsCsv(rows) {
  if (!rows.length) {
    showToast("ไม่มีข้อมูลสำหรับ Export");
    return;
  }

  const headers = [
    "เลขที่",
    "ลูกค้า",
    "ประเภท",
    "Sales",
    "วันที่ออกเอกสาร",
    "วันหมดอายุ",
    "ยอดรวม",
    "สถานะ",
  ];

  const csvRows = rows.map((row) => [
    row.quotation_no || "ยังไม่ออกเลข",
    row.customer_name || "",
    billingTypeLabel(row.billing_type),
    row.owner_name || "",
    row.quote_date || "",
    row.valid_until || "",
    Number(row.grand_total_display || 0),
    statusLabel(row.effective_status),
  ]);

  downloadCsv("fi-quotations-export.csv", [headers, ...csvRows]);
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) => row.map((value) => csvEscape(value)).join(","))
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

async function renderProductsPage() {
  setPageHeader("สินค้า/บริการ", "จัดการ Master Data สำหรับใบเสนอราคา");
  renderLoading();

  const { data, error } = await supabaseClient
    .from("products")
    .select("id, code, name, description, default_unit, is_active, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const canEdit = appState.profile.role === "admin";

  elements.pageContent.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>สินค้า/บริการ</h3>
          <p>${canEdit ? "Admin สามารถเพิ่ม แก้ไข และเปิด/ปิดสินค้าได้" : "หน้านี้เป็น read-only สำหรับ role ของคุณ"}</p>
        </div>
        ${canEdit ? `<button id="addProductButton" class="btn btn-primary">+ เพิ่มสินค้า</button>` : ""}
      </div>
      ${renderProductsTableV10(data || [], canEdit)}
    </div>
  `;

  if (canEdit) {
    const addButton = $("#addProductButton");
    if (addButton) {
      addButton.addEventListener("click", () => {
        location.hash = "#product-new";
      });
    }

    document.querySelectorAll("[data-product-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        location.hash = `#product-edit/${button.dataset.productEdit}`;
      });
    });
  }
}

function renderProductsTableV10(rows, canEdit) {
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
            ${canEdit ? "<th>Action</th>" : ""}
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
              ${canEdit ? `<td><button class="btn btn-ghost" data-product-edit="${row.id}">แก้ไข</button></td>` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function renderProductFormPage({ mode, productId }) {
  if (appState.profile.role !== "admin") {
    renderError("เฉพาะ Admin เท่านั้นที่จัดการสินค้า/บริการได้");
    return;
  }

  const isEdit = mode === "edit";
  setPageHeader(isEdit ? "แก้ไขสินค้า/บริการ" : "เพิ่มสินค้า/บริการ", "ข้อมูลนี้จะใช้เป็น Master Data ในใบเสนอราคา");
  renderLoading();

  let product = {
    code: "",
    name: "",
    description: "",
    default_unit: "คัน",
    is_active: true,
  };

  if (isEdit) {
    const { data, error } = await supabaseClient
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (error) throw error;
    product = data;
  }

  elements.pageContent.innerHTML = `
    <form id="productForm" class="card form-card">
      <div class="card-header">
        <div>
          <h3>${isEdit ? "แก้ไขสินค้า/บริการ" : "เพิ่มสินค้า/บริการ"}</h3>
          <p>Code ควรสั้น จำง่าย และไม่ซ้ำ เช่น ERP-TRUCK</p>
        </div>
      </div>

      <div class="form-grid">
        <div class="field">
          <label for="productCode">Code *</label>
          <input id="productCode" type="text" value="${escapeHTML(product.code || "")}" placeholder="เช่น ERP-TRUCK" required />
        </div>

        <div class="field">
          <label for="productUnit">หน่วย *</label>
          <input id="productUnit" type="text" value="${escapeHTML(product.default_unit || "คัน")}" required />
        </div>

        <div class="field full">
          <label for="productName">ชื่อสินค้า/บริการ *</label>
          <input id="productName" type="text" value="${escapeHTML(product.name || "")}" required />
        </div>

        <div class="field full">
          <label for="productDescription">รายละเอียด</label>
          <textarea id="productDescription" rows="4">${escapeHTML(product.description || "")}</textarea>
        </div>

        <label class="checkbox-row full">
          <input id="productIsActive" type="checkbox" ${product.is_active ? "checked" : ""} />
          <span>เปิดใช้งานสินค้า/บริการนี้</span>
        </label>
      </div>

      <div class="form-actions normal-flow">
        <button type="button" id="cancelProductButton" class="btn btn-ghost">ยกเลิก</button>
        <button type="submit" id="saveProductButton" class="btn btn-primary">บันทึก</button>
      </div>
    </form>
  `;

  $("#cancelProductButton").addEventListener("click", () => {
    location.hash = "#products";
  });

  $("#productForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveProduct({ mode, productId });
  });
}

async function saveProduct({ mode, productId }) {
  const saveButton = $("#saveProductButton");
  saveButton.disabled = true;
  saveButton.textContent = "กำลังบันทึก...";

  try {
    const payload = {
      code: $("#productCode").value.trim(),
      name: $("#productName").value.trim(),
      description: $("#productDescription").value.trim(),
      default_unit: $("#productUnit").value.trim() || "คัน",
      is_active: $("#productIsActive").checked,
    };

    if (!payload.code || !payload.name) {
      throw new Error("กรุณากรอก Code และชื่อสินค้า/บริการ");
    }

    if (mode === "edit") {
      const { error } = await supabaseClient
        .from("products")
        .update(payload)
        .eq("id", productId);

      if (error) throw error;
    } else {
      const { error } = await supabaseClient
        .from("products")
        .insert(payload);

      if (error) throw error;
    }

    showToast("บันทึกสินค้า/บริการสำเร็จ");
    location.hash = "#products";
  } catch (error) {
    console.error(error);
    showToast(error.message || "ไม่สามารถบันทึกสินค้า/บริการได้");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "บันทึก";
  }
}

async function renderCompanyPage() {
  if (appState.profile.role !== "admin") {
    renderError("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
    return;
  }

  setPageHeader("Company Profile", "แก้ไขข้อมูลบริษัท บัญชีธนาคาร และข้อความเริ่มต้นบนใบเสนอราคา");
  renderLoading();

  const { data, error } = await supabaseClient
    .from("company_profile")
    .select("*")
    .eq("is_default", true)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    renderError("ยังไม่มี Company Profile default กรุณารัน SQL seed ก่อน");
    return;
  }

  elements.pageContent.innerHTML = `
    <form id="companyProfileForm" class="card form-card">
      <div class="card-header">
        <div>
          <h3>ข้อมูลบริษัท</h3>
          <p>ข้อมูลนี้จะถูก snapshot ลงใบเสนอราคาเมื่อ Confirm</p>
        </div>
      </div>

      <div class="form-grid">
        <div class="field full">
          <label for="companyName">ชื่อบริษัท *</label>
          <input id="companyName" type="text" value="${escapeHTML(data.company_name || "")}" required />
        </div>

        <div class="field">
          <label for="companyTaxId">เลขประจำตัวผู้เสียภาษี</label>
          <input id="companyTaxId" type="text" value="${escapeHTML(data.tax_id || "")}" />
        </div>

        <div class="field">
          <label for="companyBranchName">สาขา</label>
          <input id="companyBranchName" type="text" value="${escapeHTML(data.branch_name || "")}" />
        </div>

        <div class="field full">
          <label for="companyAddress">ที่อยู่</label>
          <textarea id="companyAddress" rows="3">${escapeHTML(data.address || "")}</textarea>
        </div>

        <div class="field">
          <label for="companyPhone">เบอร์โทร</label>
          <input id="companyPhone" type="text" value="${escapeHTML(data.phone || "")}" />
        </div>

        <div class="field">
          <label for="companyEmail">อีเมล</label>
          <input id="companyEmail" type="email" value="${escapeHTML(data.email || "")}" />
        </div>

        <div class="field full">
          <label for="companyLogoUrl">Logo URL</label>
          <input id="companyLogoUrl" type="url" value="${escapeHTML(data.logo_url || "")}" placeholder="https://..." />
          <div class="inline-note">ใช้ URL รูปภาพที่เข้าถึงได้จาก browser</div>
        </div>

        <div class="field">
          <label for="companyBankName">ธนาคาร</label>
          <input id="companyBankName" type="text" value="${escapeHTML(data.bank_name || "")}" />
        </div>

        <div class="field">
          <label for="companyBankAccountNo">เลขบัญชี</label>
          <input id="companyBankAccountNo" type="text" value="${escapeHTML(data.bank_account_no || "")}" />
        </div>

        <div class="field full">
          <label for="companyBankAccountName">ชื่อบัญชี</label>
          <input id="companyBankAccountName" type="text" value="${escapeHTML(data.bank_account_name || "")}" />
        </div>

        <div class="field full">
          <label for="companyPaymentNote">ข้อความแจ้งชำระเงิน</label>
          <textarea id="companyPaymentNote" rows="2">${escapeHTML(data.payment_note || "")}</textarea>
        </div>

        <div class="field full">
          <label for="companyDefaultNote">หมายเหตุเริ่มต้น</label>
          <textarea id="companyDefaultNote" rows="6">${escapeHTML(data.default_note || "")}</textarea>
        </div>

        <div class="field full">
          <label for="companyDefaultPaymentTerms">เงื่อนไขการชำระเงินเริ่มต้น</label>
          <textarea id="companyDefaultPaymentTerms" rows="5">${escapeHTML(data.default_payment_terms || "")}</textarea>
        </div>
      </div>

      <div class="form-actions normal-flow">
        <button type="button" id="resetCompanyFormButton" class="btn btn-ghost">โหลดข้อมูลใหม่</button>
        <button type="submit" id="saveCompanyButton" class="btn btn-primary">บันทึก Company Profile</button>
      </div>
    </form>
  `;

  $("#resetCompanyFormButton").addEventListener("click", () => {
    renderCompanyPage();
  });

  $("#companyProfileForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveCompanyProfile(data.id);
  });
}

async function saveCompanyProfile(companyId) {
  const saveButton = $("#saveCompanyButton");
  saveButton.disabled = true;
  saveButton.textContent = "กำลังบันทึก...";

  try {
    const payload = {
      company_name: $("#companyName").value.trim(),
      tax_id: $("#companyTaxId").value.trim(),
      branch_name: $("#companyBranchName").value.trim(),
      address: $("#companyAddress").value.trim(),
      phone: $("#companyPhone").value.trim(),
      email: $("#companyEmail").value.trim(),
      logo_url: $("#companyLogoUrl").value.trim(),
      bank_name: $("#companyBankName").value.trim(),
      bank_account_name: $("#companyBankAccountName").value.trim(),
      bank_account_no: $("#companyBankAccountNo").value.trim(),
      payment_note: $("#companyPaymentNote").value.trim(),
      default_note: $("#companyDefaultNote").value.trim(),
      default_payment_terms: $("#companyDefaultPaymentTerms").value.trim(),
    };

    if (!payload.company_name) {
      throw new Error("กรุณากรอกชื่อบริษัท");
    }

    const { error } = await supabaseClient
      .from("company_profile")
      .update(payload)
      .eq("id", companyId);

    if (error) throw error;

    showToast("บันทึก Company Profile สำเร็จ");
    await renderCompanyPage();
  } catch (error) {
    console.error(error);
    showToast(error.message || "ไม่สามารถบันทึก Company Profile ได้");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "บันทึก Company Profile";
  }
}

function renderQuotationActionButtons(quotation, effectiveStatus) {
  const role = appState.profile.role;
  const isOwner = quotation.owner_id === appState.user.id;
  const canModify = role === "admin" || (role === "sales" && isOwner);

  if (!canModify) {
    return "";
  }

  const buttons = [];

  if (quotation.status === "draft") {
    buttons.push(`<button id="editDraftButton" class="btn btn-ghost">แก้ไข Draft</button>`);
    buttons.push(`<button id="cancelDraftButton" class="btn btn-ghost danger-soft">ยกเลิก Draft</button>`);
    buttons.push(`<button id="confirmQuotationButton" class="btn btn-primary">Confirm และสร้างเลข</button>`);
  }

  if (quotation.status === "confirmed" && effectiveStatus === "confirmed") {
    buttons.push(`<button id="markSentButton" class="btn btn-primary">เปลี่ยนเป็นส่งแล้ว</button>`);
  }

  if (quotation.status !== "draft") {
    buttons.push(`<button id="printPreviewButton" class="btn btn-primary">Preview / Print</button>`);
    buttons.push(`<button id="duplicateQuotationButton" class="btn btn-ghost">สร้างสำเนา</button>`);
  }

  return buttons.join("");
}

function bindQuotationViewActions(quotation) {
  const backButton = $("#backToListButton");
  const editDraftButton = $("#editDraftButton");
  const cancelDraftButton = $("#cancelDraftButton");
  const confirmButton = $("#confirmQuotationButton");
  const markSentButton = $("#markSentButton");
  const printPreviewButton = $("#printPreviewButton");
  const duplicateButton = $("#duplicateQuotationButton");

  if (backButton) {
    backButton.addEventListener("click", () => {
      location.hash = "#quotations";
    });
  }

  if (editDraftButton) {
    editDraftButton.addEventListener("click", () => {
      location.hash = `#quotation-edit/${quotation.id}`;
    });
  }

  if (cancelDraftButton) {
    cancelDraftButton.addEventListener("click", async () => {
      await cancelDraftQuotation(quotation.id);
    });
  }

  if (confirmButton) {
    confirmButton.addEventListener("click", async () => {
      await confirmQuotation(quotation.id);
    });
  }

  if (markSentButton) {
    markSentButton.addEventListener("click", async () => {
      await markQuotationAsSent(quotation.id);
    });
  }

  if (printPreviewButton) {
    printPreviewButton.addEventListener("click", () => {
      location.hash = `#quotation-print/${quotation.id}`;
    });
  }

  if (duplicateButton) {
    duplicateButton.addEventListener("click", async () => {
      await duplicateQuotation(quotation.id);
    });
  }
}

async function cancelDraftQuotation(quotationId) {
  const reason = window.prompt("ระบุเหตุผลในการยกเลิก Draft", "ยกเลิกโดยผู้ใช้งาน");
  if (reason === null) return;

  try {
    showToast("กำลังยกเลิก Draft...");

    const { error } = await supabaseClient.rpc("cancel_quotation", {
      p_quotation_id: quotationId,
      p_reason: reason.trim() || "Cancelled by user",
    });

    if (error) throw error;

    showToast("ยกเลิก Draft สำเร็จ");
    await renderQuotationViewPage(quotationId);
  } catch (error) {
    console.error(error);
    showToast(error.message || "ไม่สามารถยกเลิก Draft ได้");
  }
}

async function handleSaveQuotationDraft(event, products, options = {}) {
  event.preventDefault();

  const isEdit = options.mode === "edit";
  const quotationId = options.quotationId;

  const saveButton = $("#saveDraftButton");
  saveButton.disabled = true;
  saveButton.textContent = isEdit ? "กำลังบันทึกการแก้ไข..." : "กำลังบันทึก...";

  try {
    const formData = collectQuotationFormData(products);
    validateQuotationFormData(formData);

    let savedQuotationId = quotationId;

    if (isEdit) {
      const { data: updatedQuotation, error: updateError } = await supabaseClient
        .from("quotations")
        .update(formData.quotePayload)
        .eq("id", quotationId)
        .eq("status", "draft")
        .select("id")
        .single();

      if (updateError) throw updateError;

      savedQuotationId = updatedQuotation.id;

      const { error: deleteError } = await supabaseClient
        .from("quotation_items")
        .delete()
        .eq("quotation_id", savedQuotationId);

      if (deleteError) throw deleteError;
    } else {
      const { data: quotation, error: quotationError } = await supabaseClient
        .from("quotations")
        .insert(formData.quotePayload)
        .select("id")
        .single();

      if (quotationError) throw quotationError;
      savedQuotationId = quotation.id;
    }

    const quotationItems = buildQuotationItemsPayload(savedQuotationId, formData.product);

    const { error: itemError } = await supabaseClient
      .from("quotation_items")
      .insert(quotationItems);

    if (itemError) throw itemError;

    await updateQuotationTotalsSnapshot(savedQuotationId);

    showToast(isEdit ? "บันทึกการแก้ไขสำเร็จ" : "บันทึกร่างสำเร็จ");
    location.hash = `#quotation-view/${savedQuotationId}`;
  } catch (error) {
    console.error(error);
    showToast(error.message || (isEdit ? "ไม่สามารถบันทึกการแก้ไขได้" : "ไม่สามารถบันทึกร่างได้"));
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = isEdit ? "บันทึกการแก้ไข" : "บันทึกร่าง";
  }
}

function collectQuotationFormData(products) {
  const product = products.find((item) => item.id === $("#draftProductId").value);

  if (!product) {
    throw new Error("กรุณาเลือกสินค้า/บริการ");
  }

  const quotePayload = {
    owner_id: appState.user.id,
    billing_type: $("#draftBillingType").value,
    customer_name: $("#draftCustomerName").value.trim(),
    customer_address: $("#draftCustomerAddress").value.trim(),
    quote_date: $("#draftQuoteDate").value,
    valid_until: $("#draftValidUntil").value,
    vat_enabled: $("#draftVatEnabled").checked,
    vat_rate: 7,
    wht_enabled: $("#draftWhtEnabled").checked,
    wht_rate: 3,
    discount_percent: readNumber("#draftDiscountPercent"),
    rounding_enabled: $("#draftRoundingEnabled").checked,
    note: $("#draftNote").value.trim(),
    payment_terms: $("#draftPaymentTerms").value.trim(),
  };

  return { product, quotePayload };
}

function validateQuotationFormData({ quotePayload }) {
  if (!quotePayload.customer_name) {
    throw new Error("กรุณากรอกชื่อลูกค้า");
  }

  if (!quotePayload.quote_date || !quotePayload.valid_until) {
    throw new Error("กรุณาระบุวันที่ออกเอกสารและวันหมดอายุ");
  }

  if (new Date(quotePayload.valid_until) < new Date(quotePayload.quote_date)) {
    throw new Error("วันหมดอายุต้องไม่น้อยกว่าวันที่ออกเอกสาร");
  }

  const discount = Number(quotePayload.discount_percent || 0);
  if (discount < 0 || discount > 100) {
    throw new Error("ส่วนลดท้ายบิลต้องอยู่ระหว่าง 0-100%");
  }

  const recurringPrice = readNumber("#draftUnitPrice");
  const oneTimePrice = readNumber("#draftOneTimePrice");
  const quantity = readNumber("#draftQuantity");
  const oneTimeQty = readNumber("#draftOneTimeQty");

  if (quantity <= 0) {
    throw new Error("จำนวนรถต้องมากกว่า 0");
  }

  if (recurringPrice < 0 || oneTimePrice < 0 || oneTimeQty < 0) {
    throw new Error("จำนวนและราคาต้องไม่ติดลบ");
  }
}

function buildQuotationItemsPayload(quotationId, product) {
  return [
    {
      quotation_id: quotationId,
      section_type: "recurring",
      product_id: product.id,
      product_name_snapshot: product.name,
      description: $("#draftRecurringDescription")?.value.trim() || "",
      quantity_label: "จำนวนรถ",
      quantity: readNumber("#draftQuantity"),
      unit: $("#draftUnit").value.trim() || product.default_unit || "คัน",
      unit_price: readNumber("#draftUnitPrice"),
      sort_order: 1,
    },
    {
      quotation_id: quotationId,
      section_type: "one_time",
      product_id: null,
      product_name_snapshot: $("#draftOneTimeName").value.trim() || "ค่าบริการชำระครั้งเดียว",
      description: $("#draftOneTimeDescription").value.trim(),
      quantity_label: "จำนวนครั้ง",
      quantity: readNumber("#draftOneTimeQty"),
      unit: "ครั้ง",
      unit_price: readNumber("#draftOneTimePrice"),
      sort_order: 1,
    },
  ];
}

function renderSettingsPage() {
  if (appState.profile.role !== "admin") {
    renderError("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
    return;
  }

  setPageHeader("Settings", "แนวทางดูแลระบบและ QA Checklist");
  elements.pageContent.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>System Health Checklist</h3>
          <p>ใช้ตรวจระบบหลัง deploy หรือก่อนเริ่มใช้งานจริง</p>
        </div>
      </div>

      <div class="checklist-grid">
        ${[
          "Admin เห็นทุกเมนูและจัดการ Company / Product ได้",
          "Manager ดู Dashboard และ Export/Print ได้ แต่สร้าง/แก้ไขไม่ได้",
          "Sales เห็นเฉพาะใบเสนอราคาของตัวเอง",
          "Draft แก้ไขได้ และ Confirm แล้วแก้ไม่ได้",
          "เลข QTN รันถูกต้องตามเดือนและไม่ซ้ำ",
          "Preview / Print แสดงข้อมูล snapshot หลัง Confirm",
          "Price Lookup ดึงเฉพาะเอกสาร Confirmed หรือ Sent",
          "ไม่มี service_role key ใน Frontend",
        ].map((item) => `
          <label class="checklist-item">
            <input type="checkbox" />
            <span>${escapeHTML(item)}</span>
          </label>
        `).join("")}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3>ข้อควรระวัง</h3>
          <p>สำหรับ GitHub Pages + Supabase</p>
        </div>
      </div>
      <div class="kv-list">
        <div class="kv-row"><span>Frontend Key</span><strong>ใช้ได้เฉพาะ anon public key เท่านั้น ห้ามใช้ service_role</strong></div>
        <div class="kv-row"><span>Permission</span><strong>สิทธิ์จริงต้องคุมด้วย RLS และ RPC ใน Database</strong></div>
        <div class="kv-row"><span>PDF</span><strong>เวอร์ชันนี้ใช้ Browser Print / Save as PDF</strong></div>
        <div class="kv-row"><span>User</span><strong>Admin สร้าง User ผ่าน Supabase Dashboard ตาม Requirement ปัจจุบัน</strong></div>
      </div>
    </div>
  `;
}


// =======================================================
// v1.1 UX Refresh + Stability Release Overrides
// Top navigation, Thai-only labels, loading/toast manager,
// safer rendering, company logo upload via Supabase Storage
// =======================================================

appState.navigationSeq = 0;
appState.activeActions = new Set();

function bindEvents() {
  if (elements.loginForm) elements.loginForm.addEventListener("submit", handleLogin);
  if (elements.logoutButton) elements.logoutButton.addEventListener("click", handleLogout);

  const mobileMenuButton = document.querySelector("#mobileMenuButton");
  if (mobileMenuButton) {
    mobileMenuButton.addEventListener("click", () => {
      document.body.classList.toggle("nav-open");
    });
  }

  window.addEventListener("hashchange", async () => {
    appState.currentPage = getPageFromHash();
    await renderCurrentPage();
  });
}

async function ensureActiveSession() {
  if (!supabaseClient) return false;

  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session?.user) {
    appState.user = null;
    appState.profile = null;
    showLoginPage();
    showToast("กรุณาเข้าสู่ระบบใหม่", "warning");
    return false;
  }

  appState.user = data.session.user;
  if (!appState.profile) {
    await loadProfile();
  }
  return true;
}

async function handleLogin(event) {
  event.preventDefault();

  if (!supabaseClient) {
    showLoginError("ยังไม่ได้ตั้งค่า Supabase ใน script.js");
    return;
  }

  const email = elements.loginEmail.value.trim();
  const password = elements.loginPassword.value;

  await withButtonLoading(elements.loginButton, "กำลังเข้าสู่ระบบ...", async () => {
    hideLoginError();

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      showLoginError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      showToast("เข้าสู่ระบบไม่สำเร็จ", "error");
      return;
    }

    appState.user = data.user;
    appState.profile = null;
    await loadProfile();
    showAppShell();
    await renderCurrentPage();
    showToast("เข้าสู่ระบบสำเร็จ", "success");
  });
}

async function handleLogout() {
  if (!supabaseClient) return;
  await withAction("logout", async () => {
    showToast("กำลังออกจากระบบ...", "info");
    await supabaseClient.auth.signOut();
    showToast("ออกจากระบบแล้ว", "success");
  });
}

function renderMenu() {
  if (!appState.profile || !elements.sidebarMenu) return;

  const role = appState.profile.role;
  const allMenus = [
    { key: "dashboard", label: "แดชบอร์ด", roles: ["admin", "manager", "sales"] },
    { key: "quotations", label: "ใบเสนอราคา", roles: ["admin", "manager", "sales"] },
    { key: "customers", label: "ลูกค้า", roles: ["admin", "manager", "sales"] },
    { key: "products", label: "สินค้า/บริการ", roles: ["admin", "manager", "sales"] },
    { key: "company", label: "ข้อมูลบริษัท", roles: ["admin"] },
    { key: "settings", label: "ตั้งค่า", roles: ["admin"] },
  ];

  elements.sidebarMenu.innerHTML = allMenus
    .filter((item) => item.roles.includes(role))
    .map((item) => {
      const isActive =
        item.key === appState.currentPage ||
        (item.key === "quotations" && appState.currentPage.startsWith("quotation-")) ||
        (item.key === "products" && appState.currentPage.startsWith("product-"));

      return `
        <button class="menu-item ${isActive ? "active" : ""}" data-page="${item.key}">
          <span>${menuIcon(item.key)}</span>
          <span>${item.label}</span>
        </button>
      `;
    })
    .join("");

  elements.sidebarMenu.querySelectorAll(".menu-item").forEach((button) => {
    button.addEventListener("click", () => {
      document.body.classList.remove("nav-open");
      location.hash = `#${button.dataset.page}`;
    });
  });
}

async function renderCurrentPage() {
  if (!appState.profile) return;

  const seq = ++appState.navigationSeq;
  const page = appState.currentPage;

  try {
    if (!(await ensureActiveSession())) return;
    renderMenu();

    if (page === "dashboard") {
      await renderDashboardPage();
    } else if (page === "quotations") {
      await renderQuotationsPage();
    } else if (page === "quotation-new") {
      await renderQuotationCreatePage();
    } else if (page.startsWith("quotation-edit/")) {
      await renderQuotationEditPage(page.replace("quotation-edit/", ""));
    } else if (page.startsWith("quotation-view/")) {
      await renderQuotationViewPage(page.replace("quotation-view/", ""));
    } else if (page.startsWith("quotation-print/")) {
      await renderQuotationPrintPage(page.replace("quotation-print/", ""));
    } else if (page === "customers") {
      await renderCustomersPage();
    } else if (page === "products") {
      await renderProductsPage();
    } else if (page === "product-new") {
      await renderProductFormPage({ mode: "create", productId: null });
    } else if (page.startsWith("product-edit/")) {
      await renderProductFormPage({ mode: "edit", productId: page.replace("product-edit/", "") });
    } else if (page === "company") {
      await renderCompanyPage();
    } else if (page === "settings") {
      await renderSettingsPage();
    } else {
      appState.currentPage = "dashboard";
      location.hash = "#dashboard";
    }

    if (seq !== appState.navigationSeq) return;
  } catch (error) {
    console.error(error);
    renderError(error.message || "โหลดข้อมูลไม่สำเร็จ");
    showToast(error.message || "โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่", "error", { duration: 5200 });
  }
}

function setPageHeader(title) {
  const titleMap = {
    Dashboard: "แดชบอร์ด",
    "Company Profile": "ข้อมูลบริษัท",
    Settings: "ตั้งค่า",
    "Preview / Print": "ตัวอย่างเอกสาร / พิมพ์",
    "สินค้า/บริการ": "สินค้า/บริการ",
  };

  elements.pageTitle.textContent = titleMap[title] || title || "";
  elements.pageSubtitle.textContent = "";
}

function renderLoading(label = "กำลังโหลดข้อมูล...") {
  elements.pageContent.innerHTML = `
    <div class="loading-card skeleton-card" aria-busy="true">
      <div class="skeleton-line short"></div>
      <div class="skeleton-line long"></div>
      <div class="skeleton-line medium"></div>
      <span class="sr-only">${escapeHTML(label)}</span>
    </div>
  `;
}

function renderError(message) {
  elements.pageContent.innerHTML = `
    <div class="card">
      <div class="alert alert-error">${escapeHTML(message)}</div>
      <div class="form-actions normal-flow">
        <button type="button" class="btn btn-ghost" onclick="renderCurrentPage()">ลองใหม่</button>
      </div>
    </div>
  `;
}

function showToast(message, type = "info", options = {}) {
  const duration = options.duration ?? (type === "error" ? 5200 : 2800);
  elements.toast.textContent = message;
  elements.toast.className = `toast toast-${type}`;
  elements.toast.classList.remove("hidden");

  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.add("hidden");
  }, duration);
}

function showPageBusy(label = "กำลังดำเนินการ") {
  const overlay = document.querySelector("#pageBusyOverlay");
  if (!overlay) return;
  overlay.querySelector("strong").textContent = label;
  overlay.classList.remove("hidden");
}

function hidePageBusy() {
  const overlay = document.querySelector("#pageBusyOverlay");
  if (overlay) overlay.classList.add("hidden");
}

async function withAction(key, action) {
  if (appState.activeActions.has(key)) return;
  appState.activeActions.add(key);
  try {
    return await action();
  } finally {
    appState.activeActions.delete(key);
  }
}

async function withButtonLoading(button, loadingText, action) {
  if (!button) return action();
  const oldText = button.textContent;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = loadingText;
  try {
    return await action();
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.textContent = oldText;
  }
}

function roleLabel(role) {
  const map = {
    admin: "ผู้ดูแลระบบ",
    manager: "ผู้จัดการ",
    sales: "ฝ่ายขาย",
  };
  return map[role] || role || "-";
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

function statusPill(label, style) {
  const labelMap = {
    Active: "ใช้งาน",
    Inactive: "ปิดใช้งาน",
  };
  return `<span class="status-badge status-${style}">${labelMap[label] || label}</span>`;
}

function renderQuotationActionButtons(quotation, effectiveStatus) {
  const role = appState.profile.role;
  const isOwner = quotation.owner_id === appState.user.id;
  const canModify = role === "admin" || (role === "sales" && isOwner);
  if (!canModify) return "";

  const buttons = [];

  if (quotation.status === "draft") {
    buttons.push(`<button id="editDraftButton" class="btn btn-ghost">แก้ไขร่าง</button>`);
    buttons.push(`<button id="confirmQuotationButton" class="btn btn-primary">ยืนยันและออกเลข</button>`);
    buttons.push(`<button id="cancelQuotationButton" class="btn btn-ghost">ยกเลิกเอกสาร</button>`);
  }

  if (quotation.status === "confirmed" && effectiveStatus === "confirmed") {
    buttons.push(`<button id="markSentButton" class="btn btn-primary">เปลี่ยนเป็นส่งแล้ว</button>`);
  }

  if (quotation.status !== "draft") {
    buttons.push(`<button id="printPreviewButton" class="btn btn-primary">ตัวอย่าง / พิมพ์</button>`);
    buttons.push(`<button id="duplicateQuotationButton" class="btn btn-ghost">สร้างสำเนา</button>`);
  }

  return buttons.join("");
}

function bindQuotationViewActions(quotation) {
  const backButton = $("#backToListButton");
  const editDraftButton = $("#editDraftButton");
  const confirmButton = $("#confirmQuotationButton");
  const markSentButton = $("#markSentButton");
  const printPreviewButton = $("#printPreviewButton");
  const duplicateButton = $("#duplicateQuotationButton");
  const cancelButton = $("#cancelQuotationButton");

  if (backButton) backButton.addEventListener("click", () => (location.hash = "#quotations"));
  if (editDraftButton) editDraftButton.addEventListener("click", () => (location.hash = `#quotation-edit/${quotation.id}`));
  if (printPreviewButton) printPreviewButton.addEventListener("click", () => (location.hash = `#quotation-print/${quotation.id}`));

  if (confirmButton) confirmButton.addEventListener("click", async () => withButtonLoading(confirmButton, "กำลังยืนยัน...", () => confirmQuotation(quotation.id)));
  if (markSentButton) markSentButton.addEventListener("click", async () => withButtonLoading(markSentButton, "กำลังบันทึก...", () => markQuotationAsSent(quotation.id)));
  if (duplicateButton) duplicateButton.addEventListener("click", async () => withButtonLoading(duplicateButton, "กำลังสร้างสำเนา...", () => duplicateQuotation(quotation.id)));
  if (cancelButton) cancelButton.addEventListener("click", async () => withButtonLoading(cancelButton, "กำลังยกเลิก...", () => cancelQuotationDraft(quotation.id)));
}

async function confirmQuotation(quotationId) {
  const ok = window.confirm("ยืนยันและออกเลขใบเสนอราคาใช่ไหม? หลังยืนยันแล้วจะแก้ไขเอกสารเดิมไม่ได้");
  if (!ok) return;

  await withAction(`confirm-${quotationId}`, async () => {
    showToast("กำลังสร้างเลขใบเสนอราคา...", "info");
    const { data, error } = await supabaseClient.rpc("confirm_quotation", { p_quotation_id: quotationId });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    showToast(`ยืนยันสำเร็จ ${result?.quotation_no || ""}`, "success");
    await renderQuotationViewPage(quotationId);
  }).catch((error) => {
    console.error(error);
    showToast(error.message || "ยืนยันเอกสารไม่สำเร็จ", "error");
  });
}

async function markQuotationAsSent(quotationId) {
  const ok = window.confirm("เปลี่ยนสถานะเป็นส่งแล้วใช่ไหม?");
  if (!ok) return;

  await withAction(`sent-${quotationId}`, async () => {
    showToast("กำลังเปลี่ยนสถานะ...", "info");
    const { error } = await supabaseClient.rpc("change_quotation_status", {
      p_quotation_id: quotationId,
      p_new_status: "sent",
    });
    if (error) throw error;
    showToast("เปลี่ยนสถานะสำเร็จ", "success");
    await renderQuotationViewPage(quotationId);
  }).catch((error) => {
    console.error(error);
    showToast(error.message || "เปลี่ยนสถานะไม่สำเร็จ", "error");
  });
}

async function duplicateQuotation(quotationId) {
  const ok = window.confirm("สร้างสำเนาเป็นเอกสารร่างใหม่ใช่ไหม?");
  if (!ok) return;

  await withAction(`duplicate-${quotationId}`, async () => {
    showToast("กำลังสร้างสำเนา...", "info");
    const { data, error } = await supabaseClient.rpc("duplicate_quotation", { p_quotation_id: quotationId });
    if (error) throw error;
    const newId = Array.isArray(data) ? data[0] : data;
    showToast("สร้างสำเนาสำเร็จ", "success");
    location.hash = `#quotation-view/${newId}`;
  }).catch((error) => {
    console.error(error);
    showToast(error.message || "สร้างสำเนาไม่สำเร็จ", "error");
  });
}

async function cancelQuotationDraft(quotationId) {
  const ok = window.confirm("ยกเลิกเอกสารร่างนี้ใช่ไหม?");
  if (!ok) return;

  await withAction(`cancel-${quotationId}`, async () => {
    showToast("กำลังยกเลิกเอกสาร...", "info");
    const { error } = await supabaseClient.rpc("cancel_quotation", { p_quotation_id: quotationId });
    if (error) throw error;
    showToast("ยกเลิกเอกสารสำเร็จ", "success");
    await renderQuotationViewPage(quotationId);
  }).catch((error) => {
    console.error(error);
    showToast(error.message || "ยกเลิกเอกสารไม่สำเร็จ", "error");
  });
}

async function renderCompanyPage() {
  if (appState.profile.role !== "admin") {
    renderError("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
    return;
  }

  setPageHeader("ข้อมูลบริษัท");
  renderLoading();

  const { data, error } = await supabaseClient
    .from("company_profile")
    .select("*")
    .eq("is_default", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    renderError("ยังไม่มีข้อมูลบริษัทเริ่มต้น");
    return;
  }

  elements.pageContent.innerHTML = `
    <form id="companyProfileForm" class="card form-card">
      <div class="card-header">
        <div><h3>ข้อมูลบริษัท</h3></div>
      </div>

      <div class="form-grid">
        <div class="field full">
          <label>โลโก้บริษัท</label>
          <div class="logo-upload-card">
            <div class="logo-preview-box" id="companyLogoPreview">
              ${data.logo_url ? `<img src="${escapeHTML(data.logo_url)}" alt="โลโก้บริษัท" />` : `<div class="logo-preview-placeholder">FI</div>`}
            </div>
            <div>
              <div class="file-input-row">
                <input id="companyLogoFile" type="file" accept="image/png,image/jpeg" />
                <label class="checkbox-row" style="min-height:auto;">
                  <input id="removeCompanyLogo" type="checkbox" />
                  <span>ลบโลโก้ปัจจุบัน</span>
                </label>
              </div>
              <input id="companyLogoCurrentUrl" type="hidden" value="${escapeHTML(data.logo_url || "")}" />
            </div>
          </div>
        </div>

        <div class="field full"><label for="companyName">ชื่อบริษัท *</label><input id="companyName" type="text" value="${escapeHTML(data.company_name || "")}" required /></div>
        <div class="field"><label for="companyTaxId">เลขประจำตัวผู้เสียภาษี</label><input id="companyTaxId" type="text" value="${escapeHTML(data.tax_id || "")}" /></div>
        <div class="field"><label for="companyBranchName">สาขา</label><input id="companyBranchName" type="text" value="${escapeHTML(data.branch_name || "")}" /></div>
        <div class="field full"><label for="companyAddress">ที่อยู่</label><textarea id="companyAddress" rows="3">${escapeHTML(data.address || "")}</textarea></div>
        <div class="field"><label for="companyPhone">เบอร์โทร</label><input id="companyPhone" type="text" value="${escapeHTML(data.phone || "")}" /></div>
        <div class="field"><label for="companyEmail">อีเมล</label><input id="companyEmail" type="email" value="${escapeHTML(data.email || "")}" /></div>
        <div class="field"><label for="companyBankName">ธนาคาร</label><input id="companyBankName" type="text" value="${escapeHTML(data.bank_name || "")}" /></div>
        <div class="field"><label for="companyBankAccountNo">เลขบัญชี</label><input id="companyBankAccountNo" type="text" value="${escapeHTML(data.bank_account_no || "")}" /></div>
        <div class="field full"><label for="companyBankAccountName">ชื่อบัญชี</label><input id="companyBankAccountName" type="text" value="${escapeHTML(data.bank_account_name || "")}" /></div>
        <div class="field full"><label for="companyPaymentNote">ข้อความแจ้งชำระเงิน</label><textarea id="companyPaymentNote" rows="2">${escapeHTML(data.payment_note || "")}</textarea></div>
        <div class="field full"><label for="companyDefaultNote">หมายเหตุเริ่มต้น</label><textarea id="companyDefaultNote" rows="5">${escapeHTML(data.default_note || "")}</textarea></div>
        <div class="field full"><label for="companyDefaultPaymentTerms">เงื่อนไขการชำระเงินเริ่มต้น</label><textarea id="companyDefaultPaymentTerms" rows="5">${escapeHTML(data.default_payment_terms || "")}</textarea></div>
      </div>

      <div class="form-actions normal-flow">
        <button type="button" id="resetCompanyFormButton" class="btn btn-ghost">โหลดใหม่</button>
        <button type="submit" id="saveCompanyButton" class="btn btn-primary">บันทึกข้อมูลบริษัท</button>
      </div>
    </form>
  `;

  const logoFile = $("#companyLogoFile");
  if (logoFile) {
    logoFile.addEventListener("change", () => previewCompanyLogoFile(logoFile.files?.[0]));
  }

  $("#resetCompanyFormButton").addEventListener("click", () => renderCompanyPage());
  $("#companyProfileForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveCompanyProfile(data.id);
  });
}

function previewCompanyLogoFile(file) {
  if (!file) return;
  const preview = $("#companyLogoPreview");
  if (!preview) return;
  const url = URL.createObjectURL(file);
  preview.innerHTML = `<img src="${url}" alt="ตัวอย่างโลโก้" />`;
}

async function saveCompanyProfile(companyId) {
  const saveButton = $("#saveCompanyButton");

  await withButtonLoading(saveButton, "กำลังบันทึก...", async () => {
    try {
      const companyName = $("#companyName").value.trim();
      if (!companyName) throw new Error("กรุณากรอกชื่อบริษัท");

      let logoUrl = $("#companyLogoCurrentUrl").value.trim();
      const removeLogo = $("#removeCompanyLogo")?.checked;
      const logoFile = $("#companyLogoFile")?.files?.[0];

      if (removeLogo) {
        logoUrl = "";
      } else if (logoFile) {
        showToast("กำลังอัปโหลดโลโก้...", "info");
        logoUrl = await uploadCompanyLogo(companyId, logoFile);
      }

      const payload = {
        company_name: companyName,
        tax_id: $("#companyTaxId").value.trim(),
        branch_name: $("#companyBranchName").value.trim(),
        address: $("#companyAddress").value.trim(),
        phone: $("#companyPhone").value.trim(),
        email: $("#companyEmail").value.trim(),
        logo_url: logoUrl,
        bank_name: $("#companyBankName").value.trim(),
        bank_account_name: $("#companyBankAccountName").value.trim(),
        bank_account_no: $("#companyBankAccountNo").value.trim(),
        payment_note: $("#companyPaymentNote").value.trim(),
        default_note: $("#companyDefaultNote").value.trim(),
        default_payment_terms: $("#companyDefaultPaymentTerms").value.trim(),
      };

      const { error } = await supabaseClient.from("company_profile").update(payload).eq("id", companyId);
      if (error) throw error;

      showToast("บันทึกข้อมูลบริษัทสำเร็จ", "success");
      await renderCompanyPage();
    } catch (error) {
      console.error(error);
      showToast(error.message || "บันทึกข้อมูลบริษัทไม่สำเร็จ", "error");
    }
  });
}

async function uploadCompanyLogo(companyId, file) {
  const allowedTypes = ["image/png", "image/jpeg"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("รองรับเฉพาะไฟล์ JPG หรือ PNG");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("ขนาดไฟล์โลโก้ต้องไม่เกิน 5 MB");
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `company-logos/${companyId}/logo-${Date.now()}.${ext}`;

  const { error } = await supabaseClient.storage
    .from("company-assets")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

  if (error) throw error;

  const { data } = supabaseClient.storage.from("company-assets").getPublicUrl(path);
  return data.publicUrl;
}

function renderQuotationList(rows) {
  const canCreate = appState.profile.role !== "manager";
  setPageHeader(appState.profile.role === "sales" ? "ใบเสนอราคาของฉัน" : "รายการใบเสนอราคา");

  elements.pageContent.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div><h3>รายการใบเสนอราคา</h3></div>
        <div class="table-actions">
          <button id="exportQuotationsCsvButton" class="btn btn-ghost">ส่งออก Excel/CSV</button>
          ${canCreate ? `<button id="newQuotationButton" class="btn btn-primary">+ สร้าง</button>` : ``}
        </div>
      </div>

      <div class="filter-bar">
        <input id="quotationSearch" type="search" placeholder="ค้นหาเลขเอกสาร / ลูกค้า / ฝ่ายขาย" />
        <select id="quotationStatusFilter">
          <option value="">ทุกสถานะ</option>
          <option value="draft">ร่าง</option>
          <option value="confirmed">ยืนยันแล้ว</option>
          <option value="sent">ส่งแล้ว</option>
          <option value="expired">หมดอายุ</option>
          <option value="cancelled">ยกเลิก</option>
        </select>
        <select id="quotationBillingFilter">
          <option value="">ทุกประเภท</option>
          <option value="monthly">รายเดือน</option>
          <option value="yearly">รายปี</option>
        </select>
      </div>

      <div id="quotationTable"></div>
    </div>
  `;

  const searchInput = $("#quotationSearch");
  const statusFilter = $("#quotationStatusFilter");
  const billingFilter = $("#quotationBillingFilter");
  const tableTarget = $("#quotationTable");
  const newButton = $("#newQuotationButton");
  const exportButton = $("#exportQuotationsCsvButton");
  let currentFilteredRows = rows;

  if (newButton) newButton.addEventListener("click", () => (location.hash = "#quotation-new"));
  if (exportButton) exportButton.addEventListener("click", () => exportQuotationsCsv(currentFilteredRows));

  function updateTable() {
    const keyword = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value;
    const billingType = billingFilter.value;

    currentFilteredRows = rows.filter((row) => {
      const text = `${row.quotation_no || ""} ${row.customer_name || ""} ${row.owner_name || ""}`.toLowerCase();
      return (!keyword || text.includes(keyword)) && (!status || row.effective_status === status) && (!billingType || row.billing_type === billingType);
    });

    tableTarget.innerHTML = renderQuotationTable(currentFilteredRows);
    bindQuotationTableActions();
  }

  [searchInput, statusFilter, billingFilter].forEach((input) => input.addEventListener(input.tagName === "INPUT" ? "input" : "change", updateTable));
  updateTable();
}

function renderProductsTableV10(rows, canEdit) {
  if (!rows.length) return `<div class="empty-state">ยังไม่มีสินค้า/บริการ</div>`;
  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>รหัส</th><th>ชื่อสินค้า/บริการ</th><th>รายละเอียด</th><th>หน่วย</th><th>สถานะ</th>${canEdit ? "<th>การกระทำ</th>" : ""}</tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td><strong>${escapeHTML(row.code || "-")}</strong></td>
              <td>${escapeHTML(row.name || "-")}</td>
              <td>${escapeHTML(row.description || "-")}</td>
              <td>${escapeHTML(row.default_unit || "-")}</td>
              <td>${row.is_active ? statusPill("Active", "confirmed") : statusPill("Inactive", "cancelled")}</td>
              ${canEdit ? `<td><button class="btn btn-ghost" data-product-edit="${row.id}">แก้ไข</button></td>` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}


// =======================================================
// v1.2 Reliability + Date Range Filter + XLSX Export
// Session recovery, login flash guard, logout confirm
// =======================================================

appState.lastResumeAt = 0;
appState.isBootstrapping = false;

async function initApp() {
  if (!isConfigured) {
    showLoginPage();
    showSetupWarningOnLogin();
    return;
  }

  appState.isBootstrapping = true;
  showBootPage();
  bindEvents();

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (data.session?.user) {
      appState.user = data.session.user;
      appState.profile = null;
      await loadProfile();
      showAppShell();
      await renderCurrentPage();
    } else {
      showLoginPage();
    }
  } catch (error) {
    console.error(error);
    showLoginPage();
    showLoginError("ไม่สามารถตรวจสอบ session ได้ กรุณาเข้าสู่ระบบใหม่");
  } finally {
    appState.isBootstrapping = false;
  }

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;

    if (session?.user) {
      appState.user = session.user;
      if (!appState.profile || appState.profile.id !== session.user.id) {
        await loadProfile();
      }
      showAppShell();

      if (!appState.isBootstrapping) {
        await renderCurrentPage();
      }
    } else {
      appState.user = null;
      appState.profile = null;
      showLoginPage();
    }
  });
}

function bindEvents() {
  if (elements.loginForm) elements.loginForm.addEventListener("submit", handleLogin);
  if (elements.logoutButton) elements.logoutButton.addEventListener("click", handleLogout);

  const mobileMenuButton = document.querySelector("#mobileMenuButton");
  if (mobileMenuButton) {
    mobileMenuButton.addEventListener("click", () => {
      document.body.classList.toggle("nav-open");
    });
  }

  window.addEventListener("hashchange", async () => {
    appState.currentPage = getPageFromHash();
    await renderCurrentPage();
  });

  window.addEventListener("focus", () => {
    recoverAppAfterResume("focus");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      recoverAppAfterResume("visible");
    }
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      recoverAppAfterResume("pageshow");
    }
  });
}

function showBootPage() {
  const bootPage = document.querySelector("#bootPage");
  if (bootPage) bootPage.classList.remove("hidden");
  if (elements.loginPage) elements.loginPage.classList.add("hidden");
  if (elements.appShell) elements.appShell.classList.add("hidden");
}

function hideBootPage() {
  const bootPage = document.querySelector("#bootPage");
  if (bootPage) bootPage.classList.add("hidden");
}

function showLoginPage() {
  hideBootPage();
  if (elements.loginPage) elements.loginPage.classList.remove("hidden");
  if (elements.appShell) elements.appShell.classList.add("hidden");
  document.body.classList.remove("nav-open");
  hidePageBusy();
}

function showAppShell() {
  hideBootPage();
  if (elements.loginPage) elements.loginPage.classList.add("hidden");
  if (elements.appShell) elements.appShell.classList.remove("hidden");

  updateHeaderUser();
  renderMenu();

  if (!location.hash) {
    location.hash = "#dashboard";
  } else {
    appState.currentPage = getPageFromHash();
  }

  hidePageBusy();
}

function updateHeaderUser() {
  if (!appState.profile) return;

  const fullName = appState.profile.full_name || appState.profile.email || "-";
  const roleText = roleLabel(appState.profile.role);

  if (elements.userName) elements.userName.textContent = fullName;
  if (elements.userRole) elements.userRole.textContent = roleText;

  const userChip = document.querySelector("#headerUserChip");
  if (userChip) {
    userChip.textContent = `${fullName} · ${roleText}`;
    userChip.title = `${fullName} · ${roleText}`;
  }
}

async function recoverAppAfterResume(reason = "resume") {
  if (!supabaseClient || document.visibilityState === "hidden") return;

  const now = Date.now();
  if (now - (appState.lastResumeAt || 0) < 900) return;
  appState.lastResumeAt = now;

  try {
    hidePageBusy();
    document.body.classList.remove("nav-open");

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (!data.session?.user) {
      appState.user = null;
      appState.profile = null;
      showLoginPage();
      return;
    }

    appState.user = data.session.user;

    if (!appState.profile || appState.profile.id !== data.session.user.id) {
      await loadProfile();
    }

    updateHeaderUser();

    const page = getPageFromHash();
    const isEditingPage =
      page === "quotation-new" ||
      page.startsWith("quotation-edit/") ||
      page === "product-new" ||
      page.startsWith("product-edit/") ||
      page === "company";

    if (!elements.appShell.classList.contains("hidden") && !isEditingPage) {
      appState.currentPage = page;
      await renderCurrentPage();
    }
  } catch (error) {
    console.error(error);
    showToast("เชื่อมต่อ session ไม่สำเร็จ กรุณารีเฟรชหรือเข้าสู่ระบบใหม่", "warning", { duration: 5200 });
  }
}

async function handleLogout() {
  if (!supabaseClient) return;

  const confirmed = await showConfirmDialog({
    title: "ออกจากระบบ?",
    message: "คุณต้องการออกจากระบบใช่ไหม",
    confirmText: "ออกจากระบบ",
    cancelText: "ยกเลิก",
    danger: true,
  });

  if (!confirmed) return;

  await withAction("logout", async () => {
    try {
      showPageBusy("กำลังออกจากระบบ");
      await supabaseClient.auth.signOut();
      hidePageBusy();
      showToast("ออกจากระบบแล้ว", "success");
    } catch (error) {
      hidePageBusy();
      console.error(error);
      showToast(error.message || "ออกจากระบบไม่สำเร็จ", "error");
    }
  });
}

function showConfirmDialog({ title, message, confirmText = "ยืนยัน", cancelText = "ยกเลิก", danger = false }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-body">
          <h3>${escapeHTML(title)}</h3>
          <p>${escapeHTML(message)}</p>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-confirm-cancel>${escapeHTML(cancelText)}</button>
          <button type="button" class="btn ${danger ? "btn-ghost danger-soft" : "btn-primary"}" data-confirm-ok>${escapeHTML(confirmText)}</button>
        </div>
      </div>
    `;

    function cleanup(value) {
      document.removeEventListener("keydown", onKeyDown);
      backdrop.remove();
      resolve(value);
    }

    function onKeyDown(event) {
      if (event.key === "Escape") cleanup(false);
    }

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) cleanup(false);
    });

    backdrop.querySelector("[data-confirm-cancel]").addEventListener("click", () => cleanup(false));
    backdrop.querySelector("[data-confirm-ok]").addEventListener("click", () => cleanup(true));

    document.addEventListener("keydown", onKeyDown);
    document.body.appendChild(backdrop);
    backdrop.querySelector("[data-confirm-ok]").focus();
  });
}

function renderQuotationList(rows) {
  const canCreate = appState.profile.role !== "manager";
  setPageHeader(appState.profile.role === "sales" ? "ใบเสนอราคาของฉัน" : "รายการใบเสนอราคา");

  elements.pageContent.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div><h3>รายการใบเสนอราคา</h3></div>
        <div class="table-actions">
          <button id="exportQuotationsXlsxButton" class="btn btn-ghost btn-export-disabled" disabled>
            Export Excel
          </button>
          ${canCreate ? `<button id="newQuotationButton" class="btn btn-primary">+ สร้าง</button>` : ``}
        </div>
      </div>

      <div class="filter-card">
        <div class="filter-grid">
          <div class="filter-field">
            <label for="quotationSearch">ค้นหา</label>
            <input id="quotationSearch" type="search" placeholder="เลขเอกสาร / ลูกค้า / ฝ่ายขาย" />
          </div>

          <div class="filter-field">
            <label for="quotationStatusFilter">สถานะ</label>
            <select id="quotationStatusFilter">
              <option value="">ทุกสถานะ</option>
              <option value="draft">ร่าง</option>
              <option value="confirmed">ยืนยันแล้ว</option>
              <option value="sent">ส่งแล้ว</option>
              <option value="expired">หมดอายุ</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
          </div>

          <div class="filter-field">
            <label for="quotationBillingFilter">ประเภท</label>
            <select id="quotationBillingFilter">
              <option value="">ทุกประเภท</option>
              <option value="monthly">รายเดือน</option>
              <option value="yearly">รายปี</option>
            </select>
          </div>

          <div class="filter-field">
            <label for="quoteDateFromFilter">วันที่เสนอราคา จาก</label>
            <input id="quoteDateFromFilter" type="date" />
          </div>

          <div class="filter-field">
            <label for="quoteDateToFilter">วันที่เสนอราคา ถึง</label>
            <input id="quoteDateToFilter" type="date" />
          </div>

          <div class="filter-field">
            <label for="validUntilFromFilter">วันหมดอายุ จาก</label>
            <input id="validUntilFromFilter" type="date" />
          </div>

          <div class="filter-field">
            <label for="validUntilToFilter">วันหมดอายุ ถึง</label>
            <input id="validUntilToFilter" type="date" />
          </div>
        </div>

        <div id="quotationFilterHelp" class="filter-help">
          Export Excel ได้เมื่อกรองช่วงวันที่เสนอราคาหรือช่วงวันหมดอายุอย่างน้อย 1 ช่วง และแต่ละช่วงต้องไม่เกิน 3 เดือน
        </div>
      </div>

      <div id="quotationTable"></div>
    </div>
  `;

  const searchInput = $("#quotationSearch");
  const statusFilter = $("#quotationStatusFilter");
  const billingFilter = $("#quotationBillingFilter");
  const quoteFrom = $("#quoteDateFromFilter");
  const quoteTo = $("#quoteDateToFilter");
  const validFrom = $("#validUntilFromFilter");
  const validTo = $("#validUntilToFilter");
  const tableTarget = $("#quotationTable");
  const newButton = $("#newQuotationButton");
  const exportButton = $("#exportQuotationsXlsxButton");
  const filterHelp = $("#quotationFilterHelp");

  let currentFilteredRows = rows;

  if (newButton) newButton.addEventListener("click", () => (location.hash = "#quotation-new"));
  if (exportButton) {
    exportButton.addEventListener("click", () => exportQuotationsXlsx(currentFilteredRows));
  }

  function getFilterState() {
    const quoteRange = getDateRangeState(quoteFrom.value, quoteTo.value, "วันที่เสนอราคา");
    const validRange = getDateRangeState(validFrom.value, validTo.value, "วันหมดอายุ");

    const hasValidExportDateRange =
      (quoteRange.active && quoteRange.valid) ||
      (validRange.active && validRange.valid);

    const hasInvalidRange =
      quoteRange.invalidReason ||
      validRange.invalidReason;

    return { quoteRange, validRange, hasValidExportDateRange, hasInvalidRange };
  }

  function updateExportState() {
    const state = getFilterState();

    if (state.hasInvalidRange) {
      exportButton.disabled = true;
      exportButton.classList.add("btn-export-disabled");
      exportButton.title = state.hasInvalidRange;
      filterHelp.className = "filter-warning";
      filterHelp.textContent = state.hasInvalidRange;
      return;
    }

    if (!state.hasValidExportDateRange) {
      exportButton.disabled = true;
      exportButton.classList.add("btn-export-disabled");
      exportButton.title = "ต้องเลือกช่วงวันที่เสนอราคาหรือช่วงวันหมดอายุก่อน";
      filterHelp.className = "filter-help";
      filterHelp.textContent = "Export Excel ได้เมื่อกรองช่วงวันที่เสนอราคาหรือช่วงวันหมดอายุอย่างน้อย 1 ช่วง และแต่ละช่วงต้องไม่เกิน 3 เดือน";
      return;
    }

    exportButton.disabled = false;
    exportButton.classList.remove("btn-export-disabled");
    exportButton.title = "";
    filterHelp.className = "filter-help";
    filterHelp.textContent = `พร้อม Export ${number(currentFilteredRows.length)} รายการเป็น Excel`;
  }

  function updateTable() {
    const keyword = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value;
    const billingType = billingFilter.value;
    const state = getFilterState();

    currentFilteredRows = rows.filter((row) => {
      const text = `${row.quotation_no || ""} ${row.customer_name || ""} ${row.owner_name || ""}`.toLowerCase();

      const matchText = !keyword || text.includes(keyword);
      const matchStatus = !status || row.effective_status === status;
      const matchBilling = !billingType || row.billing_type === billingType;
      const matchQuoteRange = !state.quoteRange.active || !state.quoteRange.valid || isDateWithinRange(row.quote_date, state.quoteRange.from, state.quoteRange.to);
      const matchValidRange = !state.validRange.active || !state.validRange.valid || isDateWithinRange(row.valid_until, state.validRange.from, state.validRange.to);

      return matchText && matchStatus && matchBilling && matchQuoteRange && matchValidRange;
    });

    tableTarget.innerHTML = renderQuotationTable(currentFilteredRows);
    bindQuotationTableActions();
    updateExportState();
  }

  [searchInput, statusFilter, billingFilter, quoteFrom, quoteTo, validFrom, validTo].forEach((input) => {
    input.addEventListener(input.type === "search" ? "input" : "change", updateTable);
  });

  updateTable();
}

function getDateRangeState(fromValue, toValue, label) {
  const hasFrom = Boolean(fromValue);
  const hasTo = Boolean(toValue);

  if (!hasFrom && !hasTo) {
    return { active: false, valid: false, from: null, to: null, invalidReason: "" };
  }

  if (!hasFrom || !hasTo) {
    return {
      active: true,
      valid: false,
      from: null,
      to: null,
      invalidReason: `กรุณาเลือกช่วง${label}ให้ครบทั้งวันที่เริ่มต้นและวันที่สิ้นสุด`,
    };
  }

  const from = parseDateOnly(fromValue);
  const to = parseDateOnly(toValue);

  if (!from || !to) {
    return {
      active: true,
      valid: false,
      from: null,
      to: null,
      invalidReason: `ช่วง${label}ไม่ถูกต้อง`,
    };
  }

  if (to < from) {
    return {
      active: true,
      valid: false,
      from,
      to,
      invalidReason: `ช่วง${label}: วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น`,
    };
  }

  const maxTo = addMonths(from, 3);
  if (to > maxTo) {
    return {
      active: true,
      valid: false,
      from,
      to,
      invalidReason: `ช่วง${label}ต้องไม่เกิน 3 เดือน`,
    };
  }

  return { active: true, valid: true, from, to, invalidReason: "" };
}

function parseDateOnly(value) {
  if (!value) return null;

  if (value instanceof Date) {
    const result = new Date(value);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  const text = String(value);
  const dateOnly = text.includes("T") ? text.slice(0, 10) : text.slice(0, 10);
  const parts = dateOnly.split("-").map(Number);

  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;

  const result = new Date(parts[0], parts[1] - 1, parts[2]);
  result.setHours(0, 0, 0, 0);
  return result;
}

function isDateWithinRange(value, from, to) {
  const date = parseDateOnly(value);
  if (!date) return false;
  return date >= from && date <= to;
}

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function exportQuotationsXlsx(rows) {
  if (!rows.length) {
    showToast("ไม่มีข้อมูลสำหรับ Export", "warning");
    return;
  }

  if (!window.XLSX) {
    showToast("ไม่พบ Excel library กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่", "error", { duration: 5200 });
    return;
  }

  const aoa = [
    [
      "เลขที่ใบเสนอราคา",
      "ลูกค้า",
      "ประเภท",
      "ฝ่ายขาย",
      "วันที่เสนอราคา",
      "วันหมดอายุ",
      "ยอดรวมสุทธิ",
      "สถานะ",
    ],
    ...rows.map((row) => [
      row.quotation_no || "ยังไม่ออกเลข",
      row.customer_name || "",
      billingTypeLabel(row.billing_type),
      row.owner_name || "",
      row.quote_date ? formatDate(row.quote_date) : "",
      row.valid_until ? formatDate(row.valid_until) : "",
      Number(row.grand_total_display || 0),
      statusLabel(row.effective_status),
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = [
    { wch: 20 },
    { wch: 34 },
    { wch: 14 },
    { wch: 24 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "ใบเสนอราคา");

  const filename = `fi-quotation-export-${toDateInputValue(new Date())}.xlsx`;
  XLSX.writeFile(workbook, filename);
  showToast(`Export Excel สำเร็จ ${number(rows.length)} รายการ`, "success");
}


// =======================================================
// v1.3 Status + Analytics + Bulk Update + Stability Patch
// =======================================================

Object.assign(appState, {
  selectedQuotationIds: new Set(),
  quotationListRows: [],
  quotationFilteredRows: [],
  quotationSort: { key: "created_at", direction: "desc" },
  quotationFilters: {
    keyword: "",
    status: "",
    billingType: "",
    ownerId: "",
    quoteFrom: "",
    quoteTo: "",
    validFrom: "",
    validTo: "",
  },
  activeActions: new Set(),
  lastResumeAt: 0,
  renderToken: 0,
});

const V13_STATUS = {
  draft: "ร่าง",
  confirmed: "ยืนยัน",
  sent: "ส่งแล้ว",
  paid: "ชำระเงิน",
  expired: "หมดอายุ",
  cancelled: "ยกเลิก",
};

const V13_BULK_STATUS_OPTIONS = [
  { value: "sent", label: "ส่งแล้ว" },
  { value: "paid", label: "ชำระเงิน" },
  { value: "cancelled", label: "ยกเลิก" },
];

async function initApp() {
  showBootPage();

  if (!isConfigured) {
    hideBootPage();
    showLoginPage();
    showSetupWarningOnLogin();
    return;
  }

  bindEvents();

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (data.session?.user) {
      appState.user = data.session.user;
      await loadProfile();
      hideBootPage();
      showAppShell();
      await renderCurrentPage();
    } else {
      hideBootPage();
      showLoginPage();
    }
  } catch (error) {
    console.error(error);
    hideBootPage();
    showLoginPage();
    showLoginError("ไม่สามารถตรวจสอบ session ได้ กรุณาเข้าสู่ระบบใหม่");
  }

  if (!window.__fiAuthListenerV13) {
    window.__fiAuthListenerV13 = true;
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (event === "TOKEN_REFRESHED" && session?.user) {
        appState.user = session.user;
        return;
      }

      if (session?.user) {
        appState.user = session.user;
        try {
          await loadProfile();
          hideBootPage();
          showAppShell();
          await renderCurrentPage();
        } catch (error) {
          console.error(error);
          showToast("โหลดข้อมูลผู้ใช้ไม่สำเร็จ", "error");
        }
      } else if (event === "SIGNED_OUT") {
        appState.user = null;
        appState.profile = null;
        appState.selectedQuotationIds.clear();
        hideBootPage();
        showLoginPage();
      }
    });
  }
}

function bindEvents() {
  if (elements.loginForm && !elements.loginForm.dataset.v13Bound) {
    elements.loginForm.dataset.v13Bound = "true";
    elements.loginForm.addEventListener("submit", handleLogin);
  }

  if (elements.logoutButton && !elements.logoutButton.dataset.v13Bound) {
    elements.logoutButton.dataset.v13Bound = "true";
    elements.logoutButton.addEventListener("click", handleLogout);
  }

  if (!window.__fiHashBoundV13) {
    window.__fiHashBoundV13 = true;
    window.addEventListener("hashchange", async () => {
      appState.currentPage = getPageFromHash();
      await renderCurrentPage();
    });
  }

  if (!window.__fiDelegatedClickV13) {
    window.__fiDelegatedClickV13 = true;
    document.addEventListener("click", handleDelegatedClick, true);
    document.addEventListener("change", handleDelegatedChange, true);
  }

  if (!window.__fiLifecycleBoundV13) {
    window.__fiLifecycleBoundV13 = true;
    window.addEventListener("focus", () => recoverAppAfterResume("focus"));
    window.addEventListener("pageshow", (event) => recoverAppAfterResume(event.persisted ? "pageshow-cache" : "pageshow"));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") recoverAppAfterResume("visibilitychange");
    });
  }

  const mobileMenuButton = $("#mobileMenuButton");
  if (mobileMenuButton && !mobileMenuButton.dataset.v13Bound) {
    mobileMenuButton.dataset.v13Bound = "true";
    mobileMenuButton.addEventListener("click", () => {
      elements.sidebarMenu?.classList.toggle("is-open");
    });
  }
}

function handleDelegatedClick(event) {
  const menuButton = event.target.closest(".menu-item[data-page]");
  if (menuButton) {
    event.preventDefault();
    location.hash = `#${menuButton.dataset.page}`;
    elements.sidebarMenu?.classList.remove("is-open");
    return;
  }

  const compactLink = event.target.closest("[data-quotation-link]");
  if (compactLink) {
    event.preventDefault();
    location.hash = `#quotation-view/${compactLink.dataset.quotationLink}`;
    return;
  }

  const tableViewButton = event.target.closest("[data-action='view'][data-id]");
  if (tableViewButton) {
    event.preventDefault();
    location.hash = `#quotation-view/${tableViewButton.dataset.id}`;
    return;
  }

  const sortButton = event.target.closest("[data-sort-key]");
  if (sortButton) {
    event.preventDefault();
    updateQuotationSort(sortButton.dataset.sortKey);
    renderQuotationTableFromState();
    return;
  }
}

function handleDelegatedChange(event) {
  const rowCheckbox = event.target.closest("[data-select-quotation]");
  if (rowCheckbox) {
    const id = rowCheckbox.dataset.selectQuotation;
    if (rowCheckbox.checked) {
      appState.selectedQuotationIds.add(id);
    } else {
      appState.selectedQuotationIds.delete(id);
    }
    updateBulkActionState();
    return;
  }

  if (event.target.id === "selectAllQuotations") {
    const checked = event.target.checked;
    appState.quotationFilteredRows.forEach((row) => {
      if (checked) appState.selectedQuotationIds.add(row.id);
      else appState.selectedQuotationIds.delete(row.id);
    });
    document.querySelectorAll("[data-select-quotation]").forEach((checkbox) => {
      checkbox.checked = checked;
    });
    updateBulkActionState();
  }
}

async function recoverAppAfterResume(reason = "resume") {
  if (!isConfigured || !supabaseClient) return;

  const now = Date.now();
  if (now - (appState.lastResumeAt || 0) < 650) return;
  appState.lastResumeAt = now;

  if (!appState.user && !appState.profile) return;

  try {
    hidePageBusy();
    appState.activeActions?.clear?.();

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (!data.session?.user) {
      showLoginPage();
      showToast("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่", "warning", { duration: 4200 });
      return;
    }

    appState.user = data.session.user;
    await loadProfile();
    showAppShell();

    // Soft re-render fixes stale event handlers and frozen UI after tab resume.
    await renderCurrentPage();
  } catch (error) {
    console.error("recoverAppAfterResume", reason, error);
    showToast("กู้คืนหน้าจอไม่สำเร็จ กำลังโหลดข้อมูลใหม่", "warning", { duration: 3600 });
    try {
      await renderCurrentPage();
    } catch (renderError) {
      console.error(renderError);
    }
  }
}

function showBootPage() {
  $("#bootPage")?.classList.remove("hidden");
  elements.loginPage?.classList.add("hidden");
  elements.appShell?.classList.add("hidden");
}

function hideBootPage() {
  $("#bootPage")?.classList.add("hidden");
}

function showLoginPage() {
  hideBootPage();
  elements.loginPage?.classList.remove("hidden");
  elements.appShell?.classList.add("hidden");
}

function showAppShell() {
  hideBootPage();
  elements.loginPage?.classList.add("hidden");
  elements.appShell?.classList.remove("hidden");
  updateHeaderUser();
  renderMenu();

  if (!location.hash) {
    location.hash = "#dashboard";
  } else {
    appState.currentPage = getPageFromHash();
  }
}

function updateHeaderUser() {
  const fullName = appState.profile?.full_name || appState.profile?.email || "-";
  const role = roleLabel(appState.profile?.role);
  const headerUserChip = $("#headerUserChip");

  if (headerUserChip) headerUserChip.textContent = `${fullName} · ${role}`;
  if (elements.userName) elements.userName.textContent = "";
  if (elements.userRole) elements.userRole.textContent = "";
}

function renderMenu() {
  if (!appState.profile || !elements.sidebarMenu) return;

  const role = appState.profile.role;
  const allMenus = [
    { key: "dashboard", label: "แดชบอร์ด", roles: ["admin", "manager", "sales"] },
    { key: "quotations", label: "ใบเสนอราคา", roles: ["admin", "manager", "sales"] },
    { key: "customers", label: "ลูกค้า", roles: ["admin", "manager", "sales"] },
    { key: "products", label: "สินค้า/บริการ", roles: ["admin", "manager", "sales"] },
    { key: "company", label: "ข้อมูลบริษัท", roles: ["admin"] },
    { key: "settings", label: "ตั้งค่า", roles: ["admin"] },
  ];

  const menus = allMenus.filter((item) => item.roles.includes(role));

  elements.sidebarMenu.innerHTML = menus.map((item) => {
    const isActive = item.key === appState.currentPage ||
      (item.key === "quotations" && appState.currentPage.startsWith("quotation-")) ||
      (item.key === "products" && appState.currentPage.startsWith("product-"));

    return `
      <button class="menu-item ${isActive ? "active" : ""}" data-page="${item.key}" type="button">
        <span>${menuIcon(item.key)}</span>
        <span>${item.label}</span>
      </button>
    `;
  }).join("");
}

async function handleLogout() {
  if (!supabaseClient) return;

  const confirmed = await showConfirmDialog({
    title: "ออกจากระบบ",
    message: "ต้องการออกจากระบบใช่ไหม?",
    confirmText: "ออกจากระบบ",
    cancelText: "ยกเลิก",
    danger: false,
  });

  if (!confirmed) return;

  await withAction("logout", async () => {
    await supabaseClient.auth.signOut();
    showToast("ออกจากระบบแล้ว", "success");
  });
}

async function renderCurrentPage() {
  if (!appState.profile) return;

  const renderToken = Date.now();
  appState.renderToken = renderToken;
  appState.currentPage = getPageFromHash();
  renderMenu();
  updateHeaderUser();
  hidePageBusy();

  const page = appState.currentPage;

  try {
    if (page === "dashboard") {
      await renderDashboardPage();
    } else if (page === "quotations") {
      await renderQuotationsPage();
    } else if (page === "quotation-new") {
      await renderQuotationCreatePage();
    } else if (page.startsWith("quotation-edit/")) {
      await renderQuotationEditPage(page.replace("quotation-edit/", ""));
    } else if (page.startsWith("quotation-view/")) {
      await renderQuotationViewPage(page.replace("quotation-view/", ""));
    } else if (page.startsWith("quotation-print/")) {
      await renderQuotationPrintPage(page.replace("quotation-print/", ""));
    } else if (page === "customers") {
      await renderCustomersPage();
    } else if (page === "products") {
      await renderProductsPage();
    } else if (page === "product-new") {
      await renderProductFormPage({ mode: "create", productId: null });
    } else if (page.startsWith("product-edit/")) {
      await renderProductFormPage({ mode: "edit", productId: page.replace("product-edit/", "") });
    } else if (page === "company") {
      await renderCompanyPage();
    } else if (page === "settings") {
      await renderSettingsPage();
    } else {
      location.hash = "#dashboard";
    }
  } catch (error) {
    console.error(error);
    renderError(error.message || "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
  }
}

async function renderDashboardPage() {
  setPageHeader("แดชบอร์ด");
  renderLoading("กำลังโหลดแดชบอร์ด...");

  const { data, error } = await supabaseClient
    .from("v_quotations_list")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1200);

  if (error) throw error;

  const rows = data || [];
  const analytics = buildDashboardAnalytics(rows);

  elements.pageContent.innerHTML = `
    <div class="metric-grid metric-grid-v13">
      <div class="metric-card"><span>ใบเสนอราคาทั้งหมด</span><strong>${number(rows.length)}</strong></div>
      <div class="metric-card"><span>ส่งแล้วเดือนนี้</span><strong>${formatTHB(analytics.currentMonthSentAmount)}</strong></div>
      <div class="metric-card"><span>ชำระเงินเดือนนี้</span><strong>${formatTHB(analytics.currentMonthPaidAmount)}</strong></div>
      <div class="metric-card"><span>จำนวนส่งแล้วเดือนนี้</span><strong>${number(analytics.currentMonthSentCount)}</strong></div>
      <div class="metric-card"><span>รอชำระเงิน</span><strong>${formatTHB(analytics.openSentAmount)}</strong></div>
    </div>

    <div class="dashboard-grid">
      <div class="card chart-card">
        <div class="card-header"><h3>ยอดส่งแล้วเทียบกับชำระเงิน 12 เดือน</h3></div>
        ${renderAmountComparisonChart(analytics.months)}
      </div>

      <div class="card chart-card">
        <div class="card-header"><h3>จำนวนใบเสนอราคาส่งแล้ว แยกตามฝ่ายขายและเดือน</h3></div>
        ${renderSentCountBySalesChart(analytics.salesSentCounts, analytics.monthLabels)}
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="card">
        <div class="card-header"><h3>เอกสารใกล้หมดอายุ</h3></div>
        ${renderCompactQuotationList(analytics.expiringSoon, "ยังไม่มีเอกสารใกล้หมดอายุ")}
      </div>
      <div class="card">
        <div class="card-header"><h3>อัปเดตล่าสุด</h3></div>
        ${renderCompactQuotationList(rows.slice(0, 8), "ยังไม่มีใบเสนอราคา")}
      </div>
    </div>
  `;

  bindCompactQuotationLinks();
}

function buildDashboardAnalytics(rows) {
  const today = startOfToday();
  const currentKey = monthKey(today);
  const monthStarts = [];
  const monthLabels = [];

  for (let index = 11; index >= 0; index -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
    monthStarts.push(date);
    monthLabels.push(formatMonthLabel(date));
  }

  const months = monthStarts.map((date) => ({
    key: monthKey(date),
    label: formatMonthLabel(date),
    sentAmount: 0,
    paidAmount: 0,
    sentCount: 0,
  }));

  const monthMap = new Map(months.map((item) => [item.key, item]));
  const salesSentCounts = new Map();
  let currentMonthSentAmount = 0;
  let currentMonthPaidAmount = 0;
  let currentMonthSentCount = 0;
  let openSentAmount = 0;

  rows.forEach((row) => {
    const status = getRawStatus(row);
    const amount = Number(row.grand_total_display || 0);

    if (status === "sent") {
      const sentDate = parseDateOnly(row.sent_at || row.quote_date || row.created_at);
      const key = sentDate ? monthKey(sentDate) : "";
      const month = monthMap.get(key);
      if (month) {
        month.sentAmount += amount;
        month.sentCount += 1;
      }
      if (key === currentKey) {
        currentMonthSentAmount += amount;
        currentMonthSentCount += 1;
      }
      openSentAmount += amount;

      const salesName = row.owner_name || "ไม่ระบุฝ่ายขาย";
      if (!salesSentCounts.has(salesName)) {
        salesSentCounts.set(salesName, Object.fromEntries(months.map((item) => [item.key, 0])));
      }
      if (key && salesSentCounts.get(salesName)[key] !== undefined) {
        salesSentCounts.get(salesName)[key] += 1;
      }
    }

    if (status === "paid") {
      const paidDate = parseDateOnly(row.paid_at || row.sent_at || row.quote_date || row.created_at);
      const key = paidDate ? monthKey(paidDate) : "";
      const month = monthMap.get(key);
      if (month) month.paidAmount += amount;
      if (key === currentKey) currentMonthPaidAmount += amount;
    }
  });

  const soon = addDays(today, 7);
  const expiringSoon = rows
    .filter((row) => ["confirmed", "sent"].includes(getRawStatus(row)))
    .filter((row) => {
      const validDate = parseDateOnly(row.valid_until);
      return validDate && validDate >= today && validDate <= soon;
    })
    .slice(0, 8);

  return {
    months,
    monthLabels,
    salesSentCounts,
    currentMonthSentAmount,
    currentMonthPaidAmount,
    currentMonthSentCount,
    openSentAmount,
    expiringSoon,
  };
}

function renderAmountComparisonChart(months) {
  const maxValue = Math.max(1, ...months.flatMap((month) => [month.sentAmount, month.paidAmount]));

  return `
    <div class="amount-chart">
      ${months.map((month) => {
        const sentHeight = Math.max(2, Math.round((month.sentAmount / maxValue) * 160));
        const paidHeight = Math.max(2, Math.round((month.paidAmount / maxValue) * 160));
        return `
          <div class="amount-chart-group">
            <div class="amount-bars">
              <div class="bar bar-sent" style="height:${sentHeight}px" title="ส่งแล้ว ${formatTHB(month.sentAmount)}"></div>
              <div class="bar bar-paid" style="height:${paidHeight}px" title="ชำระเงิน ${formatTHB(month.paidAmount)}"></div>
            </div>
            <span>${month.label}</span>
          </div>
        `;
      }).join("")}
    </div>
    <div class="chart-legend">
      <span><i class="legend-dot sent"></i> ส่งแล้ว</span>
      <span><i class="legend-dot paid"></i> ชำระเงิน</span>
    </div>
  `;
}

function renderSentCountBySalesChart(salesSentCounts, monthLabels) {
  const entries = Array.from(salesSentCounts.entries());
  if (!entries.length) {
    return `<div class="empty-state compact">ยังไม่มีข้อมูลส่งใบเสนอราคา</div>`;
  }

  const monthKeys = Array.from(salesSentCounts.values())[0]
    ? Object.keys(Array.from(salesSentCounts.values())[0])
    : [];
  const maxCount = Math.max(1, ...entries.flatMap(([, counts]) => Object.values(counts)));

  return `
    <div class="sales-month-chart">
      <div class="sales-month-header">
        <span>ฝ่ายขาย</span>
        ${monthLabels.map((label) => `<span>${label}</span>`).join("")}
      </div>
      ${entries.map(([salesName, counts]) => `
        <div class="sales-month-row">
          <strong>${escapeHTML(salesName)}</strong>
          ${monthKeys.map((key) => {
            const value = counts[key] || 0;
            const width = Math.max(0, Math.round((value / maxCount) * 100));
            return `
              <span class="count-cell" title="${value} ใบ">
                <i style="width:${width}%"></i>
                <b>${value ? number(value) : ""}</b>
              </span>
            `;
          }).join("")}
        </div>
      `).join("")}
    </div>
  `;
}

async function renderQuotationsPage() {
  setPageHeader(appState.profile.role === "sales" ? "ใบเสนอราคาของฉัน" : "ใบเสนอราคา");
  renderLoading("กำลังโหลดใบเสนอราคา...");

  const { data, error } = await supabaseClient
    .from("v_quotations_list")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  renderQuotationList(data || []);
}

function renderQuotationList(rows) {
  const canCreate = appState.profile.role !== "manager";
  appState.quotationListRows = rows;
  appState.quotationFilteredRows = rows;
  pruneSelectionToRows(rows);

  const salesOptions = buildSalesFilterOptions(rows);

  elements.pageContent.innerHTML = `
    <div class="card quotation-list-card">
      <div class="card-header list-header-v13">
        <div><h3>รายการใบเสนอราคา</h3></div>
        <div class="table-actions">
          <button id="exportQuotationsXlsxButton" class="btn btn-ghost btn-export-disabled" disabled>Export Excel</button>
          ${canCreate ? `<button id="newQuotationButton" class="btn btn-primary">+ สร้างใบเสนอราคา</button>` : ``}
        </div>
      </div>

      <div class="filter-grid-v13">
        <div class="field"><label for="quotationSearch">ค้นหา</label><input id="quotationSearch" type="search" placeholder="ลูกค้า / เลขเอกสาร / ฝ่ายขาย" value="${escapeHTML(appState.quotationFilters.keyword)}" /></div>
        <div class="field"><label for="quotationStatusFilter">สถานะ</label><select id="quotationStatusFilter">${renderStatusFilterOptions(appState.quotationFilters.status)}</select></div>
        <div class="field"><label for="quotationBillingFilter">ประเภท</label><select id="quotationBillingFilter">${renderBillingFilterOptions(appState.quotationFilters.billingType)}</select></div>
        <div class="field"><label for="quotationSalesFilter">ฝ่ายขาย</label><select id="quotationSalesFilter"><option value="">ทุกคน</option>${salesOptions.map((sales) => `<option value="${sales.id}" ${sales.id === appState.quotationFilters.ownerId ? "selected" : ""}>${escapeHTML(sales.name)}</option>`).join("")}</select></div>
      </div>

      <div class="date-range-row-v13">
        ${renderDateRangeControl("quote", "ช่วงวันที่เสนอราคา", appState.quotationFilters.quoteFrom, appState.quotationFilters.quoteTo)}
        ${renderDateRangeControl("valid", "ช่วงวันหมดอายุ", appState.quotationFilters.validFrom, appState.quotationFilters.validTo)}
      </div>

      <div id="filterHelp" class="filter-help"></div>

      <div id="bulkActionBar" class="bulk-action-bar hidden">
        <strong id="bulkSelectedText">เลือก 0 รายการ</strong>
        <select id="bulkStatusSelect">
          <option value="">เลือกสถานะที่จะปรับ</option>
          ${V13_BULK_STATUS_OPTIONS.map((item) => `<option value="${item.value}">${item.label}</option>`).join("")}
        </select>
        <button id="applyBulkStatusButton" class="btn btn-primary" disabled>ปรับสถานะ</button>
        <button id="clearSelectionButton" class="btn btn-ghost">ล้างการเลือก</button>
      </div>

      <div id="quotationTable"></div>
    </div>
  `;

  bindQuotationListControls();
  updateQuotationTableFromFilters();
}

function bindQuotationListControls() {
  const newButton = $("#newQuotationButton");
  if (newButton) newButton.addEventListener("click", () => (location.hash = "#quotation-new"));

  const exportButton = $("#exportQuotationsXlsxButton");
  if (exportButton) exportButton.addEventListener("click", () => exportQuotationsXlsx(appState.quotationFilteredRows));

  ["quotationSearch", "quotationStatusFilter", "quotationBillingFilter", "quotationSalesFilter"].forEach((id) => {
    const input = $(`#${id}`);
    if (!input) return;
    input.addEventListener(input.type === "search" ? "input" : "change", () => {
      appState.quotationFilters.keyword = $("#quotationSearch")?.value.trim() || "";
      appState.quotationFilters.status = $("#quotationStatusFilter")?.value || "";
      appState.quotationFilters.billingType = $("#quotationBillingFilter")?.value || "";
      appState.quotationFilters.ownerId = $("#quotationSalesFilter")?.value || "";
      updateQuotationTableFromFilters();
    });
  });

  bindDateRangeControls();

  const bulkSelect = $("#bulkStatusSelect");
  if (bulkSelect) bulkSelect.addEventListener("change", updateBulkActionState);

  const bulkApply = $("#applyBulkStatusButton");
  if (bulkApply) {
    bulkApply.addEventListener("click", async () => {
      const status = $("#bulkStatusSelect")?.value;
      await applyBulkStatus(status);
    });
  }

  const clearSelection = $("#clearSelectionButton");
  if (clearSelection) {
    clearSelection.addEventListener("click", () => {
      appState.selectedQuotationIds.clear();
      renderQuotationTableFromState();
    });
  }
}

function renderDateRangeControl(key, label, from, to) {
  const prefix = key === "quote" ? "quote" : "valid";
  return `
    <div class="date-range-control" data-range-control="${prefix}">
      <button type="button" class="date-range-display" data-date-range-toggle="${prefix}">
        <span>${label}</span>
        <strong id="${prefix}RangeLabel">${formatRangeLabel(from, to)}</strong>
      </button>
      <div id="${prefix}DatePopover" class="date-range-popover hidden">
        <div class="date-popover-title">เลือกช่วงเวลา</div>
        <div class="date-presets">
          <button type="button" data-range-preset="${prefix}:this_month">เดือนนี้</button>
          <button type="button" data-range-preset="${prefix}:last_month">เดือนที่แล้ว</button>
          <button type="button" data-range-preset="${prefix}:this_year">ปีนี้</button>
          <button type="button" data-range-preset="${prefix}:last_year">ปีที่แล้ว</button>
        </div>
        <div class="date-input-grid">
          <div class="field"><label>จากวันที่</label><input id="${prefix}FromTemp" type="date" value="${escapeHTML(from || "")}" /></div>
          <div class="field"><label>ถึงวันที่</label><input id="${prefix}ToTemp" type="date" value="${escapeHTML(to || "")}" /></div>
        </div>
        <div class="date-popover-actions">
          <button type="button" class="link-button" data-range-clear="${prefix}">ล้างค่า</button>
          <div>
            <button type="button" class="btn btn-ghost" data-range-cancel="${prefix}">ยกเลิก</button>
            <button type="button" class="btn btn-primary" data-range-apply="${prefix}">บันทึก</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindDateRangeControls() {
  document.querySelectorAll("[data-date-range-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.dateRangeToggle;
      document.querySelectorAll(".date-range-popover").forEach((popover) => {
        if (popover.id !== `${key}DatePopover`) popover.classList.add("hidden");
      });
      $(`#${key}DatePopover`)?.classList.toggle("hidden");
    });
  });

  document.querySelectorAll("[data-range-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const [key, preset] = button.dataset.rangePreset.split(":");
      const range = getPresetRange(preset);
      $(`#${key}FromTemp`).value = range.from;
      $(`#${key}ToTemp`).value = range.to;
    });
  });

  document.querySelectorAll("[data-range-clear]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.rangeClear;
      setRangeFilter(key, "", "");
      $(`#${key}DatePopover`)?.classList.add("hidden");
      updateQuotationTableFromFilters();
    });
  });

  document.querySelectorAll("[data-range-cancel]").forEach((button) => {
    button.addEventListener("click", () => $(`#${button.dataset.rangeCancel}DatePopover`)?.classList.add("hidden"));
  });

  document.querySelectorAll("[data-range-apply]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.rangeApply;
      setRangeFilter(key, $(`#${key}FromTemp`)?.value || "", $(`#${key}ToTemp`)?.value || "");
      $(`#${key}DatePopover`)?.classList.add("hidden");
      updateQuotationTableFromFilters();
    });
  });
}

function setRangeFilter(key, from, to) {
  if (key === "quote") {
    appState.quotationFilters.quoteFrom = from;
    appState.quotationFilters.quoteTo = to;
  } else {
    appState.quotationFilters.validFrom = from;
    appState.quotationFilters.validTo = to;
  }

  const label = $(`#${key}RangeLabel`);
  if (label) label.textContent = formatRangeLabel(from, to);
}

function updateQuotationTableFromFilters() {
  const filter = appState.quotationFilters;
  const quoteRange = getDateRangeState(filter.quoteFrom, filter.quoteTo, "วันที่เสนอราคา");
  const validRange = getDateRangeState(filter.validFrom, filter.validTo, "วันหมดอายุ");
  const invalidReason = quoteRange.invalidReason || validRange.invalidReason;

  appState.quotationFilteredRows = appState.quotationListRows.filter((row) => {
    const keyword = (filter.keyword || "").toLowerCase();
    const text = `${row.quotation_no || ""} ${row.customer_name || ""} ${row.owner_name || ""}`.toLowerCase();

    return (!keyword || text.includes(keyword)) &&
      (!filter.status || row.effective_status === filter.status || row.status === filter.status) &&
      (!filter.billingType || row.billing_type === filter.billingType) &&
      (!filter.ownerId || row.owner_id === filter.ownerId) &&
      (!quoteRange.active || !quoteRange.valid || isDateWithinRange(row.quote_date, quoteRange.from, quoteRange.to)) &&
      (!validRange.active || !validRange.valid || isDateWithinRange(row.valid_until, validRange.from, validRange.to));
  });

  applyQuotationSort();
  pruneSelectionToRows(appState.quotationFilteredRows);
  renderQuotationTableFromState();
  updateExportStateV13({ quoteRange, validRange, invalidReason });
}

function renderQuotationTableFromState() {
  const tableTarget = $("#quotationTable");
  if (!tableTarget) return;
  tableTarget.innerHTML = renderQuotationTable(appState.quotationFilteredRows);
  updateBulkActionState();
}

function renderQuotationTable(rows) {
  if (!rows.length) {
    return `<div class="empty-state">ยังไม่มีใบเสนอราคา</div>`;
  }

  const showSales = appState.profile.role !== "sales";

  return `
    <div class="table-wrap">
      <table class="data-table quotation-table-v13">
        <thead>
          <tr>
            <th class="select-col"><input id="selectAllQuotations" type="checkbox" ${areAllVisibleRowsSelected(rows) ? "checked" : ""} /></th>
            ${sortableTh("row_no", "ลำดับ")}
            ${sortableTh("quotation_no", "เลขที่")}
            ${sortableTh("customer_name", "ลูกค้า")}
            ${sortableTh("billing_type", "ประเภท")}
            ${showSales ? sortableTh("owner_name", "ฝ่ายขาย") : ""}
            ${sortableTh("quote_date", "วันที่เสนอราคา")}
            ${sortableTh("valid_until", "วันหมดอายุ")}
            ${sortableTh("grand_total_display", "ยอดรวม")}
            ${sortableTh("effective_status", "สถานะ")}
            ${sortableTh("created_at", "วันที่สร้าง")}
            <th>การกระทำ</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, index) => `
            <tr>
              <td class="select-col"><input type="checkbox" data-select-quotation="${row.id}" ${appState.selectedQuotationIds.has(row.id) ? "checked" : ""} /></td>
              <td>${index + 1}</td>
              <td><strong>${escapeHTML(row.quotation_no || "ยังไม่ออกเลข")}</strong></td>
              <td>${escapeHTML(row.customer_name || "-")}</td>
              <td>${billingTypeLabel(row.billing_type)}</td>
              ${showSales ? `<td>${escapeHTML(row.owner_name || "-")}</td>` : ""}
              <td>${formatDate(row.quote_date)}</td>
              <td>${formatDate(row.valid_until)}</td>
              <td class="num-cell">${formatTHB(row.grand_total_display)}</td>
              <td>${statusBadge(row.effective_status)}</td>
              <td>${formatDate(row.created_at)}</td>
              <td><button class="btn btn-ghost" data-action="view" data-id="${row.id}">ดู</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function sortableTh(key, label) {
  const current = appState.quotationSort.key === key;
  const direction = current ? appState.quotationSort.direction : "";
  const icon = current ? (direction === "asc" ? "▲" : "▼") : "↕";
  return `<th><button type="button" class="sort-header" data-sort-key="${key}">${label} <span>${icon}</span></button></th>`;
}

function updateQuotationSort(key) {
  if (appState.quotationSort.key === key) {
    appState.quotationSort.direction = appState.quotationSort.direction === "asc" ? "desc" : "asc";
  } else {
    appState.quotationSort = { key, direction: "asc" };
  }
  applyQuotationSort();
}

function applyQuotationSort() {
  const { key, direction } = appState.quotationSort;
  const factor = direction === "asc" ? 1 : -1;

  appState.quotationFilteredRows.sort((a, b) => {
    if (key === "row_no") return 0;
    const valueA = getSortValue(a, key);
    const valueB = getSortValue(b, key);

    if (valueA < valueB) return -1 * factor;
    if (valueA > valueB) return 1 * factor;
    return 0;
  });
}

function getSortValue(row, key) {
  if (["quote_date", "valid_until", "created_at"].includes(key)) {
    return parseDateOnly(row[key])?.getTime?.() || 0;
  }
  if (key === "grand_total_display") return Number(row[key] || 0);
  if (key === "billing_type") return billingTypeLabel(row.billing_type);
  if (key === "effective_status") return statusLabel(row.effective_status);
  return String(row[key] || "").toLowerCase();
}

function updateExportStateV13({ quoteRange, validRange, invalidReason }) {
  const exportButton = $("#exportQuotationsXlsxButton");
  const filterHelp = $("#filterHelp");
  if (!exportButton || !filterHelp) return;

  const canExport = (quoteRange.active && quoteRange.valid) || (validRange.active && validRange.valid);

  if (invalidReason) {
    exportButton.disabled = true;
    exportButton.classList.add("btn-export-disabled");
    filterHelp.className = "filter-warning";
    filterHelp.textContent = invalidReason;
    return;
  }

  if (!canExport) {
    exportButton.disabled = true;
    exportButton.classList.add("btn-export-disabled");
    filterHelp.className = "filter-help";
    filterHelp.textContent = "Export Excel ได้เมื่อเลือกช่วงวันที่เสนอราคาหรือช่วงวันหมดอายุอย่างน้อย 1 ช่วง และช่วงละไม่เกิน 3 เดือน";
    return;
  }

  exportButton.disabled = false;
  exportButton.classList.remove("btn-export-disabled");
  filterHelp.className = "filter-help";
  filterHelp.textContent = `พร้อม Export ${number(appState.quotationFilteredRows.length)} รายการเป็น Excel`;
}

function updateBulkActionState() {
  const bar = $("#bulkActionBar");
  const text = $("#bulkSelectedText");
  const applyButton = $("#applyBulkStatusButton");
  const selectedCount = appState.selectedQuotationIds.size;
  const status = $("#bulkStatusSelect")?.value || "";

  if (!bar) return;
  bar.classList.toggle("hidden", selectedCount === 0);
  if (text) text.textContent = `เลือก ${number(selectedCount)} รายการ`;
  if (applyButton) applyButton.disabled = selectedCount === 0 || !status;
}

async function applyBulkStatus(status) {
  if (!status) return;

  const selectedRows = appState.quotationListRows.filter((row) => appState.selectedQuotationIds.has(row.id));
  const eligibleRows = selectedRows.filter((row) => canTransitionToStatus(row, status));

  if (!eligibleRows.length) {
    showToast("รายการที่เลือกไม่สามารถเปลี่ยนเป็นสถานะนี้ได้", "warning");
    return;
  }

  const payload = await showStatusChangeDialog({
    status,
    count: eligibleRows.length,
    skipped: selectedRows.length - eligibleRows.length,
  });

  if (!payload) return;

  await updateQuotationStatuses(eligibleRows.map((row) => row.id), status, payload);
  appState.selectedQuotationIds.clear();
  await renderQuotationsPage();
}

function canTransitionToStatus(row, status) {
  const current = getRawStatus(row);
  if (status === "sent") return current === "confirmed";
  if (status === "paid") return current === "sent";
  if (status === "cancelled") return !["paid", "cancelled"].includes(current);
  return false;
}

function renderQuotationActionButtons(quotation, effectiveStatus) {
  const role = appState.profile.role;
  const isOwner = quotation.owner_id === appState.user.id;
  const canModify = role === "admin" || (role === "sales" && isOwner);
  if (!canModify) return "";

  const status = quotation.status;
  const buttons = [];

  if (status === "draft") {
    buttons.push(`<button id="editDraftButton" class="btn btn-ghost">แก้ไข</button>`);
    buttons.push(`<button id="confirmQuotationButton" class="btn btn-primary">ยืนยัน</button>`);
    buttons.push(`<button id="cancelQuotationButton" class="btn btn-ghost danger-soft">ยกเลิก</button>`);
  }

  if (status === "confirmed") {
    buttons.push(`<button id="markSentButton" class="btn btn-primary">ส่งแล้ว</button>`);
    buttons.push(`<button id="cancelQuotationButton" class="btn btn-ghost danger-soft">ยกเลิก</button>`);
  }

  if (status === "sent") {
    buttons.push(`<button id="markPaidButton" class="btn btn-primary">ชำระเงิน</button>`);
    buttons.push(`<button id="cancelQuotationButton" class="btn btn-ghost danger-soft">ยกเลิก</button>`);
  }

  if (status !== "draft") {
    buttons.push(`<button id="printPreviewButton" class="btn btn-primary">Preview / Print</button>`);
    buttons.push(`<button id="duplicateQuotationButton" class="btn btn-ghost">สร้างสำเนา</button>`);
  }

  return buttons.join("");
}

function bindQuotationViewActions(quotation) {
  const bindClick = (selector, handler) => {
    const button = $(selector);
    if (button) button.addEventListener("click", handler);
  };

  bindClick("#backToListButton", () => (location.hash = "#quotations"));
  bindClick("#editDraftButton", () => (location.hash = `#quotation-edit/${quotation.id}`));
  bindClick("#confirmQuotationButton", async () => confirmQuotation(quotation.id));
  bindClick("#markSentButton", async () => markQuotationAsSent(quotation.id));
  bindClick("#markPaidButton", async () => markQuotationAsPaid(quotation.id));
  bindClick("#cancelQuotationButton", async () => cancelSingleQuotation(quotation.id));
  bindClick("#printPreviewButton", () => (location.hash = `#quotation-print/${quotation.id}`));
  bindClick("#duplicateQuotationButton", async () => duplicateQuotation(quotation.id));
}

async function markQuotationAsSent(quotationId) {
  const payload = await showStatusChangeDialog({ status: "sent", count: 1 });
  if (!payload) return;
  await updateQuotationStatuses([quotationId], "sent", payload);
  await renderQuotationViewPage(quotationId);
}

async function markQuotationAsPaid(quotationId) {
  const payload = await showStatusChangeDialog({ status: "paid", count: 1 });
  if (!payload) return;
  await updateQuotationStatuses([quotationId], "paid", payload);
  await renderQuotationViewPage(quotationId);
}

async function cancelSingleQuotation(quotationId) {
  const payload = await showStatusChangeDialog({ status: "cancelled", count: 1 });
  if (!payload) return;
  await updateQuotationStatuses([quotationId], "cancelled", payload);
  await renderQuotationViewPage(quotationId);
}

async function updateQuotationStatuses(ids, status, payload) {
  await withAction(`change-status-${status}`, async () => {
    showPageBusy("กำลังปรับสถานะ...");
    const { error } = await supabaseClient.rpc("change_quotation_status_v13", {
      p_quotation_ids: ids,
      p_new_status: status,
      p_effective_date: payload.effectiveDate || toDateInputValue(new Date()),
      p_note: payload.note || null,
    });
    if (error) throw error;
    hidePageBusy();
    showToast(`ปรับสถานะเป็น${statusLabel(status)}สำเร็จ ${number(ids.length)} รายการ`, "success");
  });
}

function showStatusChangeDialog({ status, count, skipped = 0 }) {
  const today = toDateInputValue(new Date());
  const needsDate = ["sent", "paid"].includes(status);
  const needsReason = status === "cancelled";
  const title = count > 1 ? `ปรับสถานะ ${number(count)} รายการ` : `เปลี่ยนสถานะเป็น${statusLabel(status)}`;
  const skippedText = skipped > 0 ? `<div class="alert alert-warning">ข้าม ${number(skipped)} รายการที่ไม่เข้าเงื่อนไขสถานะนี้</div>` : "";

  return new Promise((resolve) => {
    const dialog = document.createElement("div");
    dialog.className = "modal-backdrop";
    dialog.innerHTML = `
      <div class="confirm-dialog status-dialog">
        <h3>${escapeHTML(title)}</h3>
        ${skippedText}
        ${needsDate ? `
          <div class="field">
            <label>${status === "sent" ? "วันที่ส่งใบเสนอราคา" : "วันที่ชำระเงิน"}</label>
            <input id="statusEffectiveDate" type="date" value="${today}" />
          </div>
        ` : ""}
        ${needsReason ? `
          <div class="field">
            <label>เหตุผลการยกเลิก (ไม่บังคับ)</label>
            <textarea id="statusReason" rows="4" placeholder="ระบุเหตุผลการยกเลิก ถ้ามี"></textarea>
          </div>
        ` : ""}
        <div class="confirm-actions">
          <button type="button" class="btn btn-ghost" data-dialog-cancel>ยกเลิก</button>
          <button type="button" class="btn ${needsReason ? "danger-soft" : "btn-primary"}" data-dialog-confirm>บันทึก</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    const cleanup = (value) => {
      dialog.remove();
      resolve(value);
    };

    dialog.querySelector("[data-dialog-cancel]").addEventListener("click", () => cleanup(null));
    dialog.querySelector("[data-dialog-confirm]").addEventListener("click", () => {
      const effectiveDate = needsDate ? dialog.querySelector("#statusEffectiveDate")?.value : today;
      const note = needsReason ? dialog.querySelector("#statusReason")?.value.trim() : "";
      if (needsDate && !effectiveDate) {
        showToast("กรุณาระบุวันที่", "warning");
        return;
      }
      cleanup({ effectiveDate, note });
    });
  });
}

function getEffectiveStatusFromQuotation(quotation) {
  if (["paid", "cancelled", "draft"].includes(quotation.status)) return quotation.status;
  if (["confirmed", "sent"].includes(quotation.status) && quotation.valid_until && new Date(quotation.valid_until) < startOfToday()) {
    return "expired";
  }
  return quotation.status;
}

function statusLabel(status) {
  return V13_STATUS[status] || status || "-";
}

function statusBadge(status) {
  return `<span class="status-badge status-${status}">${statusLabel(status)}</span>`;
}

function roleLabel(role) {
  const map = { admin: "ผู้ดูแลระบบ", manager: "ผู้จัดการ", sales: "ฝ่ายขาย" };
  return map[role] || role || "-";
}

function formatTHB(value) {
  return formatAmount(value);
}

function formatAmount(value) {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function updateDraftSummary() {
  const unitPrice = readNumber("#draftUnitPrice");
  const oneTimeQty = readNumber("#draftOneTimeQty");
  const oneTimePrice = readNumber("#draftOneTimePrice");
  const discountPercent = readNumber("#draftDiscountPercent");

  const vatEnabled = $("#draftVatEnabled")?.checked ?? true;
  const whtEnabled = $("#draftWhtEnabled")?.checked ?? true;
  const roundingEnabled = $("#draftRoundingEnabled")?.checked ?? false;

  const recurringSubtotal = unitPrice;
  const oneTimeSubtotal = oneTimeQty * oneTimePrice;
  const subtotal = roundMoney(recurringSubtotal + oneTimeSubtotal);
  const discount = roundMoney((subtotal * discountPercent) / 100);
  const taxable = roundMoney(subtotal - discount);
  const vat = vatEnabled ? roundMoney(taxable * 0.07) : 0;
  const wht = whtEnabled ? roundMoney(taxable * 0.03) : 0;
  const grandTotal = roundMoney(taxable + vat - wht);
  const displayTotal = roundingEnabled ? Math.round(grandTotal) : grandTotal;
  const rounding = roundMoney(displayTotal - grandTotal);

  const setText = (selector, text) => {
    const el = $(selector);
    if (el) el.textContent = text;
  };

  setText("#summarySubtotal", formatTHB(subtotal));
  setText("#summaryDiscount", formatTHB(discount));
  setText("#summaryTaxable", formatTHB(taxable));
  setText("#summaryVat", formatTHB(vat));
  setText("#summaryWht", `-${formatTHB(wht)}`);
  setText("#summaryRounding", formatTHB(rounding));
  setText("#summaryGrandTotal", formatTHB(displayTotal));
}

function exportQuotationsXlsx(rows) {
  if (!rows.length) {
    showToast("ไม่มีข้อมูลสำหรับ Export", "warning");
    return;
  }

  if (!window.XLSX) {
    showToast("ไม่พบ Excel library กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่", "error", { duration: 5200 });
    return;
  }

  const aoa = [[
    "เลขที่ใบเสนอราคา",
    "ลูกค้า",
    "ประเภท",
    "ฝ่ายขาย",
    "วันที่เสนอราคา",
    "วันหมดอายุ",
    "วันที่ส่ง",
    "วันที่ชำระเงิน",
    "ยอดรวมสุทธิ",
    "สถานะ",
  ], ...rows.map((row) => [
    row.quotation_no || "ยังไม่ออกเลข",
    row.customer_name || "",
    billingTypeLabel(row.billing_type),
    row.owner_name || "",
    row.quote_date ? formatDate(row.quote_date) : "",
    row.valid_until ? formatDate(row.valid_until) : "",
    row.sent_at ? formatDate(row.sent_at) : "",
    row.paid_at ? formatDate(row.paid_at) : "",
    Number(row.grand_total_display || 0),
    statusLabel(row.effective_status),
  ])];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = [
    { wch: 20 }, { wch: 34 }, { wch: 14 }, { wch: 24 }, { wch: 18 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 14 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "ใบเสนอราคา");
  XLSX.writeFile(workbook, `fi-quotation-export-${toDateInputValue(new Date())}.xlsx`);
  showToast(`Export Excel สำเร็จ ${number(rows.length)} รายการ`, "success");
}

function buildSalesFilterOptions(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (row.owner_id) map.set(row.owner_id, row.owner_name || row.sales_name_snapshot || "ไม่ระบุชื่อ");
  });
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
}

function renderStatusFilterOptions(selected) {
  const statuses = ["", "draft", "confirmed", "sent", "paid", "expired", "cancelled"];
  return statuses.map((status) => `<option value="${status}" ${status === selected ? "selected" : ""}>${status ? statusLabel(status) : "ทุกสถานะ"}</option>`).join("");
}

function renderBillingFilterOptions(selected) {
  return [
    { value: "", label: "ทุกประเภท" },
    { value: "monthly", label: "รายเดือน" },
    { value: "yearly", label: "รายปี" },
  ].map((item) => `<option value="${item.value}" ${item.value === selected ? "selected" : ""}>${item.label}</option>`).join("");
}

function pruneSelectionToRows(rows) {
  const visibleIds = new Set(rows.map((row) => row.id));
  Array.from(appState.selectedQuotationIds).forEach((id) => {
    if (!visibleIds.has(id)) appState.selectedQuotationIds.delete(id);
  });
}

function areAllVisibleRowsSelected(rows) {
  return rows.length > 0 && rows.every((row) => appState.selectedQuotationIds.has(row.id));
}

function getRawStatus(row) {
  return row.status || row.effective_status || "";
}

function getPresetRange(preset) {
  const today = new Date();
  let from;
  let to;

  if (preset === "this_month") {
    from = new Date(today.getFullYear(), today.getMonth(), 1);
    to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  } else if (preset === "last_month") {
    from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    to = new Date(today.getFullYear(), today.getMonth(), 0);
  } else if (preset === "this_year") {
    from = new Date(today.getFullYear(), 0, 1);
    to = new Date(today.getFullYear(), 11, 31);
  } else {
    from = new Date(today.getFullYear() - 1, 0, 1);
    to = new Date(today.getFullYear() - 1, 11, 31);
  }

  return { from: toDateInputValue(from), to: toDateInputValue(to) };
}

function formatRangeLabel(from, to) {
  return `${from ? formatDate(from) : "ไม่กำหนด"} - ${to ? formatDate(to) : "ไม่กำหนด"}`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat("th-TH-u-ca-gregory", { month: "short", year: "2-digit" }).format(date);
}

function showToast(message, type = "info", options = {}) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.className = `toast toast-${type}`;
  elements.toast.classList.remove("hidden");

  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    elements.toast.classList.add("hidden");
  }, options.duration || (type === "error" ? 5200 : 2800));
}

function showPageBusy(label = "กำลังดำเนินการ") {
  const overlay = $("#pageBusyOverlay");
  if (!overlay) return;
  overlay.querySelector("strong").textContent = label;
  overlay.classList.remove("hidden");
}

function hidePageBusy() {
  $("#pageBusyOverlay")?.classList.add("hidden");
}

async function withAction(key, action) {
  appState.activeActions = appState.activeActions || new Set();
  if (appState.activeActions.has(key)) return;
  appState.activeActions.add(key);
  try {
    return await action();
  } catch (error) {
    console.error(error);
    hidePageBusy();
    showToast(error.message || "ทำรายการไม่สำเร็จ", "error", { duration: 5200 });
    throw error;
  } finally {
    appState.activeActions.delete(key);
    hidePageBusy();
  }
}

// =======================================================
// v1.4 Dashboard Polish + App Branding + Resume Hard Fix
// =======================================================

Object.assign(appState, {
  appBranding: {
    login_logo_url: "",
    favicon_url: "",
  },
  resumeInProgress: false,
  lastSuccessfulRenderAt: 0,
});

async function initApp() {
  showBootPage();

  if (!isConfigured) {
    hideBootPage();
    showLoginPage();
    showSetupWarningOnLogin();
    return;
  }

  bindEvents();
  await loadAndApplyAppBranding();

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (data.session?.user) {
      appState.user = data.session.user;
      await loadProfile();
      hideBootPage();
      showAppShell();
      await renderCurrentPage({ force: true, reason: "initial-session" });
    } else {
      hideBootPage();
      showLoginPage();
    }
  } catch (error) {
    console.error(error);
    hideBootPage();
    showLoginPage();
    showLoginError("ไม่สามารถตรวจสอบ session ได้ กรุณาเข้าสู่ระบบใหม่");
  }

  if (!window.__fiAuthListenerV14) {
    window.__fiAuthListenerV14 = true;
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (event === "TOKEN_REFRESHED" && session?.user) {
        appState.user = session.user;
        return;
      }

      if (session?.user) {
        appState.user = session.user;
        try {
          await loadProfile();
          hideBootPage();
          showAppShell();
          await loadAndApplyAppBranding();
          await renderCurrentPage({ force: true, reason: `auth-${event}` });
        } catch (error) {
          console.error(error);
          showToast("โหลดข้อมูลผู้ใช้ไม่สำเร็จ", "error");
        }
      } else if (event === "SIGNED_OUT") {
        appState.user = null;
        appState.profile = null;
        appState.selectedQuotationIds?.clear?.();
        hideBootPage();
        showLoginPage();
      }
    });
  }
}

function bindEvents() {
  if (elements.loginForm && !elements.loginForm.dataset.v14Bound) {
    elements.loginForm.dataset.v14Bound = "true";
    elements.loginForm.addEventListener("submit", handleLogin);
  }

  if (elements.logoutButton && !elements.logoutButton.dataset.v14Bound) {
    elements.logoutButton.dataset.v14Bound = "true";
    elements.logoutButton.addEventListener("click", handleLogout);
  }

  if (!window.__fiHashBoundV14) {
    window.__fiHashBoundV14 = true;
    window.addEventListener("hashchange", async () => {
      appState.currentPage = getPageFromHash();
      await renderCurrentPage({ force: true, reason: "hashchange" });
    });
  }

  if (!window.__fiDelegatedClickV14) {
    window.__fiDelegatedClickV14 = true;
    document.addEventListener("click", handleDelegatedClick, true);
    document.addEventListener("change", handleDelegatedChange, true);
  }

  if (!window.__fiLifecycleBoundV14) {
    window.__fiLifecycleBoundV14 = true;
    window.addEventListener("focus", () => recoverAppAfterResume("focus"));
    window.addEventListener("pageshow", (event) => recoverAppAfterResume(event.persisted ? "pageshow-cache" : "pageshow"));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") recoverAppAfterResume("visibilitychange");
    });
  }

  const mobileMenuButton = $("#mobileMenuButton");
  if (mobileMenuButton && !mobileMenuButton.dataset.v14Bound) {
    mobileMenuButton.dataset.v14Bound = "true";
    mobileMenuButton.addEventListener("click", () => {
      elements.sidebarMenu?.classList.toggle("is-open");
    });
  }
}

function handleDelegatedClick(event) {
  const menuButton = event.target.closest(".menu-item[data-page]");
  if (menuButton) {
    event.preventDefault();
    const targetPage = menuButton.dataset.page;
    navigateToPage(targetPage, { force: targetPage === getPageFromHash() });
    elements.sidebarMenu?.classList.remove("is-open");
    return;
  }

  const compactLink = event.target.closest("[data-quotation-link]");
  if (compactLink) {
    event.preventDefault();
    navigateToPage(`quotation-view/${compactLink.dataset.quotationLink}`);
    return;
  }

  const tableViewButton = event.target.closest("[data-action='view'][data-id]");
  if (tableViewButton) {
    event.preventDefault();
    navigateToPage(`quotation-view/${tableViewButton.dataset.id}`);
    return;
  }

  const sortButton = event.target.closest("[data-sort-key]");
  if (sortButton) {
    event.preventDefault();
    updateQuotationSort(sortButton.dataset.sortKey);
    renderQuotationTableFromState();
    return;
  }
}

function navigateToPage(page, options = {}) {
  const nextHash = `#${page}`;
  const sameHash = location.hash === nextHash;

  if (!sameHash) {
    location.hash = nextHash;
    return;
  }

  if (options.force) {
    appState.currentPage = page;
    renderCurrentPage({ force: true, reason: "same-page-click" });
  }
}

async function recoverAppAfterResume(reason = "resume") {
  if (!isConfigured || !supabaseClient) return;
  if (appState.resumeInProgress) return;

  appState.resumeInProgress = true;

  try {
    hidePageBusy();
    appState.activeActions?.clear?.();

    await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (!data.session?.user) {
      appState.user = null;
      appState.profile = null;
      showLoginPage();
      showToast("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่", "warning", { duration: 4200 });
      return;
    }

    appState.user = data.session.user;
    await loadProfile();
    showAppShell();
    await loadAndApplyAppBranding();

    // Force content re-fetch every time the tab becomes active again.
    await renderCurrentPage({ force: true, reason });

    // A second delayed check catches browsers that resume the page before network/state is ready.
    window.setTimeout(async () => {
      try {
        if (!elements.pageContent || elements.pageContent.textContent.trim() === "") {
          await renderCurrentPage({ force: true, reason: `${reason}-empty-retry` });
        }
      } catch (retryError) {
        console.error("resume retry", retryError);
      }
    }, 450);
  } catch (error) {
    console.error("recoverAppAfterResume", reason, error);
    showToast("โหลดข้อมูลใหม่ไม่สำเร็จ กรุณาลองกดเมนูอีกครั้ง", "warning", { duration: 4200 });
    try {
      await renderCurrentPage({ force: true, reason: `${reason}-fallback` });
    } catch (renderError) {
      console.error(renderError);
      renderErrorStateWithRetry("ไม่สามารถโหลดข้อมูลได้", "ลองโหลดหน้านี้อีกครั้ง");
    }
  } finally {
    appState.resumeInProgress = false;
  }
}

async function renderCurrentPage(options = {}) {
  if (!appState.profile) {
    if (supabaseClient) {
      const { data } = await supabaseClient.auth.getSession();
      if (data.session?.user) {
        appState.user = data.session.user;
        await loadProfile();
      } else {
        showLoginPage();
        return;
      }
    } else {
      return;
    }
  }

  const renderToken = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  appState.renderToken = renderToken;
  appState.currentPage = getPageFromHash();
  renderMenu();
  updateHeaderUser();
  hidePageBusy();

  const page = appState.currentPage;

  try {
    if (page === "dashboard") {
      await renderDashboardPage();
    } else if (page === "quotations") {
      await renderQuotationsPage();
    } else if (page === "quotation-new") {
      await renderQuotationCreatePage();
    } else if (page.startsWith("quotation-edit/")) {
      await renderQuotationEditPage(page.replace("quotation-edit/", ""));
    } else if (page.startsWith("quotation-view/")) {
      await renderQuotationViewPage(page.replace("quotation-view/", ""));
    } else if (page.startsWith("quotation-print/")) {
      await renderQuotationPrintPage(page.replace("quotation-print/", ""));
    } else if (page === "customers") {
      await renderCustomersPage();
    } else if (page === "products") {
      await renderProductsPage();
    } else if (page === "product-new") {
      await renderProductFormPage({ mode: "create", productId: null });
    } else if (page.startsWith("product-edit/")) {
      await renderProductFormPage({ mode: "edit", productId: page.replace("product-edit/", "") });
    } else if (page === "company") {
      await renderCompanyPage();
    } else if (page === "settings") {
      await renderSettingsPage();
    } else {
      navigateToPage("dashboard", { force: true });
      return;
    }

    appState.lastSuccessfulRenderAt = Date.now();

    if (elements.pageContent && elements.pageContent.textContent.trim() === "") {
      throw new Error("Page rendered empty content");
    }
  } catch (error) {
    console.error(error);
    renderErrorStateWithRetry(error.message || "ไม่สามารถโหลดข้อมูลได้", "โหลดข้อมูลอีกครั้ง");
  }
}

function renderErrorStateWithRetry(message, buttonText = "ลองใหม่") {
  if (!elements.pageContent) return;
  elements.pageContent.innerHTML = `
    <div class="card error-state-card">
      <div>
        <h3>โหลดข้อมูลไม่สำเร็จ</h3>
        <p>${escapeHTML(message)}</p>
      </div>
      <button type="button" class="btn btn-primary" id="retryCurrentPageButton">${escapeHTML(buttonText)}</button>
    </div>
  `;

  $("#retryCurrentPageButton")?.addEventListener("click", () => {
    renderCurrentPage({ force: true, reason: "manual-retry" });
  });
}

async function renderDashboardPage() {
  setPageHeader("แดชบอร์ด");
  renderLoading("กำลังโหลดแดชบอร์ด...");

  const { data, error } = await supabaseClient
    .from("v_quotations_list")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1500);

  if (error) throw error;

  const rows = data || [];
  const analytics = buildDashboardAnalytics(rows, { monthsBack: 6 });

  elements.pageContent.innerHTML = `
    <div class="dashboard-v14">
      <section class="metric-grid metric-grid-v14">
        ${renderDashboardMetricCard("ใบเสนอราคาทั้งหมด", rows.length, "count")}
        ${renderDashboardMetricCard("ร่าง", analytics.statusCounts.draft, "count")}
        ${renderDashboardMetricCard("ยืนยัน", analytics.statusCounts.confirmed, "count")}
        ${renderDashboardMetricCard("ส่งแล้ว", analytics.statusCounts.sent, "count")}
        ${renderDashboardMetricCard("ชำระเงิน", analytics.statusCounts.paid, "count")}
        ${renderDashboardMetricCard("ยกเลิก", analytics.statusCounts.cancelled, "count")}
        ${renderDashboardMetricCard("หมดอายุ", analytics.statusCounts.expired, "count")}
        ${renderDashboardMetricCard("ยอดส่งเดือนนี้", analytics.currentMonthSentAmount, "amount")}
        ${renderDashboardMetricCard("ยอดชำระเดือนนี้", analytics.currentMonthPaidAmount, "amount")}
      </section>

      <section class="dashboard-grid dashboard-grid-v14">
        <div class="card chart-card chart-card-wide">
          <div class="card-header chart-header">
            <div>
              <h3>ยอดส่งแล้วเทียบกับชำระเงิน 6 เดือน</h3>
              <div class="chart-subtitle">ยอดเงินตามวันที่ส่งใบเสนอราคาและวันที่ชำระเงิน</div>
            </div>
          </div>
          ${renderAmountComparisonChart(analytics.months)}
        </div>

        <div class="card chart-card chart-card-wide">
          <div class="card-header chart-header">
            <div>
              <h3>จำนวนใบเสนอราคาส่งแล้ว แยกตามฝ่ายขายและเดือน</h3>
              <div class="chart-subtitle">Heatmap แสดงจำนวนเอกสารสถานะส่งแล้วในแต่ละเดือน</div>
            </div>
          </div>
          ${renderSentCountBySalesChart(analytics.salesSentCounts, analytics.months)}
        </div>
      </section>

      <section class="dashboard-grid">
        <div class="card">
          <div class="card-header"><h3>เอกสารใกล้หมดอายุ</h3></div>
          ${renderCompactQuotationList(analytics.expiringSoon, "ยังไม่มีเอกสารใกล้หมดอายุ")}
        </div>
        <div class="card">
          <div class="card-header"><h3>อัปเดตล่าสุด</h3></div>
          ${renderCompactQuotationList(rows.slice(0, 8), "ยังไม่มีใบเสนอราคา")}
        </div>
      </section>
    </div>
  `;

  bindCompactQuotationLinks();
}

function renderDashboardMetricCard(label, value, type) {
  const display = type === "amount" ? formatAmount(value) : number(value);
  const unit = type === "amount" ? "บาท" : "รายการ";
  return `
    <div class="metric-card metric-card-v14">
      <span>${escapeHTML(label)}</span>
      <strong>${display}</strong>
      <small>${unit}</small>
    </div>
  `;
}

function buildDashboardAnalytics(rows, options = {}) {
  const monthsBack = options.monthsBack || 6;
  const today = startOfToday();
  const currentKey = monthKey(today);
  const monthStarts = [];

  for (let index = monthsBack - 1; index >= 0; index -= 1) {
    monthStarts.push(new Date(today.getFullYear(), today.getMonth() - index, 1));
  }

  const months = monthStarts.map((date) => ({
    key: monthKey(date),
    label: formatMonthLabel(date),
    sentAmount: 0,
    paidAmount: 0,
    sentCount: 0,
    paidCount: 0,
  }));

  const monthMap = new Map(months.map((item) => [item.key, item]));
  const salesSentCounts = new Map();
  const statusCounts = {
    draft: 0,
    confirmed: 0,
    sent: 0,
    paid: 0,
    cancelled: 0,
    expired: 0,
  };

  let currentMonthSentAmount = 0;
  let currentMonthPaidAmount = 0;
  let currentMonthSentCount = 0;
  let currentMonthPaidCount = 0;
  let openSentAmount = 0;

  rows.forEach((row) => {
    const status = getEffectiveStatusForAnalytics(row);
    if (statusCounts[status] !== undefined) statusCounts[status] += 1;

    const rawStatus = getRawStatus(row);
    const amount = Number(row.grand_total_display || 0);

    if (rawStatus === "sent") {
      const sentDate = parseDateOnly(row.sent_at || row.quote_date || row.created_at);
      const key = sentDate ? monthKey(sentDate) : "";
      const month = monthMap.get(key);

      if (month) {
        month.sentAmount += amount;
        month.sentCount += 1;
      }

      if (key === currentKey) {
        currentMonthSentAmount += amount;
        currentMonthSentCount += 1;
      }

      openSentAmount += amount;

      const salesName = row.owner_name || "ไม่ระบุฝ่ายขาย";
      if (!salesSentCounts.has(salesName)) {
        salesSentCounts.set(salesName, Object.fromEntries(months.map((item) => [item.key, 0])));
      }
      if (key && salesSentCounts.get(salesName)[key] !== undefined) {
        salesSentCounts.get(salesName)[key] += 1;
      }
    }

    if (rawStatus === "paid") {
      const paidDate = parseDateOnly(row.paid_at || row.sent_at || row.quote_date || row.created_at);
      const key = paidDate ? monthKey(paidDate) : "";
      const month = monthMap.get(key);

      if (month) {
        month.paidAmount += amount;
        month.paidCount += 1;
      }

      if (key === currentKey) {
        currentMonthPaidAmount += amount;
        currentMonthPaidCount += 1;
      }
    }
  });

  const soon = addDays(today, 7);
  const expiringSoon = rows
    .filter((row) => ["confirmed", "sent"].includes(getRawStatus(row)))
    .filter((row) => {
      const validDate = parseDateOnly(row.valid_until);
      return validDate && validDate >= today && validDate <= soon;
    })
    .slice(0, 8);

  return {
    months,
    salesSentCounts,
    statusCounts,
    currentMonthSentAmount,
    currentMonthPaidAmount,
    currentMonthSentCount,
    currentMonthPaidCount,
    openSentAmount,
    expiringSoon,
  };
}

function getEffectiveStatusForAnalytics(row) {
  if (row.effective_status) return row.effective_status;
  if (row.status === "paid" || row.status === "cancelled" || row.status === "draft") return row.status;
  if (["confirmed", "sent"].includes(row.status) && row.valid_until && new Date(row.valid_until) < startOfToday()) return "expired";
  return row.status || "draft";
}

function renderAmountComparisonChart(months) {
  const maxValue = Math.max(1, ...months.flatMap((month) => [month.sentAmount, month.paidAmount]));
  const sentTotal = months.reduce((sum, month) => sum + month.sentAmount, 0);
  const paidTotal = months.reduce((sum, month) => sum + month.paidAmount, 0);
  const sentCount = months.reduce((sum, month) => sum + month.sentCount, 0);
  const paidCount = months.reduce((sum, month) => sum + month.paidCount, 0);

  if (!sentTotal && !paidTotal) {
    return `<div class="empty-state compact">ยังไม่มีข้อมูลส่งแล้วหรือชำระเงินในช่วง 6 เดือน</div>`;
  }

  return `
    <div class="chart-legend">
      <span><i class="legend-dot sent"></i>ยอดส่งแล้ว</span>
      <span><i class="legend-dot paid"></i>ยอดชำระเงิน</span>
    </div>

    <div class="paired-bar-chart">
      ${months.map((month) => {
        const sentPct = Math.max(3, (month.sentAmount / maxValue) * 100);
        const paidPct = Math.max(3, (month.paidAmount / maxValue) * 100);
        return `
          <div class="paired-bar-row">
            <div class="paired-bar-label">${escapeHTML(month.label)}</div>
            <div class="paired-bar-stack">
              <div class="paired-bar-line">
                <span class="bar-caption">ส่ง</span>
                <div class="bar-track"><div class="bar-fill sent" style="width:${sentPct}%"></div></div>
                <strong>${formatAmountCompact(month.sentAmount)}</strong>
              </div>
              <div class="paired-bar-line">
                <span class="bar-caption">ชำระ</span>
                <div class="bar-track"><div class="bar-fill paid" style="width:${paidPct}%"></div></div>
                <strong>${formatAmountCompact(month.paidAmount)}</strong>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>

    <div class="chart-summary-grid">
      <div><span>ยอดส่งแล้วรวม</span><strong>${formatAmount(sentTotal)}</strong><small>บาท · ${number(sentCount)} รายการ</small></div>
      <div><span>ยอดชำระเงินรวม</span><strong>${formatAmount(paidTotal)}</strong><small>บาท · ${number(paidCount)} รายการ</small></div>
      <div><span>ส่วนต่าง</span><strong>${formatAmount(sentTotal - paidTotal)}</strong><small>บาท</small></div>
    </div>

    <div class="table-wrap chart-detail-table-wrap">
      <table class="data-table chart-detail-table">
        <thead>
          <tr><th>เดือน</th><th>ส่งแล้ว (บาท)</th><th>จำนวนส่งแล้ว</th><th>ชำระเงิน (บาท)</th><th>จำนวนชำระ</th></tr>
        </thead>
        <tbody>
          ${months.map((month) => `
            <tr>
              <td>${escapeHTML(month.label)}</td>
              <td>${formatAmount(month.sentAmount)}</td>
              <td>${number(month.sentCount)}</td>
              <td>${formatAmount(month.paidAmount)}</td>
              <td>${number(month.paidCount)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSentCountBySalesChart(salesSentCounts, months) {
  const salesRows = Array.from(salesSentCounts.entries())
    .map(([salesName, counts]) => ({ salesName, counts }))
    .sort((a, b) => a.salesName.localeCompare(b.salesName, "th"));

  if (!salesRows.length) {
    return `<div class="empty-state compact">ยังไม่มีใบเสนอราคาสถานะส่งแล้วในช่วง 6 เดือน</div>`;
  }

  const maxCount = Math.max(1, ...salesRows.flatMap((row) => months.map((month) => row.counts[month.key] || 0)));
  const monthTotals = months.map((month) => salesRows.reduce((sum, row) => sum + Number(row.counts[month.key] || 0), 0));

  return `
    <div class="heatmap-wrap">
      <table class="heatmap-table">
        <thead>
          <tr>
            <th>ฝ่ายขาย</th>
            ${months.map((month) => `<th>${escapeHTML(month.label)}</th>`).join("")}
            <th>รวม</th>
          </tr>
        </thead>
        <tbody>
          ${salesRows.map((row) => {
            const rowTotal = months.reduce((sum, month) => sum + Number(row.counts[month.key] || 0), 0);
            return `
              <tr>
                <td class="heatmap-sales">${escapeHTML(row.salesName)}</td>
                ${months.map((month) => {
                  const count = Number(row.counts[month.key] || 0);
                  const intensity = count ? Math.max(0.16, count / maxCount) : 0;
                  return `<td><span class="heatmap-cell" style="--heat:${intensity}">${number(count)}</span></td>`;
                }).join("")}
                <td class="heatmap-total">${number(rowTotal)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
        <tfoot>
          <tr>
            <td>รวมทั้งเดือน</td>
            ${monthTotals.map((total) => `<td>${number(total)}</td>`).join("")}
            <td>${number(monthTotals.reduce((sum, item) => sum + item, 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

function formatAmountCompact(value) {
  const numberValue = Number(value || 0);
  if (Math.abs(numberValue) >= 1000000) return `${(numberValue / 1000000).toFixed(1)}M`;
  if (Math.abs(numberValue) >= 1000) return `${(numberValue / 1000).toFixed(0)}K`;
  return formatAmount(numberValue);
}

function showStatusChangeDialog({ status, count, skipped = 0 }) {
  const today = toDateInputValue(new Date());
  const needsDate = ["sent", "paid"].includes(status);
  const needsReason = status === "cancelled";
  const title = needsReason
    ? "ยกเลิกใบเสนอราคา"
    : count > 1
      ? `ปรับสถานะ ${number(count)} รายการ`
      : `เปลี่ยนสถานะเป็น${statusLabel(status)}`;
  const skippedText = skipped > 0 ? `<div class="alert alert-warning">ข้าม ${number(skipped)} รายการที่ไม่เข้าเงื่อนไขสถานะนี้</div>` : "";

  return new Promise((resolve) => {
    const dialog = document.createElement("div");
    dialog.className = "modal-backdrop app-modal-backdrop";
    dialog.innerHTML = `
      <div class="app-modal-card status-dialog-v14" role="dialog" aria-modal="true">
        <div class="app-modal-header">
          <div>
            <h3>${escapeHTML(title)}</h3>
            <p>${needsReason ? `เลือกไว้ ${number(count)} รายการ เหตุผลไม่บังคับ` : `เลือกไว้ ${number(count)} รายการ`}</p>
          </div>
          <button type="button" class="icon-button modal-close-button" data-dialog-cancel aria-label="ปิด">×</button>
        </div>
        <div class="app-modal-body">
          ${skippedText}
          ${needsDate ? `
            <div class="field">
              <label>${status === "sent" ? "วันที่ส่งใบเสนอราคา" : "วันที่ชำระเงิน"}</label>
              <input id="statusEffectiveDate" type="date" value="${today}" />
            </div>
          ` : ""}
          ${needsReason ? `
            <div class="field">
              <label>เหตุผลการยกเลิก</label>
              <textarea id="statusReason" rows="5" placeholder="เช่น ลูกค้าเลื่อนโครงการ / เสนอราคาใหม่ / ข้อมูลผิดพลาด"></textarea>
              <small class="field-hint">ไม่บังคับ ถ้ายกเลิกหลายใบ ระบบจะใช้เหตุผลเดียวกันทุกใบ</small>
            </div>
          ` : ""}
        </div>
        <div class="app-modal-footer">
          <button type="button" class="btn btn-ghost" data-dialog-cancel>ปิด</button>
          <button type="button" class="btn ${needsReason ? "danger-soft" : "btn-primary"}" data-dialog-confirm>${needsReason ? "ยืนยันยกเลิก" : "บันทึกสถานะ"}</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    const cleanup = (value) => {
      dialog.remove();
      resolve(value);
    };

    dialog.querySelectorAll("[data-dialog-cancel]").forEach((button) => {
      button.addEventListener("click", () => cleanup(null));
    });

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) cleanup(null);
    });

    dialog.querySelector("[data-dialog-confirm]").addEventListener("click", () => {
      const effectiveDate = needsDate ? dialog.querySelector("#statusEffectiveDate")?.value : today;
      const note = needsReason ? dialog.querySelector("#statusReason")?.value.trim() : "";
      if (needsDate && !effectiveDate) {
        showToast("กรุณาระบุวันที่", "warning");
        return;
      }
      cleanup({ effectiveDate, note });
    });

    const firstInput = needsDate ? dialog.querySelector("#statusEffectiveDate") : dialog.querySelector("#statusReason");
    window.setTimeout(() => firstInput?.focus?.(), 50);
  });
}

async function renderSettingsPage() {
  if (appState.profile.role !== "admin") {
    renderError("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
    return;
  }

  setPageHeader("ตั้งค่า");
  renderLoading("กำลังโหลดการตั้งค่า...");

  const branding = await loadAppBranding();
  appState.appBranding = branding;

  elements.pageContent.innerHTML = `
    <div class="settings-grid-v14">
      <section class="card form-card">
        <div class="card-header">
          <h3>โลโก้ระบบ</h3>
        </div>

        <div class="branding-preview-grid">
          ${renderBrandingPreviewCard("โลโก้หน้า Login / แถบเมนู", branding.login_logo_url, "login")}
          ${renderBrandingPreviewCard("Icon บน Tab / Taskbar", branding.favicon_url, "favicon")}
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="loginLogoFile">อัปโหลดโลโก้ระบบ / แถบเมนู</label>
            <input id="loginLogoFile" type="file" accept="image/png,image/jpeg,image/webp" />
            <small class="field-hint">รองรับ PNG, JPG, WEBP ไม่เกิน 5 MB</small>
          </div>
          <div class="field">
            <label for="faviconFile">อัปโหลด Icon เว็บไซต์</label>
            <input id="faviconFile" type="file" accept="image/png,image/jpeg,image/webp" />
            <small class="field-hint">แนะนำภาพสี่เหลี่ยม เช่น 512×512 px</small>
          </div>
        </div>

        <div class="form-actions normal-flow">
          <button type="button" id="uploadLoginLogoButton" class="btn btn-primary">บันทึกโลโก้ระบบ</button>
          <button type="button" id="uploadFaviconButton" class="btn btn-primary">บันทึก Icon เว็บไซต์</button>
        </div>
      </section>

      <section class="card">
        <div class="card-header"><h3>การใช้งานผู้ใช้</h3></div>
        <div class="checklist-grid">
          <label class="checklist-item"><input type="checkbox" checked disabled /><span>Admin สร้างบัญชีผ่าน Supabase Dashboard</span></label>
          <label class="checklist-item"><input type="checkbox" checked disabled /><span>Role ใช้จากตาราง profiles</span></label>
          <label class="checklist-item"><input type="checkbox" checked disabled /><span>Sales เห็นข้อมูลของตัวเองตาม RLS</span></label>
          <label class="checklist-item"><input type="checkbox" checked disabled /><span>Manager/Admin ดูภาพรวมได้ตามสิทธิ์</span></label>
        </div>
      </section>
    </div>
  `;

  bindAppBrandingSettingsActions();
}

function renderBrandingPreviewCard(title, url, type) {
  const fallback = type === "favicon" ? "FI" : "FI";
  return `
    <div class="branding-preview-card">
      <div class="branding-preview-image ${type}">
        ${url ? `<img src="${escapeHTML(url)}" alt="${escapeHTML(title)}" />` : `<span>${fallback}</span>`}
      </div>
      <div>
        <strong>${escapeHTML(title)}</strong>
        <small>${url ? "อัปโหลดแล้ว" : "ยังไม่ได้อัปโหลด"}</small>
      </div>
    </div>
  `;
}

function bindAppBrandingSettingsActions() {
  $("#uploadLoginLogoButton")?.addEventListener("click", async () => {
    await uploadAppBrandingFile("loginLogoFile", "login_logo_url", "login-logo", "โลโก้ระบบ");
  });

  $("#uploadFaviconButton")?.addEventListener("click", async () => {
    await uploadAppBrandingFile("faviconFile", "favicon_url", "favicon", "Icon เว็บไซต์");
  });
}

async function uploadAppBrandingFile(inputId, settingKey, fileNamePrefix, label) {
  const input = $(`#${inputId}`);
  const file = input?.files?.[0];

  if (!file) {
    showToast(`กรุณาเลือกไฟล์${label}`, "warning");
    return;
  }

  validateBrandingFile(file);

  await withAction(`upload-${settingKey}`, async () => {
    showPageBusy(`กำลังอัปโหลด${label}...`);

    const ext = getFileExtension(file.name, file.type);
    const path = `branding/${fileNamePrefix}.${ext}`;

    const { error: uploadError } = await supabaseClient.storage
      .from("app-assets")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) throw uploadError;

    const { data } = supabaseClient.storage.from("app-assets").getPublicUrl(path);
    const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

    await saveAppSetting(settingKey, publicUrl);
    appState.appBranding = await loadAppBranding();
    applyAppBranding(appState.appBranding);
    hidePageBusy();
    showToast(`บันทึก${label}สำเร็จ`, "success");
    await renderSettingsPage();
  });
}

function validateBrandingFile(file) {
  const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
  const maxSize = 5 * 1024 * 1024;

  if (!allowedTypes.includes(file.type)) {
    throw new Error("รองรับเฉพาะไฟล์ PNG, JPG หรือ WEBP เท่านั้น");
  }

  if (file.size > maxSize) {
    throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
  }
}

function getFileExtension(fileName, mimeType) {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return ext === "jpeg" ? "jpg" : ext;
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

async function loadAndApplyAppBranding() {
  try {
    appState.appBranding = await loadAppBranding();
    applyAppBranding(appState.appBranding);
  } catch (error) {
    console.warn("App branding is not ready", error);
    applyAppBranding(appState.appBranding || {});
  }
}

async function loadAppBranding() {
  if (!supabaseClient) return { login_logo_url: "", favicon_url: "" };

  const { data, error } = await supabaseClient
    .from("app_settings")
    .select("key, value")
    .in("key", ["login_logo_url", "favicon_url"]);

  if (error) {
    console.warn("Cannot load app_settings. Run supabase/patch_v1_4.sql if this is first install.", error);
    return { login_logo_url: "", favicon_url: "" };
  }

  const settings = { login_logo_url: "", favicon_url: "" };
  (data || []).forEach((row) => {
    settings[row.key] = row.value || "";
  });
  return settings;
}

async function saveAppSetting(key, value) {
  const { error } = await supabaseClient
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) throw error;
}

function applyAppBranding(branding = {}) {
  applyLoginLogo(branding.login_logo_url);
  applyHeaderLogo(branding.login_logo_url);
  applyFavicon(branding.favicon_url);
}

function applyLoginLogo(url) {
  const loginBrandMark = document.querySelector("#loginPage .brand-mark");
  if (!loginBrandMark) return;

  if (url) {
    loginBrandMark.classList.add("brand-mark-image");
    loginBrandMark.innerHTML = `<img src="${escapeHTML(url)}" alt="logo" />`;
  } else {
    loginBrandMark.classList.remove("brand-mark-image");
    loginBrandMark.textContent = "FI";
  }
}

function applyHeaderLogo(url) {
  const headerBrandMark = document.querySelector(".app-brand .brand-mark.small");
  if (!headerBrandMark) return;

  if (url) {
    headerBrandMark.classList.add("brand-mark-image");
    headerBrandMark.innerHTML = `<img src="${escapeHTML(url)}" alt="logo" />`;
  } else {
    headerBrandMark.classList.remove("brand-mark-image");
    headerBrandMark.textContent = "FI";
  }
}

function applyFavicon(url) {
  if (!url) return;

  let iconLink = document.querySelector("link[rel='icon']");
  if (!iconLink) {
    iconLink = document.createElement("link");
    iconLink.rel = "icon";
    document.head.appendChild(iconLink);
  }
  iconLink.href = url;

  let appleLink = document.querySelector("link[rel='apple-touch-icon']");
  if (!appleLink) {
    appleLink = document.createElement("link");
    appleLink.rel = "apple-touch-icon";
    document.head.appendChild(appleLink);
  }
  appleLink.href = url;
}


// =======================================================
// v1.4.1 Hotfix: prevent file picker from triggering resume re-render
// =======================================================

Object.assign(appState, {
  filePickerActive: false,
  suppressResumeUntil: 0,
});

function markFilePickerInteraction() {
  appState.filePickerActive = true;
  appState.suppressResumeUntil = Date.now() + 120000;
}

function releaseFilePickerInteraction(delay = 1400) {
  appState.filePickerActive = false;
  appState.suppressResumeUntil = Date.now() + delay;
}

function isFileInputElement(target) {
  return !!target?.closest?.("input[type='file']");
}

function shouldSkipResumeRecoveryForFilePicker() {
  const activeElement = document.activeElement;
  const isFileFocused = activeElement?.matches?.("input[type='file']");
  return Boolean(appState.filePickerActive || Date.now() < (appState.suppressResumeUntil || 0) || isFileFocused);
}

function bindEvents() {
  if (elements.loginForm && !elements.loginForm.dataset.v141Bound) {
    elements.loginForm.dataset.v141Bound = "true";
    elements.loginForm.addEventListener("submit", handleLogin);
  }

  if (elements.logoutButton && !elements.logoutButton.dataset.v141Bound) {
    elements.logoutButton.dataset.v141Bound = "true";
    elements.logoutButton.addEventListener("click", handleLogout);
  }

  if (!window.__fiHashBoundV141) {
    window.__fiHashBoundV141 = true;
    window.addEventListener("hashchange", async () => {
      appState.currentPage = getPageFromHash();
      await renderCurrentPage({ force: true, reason: "hashchange" });
    });
  }

  if (!window.__fiDelegatedClickV141) {
    window.__fiDelegatedClickV141 = true;

    document.addEventListener("pointerdown", (event) => {
      if (isFileInputElement(event.target)) markFilePickerInteraction();
    }, true);

    document.addEventListener("click", (event) => {
      if (isFileInputElement(event.target)) markFilePickerInteraction();
      handleDelegatedClick(event);
    }, true);

    document.addEventListener("change", (event) => {
      if (isFileInputElement(event.target)) {
        releaseFilePickerInteraction(2200);
        return;
      }
      handleDelegatedChange(event);
    }, true);
  }

  if (!window.__fiLifecycleBoundV141) {
    window.__fiLifecycleBoundV141 = true;
    window.addEventListener("focus", () => recoverAppAfterResume("focus"));
    window.addEventListener("pageshow", (event) => recoverAppAfterResume(event.persisted ? "pageshow-cache" : "pageshow"));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") recoverAppAfterResume("visibilitychange");
    });
  }

  const mobileMenuButton = $("#mobileMenuButton");
  if (mobileMenuButton && !mobileMenuButton.dataset.v141Bound) {
    mobileMenuButton.dataset.v141Bound = "true";
    mobileMenuButton.addEventListener("click", () => {
      elements.sidebarMenu?.classList.toggle("is-open");
    });
  }
}

async function recoverAppAfterResume(reason = "resume") {
  if (!isConfigured || !supabaseClient) return;

  if (shouldSkipResumeRecoveryForFilePicker()) {
    releaseFilePickerInteraction(1600);
    return;
  }

  if (appState.resumeInProgress) return;
  appState.resumeInProgress = true;

  try {
    hidePageBusy();
    appState.activeActions?.clear?.();

    await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (!data.session?.user) {
      appState.user = null;
      appState.profile = null;
      showLoginPage();
      showToast("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่", "warning", { duration: 4200 });
      return;
    }

    appState.user = data.session.user;
    await loadProfile();
    showAppShell();
    await loadAndApplyAppBranding();

    await renderCurrentPage({ force: true, reason });

    window.setTimeout(async () => {
      try {
        if (shouldSkipResumeRecoveryForFilePicker()) return;
        if (!elements.pageContent || elements.pageContent.textContent.trim() === "") {
          await renderCurrentPage({ force: true, reason: `${reason}-empty-retry` });
        }
      } catch (retryError) {
        console.error("resume retry", retryError);
      }
    }, 450);
  } catch (error) {
    console.error("recoverAppAfterResume", reason, error);
    showToast("โหลดข้อมูลใหม่ไม่สำเร็จ กรุณาลองกดเมนูอีกครั้ง", "warning", { duration: 4200 });
    try {
      await renderCurrentPage({ force: true, reason: `${reason}-fallback` });
    } catch (renderError) {
      console.error(renderError);
      renderErrorStateWithRetry("ไม่สามารถโหลดข้อมูลได้", "ลองโหลดหน้านี้อีกครั้ง");
    }
  } finally {
    appState.resumeInProgress = false;
  }
}

async function uploadAppBrandingFile(inputId, settingKey, fileNamePrefix, label) {
  const input = $(`#${inputId}`);
  const file = input?.files?.[0];

  if (!file) {
    showToast(`กรุณาเลือกไฟล์${label}`, "warning");
    return;
  }

  try {
    validateBrandingFile(file);
  } catch (error) {
    showToast(error.message || "ไฟล์ไม่ถูกต้อง", "error", { duration: 5200 });
    return;
  }

  await withAction(`upload-${settingKey}`, async () => {
    showPageBusy(`กำลังอัปโหลด${label}...`);

    const ext = getFileExtension(file.name, file.type);
    const path = `branding/${fileNamePrefix}.${ext}`;

    const { error: uploadError } = await supabaseClient.storage
      .from("app-assets")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) throw uploadError;

    const { data } = supabaseClient.storage.from("app-assets").getPublicUrl(path);
    const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

    await saveAppSetting(settingKey, publicUrl);
    appState.appBranding = await loadAppBranding();
    applyAppBranding(appState.appBranding);
    showToast(`บันทึก${label}สำเร็จ`, "success");
    await renderSettingsPage();
  });
}

// =======================================================
// v1.5 Print Layout Redesign
// Modern Compact Hybrid + section-level summaries
// =======================================================

async function renderQuotationPrintPage(quotationId) {
  if (!quotationId) {
    renderError("ไม่พบรหัสใบเสนอราคา");
    return;
  }

  setPageHeader("Preview / Print");
  renderLoading("กำลังโหลดใบเสนอราคา...");

  const [quotationResult, itemsResult, defaultCompanyResult, ownerResult, sectionTotalsResult] = await Promise.all([
    supabaseClient.from("quotations").select("*").eq("id", quotationId).single(),
    supabaseClient
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("section_type", { ascending: false })
      .order("sort_order", { ascending: true }),
    supabaseClient.from("company_profile").select("*").eq("is_default", true).maybeSingle(),
    supabaseClient
      .from("quotations")
      .select("owner_id, sales_name_snapshot")
      .eq("id", quotationId)
      .single()
      .then(async (quotationOwnerResult) => {
        if (quotationOwnerResult.error) return quotationOwnerResult;
        const ownerId = quotationOwnerResult.data?.owner_id;
        if (!ownerId) return { data: null, error: null };
        const profileResult = await supabaseClient.from("profiles").select("full_name, email").eq("id", ownerId).maybeSingle();
        return {
          data: {
            sales_name_snapshot: quotationOwnerResult.data?.sales_name_snapshot,
            profile: profileResult.data,
          },
          error: profileResult.error,
        };
      }),
    supabaseClient.rpc("calculate_quotation_section_totals", { p_quotation_id: quotationId }),
  ]);

  if (quotationResult.error) throw quotationResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (defaultCompanyResult.error) throw defaultCompanyResult.error;
  if (ownerResult.error) throw ownerResult.error;

  const quotation = quotationResult.data;
  const items = itemsResult.data || [];
  const defaultCompany = defaultCompanyResult.data || {};
  const ownerName =
    quotation.sales_name_snapshot ||
    ownerResult.data?.sales_name_snapshot ||
    ownerResult.data?.profile?.full_name ||
    ownerResult.data?.profile?.email ||
    "-";

  if (quotation.status === "draft") {
    elements.pageContent.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div><h3>ยังไม่สามารถ Preview / Print ได้</h3></div>
          <button class="btn btn-ghost" onclick="location.hash='quotation-view/${quotation.id}'">กลับไปหน้ารายละเอียด</button>
        </div>
        <div class="empty-state compact">ต้อง Confirm ใบเสนอราคาเพื่อสร้างเลขเอกสารก่อน</div>
      </div>
    `;
    return;
  }

  let sectionTotals = [];
  if (!sectionTotalsResult.error && Array.isArray(sectionTotalsResult.data)) {
    sectionTotals = sectionTotalsResult.data;
  } else {
    console.warn("calculate_quotation_section_totals fallback", sectionTotalsResult.error);
    sectionTotals = calculateSectionTotalsLocal(quotation, items);
    showToast("ใช้การคำนวณสำรองสำหรับ Preview กรุณารัน SQL v1.5 เพื่อความแม่นยำสูงสุด", "warning", { duration: 5200 });
  }

  const model = buildQuotationPrintModelV15({
    quotation,
    items,
    company: getCompanySnapshot(quotation, defaultCompany),
    ownerName,
    sectionTotals,
  });

  elements.pageContent.innerHTML = renderPrintV15(model);
  bindPrintV15Actions(model);

  requestAnimationFrame(() => applyPrintFitModeV15());
  window.setTimeout(() => applyPrintFitModeV15(), 350);
}

function buildQuotationPrintModelV15({ quotation, items, company, ownerName, sectionTotals }) {
  const totalsBySection = new Map((sectionTotals || []).map((item) => [item.section_type, item]));
  const localTotalsBySection = new Map(calculateSectionTotalsLocal(quotation, items).map((item) => [item.section_type, item]));
  const recurringItems = items.filter((item) => item.section_type === "recurring");
  const oneTimeItems = items.filter((item) => item.section_type === "one_time");
  const sections = [];

  const recurringTotals =
    totalsBySection.get("recurring") ||
    localTotalsBySection.get("recurring") ||
    createEmptyPrintSectionTotalsV15(quotation, "recurring");

  const oneTimeTotals =
    totalsBySection.get("one_time") ||
    localTotalsBySection.get("one_time") ||
    createEmptyPrintSectionTotalsV15(quotation, "one_time");

  if (recurringItems.length) {
    sections.push({
      type: "recurring",
      title: recurringTotals.section_title || (quotation.billing_type === "yearly" ? "ค่าบริการใช้งานรายปี" : "ค่าบริการใช้งานรายเดือน"),
      subtitle: recurringTotals.section_subtitle || (quotation.billing_type === "yearly" ? "ส่วนนี้เป็นค่าบริการที่เรียกเก็บเป็นรายปี" : "ส่วนนี้เป็นค่าบริการที่เรียกเก็บเป็นรายเดือน"),
      quantityHeader: "จำนวนรถ",
      items: recurringItems,
      totals: recurringTotals,
    });
  }

  if (oneTimeItems.length) {
    sections.push({
      type: "one_time",
      title: oneTimeTotals.section_title || "ค่าบริการครั้งเดียว (ค่าแรกเข้า)",
      subtitle: oneTimeTotals.section_subtitle || "ส่วนนี้เป็นค่าบริการที่เรียกเก็บครั้งเดียว ณ วันเริ่มใช้งาน",
      quantityHeader: "จำนวน",
      items: oneTimeItems,
      totals: oneTimeTotals,
    });
  }

  const documentTotal = roundMoney(sections.reduce((sum, section) => sum + Number(section.totals.net_total_display || 0), 0));
  const combinedAmountText = amountToThaiTextV15(documentTotal);

  return {
    quotation,
    company,
    ownerName,
    sections,
    documentTotal,
    combinedAmountText,
  };
}

function renderPrintV15(model) {
  const quotation = model.quotation;
  return `
    <div class="print-v2-toolbar">
      <div>
        <strong>${escapeHTML(quotation.quotation_no || "-")}</strong>
        <div class="print-muted">${escapeHTML(quotation.customer_name || "-")}</div>
      </div>
      <div class="print-toolbar-actions">
        <button id="backFromPrintButton" class="btn btn-ghost">กลับไปหน้ารายละเอียด</button>
        <button id="printButton" class="btn btn-primary">พิมพ์ / บันทึกเป็น PDF</button>
      </div>
    </div>

    <div class="print-v2-wrap">
      <article class="print-v2-page" id="quotationPrintPage">
        ${renderPrintV15Header(model)}
        ${renderPrintV15Customer(model)}
        ${model.sections.map((section) => renderPrintV15ServiceSection(section, model)).join("")}
        ${renderPrintV15BottomInfo(model)}
        ${renderPrintV15Signatures(model)}
      </article>
    </div>
  `;
}

function renderPrintV15Header(model) {
  const company = model.company;
  const quotation = model.quotation;
  const logo = company.logo_url
    ? `<img class="print-v2-logo" src="${escapeHTML(company.logo_url)}" alt="logo" />`
    : `<div class="print-v2-logo-mark">FI</div>`;

  return `
    <header class="print-v2-header">
      <div class="print-v2-company">
        ${logo}
        <div>
          <h1>${escapeHTML(company.company_name || "-")}</h1>
          <p>${escapeHTML(company.address || "-")}</p>
          <p>เลขประจำตัวผู้เสียภาษี: ${escapeHTML(company.tax_id || "-")} ${company.branch_name ? `(${escapeHTML(company.branch_name)})` : ""}</p>
          <p>โทร: ${escapeHTML(company.phone || "-")} · อีเมล: ${escapeHTML(company.email || "-")}</p>
        </div>
      </div>
      <div class="print-v2-doc">
        <h2>ใบเสนอราคา</h2>
        <p>QUOTATION</p>
        <dl>
          <div><dt>เลขที่</dt><dd>${escapeHTML(quotation.quotation_no || "-")}</dd></div>
          <div><dt>วันที่</dt><dd>${formatDate(quotation.quote_date)}</dd></div>
          <div><dt>วันหมดอายุ</dt><dd>${formatDate(quotation.valid_until)}</dd></div>
          <div><dt>ผู้เสนอราคา</dt><dd>${escapeHTML(model.ownerName || "-")}</dd></div>
        </dl>
      </div>
    </header>
  `;
}

function renderPrintV15Customer(model) {
  const quotation = model.quotation;
  return `
    <section class="print-v2-customer">
      <div class="print-v2-customer-row">
        <span>เรียน</span>
        <strong>${escapeHTML(quotation.customer_name || "-")}</strong>
      </div>
      <div class="print-v2-customer-row print-v2-customer-address">
        <span>ที่อยู่</span>
        <strong>${escapeHTML(quotation.customer_address || "-")}</strong>
      </div>
    </section>
  `;
}

function renderPrintV15ServiceSection(section, model) {
  const longClass = section.items.length > 3 ? "is-long-section" : "";
  return `
    <section class="print-v2-service-section print-v2-service-${escapeHTML(section.type)} ${longClass}">
      <div class="print-v2-section-heading">
        <h3>${escapeHTML(section.title)}</h3>
      </div>
      ${renderPrintV15ItemsTable(section)}
      ${renderPrintV15SectionSummary(section, model.quotation)}
    </section>
  `;
}

function renderPrintV15ItemsTable(section) {
  return `
    <table class="print-v2-service-table">
      <thead>
        <tr>
          <th class="center col-index">ลำดับ</th>
          <th>รายละเอียด</th>
          <th class="num col-qty">${escapeHTML(section.quantityHeader || "จำนวน")}</th>
          <th class="center col-unit">หน่วย</th>
          <th class="num col-price">ราคา/หน่วย</th>
          <th class="num col-subtotal">มูลค่าก่อนภาษี</th>
        </tr>
      </thead>
      <tbody>
        ${section.items.map((item, index) => renderPrintV15ItemRow(item, index)).join("")}
      </tbody>
    </table>
  `;
}

function renderPrintV15ItemRow(item, index) {
  const lineSubtotal = getItemLineSubtotalV15(item);
  return `
    <tr>
      <td class="center">${index + 1}</td>
      <td>
        <strong>${escapeHTML(item.product_name_snapshot || "-")}</strong>
        ${item.description ? `<div class="print-v2-item-desc">${escapeHTML(item.description)}</div>` : ""}
      </td>
      <td class="num">${number(item.quantity)}</td>
      <td class="center">${escapeHTML(item.unit || "-")}</td>
      <td class="num">${formatAmount(item.unit_price)}</td>
      <td class="num">${formatAmount(lineSubtotal)}</td>
    </tr>
  `;
}

function renderPrintV15SectionSummary(section, quotation) {
  const totals = section.totals || {};
  const amountText = totals.amount_text_th || amountToThaiTextV15(Number(totals.net_total_display || 0));
  const discount = Number(totals.discount_amount || 0);
  const rounding = Number(totals.rounding_adjustment || 0);
  const vat = Number(totals.vat_amount || 0);
  const wht = Number(totals.wht_amount || 0);

  return `
    <div class="print-v2-section-summary">
      <div class="print-v2-amount-text">${escapeHTML(amountText)}</div>
      <table class="print-v2-summary-table">
        <tbody>
          ${renderPrintV15SummaryRow("มูลค่าก่อนภาษี", totals.subtotal_amount)}
          ${discount > 0 ? renderPrintV15SummaryRow("ส่วนลด", -discount) : ""}
          ${discount > 0 ? renderPrintV15SummaryRow("ฐานคำนวณภาษี", totals.taxable_amount) : ""}
          ${vat > 0 ? renderPrintV15SummaryRow(`VAT ${Number(quotation.vat_rate || 7)}%`, vat) : ""}
          ${wht > 0 ? renderPrintV15SummaryRow(`หัก ณ ที่จ่าย ${Number(quotation.wht_rate || 3)}%`, -wht) : ""}
          ${Math.abs(rounding) > 0 ? renderPrintV15SummaryRow("ส่วนต่างปัดเศษ", rounding) : ""}
          ${renderPrintV15SummaryRow("ยอดรวมสุทธิ", totals.net_total_display, "is-net")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPrintV15SummaryRow(label, value, className = "") {
  return `
    <tr class="${className}">
      <td>${escapeHTML(label)}</td>
      <td>${formatSignedAmount(value)}</td>
    </tr>
  `;
}

function renderPrintV15GrandTotal(model) {
  if (model.sections.length <= 1) return "";
  return `
    <section class="print-v2-grand-total-strip">
      <span>ยอดรวมทั้งฉบับ</span>
      <strong>${formatAmount(model.documentTotal)}</strong>
      <em>${escapeHTML(model.combinedAmountText)}</em>
    </section>
  `;
}

function renderPrintV15BottomInfo(model) {
  const quotation = model.quotation;
  const company = model.company;
  return `
    <section class="print-v2-bottom-grid">
      <div class="print-v2-bottom-left">
        ${renderPrintV15TextBox("หมายเหตุ", quotation.note)}
        ${renderPrintV15TextBox("เงื่อนไขการชำระเงิน", quotation.payment_terms)}
      </div>
      <div class="print-v2-bank-box">
        <h4>ข้อมูลบัญชีสำหรับชำระเงิน</h4>
        <dl>
          <div><dt>ธนาคาร</dt><dd>${escapeHTML(company.bank_name || "-")}</dd></div>
          <div><dt>ชื่อบัญชี</dt><dd>${escapeHTML(company.bank_account_name || "-")}</dd></div>
          <div><dt>เลขบัญชี</dt><dd>${escapeHTML(company.bank_account_no || "-")}</dd></div>
          <div><dt>หมายเหตุ</dt><dd>${escapeHTML(company.payment_note || "-")}</dd></div>
        </dl>
      </div>
    </section>
  `;
}

function renderPrintV15TextBox(title, text) {
  if (!String(text || "").trim()) return "";
  return `
    <div class="print-v2-note-box">
      <h4>${escapeHTML(title)}</h4>
      <div>${escapeHTML(text || "-")}</div>
    </div>
  `;
}

function renderPrintV15Signatures(model) {
  return `
    <footer class="print-v2-signatures">
      <div>
        <strong>ยืนยันรับราคา / ลูกค้า</strong>
        <div class="sign-line"></div>
        <span>วันที่ ______ / ______ / ______</span>
      </div>
      <div>
        <strong>ผู้เสนอราคา</strong>
        <div class="sign-line"></div>
        <span>${escapeHTML(model.ownerName || "-")}</span>
        <span>${escapeHTML(model.company.company_name || "")}</span>
      </div>
    </footer>
  `;
}

function bindPrintV15Actions(model) {
  const printButton = $("#printButton");
  const backButton = $("#backFromPrintButton");
  if (printButton) printButton.addEventListener("click", () => window.print());
  if (backButton) {
    backButton.addEventListener("click", () => {
      location.hash = `#quotation-view/${model.quotation.id}`;
    });
  }
}

function getItemLineSubtotalV15(item) {
  if (item.line_subtotal !== null && item.line_subtotal !== undefined) return Number(item.line_subtotal || 0);
  if (item.section_type === "recurring") return Number(item.unit_price || 0);
  return Number(item.quantity || 0) * Number(item.unit_price || 0);
}

function calculateSectionTotalsLocal(quotation, items) {
  const groups = [
    {
      section_type: "recurring",
      section_title: quotation.billing_type === "yearly" ? "ค่าบริการใช้งานรายปี" : "ค่าบริการใช้งานรายเดือน",
      section_subtitle: quotation.billing_type === "yearly" ? "ส่วนนี้เป็นค่าบริการที่เรียกเก็บเป็นรายปี" : "ส่วนนี้เป็นค่าบริการที่เรียกเก็บเป็นรายเดือน",
    },
    {
      section_type: "one_time",
      section_title: "ค่าบริการครั้งเดียว (ค่าแรกเข้า)",
      section_subtitle: "ส่วนนี้เป็นค่าบริการที่เรียกเก็บครั้งเดียว ณ วันเริ่มใช้งาน",
    },
  ];

  return groups
    .filter((group) => items.some((item) => item.section_type === group.section_type))
    .map((group) => {
      const sectionItems = items.filter((item) => item.section_type === group.section_type);
      return calculatePrintSectionTotalsFromItemsV15(quotation, group, sectionItems);
    });
}

function calculatePrintSectionTotalsFromItemsV15(quotation, group, sectionItems) {
  const subtotal = roundMoney(sectionItems.reduce((sum, item) => sum + getItemLineSubtotalV15(item), 0));
  const discount = roundMoney(subtotal * Number(quotation.discount_percent || 0) / 100);
  const taxable = roundMoney(subtotal - discount);
  const vat = quotation.vat_enabled ? roundMoney(taxable * Number(quotation.vat_rate || 0) / 100) : 0;
  const wht = quotation.wht_enabled ? roundMoney(taxable * Number(quotation.wht_rate || 0) / 100) : 0;
  const netTotal = roundMoney(taxable + vat - wht);
  const displayTotal = quotation.rounding_enabled ? Math.round(netTotal) : netTotal;
  const rounding = roundMoney(displayTotal - netTotal);

  return {
    ...group,
    subtotal_amount: subtotal,
    discount_amount: discount,
    taxable_amount: taxable,
    vat_amount: vat,
    wht_amount: wht,
    rounding_adjustment: rounding,
    net_total: netTotal,
    net_total_display: displayTotal,
    amount_text_th: amountToThaiTextV15(displayTotal),
  };
}

function createEmptyPrintSectionTotalsV15(quotation, sectionType) {
  const group = sectionType === "recurring"
    ? {
        section_type: "recurring",
        section_title: quotation.billing_type === "yearly" ? "ค่าบริการใช้งานรายปี" : "ค่าบริการใช้งานรายเดือน",
        section_subtitle: quotation.billing_type === "yearly" ? "ส่วนนี้เป็นค่าบริการที่เรียกเก็บเป็นรายปี" : "ส่วนนี้เป็นค่าบริการที่เรียกเก็บเป็นรายเดือน",
      }
    : {
        section_type: "one_time",
        section_title: "ค่าบริการครั้งเดียว (ค่าแรกเข้า)",
        section_subtitle: "ส่วนนี้เป็นค่าบริการที่เรียกเก็บครั้งเดียว ณ วันเริ่มใช้งาน",
      };

  return {
    ...group,
    subtotal_amount: 0,
    discount_amount: 0,
    taxable_amount: 0,
    vat_amount: 0,
    wht_amount: 0,
    rounding_adjustment: 0,
    net_total: 0,
    net_total_display: 0,
    amount_text_th: amountToThaiTextV15(0),
  };
}

function formatSignedAmount(value) {
  const n = Number(value || 0);
  if (n < 0) return `-${formatAmount(Math.abs(n))}`;
  return formatAmount(n);
}

function applyPrintFitModeV15() {
  const page = document.querySelector(".print-v2-page");
  if (!page) return;
  page.classList.remove("print-compact", "print-ultra-compact");

  const a4HeightPx = 1122;
  if (page.scrollHeight > a4HeightPx) page.classList.add("print-compact");

  requestAnimationFrame(() => {
    if (page.scrollHeight > a4HeightPx) page.classList.add("print-ultra-compact");
  });
}

function amountToThaiTextV15(value) {
  const numberValue = Number(value || 0);
  if (!Number.isFinite(numberValue)) return "ศูนย์บาทถ้วน";

  const fixed = Math.round((Math.abs(numberValue) + Number.EPSILON) * 100) / 100;
  const [bahtRaw, satangRaw = "00"] = fixed.toFixed(2).split(".");
  const baht = Number(bahtRaw);
  const satang = Number(satangRaw);
  const prefix = numberValue < 0 ? "ลบ" : "";
  const bahtText = baht === 0 ? "ศูนย์" : thaiNumberToTextV15(bahtRaw);

  if (satang === 0) return `${prefix}${bahtText}บาทถ้วน`;
  return `${prefix}${bahtText}บาท${thaiNumberToTextV15(satangRaw)}สตางค์`;
}

function thaiNumberToTextV15(input) {
  const digits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const units = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
  const str = String(input).replace(/^0+/, "") || "0";

  if (str.length > 6) {
    const head = str.slice(0, -6);
    const tail = str.slice(-6);
    const tailText = Number(tail) === 0 ? "" : thaiNumberToTextV15(tail);
    return `${thaiNumberToTextV15(head)}ล้าน${tailText}`;
  }

  let result = "";
  const len = str.length;
  for (let i = 0; i < len; i += 1) {
    const n = Number(str[i]);
    const position = len - i - 1;
    if (n === 0) continue;

    if (position === 1 && n === 1) {
      result += "สิบ";
    } else if (position === 1 && n === 2) {
      result += "ยี่สิบ";
    } else if (position === 0 && n === 1 && len > 1) {
      result += "เอ็ด";
    } else {
      result += digits[n] + units[position];
    }
  }
  return result || digits[0];
}

// =======================================================
// v1.6 Form UX + Product Code Rule + Excel Report Redesign
// Loading watchdog + resume hard fix
// =======================================================

Object.assign(appState, {
  renderSeqV16: 0,
  renderInProgressV16: false,
  lastResumeAttemptAtV16: 0,
});

const FI_RENDER_TIMEOUT_MS_V16 = 15000;
const FI_RESUME_DEBOUNCE_MS_V16 = 1400;

function runWithTimeoutV16(promise, timeoutMs, label = "การโหลดข้อมูล") {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label}ใช้เวลานานเกินไป กรุณาลองโหลดใหม่อีกครั้ง`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => window.clearTimeout(timeoutId));
}

function isLoadingStateVisibleV16() {
  return Boolean(elements.pageContent?.querySelector?.(".loading-card, .skeleton-card"));
}

function renderLoading(message = "กำลังโหลดข้อมูล...") {
  if (!elements.pageContent) return;
  elements.pageContent.innerHTML = `
    <div class="loading-card" data-loading-start="${Date.now()}">
      <div class="spinner"></div>
      <strong>${escapeHTML(message)}</strong>
      <p>หากโหลดนานผิดปกติ ระบบจะแสดงปุ่มให้ลองโหลดใหม่โดยไม่ต้องรีเฟรชเว็บ</p>
    </div>
  `;
}

function renderErrorStateWithRetry(message, buttonText = "โหลดข้อมูลอีกครั้ง") {
  if (!elements.pageContent) return;
  elements.pageContent.innerHTML = `
    <div class="card error-state-card render-retry-card">
      <div>
        <h3>โหลดข้อมูลไม่สำเร็จ</h3>
        <p>${escapeHTML(message || "ไม่สามารถโหลดข้อมูลได้")}</p>
      </div>
      <button type="button" class="btn btn-primary" id="retryCurrentPageButton">${escapeHTML(buttonText)}</button>
    </div>
  `;

  $("#retryCurrentPageButton")?.addEventListener("click", () => {
    renderCurrentPage({ force: true, reason: "manual-retry" });
  });
}

async function renderCurrentPage(options = {}) {
  if (!appState.profile) {
    if (!supabaseClient) return;

    try {
      const { data, error } = await runWithTimeoutV16(
        supabaseClient.auth.getSession(),
        8000,
        "การตรวจสอบ session"
      );
      if (error) throw error;
      if (!data.session?.user) {
        showLoginPage();
        return;
      }
      appState.user = data.session.user;
      await runWithTimeoutV16(loadProfile(), 8000, "การโหลดข้อมูลผู้ใช้");
      showAppShell();
    } catch (error) {
      console.error("renderCurrentPage session bootstrap", error);
      hidePageBusy();
      renderErrorStateWithRetry("ไม่สามารถตรวจสอบ session ได้ กรุณาลองโหลดใหม่");
      return;
    }
  }

  const token = ++appState.renderSeqV16;
  appState.renderInProgressV16 = true;
  appState.currentPage = getPageFromHash();
  renderMenu();
  updateHeaderUser?.();
  hidePageBusy();

  const page = appState.currentPage;
  const label = `การโหลดหน้า ${page}`;

  const watchdogId = window.setTimeout(() => {
    if (appState.renderSeqV16 !== token) return;
    if (!isLoadingStateVisibleV16()) return;
    renderErrorStateWithRetry("โหลดข้อมูลนานเกินไปหรือการเชื่อมต่อค้าง กรุณาลองโหลดใหม่อีกครั้ง");
  }, FI_RENDER_TIMEOUT_MS_V16 + 400);

  try {
    await runWithTimeoutV16(renderPageByKeyV16(page), FI_RENDER_TIMEOUT_MS_V16, label);
    if (appState.renderSeqV16 !== token) return;

    appState.lastSuccessfulRenderAt = Date.now();

    if (elements.pageContent && elements.pageContent.textContent.trim() === "") {
      throw new Error("หน้าเว็บแสดงผลว่างหลังโหลดข้อมูล");
    }

    decorateRequiredStars();
  } catch (error) {
    if (appState.renderSeqV16 !== token) return;
    console.error("renderCurrentPage v1.6", error);
    hidePageBusy();
    renderErrorStateWithRetry(error.message || "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
  } finally {
    window.clearTimeout(watchdogId);
    if (appState.renderSeqV16 === token) appState.renderInProgressV16 = false;
    hidePageBusy();
  }
}

async function renderPageByKeyV16(page) {
  if (page === "dashboard") {
    await renderDashboardPage();
  } else if (page === "quotations") {
    await renderQuotationsPage();
  } else if (page === "quotation-new") {
    await renderQuotationCreatePage();
  } else if (page.startsWith("quotation-edit/")) {
    await renderQuotationEditPage(page.replace("quotation-edit/", ""));
  } else if (page.startsWith("quotation-view/")) {
    await renderQuotationViewPage(page.replace("quotation-view/", ""));
  } else if (page.startsWith("quotation-print/")) {
    await renderQuotationPrintPage(page.replace("quotation-print/", ""));
  } else if (page === "customers") {
    await renderCustomersPage();
  } else if (page === "products") {
    await renderProductsPage();
  } else if (page === "product-new") {
    await renderProductFormPage({ mode: "create", productId: null });
  } else if (page.startsWith("product-edit/")) {
    await renderProductFormPage({ mode: "edit", productId: page.replace("product-edit/", "") });
  } else if (page === "company") {
    await renderCompanyPage();
  } else if (page === "settings") {
    await renderSettingsPage();
  } else {
    navigateToPage("dashboard", { force: true });
  }
}

async function recoverAppAfterResume(reason = "resume") {
  if (!isConfigured || !supabaseClient) return;
  if (shouldSkipResumeRecoveryForFilePicker?.()) {
    releaseFilePickerInteraction?.(1600);
    return;
  }

  const now = Date.now();
  if (now - Number(appState.lastResumeAttemptAtV16 || 0) < FI_RESUME_DEBOUNCE_MS_V16) return;
  appState.lastResumeAttemptAtV16 = now;

  if (appState.resumeInProgress) return;
  appState.resumeInProgress = true;

  try {
    hidePageBusy();
    appState.activeActions?.clear?.();

    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    const { data, error } = await runWithTimeoutV16(
      supabaseClient.auth.getSession(),
      8000,
      "การตรวจสอบ session หลังกลับมาหน้าเว็บ"
    );
    if (error) throw error;

    if (!data.session?.user) {
      appState.user = null;
      appState.profile = null;
      showLoginPage();
      showToast("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่", "warning", { duration: 4200 });
      return;
    }

    appState.user = data.session.user;
    await runWithTimeoutV16(loadProfile(), 8000, "การโหลดข้อมูลผู้ใช้");
    showAppShell();

    try {
      await runWithTimeoutV16(loadAndApplyAppBranding(), 8000, "การโหลด branding");
    } catch (brandingError) {
      console.warn("branding reload skipped", brandingError);
    }

    await renderCurrentPage({ force: true, reason });

    window.setTimeout(() => {
      if (shouldSkipResumeRecoveryForFilePicker?.()) return;
      if (isLoadingStateVisibleV16() || !elements.pageContent?.textContent.trim()) {
        renderCurrentPage({ force: true, reason: `${reason}-watchdog-retry` });
      }
    }, 900);
  } catch (error) {
    console.error("recoverAppAfterResume v1.6", reason, error);
    hidePageBusy();
    renderErrorStateWithRetry(error.message || "โหลดข้อมูลหลังกลับมาหน้าเว็บไม่สำเร็จ", "โหลดข้อมูลใหม่");
    showToast("โหลดข้อมูลใหม่ไม่สำเร็จ กรุณากดโหลดข้อมูลใหม่", "warning", { duration: 5200 });
  } finally {
    appState.resumeInProgress = false;
  }
}

function decorateRequiredStars(root = document) {
  const scope = root?.querySelectorAll ? root : document;
  scope.querySelectorAll("label").forEach((label) => {
    if (label.querySelector(".required-star")) return;
    if (label.querySelector("input, select, textarea, button")) return;
    const text = label.textContent || "";
    if (!text.includes("*")) return;
    label.innerHTML = escapeHTML(text).replace(/\*/g, '<span class="required-star">*</span>');
  });
}

function startRequiredStarObserverV16() {
  decorateRequiredStars();
  if (window.__fiRequiredObserverV16) return;
  window.__fiRequiredObserverV16 = true;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) decorateRequiredStars(node);
      });
    }
  });

  const target = document.getElementById("app") || document.body;
  observer.observe(target, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startRequiredStarObserverV16);
} else {
  startRequiredStarObserverV16();
}

const renderProductFormPageV16Base = renderProductFormPage;
async function renderProductFormPage(options) {
  await renderProductFormPageV16Base(options);
  const helper = document.querySelector("#productForm .card-header p");
  if (helper) helper.textContent = "Code สามารถซ้ำได้ แต่ชื่อสินค้า/บริการต้องไม่ซ้ำ";
  decorateRequiredStars();
}

async function saveProduct({ mode, productId }) {
  const saveButton = $("#saveProductButton");
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "กำลังบันทึก...";
  }

  try {
    const payload = {
      code: $("#productCode")?.value.trim() || "",
      name: $("#productName")?.value.trim() || "",
      description: $("#productDescription")?.value.trim() || "",
      default_unit: $("#productUnit")?.value.trim() || "คัน",
      is_active: $("#productIsActive")?.checked ?? true,
    };

    if (!payload.code || !payload.name || !payload.default_unit) {
      throw new Error("กรุณากรอก Code, ชื่อสินค้า/บริการ และหน่วย");
    }

    const { data: productsForNameCheck, error: nameCheckError } = await supabaseClient
      .from("products")
      .select("id, name");

    if (nameCheckError) throw nameCheckError;

    const normalizedName = normalizeProductNameV16(payload.name);
    const duplicatedName = (productsForNameCheck || []).find((item) => {
      if (mode === "edit" && item.id === productId) return false;
      return normalizeProductNameV16(item.name) === normalizedName;
    });

    if (duplicatedName) {
      throw new Error("ชื่อสินค้า/บริการนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น");
    }

    if (mode === "edit") {
      const { error } = await supabaseClient
        .from("products")
        .update(payload)
        .eq("id", productId);
      if (error) throw error;
    } else {
      const { error } = await supabaseClient
        .from("products")
        .insert(payload);
      if (error) throw error;
    }

    showToast("บันทึกสินค้า/บริการสำเร็จ", "success");
    location.hash = "#products";
  } catch (error) {
    console.error(error);
    const duplicateMessage = isProductNameDuplicateErrorV16(error)
      ? "ชื่อสินค้า/บริการนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น"
      : error.message || "ไม่สามารถบันทึกสินค้า/บริการได้";
    showToast(duplicateMessage, "error", { duration: 5200 });
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = "บันทึก";
    }
  }
}

function normalizeProductNameV16(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function isProductNameDuplicateErrorV16(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === "23505" || message.includes("products_name_unique") || message.includes("duplicate key");
}

async function exportQuotationsXlsx(rows) {
  if (!rows?.length) {
    showToast("ไม่มีข้อมูลสำหรับ Export", "warning");
    return;
  }

  if (!window.XLSX) {
    showToast("ไม่พบ Excel library กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่", "error", { duration: 5200 });
    return;
  }

  await withAction("export-quotations-xlsx-v16", async () => {
    showPageBusy("กำลังสร้าง Excel Report...");

    const ids = rows.map((row) => row.id).filter(Boolean);
    const [quotationsResult, itemsResult] = await Promise.all([
      supabaseClient
        .from("quotations")
        .select("id, quotation_no, status, billing_type, customer_name, quote_date, valid_until, sent_at, paid_at, cancelled_reason, vat_enabled, vat_rate, wht_enabled, wht_rate, discount_percent, rounding_enabled, subtotal_amount, discount_amount, taxable_amount, vat_amount, wht_amount, rounding_adjustment, grand_total_display, created_at, updated_at")
        .in("id", ids),
      supabaseClient
        .from("quotation_items")
        .select("id, quotation_id, section_type, product_id, product_name_snapshot, description, quantity, unit, unit_price, line_subtotal, sort_order")
        .in("quotation_id", ids)
        .order("quotation_id", { ascending: true })
        .order("section_type", { ascending: false })
        .order("sort_order", { ascending: true }),
    ]);

    if (quotationsResult.error) throw quotationsResult.error;
    if (itemsResult.error) throw itemsResult.error;

    const quotationById = new Map((quotationsResult.data || []).map((item) => [item.id, item]));
    const items = itemsResult.data || [];
    const itemsByQuotation = groupByV16(items, "quotation_id");

    const productIds = Array.from(new Set(items.map((item) => item.product_id).filter(Boolean)));
    const productById = new Map();
    if (productIds.length) {
      const { data: products, error: productsError } = await supabaseClient
        .from("products")
        .select("id, code, name")
        .in("id", productIds);
      if (productsError) throw productsError;
      (products || []).forEach((product) => productById.set(product.id, product));
    }

    const exportRows = rows.map((row) => {
      const quotation = { ...(quotationById.get(row.id) || {}), ...row };
      const sectionItems = itemsByQuotation.get(row.id) || [];
      const sectionMap = buildSectionTotalsForExportV16(quotation, sectionItems);
      return {
        ...row,
        _quotation: quotation,
        _items: sectionItems,
        _recurringTotal: sectionMap.get("recurring")?.net_total_display || 0,
        _oneTimeTotal: sectionMap.get("one_time")?.net_total_display || 0,
      };
    });

    const workbook = XLSX.utils.book_new();
    appendSheetV16(workbook, "Summary", buildExcelSummaryRowsV16(exportRows));
    appendSheetV16(workbook, "Quotations", buildExcelQuotationRowsV16(exportRows));
    appendSheetV16(workbook, "Items", buildExcelItemRowsV16(exportRows, itemsByQuotation, productById));
    appendSheetV16(workbook, "By Sales", buildExcelBySalesRowsV16(exportRows));
    appendSheetV16(workbook, "By Status", buildExcelByStatusRowsV16(exportRows));

    XLSX.writeFile(workbook, `fi-quotation-report-${toDateInputValue(new Date())}.xlsx`);
    showToast(`Export Excel สำเร็จ ${number(rows.length)} รายการ`, "success");
  });
}

function appendSheetV16(workbook, sheetName, rows) {
  const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ รายละเอียด: "ไม่มีข้อมูล" }], { skipHeader: false });
  worksheet["!cols"] = inferSheetColumnsV16(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}

function inferSheetColumnsV16(rows) {
  if (!rows?.length) return [{ wch: 24 }];
  const keys = Object.keys(rows[0]);
  return keys.map((key) => {
    const max = Math.max(
      String(key).length,
      ...rows.slice(0, 200).map((row) => String(row[key] ?? "").length)
    );
    return { wch: Math.min(Math.max(max + 2, 12), 42) };
  });
}

function buildSectionTotalsForExportV16(quotation, items) {
  const recurringItems = items.filter((item) => item.section_type === "recurring");
  const oneTimeItems = items.filter((item) => item.section_type === "one_time");
  const map = new Map();

  if (recurringItems.length) {
    map.set("recurring", calculatePrintSectionTotalsFromItemsV15(quotation, {
      section_type: "recurring",
      section_title: quotation.billing_type === "yearly" ? "ค่าบริการใช้งานรายปี" : "ค่าบริการใช้งานรายเดือน",
      section_subtitle: "",
    }, recurringItems));
  }

  if (oneTimeItems.length) {
    map.set("one_time", calculatePrintSectionTotalsFromItemsV15(quotation, {
      section_type: "one_time",
      section_title: "ค่าบริการครั้งเดียว (ค่าแรกเข้า)",
      section_subtitle: "",
    }, oneTimeItems));
  }

  return map;
}

function buildExcelSummaryRowsV16(rows) {
  const filters = appState.quotationFilters || {};
  const counts = countByV16(rows, (row) => statusLabel(row.effective_status || row.status));
  const sentAmount = sumByV16(rows.filter((row) => (row.effective_status || row.status) === "sent"), "grand_total_display");
  const paidAmount = sumByV16(rows.filter((row) => (row.effective_status || row.status) === "paid"), "grand_total_display");

  const result = [
    { หัวข้อ: "Export เมื่อ", ค่า: new Date().toLocaleString("th-TH") },
    { หัวข้อ: "ผู้ Export", ค่า: appState.profile?.full_name || appState.profile?.email || "-" },
    { หัวข้อ: "ช่วงวันที่เสนอราคา", ค่า: formatRangeLabel(filters.quoteFrom, filters.quoteTo) },
    { หัวข้อ: "ช่วงวันหมดอายุ", ค่า: formatRangeLabel(filters.validFrom, filters.validTo) },
    { หัวข้อ: "สถานะที่กรอง", ค่า: filters.status ? statusLabel(filters.status) : "ทุกสถานะ" },
    { หัวข้อ: "ประเภทที่กรอง", ค่า: filters.billingType ? billingTypeLabel(filters.billingType) : "ทุกประเภท" },
    { หัวข้อ: "จำนวนใบเสนอราคา", ค่า: rows.length },
    { หัวข้อ: "ยอดสถานะส่งแล้ว", ค่า: sentAmount },
    { หัวข้อ: "ยอดสถานะชำระเงินแล้ว", ค่า: paidAmount },
  ];

  Object.entries(counts).forEach(([status, count]) => {
    result.push({ หัวข้อ: `จำนวนสถานะ ${status}`, ค่า: count });
  });

  return result;
}

function buildExcelQuotationRowsV16(rows) {
  return rows.map((row) => ({
    "เลขที่ใบเสนอราคา": row.quotation_no || "ยังไม่ออกเลข",
    สถานะ: statusLabel(row.effective_status || row.status),
    ลูกค้า: row.customer_name || "",
    ฝ่ายขาย: row.owner_name || "",
    ประเภท: billingTypeLabel(row.billing_type),
    "วันที่เสนอราคา": row.quote_date || "",
    "วันหมดอายุ": row.valid_until || "",
    "วันที่ส่ง": row.sent_at || "",
    "วันที่ชำระเงิน": row.paid_at || "",
    "ยอดรายเดือน/รายปี": Number(row._recurringTotal || 0),
    "ยอดครั้งเดียว": Number(row._oneTimeTotal || 0),
    "ยอดรวมสุทธิ": Number(row.grand_total_display || 0),
    VAT: Number(row.vat_amount || 0),
    "หัก ณ ที่จ่าย": Number(row.wht_amount || 0),
    ส่วนลด: Number(row.discount_amount || 0),
    "เหตุผลยกเลิก": row.cancelled_reason || "",
    "วันที่สร้าง": row.created_at || "",
    "วันที่แก้ไขล่าสุด": row.updated_at || "",
  }));
}

function buildExcelItemRowsV16(rows, itemsByQuotation, productById) {
  const result = [];
  rows.forEach((row) => {
    const items = itemsByQuotation.get(row.id) || [];
    items.forEach((item) => {
      const product = item.product_id ? productById.get(item.product_id) : null;
      result.push({
        "เลขที่ใบเสนอราคา": row.quotation_no || "ยังไม่ออกเลข",
        ลูกค้า: row.customer_name || "",
        ฝ่ายขาย: row.owner_name || "",
        Section: item.section_type === "recurring" ? billingTypeLabel(row.billing_type) : "ครั้งเดียว",
        "รหัสสินค้า": product?.code || "",
        "ชื่อสินค้า/บริการ": item.product_name_snapshot || product?.name || "",
        รายละเอียด: item.description || "",
        จำนวน: Number(item.quantity || 0),
        หน่วย: item.unit || "",
        "ราคา/หน่วย": Number(item.unit_price || 0),
        "มูลค่าก่อนภาษี": Number(getItemLineSubtotalV15(item) || 0),
      });
    });
  });
  return result;
}

function buildExcelBySalesRowsV16(rows) {
  const groups = groupByFunctionV16(rows, (row) => row.owner_name || "ไม่ระบุฝ่ายขาย");
  return Array.from(groups.entries()).map(([sales, items]) => {
    const sentRows = items.filter((row) => (row.effective_status || row.status) === "sent");
    const paidRows = items.filter((row) => (row.effective_status || row.status) === "paid");
    const sentAmount = sumByV16(sentRows, "grand_total_display");
    const paidAmount = sumByV16(paidRows, "grand_total_display");
    return {
      ฝ่ายขาย: sales,
      "จำนวนใบเสนอราคา": items.length,
      "จำนวนส่งแล้ว": sentRows.length,
      "จำนวนชำระเงินแล้ว": paidRows.length,
      "ยอดส่งแล้ว": sentAmount,
      "ยอดชำระเงินแล้ว": paidAmount,
      "Conversion โดยยอด (%)": sentAmount > 0 ? roundMoney((paidAmount / sentAmount) * 100) : 0,
    };
  }).sort((a, b) => String(a.ฝ่ายขาย).localeCompare(String(b.ฝ่ายขาย), "th"));
}

function buildExcelByStatusRowsV16(rows) {
  const groups = groupByFunctionV16(rows, (row) => statusLabel(row.effective_status || row.status));
  return Array.from(groups.entries()).map(([status, items]) => ({
    สถานะ: status,
    "จำนวนเอกสาร": items.length,
    "ยอดรวม": sumByV16(items, "grand_total_display"),
  }));
}

function groupByV16(items, key) {
  const map = new Map();
  (items || []).forEach((item) => {
    const value = item[key];
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(item);
  });
  return map;
}

function groupByFunctionV16(items, getter) {
  const map = new Map();
  (items || []).forEach((item) => {
    const value = getter(item);
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(item);
  });
  return map;
}

function countByV16(items, getter) {
  const result = {};
  (items || []).forEach((item) => {
    const key = getter(item);
    result[key] = (result[key] || 0) + 1;
  });
  return result;
}

function sumByV16(items, key) {
  return roundMoney((items || []).reduce((sum, item) => sum + Number(item[key] || 0), 0));
}

// =======================================================
// v1.6.2 Auth Boot Fix
// Resume/session recovery must not block data rendering.
// This block intentionally sits at the end of the file so these
// function declarations override older appended release blocks.
// =======================================================

const FI_APP_VERSION = "1.6.2";
const FI_RENDER_TIMEOUT_MS_V161 = 30000;
const FI_SESSION_TIMEOUT_MS_V161 = 18000;
const FI_RESUME_DEBOUNCE_MS_V161 = 1800;

Object.assign(appState, {
  appVersion: FI_APP_VERSION,
  renderSeqV161: 0,
  resumeInProgressV161: false,
  lastResumeAttemptAtV161: 0,
  lastSuccessfulRenderAtV161: 0,
});

function timeoutPromiseV161(timeoutMs, label) {
  return new Promise((_, reject) => {
    window.setTimeout(() => {
      reject(new Error(`${label || "การทำงาน"}ใช้เวลานานเกินไป กรุณากดโหลดข้อมูลใหม่`));
    }, timeoutMs);
  });
}

async function withTimeoutV161(promise, timeoutMs, label) {
  return Promise.race([promise, timeoutPromiseV161(timeoutMs, label)]);
}

function isAppAuthenticatedV161() {
  return Boolean(appState.user?.id && appState.profile?.id);
}

function hasVisibleLoadingV161() {
  return Boolean(elements.pageContent?.querySelector?.(".loading-card, .skeleton-card, .page-loading-card"));
}

function hideBootPage() {
  document.querySelector("#bootPage")?.classList.add("hidden");
}

function showBootPage() {
  document.querySelector("#bootPage")?.classList.remove("hidden");
}

function showLoginPage() {
  hideBootPage();
  elements.loginPage?.classList.remove("hidden");
  elements.appShell?.classList.add("hidden");
}

function showAppShell() {
  hideBootPage();
  elements.loginPage?.classList.add("hidden");
  elements.appShell?.classList.remove("hidden");

  if (appState.profile) {
    if (elements.userName) elements.userName.textContent = appState.profile.full_name || appState.profile.email || "-";
    if (elements.userRole) elements.userRole.textContent = roleLabel(appState.profile.role);
  }

  renderMenu();
  if (!location.hash) location.hash = "#dashboard";
  appState.currentPage = getPageFromHash();

  updateHeaderUser?.();
  applySystemBrandingToHeader?.();
}

function renderLoading(message = "กำลังโหลดข้อมูล...") {
  if (!elements.pageContent) return;
  elements.pageContent.innerHTML = `
    <div class="loading-card page-loading-card" data-loading-start="${Date.now()}" data-version="${FI_APP_VERSION}">
      <div class="spinner"></div>
      <strong>${escapeHTML(message)}</strong>
      <p>ระบบกำลังดึงข้อมูล หากใช้เวลานานเกินไปจะแสดงปุ่มโหลดข้อมูลใหม่</p>
    </div>
  `;
}

function renderError(message) {
  renderErrorStateWithRetry(message || "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
}

function renderErrorStateWithRetry(message, buttonText = "โหลดข้อมูลใหม่") {
  if (!elements.pageContent) return;
  elements.pageContent.innerHTML = `
    <div class="card error-state-card render-retry-card" data-version="${FI_APP_VERSION}">
      <div>
        <h3>โหลดข้อมูลไม่สำเร็จ</h3>
        <p>${escapeHTML(message || "ไม่สามารถโหลดข้อมูลได้")}</p>
        <small>ระบบจะลองโหลดหน้าเดิมใหม่โดยไม่ต้องรีเฟรช Browser</small>
      </div>
      <button type="button" class="btn btn-primary" id="retryCurrentPageButton">${escapeHTML(buttonText)}</button>
    </div>
  `;

  document.querySelector("#retryCurrentPageButton")?.addEventListener("click", async () => {
    await recoverAppAfterResume("manual-retry");
  });
}

async function initApp() {
  showBootPage();

  if (!isConfigured) {
    hideBootPage();
    showLoginPage();
    showSetupWarningOnLogin();
    return;
  }

  bindEvents();
  startRequiredStarObserverV16?.();

  try {
    await loadAndApplyAppBranding?.();
  } catch (brandingError) {
    console.warn("Branding skipped during init", brandingError);
  }

  try {
    const { data, error } = await withTimeoutV161(
      supabaseClient.auth.getSession(),
      FI_SESSION_TIMEOUT_MS_V161,
      "การตรวจสอบ session"
    );
    if (error) throw error;

    if (data?.session?.user) {
      appState.user = data.session.user;
      await withTimeoutV161(loadProfile(), FI_SESSION_TIMEOUT_MS_V161, "การโหลดข้อมูลผู้ใช้");
      showAppShell();
      await renderCurrentPage({ force: true, reason: "initial-session" });
    } else {
      hideBootPage();
      showLoginPage();
    }
  } catch (error) {
    console.error("initApp v1.6.2", error);
    hideBootPage();
    showLoginPage();
    showLoginError("ไม่สามารถตรวจสอบ session ได้ กรุณาลองเข้าสู่ระบบใหม่");
  }

  bindAuthListenerV161();
}

function bindAuthListenerV161() {
  if (window.__fiAuthListenerV161 || !supabaseClient) return;
  window.__fiAuthListenerV161 = true;

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === "TOKEN_REFRESHED" && session?.user) {
      appState.user = session.user;
      return;
    }

    if (event === "SIGNED_OUT") {
      appState.user = null;
      appState.profile = null;
      appState.selectedQuotationIds?.clear?.();
      hidePageBusy?.();
      showLoginPage();
      return;
    }

    if (session?.user && !isAppAuthenticatedV161()) {
      appState.user = session.user;
      try {
        await loadProfile();
        showAppShell();
        await renderCurrentPage({ force: true, reason: `auth-${event}` });
      } catch (error) {
        console.error("auth listener v1.6.2", error);
        showToast("โหลดข้อมูลผู้ใช้ไม่สำเร็จ", "error");
      }
    }
  });
}

async function renderCurrentPage(options = {}) {
  const token = ++appState.renderSeqV161;
  appState.currentPage = getPageFromHash();

  if (!isAppAuthenticatedV161()) {
    try {
      const { data, error } = await withTimeoutV161(
        supabaseClient.auth.getSession(),
        FI_SESSION_TIMEOUT_MS_V161,
        "การตรวจสอบ session"
      );
      if (error) throw error;
      if (!data?.session?.user) {
        showLoginPage();
        return;
      }
      appState.user = data.session.user;
      await withTimeoutV161(loadProfile(), FI_SESSION_TIMEOUT_MS_V161, "การโหลดข้อมูลผู้ใช้");
      showAppShell();
    } catch (error) {
      console.error("renderCurrentPage session bootstrap v1.6.2", error);
      hidePageBusy?.();
      renderErrorStateWithRetry("ไม่สามารถตรวจสอบ session ได้ กรุณากดโหลดข้อมูลใหม่");
      return;
    }
  }

  showAppShell();
  renderMenu();
  updateHeaderUser?.();
  hidePageBusy?.();

  const page = appState.currentPage || "dashboard";
  const watchdogId = window.setTimeout(() => {
    if (appState.renderSeqV161 !== token) return;
    if (hasVisibleLoadingV161()) {
      renderErrorStateWithRetry("โหลดข้อมูลนานเกินไปหรือการเชื่อมต่อค้าง กรุณากดโหลดข้อมูลใหม่");
    }
  }, FI_RENDER_TIMEOUT_MS_V161 + 1500);

  try {
    await withTimeoutV161(renderPageByKeyV161(page), FI_RENDER_TIMEOUT_MS_V161, `การโหลดหน้า ${page}`);
    if (appState.renderSeqV161 !== token) return;

    appState.lastSuccessfulRenderAtV161 = Date.now();
    appState.lastSuccessfulRenderAt = Date.now();

    if (!elements.pageContent?.textContent?.trim()) {
      throw new Error("หน้าเว็บแสดงผลว่างหลังโหลดข้อมูล");
    }

    decorateRequiredStars?.();
  } catch (error) {
    if (appState.renderSeqV161 !== token) return;
    console.error("renderCurrentPage v1.6.2", page, error);
    hidePageBusy?.();
    renderErrorStateWithRetry(error.message || "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
  } finally {
    window.clearTimeout(watchdogId);
    hidePageBusy?.();
  }
}

async function renderPageByKeyV161(page) {
  if (page === "dashboard") return renderDashboardPage();
  if (page === "quotations") return renderQuotationsPage();
  if (page === "quotation-new") return renderQuotationCreatePage();
  if (page.startsWith("quotation-edit/")) return renderQuotationEditPage(page.replace("quotation-edit/", ""));
  if (page.startsWith("quotation-view/")) return renderQuotationViewPage(page.replace("quotation-view/", ""));
  if (page.startsWith("quotation-print/")) return renderQuotationPrintPage(page.replace("quotation-print/", ""));
  if (page === "customers") return renderCustomersPage();
  if (page === "products") return renderProductsPage();
  if (page === "product-new") return renderProductFormPage({ mode: "create", productId: null });
  if (page.startsWith("product-edit/")) return renderProductFormPage({ mode: "edit", productId: page.replace("product-edit/", "") });
  if (page === "company") return renderCompanyPage();
  if (page === "settings") return renderSettingsPage();

  appState.currentPage = "dashboard";
  location.hash = "#dashboard";
  return renderDashboardPage();
}

async function recoverAppAfterResume(reason = "resume") {
  if (!isConfigured || !supabaseClient) return;

  if (shouldSkipResumeRecoveryForFilePicker?.()) {
    releaseFilePickerInteraction?.(1800);
    return;
  }

  const now = Date.now();
  if (now - Number(appState.lastResumeAttemptAtV161 || 0) < FI_RESUME_DEBOUNCE_MS_V161) return;
  appState.lastResumeAttemptAtV161 = now;

  if (appState.resumeInProgressV161) return;
  appState.resumeInProgressV161 = true;

  try {
    hidePageBusy?.();
    appState.activeActions?.clear?.();
    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    // Important fix: if the app already has a valid in-memory user/profile,
    // render the current page first. Do not block rendering on getSession(),
    // because browser resume can delay Supabase session checks.
    if (isAppAuthenticatedV161()) {
      showAppShell();
      await renderCurrentPage({ force: true, reason: `resume-${reason}` });
      validateSessionInBackgroundV161(reason);
      schedulePostResumeGuardV161(reason);
      return;
    }

    const { data, error } = await withTimeoutV161(
      supabaseClient.auth.getSession(),
      FI_SESSION_TIMEOUT_MS_V161,
      "การตรวจสอบ session หลังกลับมาหน้าเว็บ"
    );
    if (error) throw error;

    if (!data?.session?.user) {
      appState.user = null;
      appState.profile = null;
      showLoginPage();
      showToast("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่", "warning", { duration: 4200 });
      return;
    }

    appState.user = data.session.user;
    await withTimeoutV161(loadProfile(), FI_SESSION_TIMEOUT_MS_V161, "การโหลดข้อมูลผู้ใช้");
    showAppShell();
    await renderCurrentPage({ force: true, reason: `resume-${reason}` });
    schedulePostResumeGuardV161(reason);
  } catch (error) {
    console.error("recoverAppAfterResume v1.6.2", reason, error);
    hidePageBusy?.();

    if (isAppAuthenticatedV161()) {
      await renderCurrentPage({ force: true, reason: `resume-fallback-${reason}` });
      return;
    }

    renderErrorStateWithRetry(error.message || "โหลดข้อมูลหลังกลับมาหน้าเว็บไม่สำเร็จ", "โหลดข้อมูลใหม่");
    showToast("โหลดข้อมูลใหม่ไม่สำเร็จ กรุณากดโหลดข้อมูลใหม่", "warning", { duration: 5200 });
  } finally {
    appState.resumeInProgressV161 = false;
  }
}

function validateSessionInBackgroundV161(reason) {
  window.setTimeout(async () => {
    try {
      const { data, error } = await withTimeoutV161(
        supabaseClient.auth.getSession(),
        FI_SESSION_TIMEOUT_MS_V161,
        "การตรวจสอบ session แบบเบื้องหลัง"
      );
      if (error) throw error;
      if (!data?.session?.user) {
        appState.user = null;
        appState.profile = null;
        showLoginPage();
        showToast("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่", "warning", { duration: 4200 });
      } else {
        appState.user = data.session.user;
      }
    } catch (error) {
      console.warn("background session validation skipped", reason, error);
    }
  }, 600);
}

function schedulePostResumeGuardV161(reason) {
  window.setTimeout(() => {
    if (shouldSkipResumeRecoveryForFilePicker?.()) return;
    if (hasVisibleLoadingV161() || !elements.pageContent?.textContent?.trim()) {
      renderCurrentPage({ force: true, reason: `${reason}-post-resume-guard` });
    }
  }, 1800);
}

function bindEvents() {
  if (elements.loginForm && !elements.loginForm.dataset.v161Bound) {
    elements.loginForm.dataset.v161Bound = "true";
    elements.loginForm.addEventListener("submit", handleLogin);
  }

  if (elements.logoutButton && !elements.logoutButton.dataset.v161Bound) {
    elements.logoutButton.dataset.v161Bound = "true";
    elements.logoutButton.addEventListener("click", handleLogout);
  }

  if (!window.__fiHashBoundV161) {
    window.__fiHashBoundV161 = true;
    window.addEventListener("hashchange", async () => {
      appState.currentPage = getPageFromHash();
      await renderCurrentPage({ force: true, reason: "hashchange" });
    });
  }

  if (!window.__fiDelegatedClickV161) {
    window.__fiDelegatedClickV161 = true;

    document.addEventListener("pointerdown", (event) => {
      if (isFileInputElement?.(event.target)) markFilePickerInteraction?.();
    }, true);

    document.addEventListener("click", (event) => {
      if (isFileInputElement?.(event.target)) markFilePickerInteraction?.();
      handleDelegatedClick?.(event);
    }, true);

    document.addEventListener("change", (event) => {
      if (isFileInputElement?.(event.target)) {
        releaseFilePickerInteraction?.(2200);
        return;
      }
      handleDelegatedChange?.(event);
    }, true);
  }

  if (!window.__fiLifecycleBoundV161) {
    window.__fiLifecycleBoundV161 = true;
    window.addEventListener("focus", () => recoverAppAfterResume("focus"));
    window.addEventListener("pageshow", (event) => recoverAppAfterResume(event.persisted ? "pageshow-cache" : "pageshow"));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") recoverAppAfterResume("visibilitychange");
    });
  }

  const mobileMenuButton = document.querySelector("#mobileMenuButton");
  if (mobileMenuButton && !mobileMenuButton.dataset.v161Bound) {
    mobileMenuButton.dataset.v161Bound = "true";
    mobileMenuButton.addEventListener("click", () => {
      elements.sidebarMenu?.classList.toggle("is-open");
    });
  }
}

// Re-apply required star styling after all final overrides are registered.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => decorateRequiredStars?.());
} else {
  decorateRequiredStars?.();
}

// =======================================================
// v1.6.2 Auth Boot Fix
// Fix: stale/invalid Supabase session must not show a fatal login error.
// Strategy:
// - Treat getSession failure during initial boot as a stale local session.
// - Clear only this Supabase project's auth keys and show a clean login page.
// - Show login errors only for real sign-in failure or profile-loading failure.
// - Keep resume recovery non-blocking when in-memory user/profile exists.
// =======================================================

const FI_AUTH_BOOT_FIX_VERSION = "1.6.2";
const FI_SESSION_TIMEOUT_MS_V162 = 12000;
const FI_RENDER_TIMEOUT_MS_V162 = 30000;
const FI_RESUME_DEBOUNCE_MS_V162 = 1800;

Object.assign(appState, {
  appVersion: FI_AUTH_BOOT_FIX_VERSION,
  renderSeqV162: 0,
  resumeInProgressV162: false,
  lastResumeAttemptAtV162: 0,
  lastSuccessfulRenderAtV162: 0,
});

function getSupabaseProjectRefV162() {
  try {
    return new URL(SUPABASE_URL).hostname.split(".")[0] || "";
  } catch (_error) {
    return "";
  }
}

function removeStorageKeysV162(storage, predicate) {
  if (!storage) return;

  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && predicate(key)) keys.push(key);
  }

  keys.forEach((key) => storage.removeItem(key));
}

function clearLocalAuthSessionV162() {
  const projectRef = getSupabaseProjectRefV162();
  if (!projectRef) return;

  const shouldRemove = (key) =>
    key === `sb-${projectRef}-auth-token` ||
    key === `sb-${projectRef}-auth-token-code-verifier` ||
    (key.startsWith(`sb-${projectRef}-`) && key.includes("auth")) ||
    (key.includes(projectRef) && key.includes("auth-token"));

  try { removeStorageKeysV162(window.localStorage, shouldRemove); } catch (error) { console.warn("localStorage auth clear skipped", error); }
  try { removeStorageKeysV162(window.sessionStorage, shouldRemove); } catch (error) { console.warn("sessionStorage auth clear skipped", error); }
}

function resetAuthStateV162() {
  appState.user = null;
  appState.profile = null;
  appState.selectedQuotationIds?.clear?.();
  hidePageBusy?.();
}

function showCleanLoginPageV162(options = {}) {
  const { message = "", showError = false } = options;
  resetAuthStateV162();
  showLoginPage();

  if (showError && message) {
    showLoginError(message);
  } else {
    hideLoginError?.();
  }
}

function isExpectedSessionBootErrorV162(error) {
  if (!error) return false;
  const message = String(error.message || error.name || error).toLowerCase();
  return (
    message.includes("session") ||
    message.includes("refresh") ||
    message.includes("token") ||
    message.includes("jwt") ||
    message.includes("auth") ||
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("failed") ||
    message.includes("fetch") ||
    message.includes("invalid") ||
    message.includes("expired")
  );
}

async function getSessionSafelyV162(label = "การตรวจสอบ session") {
  try {
    const { data, error } = await withTimeoutV161(
      supabaseClient.auth.getSession(),
      FI_SESSION_TIMEOUT_MS_V162,
      label
    );

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

async function bootAuthenticatedAppV162(session, reason = "boot") {
  appState.user = session.user;
  appState.profile = null;

  try {
    await withTimeoutV161(loadProfile(), FI_SESSION_TIMEOUT_MS_V162, "การโหลดข้อมูลผู้ใช้");
  } catch (profileError) {
    console.error(`loadProfile ${FI_AUTH_BOOT_FIX_VERSION}`, profileError);
    clearLocalAuthSessionV162();
    showCleanLoginPageV162({
      showError: true,
      message: "เข้าสู่ระบบได้แล้ว แต่ไม่สามารถโหลดข้อมูลผู้ใช้ได้ กรุณาติดต่อ Admin หรือเข้าสู่ระบบใหม่",
    });
    return;
  }

  hideLoginError?.();
  showAppShell();
  await renderCurrentPage({ force: true, reason });
}

async function initApp() {
  showBootPage();

  if (!isConfigured) {
    hideBootPage();
    showLoginPage();
    showSetupWarningOnLogin();
    return;
  }

  bindEvents();
  bindAuthListenerV162();
  startRequiredStarObserverV16?.();
  hideLoginError?.();

  try {
    await loadAndApplyAppBranding?.();
  } catch (brandingError) {
    console.warn("Branding skipped during init", brandingError);
  }

  const { data, error } = await getSessionSafelyV162("การตรวจสอบ session ตอนเปิดระบบ");

  if (error) {
    console.warn(`initApp ${FI_AUTH_BOOT_FIX_VERSION}: stored session is invalid; showing clean login`, error);
    if (isExpectedSessionBootErrorV162(error)) clearLocalAuthSessionV162();
    hideBootPage();
    showCleanLoginPageV162();
    return;
  }

  if (!data?.session?.user) {
    hideBootPage();
    showCleanLoginPageV162();
    return;
  }

  await bootAuthenticatedAppV162(data.session, "initial-session-v162");
}

function bindAuthListenerV162() {
  if (window.__fiAuthListenerV162 || !supabaseClient) return;
  window.__fiAuthListenerV162 = true;

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === "TOKEN_REFRESHED" && session?.user) {
      appState.user = session.user;
      return;
    }

    if (event === "SIGNED_OUT") {
      clearLocalAuthSessionV162();
      showCleanLoginPageV162();
      return;
    }

    if (session?.user && !isAppAuthenticatedV161()) {
      try {
        await bootAuthenticatedAppV162(session, `auth-${event}-v162`);
      } catch (error) {
        console.error(`auth listener ${FI_AUTH_BOOT_FIX_VERSION}`, error);
        showLoginError("เข้าสู่ระบบได้แล้ว แต่ไม่สามารถโหลดข้อมูลผู้ใช้ได้");
      }
    }
  });
}

async function handleLogin(event) {
  event.preventDefault();

  if (!supabaseClient) {
    showLoginError("ยังไม่ได้ตั้งค่า Supabase ใน script.js");
    return;
  }

  hideLoginError?.();
  clearLocalAuthSessionV162();

  const email = elements.loginEmail?.value?.trim() || "";
  const password = elements.loginPassword?.value || "";

  const executeLogin = async () => {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      showLoginError("อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      showToast?.("เข้าสู่ระบบไม่สำเร็จ", "error");
      return;
    }

    if (!data?.user) {
      showLoginError("ไม่พบข้อมูลผู้ใช้หลังเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง");
      return;
    }

    await bootAuthenticatedAppV162({ user: data.user }, "login-v162");
    showToast?.("เข้าสู่ระบบสำเร็จ", "success");
  };

  if (typeof withButtonLoading === "function") {
    await withButtonLoading(elements.loginButton, "กำลังเข้าสู่ระบบ...", executeLogin);
  } else {
    setLoginLoading?.(true);
    try { await executeLogin(); } finally { setLoginLoading?.(false); }
  }
}

async function renderCurrentPage(options = {}) {
  const token = ++appState.renderSeqV162;
  appState.currentPage = getPageFromHash();

  if (!isAppAuthenticatedV161()) {
    const { data, error } = await getSessionSafelyV162("การตรวจสอบ session ก่อนโหลดหน้า");

    if (error || !data?.session?.user) {
      if (error) console.warn(`renderCurrentPage ${FI_AUTH_BOOT_FIX_VERSION}: no valid session`, error);
      clearLocalAuthSessionV162();
      showCleanLoginPageV162();
      return;
    }

    await bootAuthenticatedAppV162(data.session, `bootstrap-${options.reason || "render"}-v162`);
    return;
  }

  showAppShell();
  renderMenu();
  updateHeaderUser?.();
  hidePageBusy?.();

  const page = appState.currentPage || "dashboard";
  const watchdogId = window.setTimeout(() => {
    if (appState.renderSeqV162 !== token) return;
    if (hasVisibleLoadingV161()) {
      renderErrorStateWithRetry("โหลดข้อมูลนานเกินไปหรือการเชื่อมต่อค้าง กรุณากดโหลดข้อมูลใหม่");
    }
  }, FI_RENDER_TIMEOUT_MS_V162 + 1500);

  try {
    await withTimeoutV161(renderPageByKeyV161(page), FI_RENDER_TIMEOUT_MS_V162, `การโหลดหน้า ${page}`);
    if (appState.renderSeqV162 !== token) return;

    appState.lastSuccessfulRenderAtV162 = Date.now();
    appState.lastSuccessfulRenderAtV161 = Date.now();
    appState.lastSuccessfulRenderAt = Date.now();

    if (!elements.pageContent?.textContent?.trim()) {
      throw new Error("หน้าเว็บแสดงผลว่างหลังโหลดข้อมูล");
    }

    decorateRequiredStars?.();
  } catch (error) {
    if (appState.renderSeqV162 !== token) return;
    console.error(`renderCurrentPage ${FI_AUTH_BOOT_FIX_VERSION}`, page, error);
    hidePageBusy?.();
    renderErrorStateWithRetry(error.message || "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
  } finally {
    window.clearTimeout(watchdogId);
    hidePageBusy?.();
  }
}

async function recoverAppAfterResume(reason = "resume") {
  if (!isConfigured || !supabaseClient) return;

  if (shouldSkipResumeRecoveryForFilePicker?.()) {
    releaseFilePickerInteraction?.(1800);
    return;
  }

  const now = Date.now();
  if (now - Number(appState.lastResumeAttemptAtV162 || 0) < FI_RESUME_DEBOUNCE_MS_V162) return;
  appState.lastResumeAttemptAtV162 = now;

  if (appState.resumeInProgressV162) return;
  appState.resumeInProgressV162 = true;

  try {
    hidePageBusy?.();
    appState.activeActions?.clear?.();
    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    if (isAppAuthenticatedV161()) {
      showAppShell();
      await renderCurrentPage({ force: true, reason: `resume-${reason}-v162` });
      validateSessionInBackgroundV162(reason);
      schedulePostResumeGuardV161?.(reason);
      return;
    }

    const { data, error } = await getSessionSafelyV162("การตรวจสอบ session หลังกลับมาหน้าเว็บ");

    if (error || !data?.session?.user) {
      if (error) console.warn(`recoverAppAfterResume ${FI_AUTH_BOOT_FIX_VERSION}: invalid session`, error);
      clearLocalAuthSessionV162();
      showCleanLoginPageV162();
      return;
    }

    await bootAuthenticatedAppV162(data.session, `resume-${reason}-v162`);
    schedulePostResumeGuardV161?.(reason);
  } catch (error) {
    console.error(`recoverAppAfterResume ${FI_AUTH_BOOT_FIX_VERSION}`, reason, error);
    hidePageBusy?.();

    if (isAppAuthenticatedV161()) {
      await renderCurrentPage({ force: true, reason: `resume-fallback-${reason}-v162` });
      return;
    }

    clearLocalAuthSessionV162();
    showCleanLoginPageV162();
  } finally {
    appState.resumeInProgressV162 = false;
  }
}

function validateSessionInBackgroundV162(reason) {
  window.setTimeout(async () => {
    const { data, error } = await getSessionSafelyV162("การตรวจสอบ session แบบเบื้องหลัง");

    if (error) {
      console.warn("background session validation skipped", reason, error);
      return;
    }

    if (!data?.session?.user) {
      clearLocalAuthSessionV162();
      showCleanLoginPageV162();
      showToast?.("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่", "warning", { duration: 4200 });
      return;
    }

    appState.user = data.session.user;
  }, 600);
}

// Ensure the final version marker is visible for debugging.
window.FI_APP_VERSION = FI_AUTH_BOOT_FIX_VERSION;


// =======================================================
// v1.7.0 Clean Stabilization Override
// Purpose: stabilize auth boot, profile loading, app shell render,
// and resume recovery without adding new features.
// This block overrides the final runtime entrypoints from older patches.
// =======================================================

const FI_STABILIZATION_VERSION = "1.7.0";
const FI_AUTH_TIMEOUT_MS_V17 = 20000;
const FI_RENDER_TIMEOUT_MS_V17 = 35000;
const FI_RESUME_DEBOUNCE_MS_V17 = 1800;

Object.assign(appState, {
  appVersion: FI_STABILIZATION_VERSION,
  renderSeqV17: 0,
  resumeInProgressV17: false,
  lastResumeAttemptAtV17: 0,
  lastSuccessfulRenderAtV17: 0,
});

function delayV17(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function timeoutPromiseV17(timeoutMs, label) {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error(`${label || "การทำงาน"}ใช้เวลานานเกินไป กรุณากดโหลดข้อมูลใหม่`)), timeoutMs);
  });
}

function withTimeoutV17(promise, timeoutMs, label) {
  return Promise.race([promise, timeoutPromiseV17(timeoutMs, label)]);
}

function getProjectRefV17() {
  try {
    return new URL(SUPABASE_URL).hostname.split(".")[0] || "";
  } catch (_error) {
    return "";
  }
}

function clearAuthStorageV17() {
  const projectRef = getProjectRefV17();
  if (!projectRef) return;

  const shouldRemove = (key) =>
    key === `sb-${projectRef}-auth-token` ||
    key === `sb-${projectRef}-auth-token-code-verifier` ||
    (key.startsWith(`sb-${projectRef}-`) && key.toLowerCase().includes("auth")) ||
    (key.includes(projectRef) && key.toLowerCase().includes("auth-token"));

  [window.localStorage, window.sessionStorage].forEach((storage) => {
    try {
      const keys = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && shouldRemove(key)) keys.push(key);
      }
      keys.forEach((key) => storage.removeItem(key));
    } catch (error) {
      console.warn("clearAuthStorageV17 skipped", error);
    }
  });
}

function isAuthenticatedV17() {
  return Boolean(appState.user?.id && appState.profile?.id);
}

function showLoginPageCleanV17(options = {}) {
  const { message = "", showError = false } = options;
  appState.user = null;
  appState.profile = null;
  appState.selectedQuotationIds?.clear?.();
  hidePageBusy?.();
  hideBootPage?.();
  elements.loginPage?.classList.remove("hidden");
  elements.appShell?.classList.add("hidden");
  document.body.classList.remove("nav-open");

  if (showError && message) {
    showLoginError(message);
  } else {
    hideLoginError?.();
  }
}

// Compatibility shim for v1.4.2 branding call. Earlier v1.6.2 called this
// function, but it was not defined, causing ReferenceError after login.
function applySystemBrandingToHeader() {
  try {
    const branding = appState.appBranding || {};
    if (typeof applyHeaderLogo === "function") {
      applyHeaderLogo(branding.login_logo_url || "");
    }
    if (typeof applyFavicon === "function" && branding.favicon_url) {
      applyFavicon(branding.favicon_url);
    }
  } catch (error) {
    console.warn("applySystemBrandingToHeader skipped", error);
  }
}

function showAppShell() {
  hideBootPage?.();
  elements.loginPage?.classList.add("hidden");
  elements.appShell?.classList.remove("hidden");
  document.body.classList.remove("nav-open");

  if (appState.profile) {
    const fullName = appState.profile.full_name || appState.profile.email || "-";
    const roleText = roleLabel(appState.profile.role);

    if (elements.userName) elements.userName.textContent = fullName;
    if (elements.userRole) elements.userRole.textContent = roleText;

    const headerUserChip = document.querySelector("#headerUserChip");
    if (headerUserChip) {
      headerUserChip.textContent = `${fullName} · ${roleText}`;
      headerUserChip.title = `${fullName} · ${roleText}`;
    }
  }

  renderMenu?.();
  applySystemBrandingToHeader();

  if (!location.hash) location.hash = "#dashboard";
  appState.currentPage = getPageFromHash();
  hidePageBusy?.();
}

async function getSessionV17(label = "การตรวจสอบ session") {
  try {
    const { data, error } = await withTimeoutV17(supabaseClient.auth.getSession(), FI_AUTH_TIMEOUT_MS_V17, label);
    if (error) return { session: null, error };
    return { session: data?.session || null, error: null };
  } catch (error) {
    return { session: null, error };
  }
}

async function loadProfile() {
  if (!appState.user?.id) {
    throw new Error("ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
  }

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", appState.user.id)
    .maybeSingle();

  if (error) {
    console.error("loadProfile v1.7.0", error);

    if (String(error.code || "") === "42501" || String(error.message || "").toLowerCase().includes("permission denied")) {
      throw new Error("ไม่มีสิทธิ์อ่านข้อมูลผู้ใช้จากตาราง profiles กรุณารัน supabase/patch_v1_7_0.sql แล้วลองใหม่");
    }

    throw new Error(error.message || "ไม่สามารถโหลดข้อมูลผู้ใช้ได้");
  }

  if (!data) {
    throw new Error("ไม่พบข้อมูลผู้ใช้ในตาราง profiles กรุณาให้ Admin ตรวจสอบบัญชี");
  }

  if (data.is_active === false) {
    await supabaseClient.auth.signOut();
    throw new Error("บัญชีนี้ถูกปิดการใช้งาน");
  }

  appState.profile = data;
  return data;
}

async function bootAuthenticatedAppV17(session, reason = "boot") {
  if (!session?.user) {
    showLoginPageCleanV17();
    return;
  }

  appState.user = session.user;
  appState.profile = null;

  try {
    await withTimeoutV17(loadProfile(), FI_AUTH_TIMEOUT_MS_V17, "การโหลดข้อมูลผู้ใช้");
  } catch (error) {
    console.error(`bootAuthenticatedApp ${FI_STABILIZATION_VERSION}`, error);
    showLoginPageCleanV17({
      showError: true,
      message: error.message || "เข้าสู่ระบบได้แล้ว แต่ไม่สามารถโหลดข้อมูลผู้ใช้ได้",
    });
    return;
  }

  hideLoginError?.();
  showAppShell();
  await renderCurrentPage({ force: true, reason });
}

async function initApp() {
  showBootPage?.();

  if (!isConfigured) {
    showLoginPageCleanV17({ showError: true, message: "ยังไม่ได้ตั้งค่า Supabase URL และ anon key ในไฟล์ script.js" });
    return;
  }

  bindEvents();
  bindAuthListenerV17();
  startRequiredStarObserverV16?.();
  hideLoginError?.();

  try {
    if (typeof loadAndApplyAppBranding === "function") {
      await loadAndApplyAppBranding();
    }
  } catch (error) {
    console.warn("Branding skipped during init v1.7.0", error);
  }

  const { session, error } = await getSessionV17("การตรวจสอบ session ตอนเปิดระบบ");

  if (error) {
    console.warn("Stored session invalid; showing clean login v1.7.0", error);
    clearAuthStorageV17();
    showLoginPageCleanV17();
    return;
  }

  if (!session?.user) {
    showLoginPageCleanV17();
    return;
  }

  await bootAuthenticatedAppV17(session, "initial-session-v17");
}

function bindAuthListenerV17() {
  if (window.__fiAuthListenerV17 || !supabaseClient) return;
  window.__fiAuthListenerV17 = true;

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === "TOKEN_REFRESHED" && session?.user) {
      appState.user = session.user;
      return;
    }

    if (event === "SIGNED_OUT") {
      clearAuthStorageV17();
      showLoginPageCleanV17();
      return;
    }

    if (session?.user && !isAuthenticatedV17()) {
      await bootAuthenticatedAppV17(session, `auth-${event}-v17`);
    }
  });
}

function bindEvents() {
  if (elements.loginForm && !elements.loginForm.dataset.v17Bound) {
    elements.loginForm.dataset.v17Bound = "true";
    elements.loginForm.addEventListener("submit", handleLogin);
  }

  if (elements.logoutButton && !elements.logoutButton.dataset.v17Bound) {
    elements.logoutButton.dataset.v17Bound = "true";
    elements.logoutButton.addEventListener("click", handleLogout);
  }

  if (!window.__fiHashBoundV17) {
    window.__fiHashBoundV17 = true;
    window.addEventListener("hashchange", async () => {
      appState.currentPage = getPageFromHash();
      if (isAuthenticatedV17()) {
        await renderCurrentPage({ force: true, reason: "hashchange-v17" });
      }
    });
  }

  if (!window.__fiDelegatedClickV17) {
    window.__fiDelegatedClickV17 = true;

    document.addEventListener("pointerdown", (event) => {
      if (isFileInputElement?.(event.target)) markFilePickerInteraction?.();
    }, true);

    document.addEventListener("click", (event) => {
      if (isFileInputElement?.(event.target)) markFilePickerInteraction?.();
      handleDelegatedClick?.(event);
    }, true);

    document.addEventListener("change", (event) => {
      if (isFileInputElement?.(event.target)) {
        releaseFilePickerInteraction?.(2200);
        return;
      }
      handleDelegatedChange?.(event);
    }, true);
  }

  if (!window.__fiLifecycleBoundV17) {
    window.__fiLifecycleBoundV17 = true;
    window.addEventListener("focus", () => recoverAppAfterResume("focus"));
    window.addEventListener("pageshow", (event) => recoverAppAfterResume(event.persisted ? "pageshow-cache" : "pageshow"));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") recoverAppAfterResume("visibilitychange");
    });
  }

  const mobileMenuButton = document.querySelector("#mobileMenuButton");
  if (mobileMenuButton && !mobileMenuButton.dataset.v17Bound) {
    mobileMenuButton.dataset.v17Bound = "true";
    mobileMenuButton.addEventListener("click", () => elements.sidebarMenu?.classList.toggle("is-open"));
  }
}

async function handleLogin(event) {
  event.preventDefault();

  if (!supabaseClient) {
    showLoginError("ยังไม่ได้ตั้งค่า Supabase ใน script.js");
    return;
  }

  hideLoginError?.();

  const email = elements.loginEmail?.value?.trim() || "";
  const password = elements.loginPassword?.value || "";

  if (!email || !password) {
    showLoginError("กรุณากรอกอีเมลและรหัสผ่าน");
    return;
  }

  const executeLogin = async () => {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      showLoginError("อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      return;
    }

    if (!data?.user) {
      showLoginError("ไม่พบข้อมูลผู้ใช้หลังเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง");
      return;
    }

    await bootAuthenticatedAppV17({ user: data.user }, "login-v17");
    if (isAuthenticatedV17()) showToast?.("เข้าสู่ระบบสำเร็จ", "success");
  };

  if (typeof withButtonLoading === "function") {
    await withButtonLoading(elements.loginButton, "กำลังเข้าสู่ระบบ...", executeLogin);
  } else {
    setLoginLoading?.(true);
    try { await executeLogin(); } finally { setLoginLoading?.(false); }
  }
}

async function handleLogout() {
  if (!supabaseClient) return;

  const ok = window.confirm("ต้องการออกจากระบบใช่ไหม?");
  if (!ok) return;

  try {
    await supabaseClient.auth.signOut();
  } finally {
    clearAuthStorageV17();
    showLoginPageCleanV17();
    showToast?.("ออกจากระบบแล้ว", "success");
  }
}

async function renderCurrentPage(options = {}) {
  const token = ++appState.renderSeqV17;
  appState.currentPage = getPageFromHash() || "dashboard";

  if (!isAuthenticatedV17()) {
    const { session, error } = await getSessionV17("การตรวจสอบ session ก่อนโหลดหน้า");

    if (error || !session?.user) {
      if (error) console.warn("renderCurrentPage no valid session v1.7.0", error);
      clearAuthStorageV17();
      showLoginPageCleanV17();
      return;
    }

    await bootAuthenticatedAppV17(session, `bootstrap-${options.reason || "render"}-v17`);
    return;
  }

  showAppShell();
  renderMenu?.();
  applySystemBrandingToHeader();
  hidePageBusy?.();

  const page = appState.currentPage || "dashboard";

  const watchdogId = window.setTimeout(() => {
    if (appState.renderSeqV17 !== token) return;
    if (hasVisibleLoadingV161?.()) {
      renderErrorStateWithRetry?.("โหลดข้อมูลนานเกินไปหรือการเชื่อมต่อค้าง กรุณากดโหลดข้อมูลใหม่");
    }
  }, FI_RENDER_TIMEOUT_MS_V17 + 1500);

  try {
    await withTimeoutV17(renderPageByKeyV161(page), FI_RENDER_TIMEOUT_MS_V17, `การโหลดหน้า ${page}`);
    if (appState.renderSeqV17 !== token) return;

    appState.lastSuccessfulRenderAtV17 = Date.now();
    appState.lastSuccessfulRenderAt = Date.now();

    if (!elements.pageContent?.textContent?.trim()) {
      throw new Error("หน้าเว็บแสดงผลว่างหลังโหลดข้อมูล");
    }

    decorateRequiredStars?.();
  } catch (error) {
    if (appState.renderSeqV17 !== token) return;
    console.error("renderCurrentPage v1.7.0", page, error);
    hidePageBusy?.();
    renderErrorStateWithRetry?.(error.message || "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
  } finally {
    window.clearTimeout(watchdogId);
    hidePageBusy?.();
  }
}

async function recoverAppAfterResume(reason = "resume") {
  if (!isConfigured || !supabaseClient || document.visibilityState === "hidden") return;

  if (shouldSkipResumeRecoveryForFilePicker?.()) {
    releaseFilePickerInteraction?.(1800);
    return;
  }

  const now = Date.now();
  if (now - Number(appState.lastResumeAttemptAtV17 || 0) < FI_RESUME_DEBOUNCE_MS_V17) return;
  appState.lastResumeAttemptAtV17 = now;

  if (appState.resumeInProgressV17) return;
  appState.resumeInProgressV17 = true;

  try {
    hidePageBusy?.();
    appState.activeActions?.clear?.();
    await delayV17(0);

    if (isAuthenticatedV17()) {
      showAppShell();
      await renderCurrentPage({ force: true, reason: `resume-${reason}-v17` });
      validateSessionInBackgroundV17(reason);
      return;
    }

    const { session, error } = await getSessionV17("การตรวจสอบ session หลังกลับมาหน้าเว็บ");

    if (error || !session?.user) {
      if (error) console.warn("recover invalid session v1.7.0", error);
      clearAuthStorageV17();
      showLoginPageCleanV17();
      return;
    }

    await bootAuthenticatedAppV17(session, `resume-${reason}-v17`);
  } catch (error) {
    console.error("recoverAppAfterResume v1.7.0", reason, error);
    hidePageBusy?.();

    if (isAuthenticatedV17()) {
      await renderCurrentPage({ force: true, reason: `resume-fallback-${reason}-v17` });
      return;
    }

    showLoginPageCleanV17();
  } finally {
    appState.resumeInProgressV17 = false;
  }
}

function validateSessionInBackgroundV17(reason) {
  window.setTimeout(async () => {
    const { session, error } = await getSessionV17("การตรวจสอบ session แบบเบื้องหลัง");

    if (error) {
      console.warn("background session validation skipped v1.7.0", reason, error);
      return;
    }

    if (!session?.user) {
      clearAuthStorageV17();
      showLoginPageCleanV17();
      showToast?.("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่", "warning", { duration: 4200 });
      return;
    }

    appState.user = session.user;
  }, 800);
}

window.FI_APP_VERSION = FI_STABILIZATION_VERSION;

// =======================================================
// v1.7.1 Auth Session Guard + Profiles RLS Fix
// Purpose: prevent profiles query from being sent as anon after browser refresh.
// This block overrides the v1.7.0 boot/auth/profile/runtime entrypoints.
// =======================================================

const FI_AUTH_SESSION_GUARD_VERSION = "1.7.1";
const FI_AUTH_TIMEOUT_MS_V171 = 24000;
const FI_RENDER_TIMEOUT_MS_V171 = 36000;
const FI_RESUME_DEBOUNCE_MS_V171 = 1800;

Object.assign(appState, {
  appVersion: FI_AUTH_SESSION_GUARD_VERSION,
  renderSeqV171: 0,
  resumeInProgressV171: false,
  lastResumeAttemptAtV171: 0,
  lastSuccessfulRenderAtV171: 0,
});

function delayV171(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function timeoutPromiseV171(timeoutMs, label) {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error(`${label || "การทำงาน"}ใช้เวลานานเกินไป กรุณากดโหลดข้อมูลใหม่`)), timeoutMs);
  });
}

function withTimeoutV171(promise, timeoutMs, label) {
  return Promise.race([promise, timeoutPromiseV171(timeoutMs, label)]);
}

function isUsableSessionV171(session) {
  return Boolean(session?.access_token && session?.user?.id);
}

function isAuthMissingErrorV171(error) {
  return String(error?.message || error || "") === "AUTH_SESSION_MISSING" ||
    String(error?.code || "") === "AUTH_SESSION_MISSING";
}

async function getSessionV171(label = "การตรวจสอบ session") {
  if (!supabaseClient) return { session: null, error: new Error("SUPABASE_NOT_CONFIGURED") };

  try {
    const { data, error } = await withTimeoutV171(
      supabaseClient.auth.getSession(),
      FI_AUTH_TIMEOUT_MS_V171,
      label
    );

    if (error) return { session: null, error };
    return { session: data?.session || null, error: null };
  } catch (error) {
    return { session: null, error };
  }
}

function getProjectRefV171() {
  try {
    return new URL(SUPABASE_URL).hostname.split(".")[0] || "";
  } catch (_error) {
    return "";
  }
}

function clearAuthStorageV171() {
  const projectRef = getProjectRefV171();
  if (!projectRef) return;

  const shouldRemove = (key) =>
    key === `sb-${projectRef}-auth-token` ||
    key === `sb-${projectRef}-auth-token-code-verifier` ||
    (key.startsWith(`sb-${projectRef}-`) && key.toLowerCase().includes("auth")) ||
    (key.includes(projectRef) && key.toLowerCase().includes("auth-token"));

  [window.localStorage, window.sessionStorage].forEach((storage) => {
    try {
      const keys = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && shouldRemove(key)) keys.push(key);
      }
      keys.forEach((key) => storage.removeItem(key));
    } catch (error) {
      console.warn("clearAuthStorageV171 skipped", error);
    }
  });
}

function isAuthenticatedV17() {
  return Boolean(appState.user?.id && appState.profile?.id);
}

function showLoginPageCleanV17(options = {}) {
  const { message = "", showError = false } = options;

  appState.user = null;
  appState.profile = null;
  appState.selectedQuotationIds?.clear?.();

  hidePageBusy?.();
  hideBootPage?.();

  elements.loginPage?.classList.remove("hidden");
  elements.appShell?.classList.add("hidden");
  document.body.classList.remove("nav-open");

  if (showError && message) {
    showLoginError(message);
  } else {
    hideLoginError?.();
  }
}

function applySystemBrandingToHeader() {
  try {
    const branding = appState.appBranding || {};
    const loginLogoUrl = branding.login_logo_url || "";

    if (typeof applyHeaderLogo === "function") {
      applyHeaderLogo(loginLogoUrl);
    }

    const headerLogo = document.querySelector(".sidebar-brand .brand-mark.small, .app-brand .brand-mark.small");
    if (headerLogo && loginLogoUrl) {
      headerLogo.innerHTML = `<img src="${escapeHTML(loginLogoUrl)}" alt="Forward Insight" />`;
      headerLogo.classList.add("has-image");
    }

    if (typeof applyFavicon === "function" && branding.favicon_url) {
      applyFavicon(branding.favicon_url);
    }
  } catch (error) {
    console.warn("applySystemBrandingToHeader skipped", error);
  }
}

function showAppShell() {
  hideBootPage?.();
  elements.loginPage?.classList.add("hidden");
  elements.appShell?.classList.remove("hidden");
  document.body.classList.remove("nav-open");

  if (appState.profile) {
    const fullName = appState.profile.full_name || appState.profile.email || "-";
    const roleText = roleLabel(appState.profile.role);

    if (elements.userName) elements.userName.textContent = fullName;
    if (elements.userRole) elements.userRole.textContent = roleText;

    const headerUserChip = document.querySelector("#headerUserChip");
    if (headerUserChip) {
      headerUserChip.textContent = `${fullName} · ${roleText}`;
      headerUserChip.title = `${fullName} · ${roleText}`;
    }
  }

  renderMenu?.();
  applySystemBrandingToHeader();

  if (!location.hash) location.hash = "#dashboard";
  appState.currentPage = getPageFromHash();
  hidePageBusy?.();
}

async function loadProfile() {
  const { session, error: sessionError } = await getSessionV171("การตรวจสอบ session ก่อนโหลดข้อมูลผู้ใช้");

  if (sessionError) {
    console.warn("loadProfile v1.7.1 session check failed", sessionError);
  }

  if (!isUsableSessionV171(session)) {
    const error = new Error("AUTH_SESSION_MISSING");
    error.code = "AUTH_SESSION_MISSING";
    throw error;
  }

  appState.user = session.user;

  const { data, error } = await withTimeoutV171(
    supabaseClient
      .from("profiles")
      .select("id, email, full_name, role, is_active")
      .eq("id", session.user.id)
      .maybeSingle(),
    FI_AUTH_TIMEOUT_MS_V171,
    "การโหลดข้อมูลผู้ใช้"
  );

  if (error) {
    console.error("loadProfile v1.7.1", error);

    if (String(error.code || "") === "42501" || String(error.message || "").toLowerCase().includes("permission denied")) {
      throw new Error("ไม่มีสิทธิ์อ่านข้อมูลผู้ใช้จากตาราง profiles กรุณารัน supabase/patch_v1_7_1.sql แล้วลองใหม่");
    }

    throw new Error(error.message || "ไม่สามารถโหลดข้อมูลผู้ใช้ได้");
  }

  if (!data) {
    throw new Error("ไม่พบข้อมูลผู้ใช้ในตาราง profiles กรุณาให้ Admin ตรวจสอบบัญชี");
  }

  if (data.is_active === false) {
    await supabaseClient.auth.signOut();
    throw new Error("บัญชีนี้ถูกปิดการใช้งาน");
  }

  appState.profile = data;
  return data;
}

async function bootAuthenticatedAppV17(session, reason = "boot") {
  if (!isUsableSessionV171(session)) {
    showLoginPageCleanV17();
    return;
  }

  appState.user = session.user;
  appState.profile = null;

  try {
    await loadProfile();
  } catch (error) {
    console.error(`bootAuthenticatedApp ${FI_AUTH_SESSION_GUARD_VERSION}`, error);

    if (isAuthMissingErrorV171(error)) {
      clearAuthStorageV171();
      showLoginPageCleanV17();
      return;
    }

    showLoginPageCleanV17({
      showError: true,
      message: error.message || "เข้าสู่ระบบได้แล้ว แต่ไม่สามารถโหลดข้อมูลผู้ใช้ได้",
    });
    return;
  }

  hideLoginError?.();
  showAppShell();
  await renderCurrentPage({ force: true, reason });
}

async function initApp() {
  showBootPage?.();

  if (!isConfigured) {
    showLoginPageCleanV17({ showError: true, message: "ยังไม่ได้ตั้งค่า Supabase URL และ anon key ในไฟล์ script.js" });
    return;
  }

  bindEvents();
  bindAuthListenerV17();
  startRequiredStarObserverV16?.();
  hideLoginError?.();

  try {
    if (typeof loadAndApplyAppBranding === "function") {
      await loadAndApplyAppBranding();
    }
  } catch (error) {
    console.warn(`Branding skipped during init ${FI_AUTH_SESSION_GUARD_VERSION}`, error);
  }

  const { session, error } = await getSessionV171("การตรวจสอบ session ตอนเปิดระบบ");

  if (error) {
    console.warn(`Stored session check failed ${FI_AUTH_SESSION_GUARD_VERSION}; showing clean login`, error);
    showLoginPageCleanV17();
    return;
  }

  if (!isUsableSessionV171(session)) {
    showLoginPageCleanV17();
    return;
  }

  await bootAuthenticatedAppV17(session, "initial-session-v171");
}

function bindAuthListenerV17() {
  if (window.__fiAuthListenerV171 || !supabaseClient) return;
  window.__fiAuthListenerV171 = true;

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === "TOKEN_REFRESHED" && isUsableSessionV171(session)) {
      appState.user = session.user;
      return;
    }

    if (event === "SIGNED_OUT") {
      clearAuthStorageV171();
      showLoginPageCleanV17();
      return;
    }

    if (isUsableSessionV171(session) && !isAuthenticatedV17()) {
      await bootAuthenticatedAppV17(session, `auth-${event}-v171`);
    }
  });
}

function bindEvents() {
  if (elements.loginForm && !elements.loginForm.dataset.v171Bound) {
    elements.loginForm.dataset.v171Bound = "true";
    elements.loginForm.addEventListener("submit", handleLogin);
  }

  if (elements.logoutButton && !elements.logoutButton.dataset.v171Bound) {
    elements.logoutButton.dataset.v171Bound = "true";
    elements.logoutButton.addEventListener("click", handleLogout);
  }

  if (!window.__fiHashBoundV171) {
    window.__fiHashBoundV171 = true;
    window.addEventListener("hashchange", async () => {
      appState.currentPage = getPageFromHash();
      if (isAuthenticatedV17()) {
        await renderCurrentPage({ force: true, reason: "hashchange-v171" });
      }
    });
  }

  if (!window.__fiDelegatedClickV171) {
    window.__fiDelegatedClickV171 = true;

    document.addEventListener("pointerdown", (event) => {
      if (isFileInputElement?.(event.target)) markFilePickerInteraction?.();
    }, true);

    document.addEventListener("click", (event) => {
      if (isFileInputElement?.(event.target)) markFilePickerInteraction?.();
      handleDelegatedClick?.(event);
    }, true);

    document.addEventListener("change", (event) => {
      if (isFileInputElement?.(event.target)) {
        releaseFilePickerInteraction?.(2200);
        return;
      }
      handleDelegatedChange?.(event);
    }, true);
  }

  if (!window.__fiLifecycleBoundV171) {
    window.__fiLifecycleBoundV171 = true;
    window.addEventListener("focus", () => recoverAppAfterResume("focus"));
    window.addEventListener("pageshow", (event) => recoverAppAfterResume(event.persisted ? "pageshow-cache" : "pageshow"));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") recoverAppAfterResume("visibilitychange");
    });
  }

  const mobileMenuButton = document.querySelector("#mobileMenuButton");
  if (mobileMenuButton && !mobileMenuButton.dataset.v171Bound) {
    mobileMenuButton.dataset.v171Bound = "true";
    mobileMenuButton.addEventListener("click", () => elements.sidebarMenu?.classList.toggle("is-open"));
  }
}

async function handleLogin(event) {
  event.preventDefault();

  if (!supabaseClient) {
    showLoginError("ยังไม่ได้ตั้งค่า Supabase ใน script.js");
    return;
  }

  hideLoginError?.();

  const email = elements.loginEmail?.value?.trim() || "";
  const password = elements.loginPassword?.value || "";

  if (!email || !password) {
    showLoginError("กรุณากรอกอีเมลและรหัสผ่าน");
    return;
  }

  const executeLogin = async () => {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      showLoginError("อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      return;
    }

    const session = data?.session || (await getSessionV171("การตรวจสอบ session หลังเข้าสู่ระบบ")).session;

    if (!isUsableSessionV171(session)) {
      showLoginError("เข้าสู่ระบบสำเร็จแต่ยังไม่พบ session กรุณาลองใหม่อีกครั้ง");
      return;
    }

    await bootAuthenticatedAppV17(session, "login-v171");
    if (isAuthenticatedV17()) showToast?.("เข้าสู่ระบบสำเร็จ", "success");
  };

  if (typeof withButtonLoading === "function") {
    await withButtonLoading(elements.loginButton, "กำลังเข้าสู่ระบบ...", executeLogin);
  } else {
    setLoginLoading?.(true);
    try { await executeLogin(); } finally { setLoginLoading?.(false); }
  }
}

async function handleLogout() {
  if (!supabaseClient) return;

  const ok = window.confirm("ต้องการออกจากระบบใช่ไหม?");
  if (!ok) return;

  try {
    await supabaseClient.auth.signOut();
  } finally {
    clearAuthStorageV171();
    showLoginPageCleanV17();
    showToast?.("ออกจากระบบแล้ว", "success");
  }
}

async function renderCurrentPage(options = {}) {
  const token = ++appState.renderSeqV171;
  appState.currentPage = getPageFromHash() || "dashboard";

  if (!isAuthenticatedV17()) {
    const { session, error } = await getSessionV171("การตรวจสอบ session ก่อนโหลดหน้า");

    if (error || !isUsableSessionV171(session)) {
      if (error) console.warn(`renderCurrentPage no valid session ${FI_AUTH_SESSION_GUARD_VERSION}`, error);
      showLoginPageCleanV17();
      return;
    }

    await bootAuthenticatedAppV17(session, `bootstrap-${options.reason || "render"}-v171`);
    return;
  }

  showAppShell();
  renderMenu?.();
  applySystemBrandingToHeader();
  hidePageBusy?.();

  const page = appState.currentPage || "dashboard";

  const watchdogId = window.setTimeout(() => {
    if (appState.renderSeqV171 !== token) return;
    if (hasVisibleLoadingV161?.()) {
      renderErrorStateWithRetry?.("โหลดข้อมูลนานเกินไปหรือการเชื่อมต่อค้าง กรุณากดโหลดข้อมูลใหม่");
    }
  }, FI_RENDER_TIMEOUT_MS_V171 + 1500);

  try {
    await withTimeoutV171(renderPageByKeyV161(page), FI_RENDER_TIMEOUT_MS_V171, `การโหลดหน้า ${page}`);
    if (appState.renderSeqV171 !== token) return;

    appState.lastSuccessfulRenderAtV171 = Date.now();
    appState.lastSuccessfulRenderAt = Date.now();

    if (!elements.pageContent?.textContent?.trim()) {
      throw new Error("หน้าเว็บแสดงผลว่างหลังโหลดข้อมูล");
    }

    decorateRequiredStars?.();
  } catch (error) {
    if (appState.renderSeqV171 !== token) return;
    console.error(`renderCurrentPage ${FI_AUTH_SESSION_GUARD_VERSION}`, page, error);
    hidePageBusy?.();
    renderErrorStateWithRetry?.(error.message || "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
  } finally {
    window.clearTimeout(watchdogId);
    hidePageBusy?.();
  }
}

async function recoverAppAfterResume(reason = "resume") {
  if (!isConfigured || !supabaseClient || document.visibilityState === "hidden") return;

  if (shouldSkipResumeRecoveryForFilePicker?.()) {
    releaseFilePickerInteraction?.(1800);
    return;
  }

  const now = Date.now();
  if (now - Number(appState.lastResumeAttemptAtV171 || 0) < FI_RESUME_DEBOUNCE_MS_V171) return;
  appState.lastResumeAttemptAtV171 = now;

  if (appState.resumeInProgressV171) return;
  appState.resumeInProgressV171 = true;

  try {
    hidePageBusy?.();
    appState.activeActions?.clear?.();
    await delayV171(0);

    if (isAuthenticatedV17()) {
      showAppShell();
      await renderCurrentPage({ force: true, reason: `resume-${reason}-v171` });
      validateSessionInBackgroundV17(reason);
      return;
    }

    const { session, error } = await getSessionV171("การตรวจสอบ session หลังกลับมาหน้าเว็บ");

    if (error || !isUsableSessionV171(session)) {
      if (error) console.warn(`recover invalid session ${FI_AUTH_SESSION_GUARD_VERSION}`, error);
      showLoginPageCleanV17();
      return;
    }

    await bootAuthenticatedAppV17(session, `resume-${reason}-v171`);
  } catch (error) {
    console.error(`recoverAppAfterResume ${FI_AUTH_SESSION_GUARD_VERSION}`, reason, error);
    hidePageBusy?.();

    if (isAuthenticatedV17()) {
      await renderCurrentPage({ force: true, reason: `resume-fallback-${reason}-v171` });
      return;
    }

    showLoginPageCleanV17();
  } finally {
    appState.resumeInProgressV171 = false;
  }
}

function validateSessionInBackgroundV17(reason) {
  window.setTimeout(async () => {
    const { session, error } = await getSessionV171("การตรวจสอบ session แบบเบื้องหลัง");

    if (error) {
      console.warn(`background session validation skipped ${FI_AUTH_SESSION_GUARD_VERSION}`, reason, error);
      return;
    }

    if (!isUsableSessionV171(session)) {
      clearAuthStorageV171();
      showLoginPageCleanV17();
      showToast?.("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่", "warning", { duration: 4200 });
      return;
    }

    appState.user = session.user;
  }, 800);
}

window.FI_APP_VERSION = FI_AUTH_SESSION_GUARD_VERSION;

// =======================================================
// v1.7.2 Stability Fix
// Auth Boot Final Fix + Product Form Recursion Fix
// =======================================================

const FI_STABILITY_FIX_VERSION_V172 = "1.7.2";
window.FI_APP_VERSION = FI_STABILITY_FIX_VERSION_V172;
appState.appVersion = FI_STABILITY_FIX_VERSION_V172;
appState.pendingHashV172 = null;
appState.renderSeqV172 = 0;
appState.resumeInProgressV172 = false;
appState.lastResumeAttemptAtV172 = 0;

function isUsableSessionV172(session) {
  return Boolean(session?.access_token && session?.user?.id);
}

function isAuthMissingErrorV172(error) {
  return String(error?.message || error || "") === "AUTH_SESSION_MISSING" ||
    String(error?.code || "") === "AUTH_SESSION_MISSING";
}

async function getSessionV172() {
  if (!supabaseClient) return { session: null, error: new Error("SUPABASE_NOT_CONFIGURED") };

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) return { session: null, error };
    return { session: data?.session || null, error: null };
  } catch (error) {
    return { session: null, error };
  }
}

function isAuthenticatedV17() {
  return Boolean(appState.user?.id && appState.profile?.id);
}

function getCurrentHashV172() {
  return location.hash && location.hash !== "#" ? location.hash : "#dashboard";
}

function rememberPendingHashV172() {
  const hash = getCurrentHashV172();
  if (hash !== "#dashboard") appState.pendingHashV172 = hash;
}

function clearAuthStorageV172() {
  const projectRef = (() => {
    try { return new URL(SUPABASE_URL).hostname.split(".")[0] || ""; }
    catch (_error) { return ""; }
  })();

  if (!projectRef) return;

  const shouldRemove = (key) =>
    key === `sb-${projectRef}-auth-token` ||
    key === `sb-${projectRef}-auth-token-code-verifier` ||
    (key.startsWith(`sb-${projectRef}-`) && key.toLowerCase().includes("auth")) ||
    (key.includes(projectRef) && key.toLowerCase().includes("auth-token"));

  [window.localStorage, window.sessionStorage].forEach((storage) => {
    try {
      const keys = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && shouldRemove(key)) keys.push(key);
      }
      keys.forEach((key) => storage.removeItem(key));
    } catch (error) {
      console.warn("clearAuthStorageV172 skipped", error);
    }
  });
}

function showLoginPageCleanV17(options = {}) {
  const { message = "", showError = false, rememberHash = true } = options;

  if (rememberHash) rememberPendingHashV172();

  appState.user = null;
  appState.profile = null;
  appState.selectedQuotationIds?.clear?.();

  hidePageBusy?.();
  hideBootPage?.();

  elements.loginPage?.classList.remove("hidden");
  elements.appShell?.classList.add("hidden");
  document.body.classList.remove("nav-open");

  if (showError && message) showLoginError(message);
  else hideLoginError?.();
}

async function loadProfile(sessionArg = null) {
  const session = isUsableSessionV172(sessionArg)
    ? sessionArg
    : (await getSessionV172()).session;

  if (!isUsableSessionV172(session)) {
    const error = new Error("AUTH_SESSION_MISSING");
    error.code = "AUTH_SESSION_MISSING";
    throw error;
  }

  appState.user = session.user;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    console.error(`loadProfile ${FI_STABILITY_FIX_VERSION_V172}`, error);
    throw error;
  }

  if (!data) {
    throw new Error("ไม่พบข้อมูลผู้ใช้ในตาราง profiles กรุณาติดต่อ Admin");
  }

  if (data.is_active === false) {
    await supabaseClient.auth.signOut();
    throw new Error("บัญชีนี้ถูกปิดการใช้งาน");
  }

  appState.profile = data;
  return data;
}

function applySystemBrandingToHeader() {
  try {
    const branding = appState.appBranding || {};
    const loginLogoUrl = branding.login_logo_url || branding.logo_url || "";

    if (typeof applyHeaderLogo === "function") applyHeaderLogo(loginLogoUrl);

    const headerLogo = document.querySelector(".sidebar-brand .brand-mark.small, .app-brand .brand-mark.small");
    if (headerLogo && loginLogoUrl) {
      headerLogo.innerHTML = `<img src="${escapeHTML(loginLogoUrl)}" alt="Forward Insight" />`;
      headerLogo.classList.add("has-image");
    }

    if (typeof applyFavicon === "function" && (branding.favicon_url || loginLogoUrl)) {
      applyFavicon(branding.favicon_url || loginLogoUrl);
    }
  } catch (error) {
    console.warn("applySystemBrandingToHeader skipped", error);
  }
}

function showAppShell() {
  hideBootPage?.();
  elements.loginPage?.classList.add("hidden");
  elements.appShell?.classList.remove("hidden");
  document.body.classList.remove("nav-open");

  if (appState.profile) {
    const fullName = appState.profile.full_name || appState.profile.email || "-";
    const roleText = roleLabel(appState.profile.role);

    if (elements.userName) elements.userName.textContent = fullName;
    if (elements.userRole) elements.userRole.textContent = roleText;

    const headerUserChip = document.querySelector("#headerUserChip");
    if (headerUserChip) {
      headerUserChip.textContent = `${fullName} · ${roleText}`;
      headerUserChip.title = `${fullName} · ${roleText}`;
    }
  }

  renderMenu?.();
  applySystemBrandingToHeader();

  if (!location.hash) location.hash = "#dashboard";
  appState.currentPage = getPageFromHash() || "dashboard";
  hidePageBusy?.();
}

async function bootAuthenticatedAppV17(session, reason = "boot") {
  if (!isUsableSessionV172(session)) {
    showLoginPageCleanV17({ rememberHash: true });
    return false;
  }

  appState.user = session.user;
  appState.profile = null;

  try {
    await loadProfile(session);
  } catch (error) {
    if (isAuthMissingErrorV172(error)) {
      showLoginPageCleanV17({ rememberHash: true });
      return false;
    }

    console.error(`bootAuthenticatedApp ${FI_STABILITY_FIX_VERSION_V172}`, error);
    showLoginPageCleanV17({
      showError: true,
      message: error.message || "เข้าสู่ระบบได้แล้ว แต่ไม่สามารถโหลดข้อมูลผู้ใช้ได้",
      rememberHash: true,
    });
    return false;
  }

  hideLoginError?.();
  showAppShell();
  await renderCurrentPage({ force: true, reason });
  return true;
}

async function initApp() {
  showBootPage?.();

  if (!isConfigured) {
    showLoginPageCleanV17({
      showError: true,
      message: "ยังไม่ได้ตั้งค่า Supabase URL และ anon key ในไฟล์ script.js",
      rememberHash: false,
    });
    return;
  }

  bindEvents();
  bindAuthListenerV172();
  startRequiredStarObserverV16?.();
  hideLoginError?.();

  try {
    if (typeof loadAndApplyAppBranding === "function") await loadAndApplyAppBranding();
  } catch (error) {
    console.warn(`Branding skipped during init ${FI_STABILITY_FIX_VERSION_V172}`, error);
  }

  const { session, error } = await getSessionV172();

  if (error) {
    console.warn(`Stored session check failed ${FI_STABILITY_FIX_VERSION_V172}; showing clean login`, error);
    showLoginPageCleanV17({ rememberHash: true });
    return;
  }

  if (!isUsableSessionV172(session)) {
    showLoginPageCleanV17({ rememberHash: true });
    return;
  }

  await bootAuthenticatedAppV17(session, "initial-session-v172");
}

function bindAuthListenerV172() {
  if (window.__fiAuthListenerV172 || !supabaseClient) return;
  window.__fiAuthListenerV172 = true;

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === "TOKEN_REFRESHED" && isUsableSessionV172(session)) {
      appState.user = session.user;
      return;
    }

    if (event === "SIGNED_OUT") {
      showLoginPageCleanV17({ rememberHash: false });
      return;
    }

    if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && isUsableSessionV172(session) && !isAuthenticatedV17()) {
      await bootAuthenticatedAppV17(session, `auth-${event}-v172`);
    }
  });
}

function bindEvents() {
  if (elements.loginForm && !elements.loginForm.dataset.v172Bound) {
    elements.loginForm.dataset.v172Bound = "true";
    elements.loginForm.addEventListener("submit", handleLogin);
  }

  if (elements.logoutButton && !elements.logoutButton.dataset.v172Bound) {
    elements.logoutButton.dataset.v172Bound = "true";
    elements.logoutButton.addEventListener("click", handleLogout);
  }

  if (!window.__fiHashBoundV172) {
    window.__fiHashBoundV172 = true;
    window.addEventListener("hashchange", async () => {
      appState.currentPage = getPageFromHash();
      if (isAuthenticatedV17()) await renderCurrentPage({ force: true, reason: "hashchange-v172" });
      else showLoginPageCleanV17({ rememberHash: true });
    });
  }

  if (!window.__fiDelegatedClickV172) {
    window.__fiDelegatedClickV172 = true;

    document.addEventListener("pointerdown", (event) => {
      if (isFileInputElement?.(event.target)) markFilePickerInteraction?.();
    }, true);

    document.addEventListener("click", (event) => {
      if (isFileInputElement?.(event.target)) markFilePickerInteraction?.();
      handleDelegatedClick?.(event);
    }, true);

    document.addEventListener("change", (event) => {
      if (isFileInputElement?.(event.target)) {
        releaseFilePickerInteraction?.(2200);
        return;
      }
      handleDelegatedChange?.(event);
    }, true);
  }

  if (!window.__fiLifecycleBoundV172) {
    window.__fiLifecycleBoundV172 = true;
    window.addEventListener("focus", () => recoverAppAfterResume("focus"));
    window.addEventListener("pageshow", (event) => recoverAppAfterResume(event.persisted ? "pageshow-cache" : "pageshow"));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") recoverAppAfterResume("visibilitychange");
    });
  }

  const mobileMenuButton = document.querySelector("#mobileMenuButton");
  if (mobileMenuButton && !mobileMenuButton.dataset.v172Bound) {
    mobileMenuButton.dataset.v172Bound = "true";
    mobileMenuButton.addEventListener("click", () => elements.sidebarMenu?.classList.toggle("is-open"));
  }
}

async function handleLogin(event) {
  event.preventDefault();

  if (!supabaseClient) {
    showLoginError("ยังไม่ได้ตั้งค่า Supabase ใน script.js");
    return;
  }

  hideLoginError?.();

  const email = elements.loginEmail?.value?.trim() || "";
  const password = elements.loginPassword?.value || "";

  if (!email || !password) {
    showLoginError("กรุณากรอกอีเมลและรหัสผ่าน");
    return;
  }

  const executeLogin = async () => {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      showLoginError("อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      return;
    }

    const session = data?.session || (await getSessionV172()).session;

    if (!isUsableSessionV172(session)) {
      showLoginError("เข้าสู่ระบบสำเร็จแต่ยังไม่พบ session กรุณาลองใหม่อีกครั้ง");
      return;
    }

    const ok = await bootAuthenticatedAppV17(session, "login-v172");

    if (ok) {
      const nextHash = appState.pendingHashV172 || "#dashboard";
      appState.pendingHashV172 = null;
      if (location.hash !== nextHash) location.hash = nextHash;
      else await renderCurrentPage({ force: true, reason: "login-target-v172" });
      showToast?.("เข้าสู่ระบบสำเร็จ", "success");
    }
  };

  if (typeof withButtonLoading === "function") {
    await withButtonLoading(elements.loginButton, "กำลังเข้าสู่ระบบ...", executeLogin);
  } else {
    setLoginLoading?.(true);
    try { await executeLogin(); } finally { setLoginLoading?.(false); }
  }
}

async function handleLogout() {
  if (!supabaseClient) return;

  const ok = window.confirm("ต้องการออกจากระบบใช่ไหม?");
  if (!ok) return;

  try {
    await supabaseClient.auth.signOut();
  } finally {
    appState.pendingHashV172 = null;
    showLoginPageCleanV17({ rememberHash: false });
    showToast?.("ออกจากระบบแล้ว", "success");
  }
}

async function renderCurrentPage(options = {}) {
  const token = ++appState.renderSeqV172;
  appState.currentPage = getPageFromHash() || "dashboard";

  if (!isAuthenticatedV17()) {
    const { session, error } = await getSessionV172();

    if (error || !isUsableSessionV172(session)) {
      if (error) console.warn(`renderCurrentPage no valid session ${FI_STABILITY_FIX_VERSION_V172}`, error);
      showLoginPageCleanV17({ rememberHash: true });
      return;
    }

    await bootAuthenticatedAppV17(session, `bootstrap-${options.reason || "render"}-v172`);
    return;
  }

  showAppShell();
  renderMenu?.();
  applySystemBrandingToHeader();
  hidePageBusy?.();

  const page = appState.currentPage || "dashboard";

  const watchdogId = window.setTimeout(() => {
    if (appState.renderSeqV172 !== token) return;
    if (hasVisibleLoadingV161?.()) {
      renderErrorStateWithRetry?.("โหลดข้อมูลนานเกินไปหรือการเชื่อมต่อค้าง กรุณากดโหลดข้อมูลใหม่");
    }
  }, 16000);

  try {
    await renderPageByKeyV161(page);
    if (appState.renderSeqV172 !== token) return;

    appState.lastSuccessfulRenderAtV172 = Date.now();
    appState.lastSuccessfulRenderAt = Date.now();

    if (!elements.pageContent?.textContent?.trim()) {
      throw new Error("หน้าเว็บแสดงผลว่างหลังโหลดข้อมูล");
    }

    decorateRequiredStars?.();
  } catch (error) {
    if (appState.renderSeqV172 !== token) return;
    console.error(`renderCurrentPage ${FI_STABILITY_FIX_VERSION_V172}`, page, error);
    hidePageBusy?.();
    renderErrorStateWithRetry?.(error.message || "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
  } finally {
    window.clearTimeout(watchdogId);
    hidePageBusy?.();
  }
}

async function recoverAppAfterResume(reason = "resume") {
  if (!isConfigured || !supabaseClient || document.visibilityState === "hidden") return;

  if (shouldSkipResumeRecoveryForFilePicker?.()) {
    releaseFilePickerInteraction?.(1800);
    return;
  }

  // Do not recover protected data while the user is on the login page.
  if (!isAuthenticatedV17()) {
    return;
  }

  const now = Date.now();
  if (now - Number(appState.lastResumeAttemptAtV172 || 0) < 1500) return;
  appState.lastResumeAttemptAtV172 = now;

  if (appState.resumeInProgressV172) return;
  appState.resumeInProgressV172 = true;

  try {
    hidePageBusy?.();
    appState.activeActions?.clear?.();
    showAppShell();
    await renderCurrentPage({ force: true, reason: `resume-${reason}-v172` });
    validateSessionInBackgroundV172(reason);
  } catch (error) {
    console.warn(`recoverAppAfterResume ${FI_STABILITY_FIX_VERSION_V172}`, reason, error);
    hidePageBusy?.();
    if (isAuthenticatedV17()) await renderCurrentPage({ force: true, reason: `resume-fallback-${reason}-v172` });
  } finally {
    appState.resumeInProgressV172 = false;
  }
}

function validateSessionInBackgroundV172(reason) {
  window.setTimeout(async () => {
    if (!isAuthenticatedV17()) return;

    const { session, error } = await getSessionV172();

    if (error) {
      console.warn(`background session validation skipped ${FI_STABILITY_FIX_VERSION_V172}`, reason, error);
      return;
    }

    if (!isUsableSessionV172(session)) {
      showLoginPageCleanV17({ rememberHash: true });
      showToast?.("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่", "warning", { duration: 4200 });
      return;
    }

    appState.user = session.user;
  }, 900);
}

// Product form final renderer. Do not wrap renderProductFormPage with the same name.
async function renderProductFormPage({ mode, productId }) {
  if (appState.profile?.role !== "admin") {
    renderError("เฉพาะ Admin เท่านั้นที่จัดการสินค้า/บริการได้");
    return;
  }

  const isEdit = mode === "edit";
  setPageHeader(isEdit ? "แก้ไขสินค้า/บริการ" : "เพิ่มสินค้า/บริการ", "Code สามารถซ้ำได้ แต่ชื่อสินค้า/บริการต้องไม่ซ้ำ");
  renderLoading();

  let product = {
    code: "",
    name: "",
    description: "",
    default_unit: "คัน",
    is_active: true,
  };

  if (isEdit) {
    const { data, error } = await supabaseClient
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("ไม่พบสินค้า/บริการที่ต้องการแก้ไข");
    product = data;
  }

  elements.pageContent.innerHTML = `
    <form id="productForm" class="card form-card">
      <div class="card-header">
        <div>
          <h3>${isEdit ? "แก้ไขสินค้า/บริการ" : "เพิ่มสินค้า/บริการ"}</h3>
          <p>Code สามารถซ้ำได้ แต่ชื่อสินค้า/บริการต้องไม่ซ้ำ</p>
        </div>
      </div>

      <div class="form-grid">
        <div class="field">
          <label for="productCode">Code *</label>
          <input id="productCode" type="text" value="${escapeHTML(product.code || "")}" placeholder="เช่น ERP-TRUCK" required />
        </div>

        <div class="field">
          <label for="productUnit">หน่วย *</label>
          <input id="productUnit" type="text" value="${escapeHTML(product.default_unit || "คัน")}" required />
        </div>

        <div class="field full">
          <label for="productName">ชื่อสินค้า/บริการ *</label>
          <input id="productName" type="text" value="${escapeHTML(product.name || "")}" required />
        </div>

        <div class="field full">
          <label for="productDescription">รายละเอียด</label>
          <textarea id="productDescription" rows="4">${escapeHTML(product.description || "")}</textarea>
        </div>

        <label class="checkbox-row full">
          <input id="productIsActive" type="checkbox" ${product.is_active !== false ? "checked" : ""} />
          <span>เปิดใช้งานสินค้า/บริการนี้</span>
        </label>
      </div>

      <div class="form-actions normal-flow">
        <button type="button" id="cancelProductButton" class="btn btn-ghost">ยกเลิก</button>
        <button type="submit" id="saveProductButton" class="btn btn-primary">บันทึก</button>
      </div>
    </form>
  `;

  $("#cancelProductButton")?.addEventListener("click", () => { location.hash = "#products"; });
  $("#productForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveProduct({ mode, productId });
  });

  decorateRequiredStars?.();
}

function normalizeProductNameV172(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

async function saveProduct({ mode, productId }) {
  const saveButton = $("#saveProductButton");
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "กำลังบันทึก...";
  }

  try {
    const payload = {
      code: $("#productCode")?.value.trim() || "",
      name: $("#productName")?.value.trim() || "",
      description: $("#productDescription")?.value.trim() || "",
      default_unit: $("#productUnit")?.value.trim() || "คัน",
      is_active: $("#productIsActive")?.checked ?? true,
    };

    if (!payload.code || !payload.name || !payload.default_unit) {
      throw new Error("กรุณากรอก Code, ชื่อสินค้า/บริการ และหน่วย");
    }

    const { data: existingProducts, error: checkError } = await supabaseClient
      .from("products")
      .select("id, name");

    if (checkError) throw checkError;

    const normalizedName = normalizeProductNameV172(payload.name);
    const duplicatedName = (existingProducts || []).find((item) => {
      if (mode === "edit" && item.id === productId) return false;
      return normalizeProductNameV172(item.name) === normalizedName;
    });

    if (duplicatedName) {
      throw new Error("ชื่อสินค้า/บริการนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น");
    }

    if (mode === "edit") {
      const { error } = await supabaseClient
        .from("products")
        .update(payload)
        .eq("id", productId);
      if (error) throw error;
    } else {
      const { error } = await supabaseClient
        .from("products")
        .insert(payload);
      if (error) throw error;
    }

    showToast?.("บันทึกสินค้า/บริการสำเร็จ", "success");
    location.hash = "#products";
  } catch (error) {
    console.error(error);
    const message = String(error?.message || "");
    const friendlyMessage = /duplicate|unique|products.*name/i.test(message)
      ? "ชื่อสินค้า/บริการนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น"
      : message || "ไม่สามารถบันทึกสินค้า/บริการได้";
    showToast?.(friendlyMessage, "error", { duration: 5200 });
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = "บันทึก";
    }
  }
}

window.FI_APP_VERSION = FI_STABILITY_FIX_VERSION_V172;


// =======================================================
// v1.7.3 Boot Watchdog + Final Auth Boot Guard
// Purpose: never leave the app stuck on the boot spinner.
// =======================================================

const FI_BOOT_FINAL_VERSION_V173 = "1.7.3";
window.FI_APP_VERSION = FI_BOOT_FINAL_VERSION_V173;
appState.appVersion = FI_BOOT_FINAL_VERSION_V173;
appState.bootResolvedV173 = false;
appState.bootWatchdogIdV173 = null;
appState.pendingHashV173 = appState.pendingHashV172 || null;
appState.renderSeqV173 = Number(appState.renderSeqV172 || 0);
appState.resumeInProgressV173 = false;
appState.lastResumeAttemptAtV173 = 0;

function isUsableSessionV173(session) {
  return Boolean(session?.access_token && session?.user?.id);
}

function isAuthenticatedV17() {
  return Boolean(appState.user?.id && appState.profile?.id);
}

function getCurrentHashV173() {
  return location.hash && location.hash !== "#" ? location.hash : "#dashboard";
}

function rememberPendingHashV173() {
  const hash = getCurrentHashV173();
  if (hash !== "#dashboard") {
    appState.pendingHashV173 = hash;
    appState.pendingHashV172 = hash;
  }
}

function markBootResolvedV173() {
  appState.bootResolvedV173 = true;
  if (appState.bootWatchdogIdV173) {
    window.clearTimeout(appState.bootWatchdogIdV173);
    appState.bootWatchdogIdV173 = null;
  }
  hideBootPage?.();
}

function showLoginPageCleanV17(options = {}) {
  const { message = "", showError = false, rememberHash = true } = options;

  if (rememberHash) rememberPendingHashV173();

  appState.user = null;
  appState.profile = null;
  appState.selectedQuotationIds?.clear?.();

  markBootResolvedV173();
  hidePageBusy?.();

  elements.loginPage?.classList.remove("hidden");
  elements.appShell?.classList.add("hidden");
  document.body.classList.remove("nav-open");

  if (showError && message) showLoginError(message);
  else hideLoginError?.();
}

function runWithTimeoutV173(promise, timeoutMs, label) {
  let timerId;
  const timeout = new Promise((resolve) => {
    timerId = window.setTimeout(() => resolve({ __timedOut: true, label }), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timerId) window.clearTimeout(timerId);
  });
}

async function getSessionV173(timeoutMs = 6500) {
  if (!supabaseClient?.auth) {
    return { session: null, error: new Error("SUPABASE_CLIENT_NOT_READY"), timedOut: false };
  }

  try {
    const result = await runWithTimeoutV173(
      supabaseClient.auth.getSession(),
      timeoutMs,
      "getSession"
    );

    if (result?.__timedOut) return { session: null, error: null, timedOut: true };
    if (result?.error) return { session: null, error: result.error, timedOut: false };
    return { session: result?.data?.session || null, error: null, timedOut: false };
  } catch (error) {
    return { session: null, error, timedOut: false };
  }
}

async function loadBrandingSafeV173() {
  if (typeof loadAndApplyAppBranding !== "function") return;

  try {
    const result = await runWithTimeoutV173(loadAndApplyAppBranding(), 3500, "loadAndApplyAppBranding");
    if (result?.__timedOut) console.warn(`Branding timeout ${FI_BOOT_FINAL_VERSION_V173}; continue without blocking boot`);
  } catch (error) {
    console.warn(`Branding skipped ${FI_BOOT_FINAL_VERSION_V173}`, error);
  }
}

async function loadProfile(sessionArg = null) {
  const session = isUsableSessionV173(sessionArg) ? sessionArg : (await getSessionV173()).session;

  if (!isUsableSessionV173(session)) {
    const error = new Error("AUTH_SESSION_MISSING");
    error.code = "AUTH_SESSION_MISSING";
    throw error;
  }

  appState.user = session.user;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    console.error(`loadProfile ${FI_BOOT_FINAL_VERSION_V173}`, error);
    throw error;
  }

  if (!data) throw new Error("ไม่พบข้อมูลผู้ใช้ในตาราง profiles กรุณาติดต่อ Admin");

  if (data.is_active === false) {
    await supabaseClient.auth.signOut();
    throw new Error("บัญชีนี้ถูกปิดการใช้งาน");
  }

  appState.profile = data;
  return data;
}

async function bootAuthenticatedAppV17(session, reason = "boot") {
  if (!isUsableSessionV173(session)) {
    showLoginPageCleanV17({ rememberHash: true });
    return false;
  }

  appState.user = session.user;
  appState.profile = null;

  try {
    await loadProfile(session);
  } catch (error) {
    if (String(error?.message || "") === "AUTH_SESSION_MISSING" || String(error?.code || "") === "AUTH_SESSION_MISSING") {
      showLoginPageCleanV17({ rememberHash: true });
      return false;
    }

    console.error(`bootAuthenticatedApp ${FI_BOOT_FINAL_VERSION_V173}`, error);
    showLoginPageCleanV17({
      showError: true,
      message: error.message || "เข้าสู่ระบบได้แล้ว แต่ไม่สามารถโหลดข้อมูลผู้ใช้ได้",
      rememberHash: true,
    });
    return false;
  }

  hideLoginError?.();
  showAppShell();
  await renderCurrentPage({ force: true, reason });
  return true;
}

async function initApp() {
  showBootPage?.();
  appState.bootResolvedV173 = false;

  appState.bootWatchdogIdV173 = window.setTimeout(() => {
    if (appState.bootResolvedV173) return;
    console.warn(`Boot watchdog fired ${FI_BOOT_FINAL_VERSION_V173}; showing clean login`);
    showLoginPageCleanV17({ rememberHash: true });
  }, 9000);

  if (!isConfigured || !supabaseClient?.auth) {
    showLoginPageCleanV17({
      showError: true,
      message: window.supabase?.createClient
        ? "ยังไม่ได้ตั้งค่า Supabase URL และ anon key ในไฟล์ script.js"
        : "โหลด Supabase SDK ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตหรือ CDN แล้วลองใหม่",
      rememberHash: false,
    });
    return;
  }

  bindEvents();
  bindAuthListenerV173();
  startRequiredStarObserverV16?.();
  hideLoginError?.();

  await loadBrandingSafeV173();

  const { session, error, timedOut } = await getSessionV173(6500);

  if (timedOut) {
    console.warn(`Initial getSession timeout ${FI_BOOT_FINAL_VERSION_V173}; showing clean login`);
    showLoginPageCleanV17({ rememberHash: true });
    return;
  }

  if (error) {
    console.warn(`Initial getSession failed ${FI_BOOT_FINAL_VERSION_V173}; showing clean login`, error);
    showLoginPageCleanV17({ rememberHash: true });
    return;
  }

  if (!isUsableSessionV173(session)) {
    showLoginPageCleanV17({ rememberHash: true });
    return;
  }

  await bootAuthenticatedAppV17(session, "initial-session-v173");
}

function bindAuthListenerV173() {
  if (window.__fiAuthListenerV173 || !supabaseClient?.auth) return;
  window.__fiAuthListenerV173 = true;

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === "TOKEN_REFRESHED" && isUsableSessionV173(session)) {
      appState.user = session.user;
      return;
    }

    if (event === "SIGNED_OUT") {
      showLoginPageCleanV17({ rememberHash: false });
      return;
    }

    if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && isUsableSessionV173(session) && !isAuthenticatedV17()) {
      await bootAuthenticatedAppV17(session, `auth-${event}-v173`);
    }
  });
}

function bindEvents() {
  if (elements.loginForm && !elements.loginForm.dataset.v173Bound) {
    elements.loginForm.dataset.v173Bound = "true";
    elements.loginForm.addEventListener("submit", handleLogin);
  }

  if (elements.logoutButton && !elements.logoutButton.dataset.v173Bound) {
    elements.logoutButton.dataset.v173Bound = "true";
    elements.logoutButton.addEventListener("click", handleLogout);
  }

  if (!window.__fiHashBoundV173) {
    window.__fiHashBoundV173 = true;
    window.addEventListener("hashchange", async () => {
      appState.currentPage = getPageFromHash();
      if (isAuthenticatedV17()) await renderCurrentPage({ force: true, reason: "hashchange-v173" });
      else showLoginPageCleanV17({ rememberHash: true });
    });
  }

  if (!window.__fiDelegatedClickV173) {
    window.__fiDelegatedClickV173 = true;

    document.addEventListener("pointerdown", (event) => {
      if (isFileInputElement?.(event.target)) markFilePickerInteraction?.();
    }, true);

    document.addEventListener("click", (event) => {
      if (isFileInputElement?.(event.target)) markFilePickerInteraction?.();
      handleDelegatedClick?.(event);
    }, true);

    document.addEventListener("change", (event) => {
      if (isFileInputElement?.(event.target)) {
        releaseFilePickerInteraction?.(2200);
        return;
      }
      handleDelegatedChange?.(event);
    }, true);
  }

  if (!window.__fiLifecycleBoundV173) {
    window.__fiLifecycleBoundV173 = true;
    window.addEventListener("focus", () => recoverAppAfterResume("focus"));
    window.addEventListener("pageshow", (event) => recoverAppAfterResume(event.persisted ? "pageshow-cache" : "pageshow"));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") recoverAppAfterResume("visibilitychange");
    });
  }

  const mobileMenuButton = document.querySelector("#mobileMenuButton");
  if (mobileMenuButton && !mobileMenuButton.dataset.v173Bound) {
    mobileMenuButton.dataset.v173Bound = "true";
    mobileMenuButton.addEventListener("click", () => elements.sidebarMenu?.classList.toggle("is-open"));
  }
}

async function handleLogin(event) {
  event.preventDefault();

  if (!supabaseClient?.auth) {
    showLoginError("ยังไม่ได้ตั้งค่า Supabase หรือโหลด Supabase SDK ไม่สำเร็จ");
    return;
  }

  hideLoginError?.();

  const email = elements.loginEmail?.value?.trim() || "";
  const password = elements.loginPassword?.value || "";

  if (!email || !password) {
    showLoginError("กรุณากรอกอีเมลและรหัสผ่าน");
    return;
  }

  const executeLogin = async () => {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      showLoginError("อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      return;
    }

    const session = data?.session || (await getSessionV173(6500)).session;

    if (!isUsableSessionV173(session)) {
      showLoginError("เข้าสู่ระบบสำเร็จแต่ยังไม่พบ session กรุณาลองใหม่อีกครั้ง");
      return;
    }

    const ok = await bootAuthenticatedAppV17(session, "login-v173");

    if (ok) {
      const nextHash = appState.pendingHashV173 || appState.pendingHashV172 || "#dashboard";
      appState.pendingHashV173 = null;
      appState.pendingHashV172 = null;
      if (location.hash !== nextHash) location.hash = nextHash;
      else await renderCurrentPage({ force: true, reason: "login-target-v173" });
      showToast?.("เข้าสู่ระบบสำเร็จ", "success");
    }
  };

  if (typeof withButtonLoading === "function") {
    await withButtonLoading(elements.loginButton, "กำลังเข้าสู่ระบบ...", executeLogin);
  } else {
    setLoginLoading?.(true);
    try { await executeLogin(); } finally { setLoginLoading?.(false); }
  }
}

async function handleLogout() {
  if (!supabaseClient?.auth) return;

  const ok = window.confirm("ต้องการออกจากระบบใช่ไหม?");
  if (!ok) return;

  try {
    await supabaseClient.auth.signOut();
  } finally {
    appState.pendingHashV173 = null;
    appState.pendingHashV172 = null;
    showLoginPageCleanV17({ rememberHash: false });
    showToast?.("ออกจากระบบแล้ว", "success");
  }
}

async function renderCurrentPage(options = {}) {
  const token = ++appState.renderSeqV173;
  appState.currentPage = getPageFromHash() || "dashboard";

  if (!isAuthenticatedV17()) {
    const { session, error, timedOut } = await getSessionV173(6500);

    if (timedOut || error || !isUsableSessionV173(session)) {
      if (error) console.warn(`renderCurrentPage no valid session ${FI_BOOT_FINAL_VERSION_V173}`, error);
      showLoginPageCleanV17({ rememberHash: true });
      return;
    }

    await bootAuthenticatedAppV17(session, `bootstrap-${options.reason || "render"}-v173`);
    return;
  }

  showAppShell();
  renderMenu?.();
  applySystemBrandingToHeader?.();
  hidePageBusy?.();

  const page = appState.currentPage || "dashboard";

  const watchdogId = window.setTimeout(() => {
    if (appState.renderSeqV173 !== token) return;
    if (hasVisibleLoadingV161?.()) {
      renderErrorStateWithRetry?.("โหลดข้อมูลนานเกินไปหรือการเชื่อมต่อค้าง กรุณากดโหลดข้อมูลใหม่");
    }
  }, 16000);

  try {
    await renderPageByKeyV161(page);
    if (appState.renderSeqV173 !== token) return;

    appState.lastSuccessfulRenderAtV173 = Date.now();
    appState.lastSuccessfulRenderAtV172 = Date.now();
    appState.lastSuccessfulRenderAt = Date.now();

    if (!elements.pageContent?.textContent?.trim()) {
      throw new Error("หน้าเว็บแสดงผลว่างหลังโหลดข้อมูล");
    }

    decorateRequiredStars?.();
  } catch (error) {
    if (appState.renderSeqV173 !== token) return;
    console.error(`renderCurrentPage ${FI_BOOT_FINAL_VERSION_V173}`, page, error);
    hidePageBusy?.();
    renderErrorStateWithRetry?.(error.message || "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
  } finally {
    window.clearTimeout(watchdogId);
    hidePageBusy?.();
  }
}

async function recoverAppAfterResume(reason = "resume") {
  if (!isConfigured || !supabaseClient?.auth || document.visibilityState === "hidden") return;

  if (shouldSkipResumeRecoveryForFilePicker?.()) {
    releaseFilePickerInteraction?.(1800);
    return;
  }

  if (!isAuthenticatedV17()) return;

  const now = Date.now();
  if (now - Number(appState.lastResumeAttemptAtV173 || 0) < 1500) return;
  appState.lastResumeAttemptAtV173 = now;

  if (appState.resumeInProgressV173) return;
  appState.resumeInProgressV173 = true;

  try {
    hidePageBusy?.();
    appState.activeActions?.clear?.();
    showAppShell();
    await renderCurrentPage({ force: true, reason: `resume-${reason}-v173` });
    validateSessionInBackgroundV173(reason);
  } catch (error) {
    console.warn(`recoverAppAfterResume ${FI_BOOT_FINAL_VERSION_V173}`, reason, error);
    hidePageBusy?.();
    if (isAuthenticatedV17()) await renderCurrentPage({ force: true, reason: `resume-fallback-${reason}-v173` });
  } finally {
    appState.resumeInProgressV173 = false;
  }
}

function validateSessionInBackgroundV173(reason) {
  window.setTimeout(async () => {
    if (!isAuthenticatedV17()) return;

    const { session, error } = await getSessionV173(6500);

    if (error) {
      console.warn(`background session validation skipped ${FI_BOOT_FINAL_VERSION_V173}`, reason, error);
      return;
    }

    if (!isUsableSessionV173(session)) {
      showLoginPageCleanV17({ rememberHash: true });
      showToast?.("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่", "warning", { duration: 4200 });
      return;
    }

    appState.user = session.user;
  }, 900);
}

window.FI_APP_VERSION = FI_BOOT_FINAL_VERSION_V173;

// =======================================================
// v1.7.4 Login Timeout Guard + Non-blocking Boot
// Purpose: prevent login button and boot screen from getting stuck.
// =======================================================

const FI_LOGIN_GUARD_VERSION_V174 = "1.7.4";
window.FI_APP_VERSION = FI_LOGIN_GUARD_VERSION_V174;
appState.appVersion = FI_LOGIN_GUARD_VERSION_V174;
appState.pendingHashV174 = appState.pendingHashV173 || appState.pendingHashV172 || null;
appState.bootResolvedV174 = false;
appState.bootWatchdogIdV174 = null;

function isUsableSessionV174(session) {
  return Boolean(session && session.access_token && session.user && session.user.id);
}

function isAuthenticatedV174() {
  return Boolean(appState.user && appState.user.id && appState.profile && appState.profile.id);
}

function resolveBootV174() {
  appState.bootResolvedV174 = true;
  appState.bootResolvedV173 = true;
  if (appState.bootWatchdogIdV174) {
    window.clearTimeout(appState.bootWatchdogIdV174);
    appState.bootWatchdogIdV174 = null;
  }
  if (appState.bootWatchdogIdV173) {
    window.clearTimeout(appState.bootWatchdogIdV173);
    appState.bootWatchdogIdV173 = null;
  }
  if (typeof hideBootPage === "function") hideBootPage();
  else document.querySelector("#bootPage")?.classList.add("hidden");
}

function rememberPendingHashV174() {
  const hash = location.hash && location.hash !== "#" ? location.hash : "#dashboard";
  if (hash && hash !== "#dashboard") {
    appState.pendingHashV174 = hash;
    appState.pendingHashV173 = hash;
    appState.pendingHashV172 = hash;
  }
}

function showLoginPageCleanV17(options = {}) {
  const { message = "", showError = false, rememberHash = true } = options;
  if (rememberHash) rememberPendingHashV174();

  appState.user = null;
  appState.profile = null;
  appState.selectedQuotationIds?.clear?.();
  appState.activeActions?.clear?.();

  resolveBootV174();
  if (typeof hidePageBusy === "function") hidePageBusy();

  elements.loginPage?.classList.remove("hidden");
  elements.appShell?.classList.add("hidden");
  document.body.classList.remove("nav-open");

  if (showError && message) showLoginError(message);
  else if (typeof hideLoginError === "function") hideLoginError();
}

function waitWithTimeoutV174(promise, timeoutMs, label) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label}ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) window.clearTimeout(timeoutId);
  });
}

async function getSessionV174(timeoutMs = 8000) {
  if (!supabaseClient?.auth) return { session: null, error: new Error("SUPABASE_CLIENT_NOT_READY") };

  try {
    const result = await waitWithTimeoutV174(
      supabaseClient.auth.getSession(),
      timeoutMs,
      "การตรวจสอบ session "
    );
    return { session: result?.data?.session || null, error: result?.error || null };
  } catch (error) {
    return { session: null, error };
  }
}

async function loadProfile(sessionArg = null) {
  const session = isUsableSessionV174(sessionArg)
    ? sessionArg
    : (await getSessionV174(8000)).session;

  if (!isUsableSessionV174(session)) {
    const error = new Error("AUTH_SESSION_MISSING");
    error.code = "AUTH_SESSION_MISSING";
    throw error;
  }

  appState.user = session.user;

  const query = supabaseClient
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", session.user.id)
    .maybeSingle();

  const { data, error } = await waitWithTimeoutV174(query, 10000, "การโหลดข้อมูลผู้ใช้ ");

  if (error) {
    console.error(`loadProfile ${FI_LOGIN_GUARD_VERSION_V174}`, error);
    throw error;
  }

  if (!data) throw new Error("ไม่พบข้อมูลผู้ใช้ในตาราง profiles กรุณาติดต่อ Admin");

  if (data.is_active === false) {
    await supabaseClient.auth.signOut();
    throw new Error("บัญชีนี้ถูกปิดการใช้งาน");
  }

  appState.profile = data;
  return data;
}

async function bootAuthenticatedAppV17(session, reason = "boot") {
  if (!isUsableSessionV174(session)) {
    showLoginPageCleanV17({ rememberHash: true });
    return false;
  }

  appState.user = session.user;
  appState.profile = null;

  try {
    await loadProfile(session);
  } catch (error) {
    const code = String(error?.code || error?.message || "");
    if (code === "AUTH_SESSION_MISSING") {
      showLoginPageCleanV17({ rememberHash: true });
      return false;
    }

    showLoginPageCleanV17({
      showError: true,
      message: error.message || "เข้าสู่ระบบได้แล้ว แต่ไม่สามารถโหลดข้อมูลผู้ใช้ได้",
      rememberHash: true,
    });
    return false;
  }

  resolveBootV174();
  if (typeof hideLoginError === "function") hideLoginError();
  showAppShell();

  // Important: do not block login button on slow page rendering.
  window.setTimeout(() => {
    renderCurrentPage({ force: true, reason: `${reason}-nonblocking-v174` }).catch((error) => {
      console.error(`render after boot ${FI_LOGIN_GUARD_VERSION_V174}`, error);
      if (typeof renderErrorStateWithRetry === "function") {
        renderErrorStateWithRetry(error.message || "ไม่สามารถโหลดหน้านี้ได้ กรุณากดโหลดข้อมูลใหม่");
      }
    });
  }, 0);

  return true;
}

async function initApp() {
  if (typeof showBootPage === "function") showBootPage();
  appState.bootResolvedV174 = false;

  appState.bootWatchdogIdV174 = window.setTimeout(() => {
    if (appState.bootResolvedV174) return;
    console.warn(`Boot watchdog fired ${FI_LOGIN_GUARD_VERSION_V174}; showing clean login`);
    showLoginPageCleanV17({ rememberHash: true });
  }, 9000);

  if (!isConfigured || !supabaseClient?.auth) {
    showLoginPageCleanV17({
      showError: true,
      message: window.supabase?.createClient
        ? "ยังไม่ได้ตั้งค่า Supabase URL และ anon key ในไฟล์ script.js"
        : "โหลด Supabase SDK ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตหรือ CDN แล้วลองใหม่",
      rememberHash: false,
    });
    return;
  }

  bindEvents();
  if (typeof bindAuthListenerV173 === "function") bindAuthListenerV173();
  if (typeof startRequiredStarObserverV16 === "function") startRequiredStarObserverV16();
  if (typeof hideLoginError === "function") hideLoginError();

  // Branding must never block boot.
  if (typeof loadAndApplyAppBranding === "function") {
    waitWithTimeoutV174(loadAndApplyAppBranding(), 3000, "การโหลด Branding ")
      .catch((error) => console.warn(`Branding skipped ${FI_LOGIN_GUARD_VERSION_V174}`, error));
  }

  const { session, error } = await getSessionV174(8000);

  if (error) {
    console.warn(`Initial session check skipped ${FI_LOGIN_GUARD_VERSION_V174}`, error);
    showLoginPageCleanV17({ rememberHash: true });
    return;
  }

  if (!isUsableSessionV174(session)) {
    showLoginPageCleanV17({ rememberHash: true });
    return;
  }

  await bootAuthenticatedAppV17(session, "initial-session-v174");
}

function bindEvents() {
  if (elements.loginForm && !elements.loginForm.dataset.v174Bound) {
    elements.loginForm.dataset.v174Bound = "true";
    elements.loginForm.addEventListener("submit", handleLogin);
  }

  if (elements.logoutButton && !elements.logoutButton.dataset.v174Bound) {
    elements.logoutButton.dataset.v174Bound = "true";
    elements.logoutButton.addEventListener("click", handleLogout);
  }

  if (!window.__fiHashBoundV174) {
    window.__fiHashBoundV174 = true;
    window.addEventListener("hashchange", async () => {
      appState.currentPage = getPageFromHash();
      if (isAuthenticatedV174()) await renderCurrentPage({ force: true, reason: "hashchange-v174" });
      else showLoginPageCleanV17({ rememberHash: true });
    });
  }

  if (!window.__fiDelegatedClickV174) {
    window.__fiDelegatedClickV174 = true;
    document.addEventListener("pointerdown", (event) => {
      if (typeof isFileInputElement === "function" && isFileInputElement(event.target)) markFilePickerInteraction?.();
    }, true);
    document.addEventListener("click", (event) => {
      if (typeof isFileInputElement === "function" && isFileInputElement(event.target)) markFilePickerInteraction?.();
      handleDelegatedClick?.(event);
    }, true);
    document.addEventListener("change", (event) => {
      if (typeof isFileInputElement === "function" && isFileInputElement(event.target)) {
        releaseFilePickerInteraction?.(2200);
        return;
      }
      handleDelegatedChange?.(event);
    }, true);
  }

  if (!window.__fiLifecycleBoundV174) {
    window.__fiLifecycleBoundV174 = true;
    window.addEventListener("focus", () => recoverAppAfterResume("focus"));
    window.addEventListener("pageshow", (event) => recoverAppAfterResume(event.persisted ? "pageshow-cache" : "pageshow"));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") recoverAppAfterResume("visibilitychange");
    });
  }
}

async function handleLogin(event) {
  event.preventDefault();

  if (!supabaseClient?.auth) {
    showLoginError("ยังไม่ได้ตั้งค่า Supabase หรือโหลด Supabase SDK ไม่สำเร็จ");
    return;
  }

  const email = elements.loginEmail?.value?.trim() || "";
  const password = elements.loginPassword?.value || "";

  if (!email || !password) {
    showLoginError("กรุณากรอกอีเมลและรหัสผ่าน");
    return;
  }

  if (typeof hideLoginError === "function") hideLoginError();

  const button = elements.loginButton;
  const oldText = button?.textContent || "เข้าสู่ระบบ";
  if (button) {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "กำลังเข้าสู่ระบบ...";
  }

  try {
    const { data, error } = await waitWithTimeoutV174(
      supabaseClient.auth.signInWithPassword({ email, password }),
      15000,
      "การเข้าสู่ระบบ "
    );

    if (error) {
      showLoginError("อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      return;
    }

    let session = data?.session || null;

    if (!isUsableSessionV174(session)) {
      const sessionResult = await getSessionV174(6000);
      session = sessionResult.session;
    }

    if (!isUsableSessionV174(session)) {
      showLoginError("เข้าสู่ระบบสำเร็จแต่ยังไม่พบ session กรุณาลองใหม่อีกครั้ง");
      return;
    }

    const ok = await bootAuthenticatedAppV17(session, "login-v174");

    if (!ok) return;

    const nextHash = appState.pendingHashV174 || appState.pendingHashV173 || appState.pendingHashV172 || "#dashboard";
    appState.pendingHashV174 = null;
    appState.pendingHashV173 = null;
    appState.pendingHashV172 = null;

    if (location.hash !== nextHash) location.hash = nextHash;
    else renderCurrentPage({ force: true, reason: "login-target-v174" }).catch(console.error);

    showToast?.("เข้าสู่ระบบสำเร็จ", "success");
  } catch (error) {
    console.error(`handleLogin ${FI_LOGIN_GUARD_VERSION_V174}`, error);
    showLoginError(error.message || "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง");
  } finally {
    if (button) {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent = oldText || "เข้าสู่ระบบ";
    }
  }
}

async function recoverAppAfterResume(reason = "resume") {
  if (!isConfigured || !supabaseClient?.auth || document.visibilityState === "hidden") return;
  if (!isAuthenticatedV174()) return;
  if (typeof shouldSkipResumeRecoveryForFilePicker === "function" && shouldSkipResumeRecoveryForFilePicker()) {
    releaseFilePickerInteraction?.(1800);
    return;
  }

  const now = Date.now();
  if (now - Number(appState.lastResumeAttemptAtV173 || 0) < 1500) return;
  appState.lastResumeAttemptAtV173 = now;

  try {
    hidePageBusy?.();
    showAppShell();
    await renderCurrentPage({ force: true, reason: `resume-${reason}-v174` });
  } catch (error) {
    console.warn(`recoverAppAfterResume ${FI_LOGIN_GUARD_VERSION_V174}`, error);
  }
}

window.FI_APP_VERSION = FI_LOGIN_GUARD_VERSION_V174;

// =======================================================
// v1.8.0 Corrected Integration Build
// Purpose: preserve v1.7.4 feature set while replacing the fragile
// auth boot/login/render lifecycle with one stable implementation.
// =======================================================

var FI_V18_CORRECTED_VERSION = "1.8.0";
window.FI_APP_VERSION = FI_V18_CORRECTED_VERSION;
appState.appVersion = FI_V18_CORRECTED_VERSION;
appState.pendingHashV18 = appState.pendingHashV174 || appState.pendingHashV173 || appState.pendingHashV172 || null;
appState.authSeqV18 = 0;
appState.renderSeqV18 = 0;
appState.resumeInProgressV18 = false;
appState.lastResumeAttemptAtV18 = 0;

function isUsableSessionV18(session) {
  return Boolean(session && session.access_token && session.user && session.user.id);
}

function isAuthenticatedV18() {
  return Boolean(appState.user && appState.user.id && appState.profile && appState.profile.id);
}

function getCurrentHashV18() {
  return location.hash && location.hash !== "#" ? location.hash : "#dashboard";
}

function rememberPendingHashV18() {
  const hash = getCurrentHashV18();
  if (hash && hash !== "#dashboard") {
    appState.pendingHashV18 = hash;
  }
}

function clearPendingHashV18() {
  appState.pendingHashV18 = null;
  appState.pendingHashV174 = null;
  appState.pendingHashV173 = null;
  appState.pendingHashV172 = null;
}

function hideBootPageV18() {
  document.querySelector("#bootPage")?.classList.add("hidden");
}

function showBootPageV18() {
  document.querySelector("#bootPage")?.classList.remove("hidden");
}

function resetLoginButtonV18() {
  const button = elements.loginButton;
  if (!button) return;
  button.disabled = false;
  button.removeAttribute("aria-busy");
  button.textContent = "เข้าสู่ระบบ";
}

function waitWithTimeoutV18(promise, timeoutMs, label) {
  let timeoutId = null;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      const error = new Error(`${label}ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง`);
      error.code = "TIMEOUT";
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) window.clearTimeout(timeoutId);
  });
}

function showLoginPageCleanV18(options = {}) {
  const { message = "", showError = false, rememberHash = true } = options;
  if (rememberHash) rememberPendingHashV18();

  appState.user = null;
  appState.profile = null;
  appState.currentPage = getPageFromHash ? getPageFromHash() : "dashboard";
  appState.selectedQuotationIds?.clear?.();
  appState.activeActions?.clear?.();

  hideBootPageV18();
  hidePageBusy?.();
  resetLoginButtonV18();

  elements.appShell?.classList.add("hidden");
  elements.loginPage?.classList.remove("hidden");
  document.body.classList.remove("nav-open");

  if (showError && message) showLoginError(message);
  else hideLoginError?.();
}

function showAppShellV18() {
  hideBootPageV18();
  hideLoginError?.();
  elements.loginPage?.classList.add("hidden");
  elements.appShell?.classList.remove("hidden");
  document.body.classList.remove("nav-open");
  showAppShell();
}

async function loadProfile(sessionArg) {
  if (!isUsableSessionV18(sessionArg)) {
    const error = new Error("AUTH_SESSION_MISSING");
    error.code = "AUTH_SESSION_MISSING";
    throw error;
  }

  appState.user = sessionArg.user;

  const profileQuery = supabaseClient
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", sessionArg.user.id)
    .maybeSingle();

  const { data, error } = await waitWithTimeoutV18(
    profileQuery,
    12000,
    "การโหลดข้อมูลผู้ใช้ "
  );

  if (error) {
    console.error(`loadProfile v${FI_V18_CORRECTED_VERSION}`, error);
    throw error;
  }

  if (!data) {
    const profileError = new Error("ไม่พบข้อมูลผู้ใช้ในตาราง profiles กรุณาติดต่อ Admin");
    profileError.code = "PROFILE_NOT_FOUND";
    throw profileError;
  }

  if (data.is_active === false) {
    await supabaseClient.auth.signOut();
    const inactiveError = new Error("บัญชีนี้ถูกปิดการใช้งาน");
    inactiveError.code = "PROFILE_INACTIVE";
    throw inactiveError;
  }

  appState.profile = data;
  return data;
}

async function bootAuthenticatedAppV18(session, reason = "boot") {
  const seq = ++appState.authSeqV18;

  if (!isUsableSessionV18(session)) {
    showLoginPageCleanV18({ rememberHash: true });
    return false;
  }

  try {
    await loadProfile(session);
    if (seq !== appState.authSeqV18) return false;

    showAppShellV18();

    const targetHash = appState.pendingHashV18 || getCurrentHashV18() || "#dashboard";
    clearPendingHashV18();

    if (!location.hash || location.hash === "#") {
      location.hash = targetHash || "#dashboard";
      return true;
    }

    if (targetHash && location.hash !== targetHash) {
      location.hash = targetHash;
      return true;
    }

    queueRenderV18(`boot-${reason}`);
    return true;
  } catch (error) {
    if (seq !== appState.authSeqV18) return false;

    const code = String(error?.code || error?.message || "");
    if (code === "AUTH_SESSION_MISSING") {
      showLoginPageCleanV18({ rememberHash: true });
      return false;
    }

    showLoginPageCleanV18({
      showError: true,
      message: error.message || "เข้าสู่ระบบได้แล้ว แต่ไม่สามารถโหลดข้อมูลผู้ใช้ได้",
      rememberHash: true,
    });
    return false;
  }
}

function queueRenderV18(reason = "render") {
  window.setTimeout(() => {
    renderCurrentPage({ force: true, reason }).catch((error) => {
      console.error(`queueRender v${FI_V18_CORRECTED_VERSION}`, error);
      if (typeof renderErrorStateWithRetry === "function") {
        renderErrorStateWithRetry(error.message || "ไม่สามารถโหลดหน้านี้ได้ กรุณากดโหลดข้อมูลใหม่");
      } else {
        renderError(error.message || "ไม่สามารถโหลดหน้านี้ได้ กรุณาลองใหม่อีกครั้ง");
      }
    });
  }, 0);
}

async function initApp() {
  if (!isConfigured || !supabaseClient?.auth) {
    showLoginPageCleanV18({
      showError: true,
      message: window.supabase?.createClient
        ? "ยังไม่ได้ตั้งค่า Supabase URL และ anon key ในไฟล์ script.js"
        : "โหลด Supabase SDK ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตหรือ CDN แล้วลองใหม่",
      rememberHash: false,
    });
    return;
  }

  bindEvents();
  bindAuthStateV18();
  startRequiredStarObserverV16?.();

  // Keep the UI usable immediately. Do not block boot on getSession().
  showLoginPageCleanV18({ rememberHash: true });

  // Branding is cosmetic. It must never block login or boot.
  if (typeof loadAndApplyAppBranding === "function") {
    waitWithTimeoutV18(loadAndApplyAppBranding(), 2500, "การโหลด Branding ")
      .catch((error) => console.warn(`Branding skipped v${FI_V18_CORRECTED_VERSION}`, error));
  }
}

function bindAuthStateV18() {
  if (window.__fiAuthBoundV18) return;
  window.__fiAuthBoundV18 = true;

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      showLoginPageCleanV18({ rememberHash: false });
      return;
    }

    if (isUsableSessionV18(session)) {
      bootAuthenticatedAppV18(session, `auth-${event}`).catch((error) => {
        console.error(`auth listener v${FI_V18_CORRECTED_VERSION}`, error);
        showLoginPageCleanV18({
          showError: true,
          message: error.message || "ไม่สามารถเปิดระบบจาก session ปัจจุบันได้ กรุณาเข้าสู่ระบบใหม่",
          rememberHash: true,
        });
      });
    }
  });
}

function bindEvents() {
  if (elements.loginForm && !elements.loginForm.dataset.v18Bound) {
    elements.loginForm.dataset.v18Bound = "true";
    elements.loginForm.addEventListener("submit", handleLogin);
  }

  if (elements.logoutButton && !elements.logoutButton.dataset.v18Bound) {
    elements.logoutButton.dataset.v18Bound = "true";
    elements.logoutButton.addEventListener("click", handleLogout);
  }

  const mobileMenuButton = document.querySelector("#mobileMenuButton");
  if (mobileMenuButton && !mobileMenuButton.dataset.v18Bound) {
    mobileMenuButton.dataset.v18Bound = "true";
    mobileMenuButton.addEventListener("click", () => {
      elements.sidebarMenu?.classList.toggle("is-open");
      document.body.classList.toggle("nav-open");
    });
  }

  if (!window.__fiHashBoundV18) {
    window.__fiHashBoundV18 = true;
    window.addEventListener("hashchange", async () => {
      appState.currentPage = getPageFromHash();
      if (isAuthenticatedV18()) {
        await renderCurrentPage({ force: true, reason: "hashchange-v18" });
      } else {
        showLoginPageCleanV18({ rememberHash: true });
      }
    });
  }

  if (!window.__fiDelegatedEventsBoundV18) {
    window.__fiDelegatedEventsBoundV18 = true;
    document.addEventListener("pointerdown", (event) => {
      if (typeof isFileInputElement === "function" && isFileInputElement(event.target)) {
        markFilePickerInteraction?.();
      }
    }, true);

    document.addEventListener("click", (event) => {
      if (typeof isFileInputElement === "function" && isFileInputElement(event.target)) {
        markFilePickerInteraction?.();
      }
      handleDelegatedClick?.(event);
    }, true);

    document.addEventListener("change", (event) => {
      if (typeof isFileInputElement === "function" && isFileInputElement(event.target)) {
        releaseFilePickerInteraction?.(2200);
        return;
      }
      handleDelegatedChange?.(event);
    }, true);
  }

  if (!window.__fiLifecycleBoundV18) {
    window.__fiLifecycleBoundV18 = true;
    window.addEventListener("focus", () => recoverAppAfterResume("focus"));
    window.addEventListener("pageshow", (event) => recoverAppAfterResume(event.persisted ? "pageshow-cache" : "pageshow"));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") recoverAppAfterResume("visibilitychange");
    });
  }
}

async function handleLogin(event) {
  event.preventDefault();

  if (!supabaseClient?.auth) {
    showLoginError("ยังไม่ได้ตั้งค่า Supabase หรือโหลด Supabase SDK ไม่สำเร็จ");
    return;
  }

  const email = elements.loginEmail?.value?.trim() || "";
  const password = elements.loginPassword?.value || "";

  if (!email || !password) {
    showLoginError("กรุณากรอกอีเมลและรหัสผ่าน");
    return;
  }

  const seq = ++appState.authSeqV18;
  const button = elements.loginButton;
  hideLoginError?.();

  if (button) {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "กำลังเข้าสู่ระบบ...";
  }

  try {
    const { data, error } = await waitWithTimeoutV18(
      supabaseClient.auth.signInWithPassword({ email, password }),
      20000,
      "การเข้าสู่ระบบ "
    );

    if (seq !== appState.authSeqV18) return;

    if (error) {
      showLoginError("อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      return;
    }

    const session = data?.session;
    if (!isUsableSessionV18(session)) {
      showLoginError("เข้าสู่ระบบสำเร็จแต่ยังไม่พบ session กรุณาลองใหม่อีกครั้ง");
      return;
    }

    const ok = await bootAuthenticatedAppV18(session, "login-v18");
    if (ok) showToast?.("เข้าสู่ระบบสำเร็จ", "success");
  } catch (error) {
    if (seq !== appState.authSeqV18) return;
    console.error(`handleLogin v${FI_V18_CORRECTED_VERSION}`, error);
    showLoginError(error.message || "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง");
  } finally {
    if (seq === appState.authSeqV18) resetLoginButtonV18();
  }
}

async function handleLogout() {
  if (!supabaseClient?.auth) return;

  const ok = window.confirm("ต้องการออกจากระบบใช่ไหม?");
  if (!ok) return;

  ++appState.authSeqV18;
  try {
    await waitWithTimeoutV18(supabaseClient.auth.signOut(), 10000, "การออกจากระบบ ");
  } catch (error) {
    console.warn(`signOut v${FI_V18_CORRECTED_VERSION}`, error);
  } finally {
    showLoginPageCleanV18({ rememberHash: false });
    showToast?.("ออกจากระบบแล้ว", "success");
  }
}

async function renderCurrentPage(options = {}) {
  if (!isAuthenticatedV18()) {
    showLoginPageCleanV18({ rememberHash: true });
    return;
  }

  const token = ++appState.renderSeqV18;
  appState.currentPage = getPageFromHash() || "dashboard";

  showAppShellV18();
  renderMenu?.();
  if (typeof applySystemBrandingToHeader === "function") applySystemBrandingToHeader();
  hidePageBusy?.();

  const page = appState.currentPage || "dashboard";
  const watchdogId = window.setTimeout(() => {
    if (appState.renderSeqV18 !== token) return;
    if (typeof hasVisibleLoadingV161 === "function" && hasVisibleLoadingV161()) {
      if (typeof renderErrorStateWithRetry === "function") {
        renderErrorStateWithRetry("โหลดข้อมูลนานเกินไปหรือการเชื่อมต่อค้าง กรุณากดโหลดข้อมูลใหม่");
      } else {
        renderError("โหลดข้อมูลนานเกินไปหรือการเชื่อมต่อค้าง กรุณาลองใหม่อีกครั้ง");
      }
    }
  }, 18000);

  try {
    if (typeof renderPageByKeyV161 === "function") {
      await renderPageByKeyV161(page);
    } else {
      await renderPageByKeyFallbackV18(page);
    }

    if (appState.renderSeqV18 !== token) return;
    appState.lastSuccessfulRenderAtV18 = Date.now();
    appState.lastSuccessfulRenderAtV173 = Date.now();
    appState.lastSuccessfulRenderAtV172 = Date.now();
    appState.lastSuccessfulRenderAt = Date.now();
    decorateRequiredStars?.();
  } catch (error) {
    if (appState.renderSeqV18 !== token) return;
    console.error(`renderCurrentPage v${FI_V18_CORRECTED_VERSION}`, page, error);
    hidePageBusy?.();
    if (typeof renderErrorStateWithRetry === "function") {
      renderErrorStateWithRetry(error.message || "ไม่สามารถโหลดข้อมูลได้ กรุณากดโหลดข้อมูลใหม่");
    } else {
      renderError(error.message || "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
    }
  } finally {
    window.clearTimeout(watchdogId);
    hidePageBusy?.();
  }
}

async function renderPageByKeyFallbackV18(page) {
  if (page === "dashboard") return renderDashboardPage();
  if (page === "quotations") return renderQuotationsPage();
  if (page === "quotation-new") return renderQuotationCreatePage();
  if (page.startsWith("quotation-edit/")) return renderQuotationEditPage(page.replace("quotation-edit/", ""));
  if (page.startsWith("quotation-view/")) return renderQuotationViewPage(page.replace("quotation-view/", ""));
  if (page.startsWith("quotation-print/")) return renderQuotationPrintPage(page.replace("quotation-print/", ""));
  if (page === "customers") return renderCustomersPage();
  if (page === "products") return renderProductsPage();
  if (page === "product-new") return renderProductFormPage({ mode: "create", productId: null });
  if (page.startsWith("product-edit/")) return renderProductFormPage({ mode: "edit", productId: page.replace("product-edit/", "") });
  if (page === "company") return renderCompanyPage();
  if (page === "settings") return renderSettingsPage();
  location.hash = "#dashboard";
}

async function recoverAppAfterResume(reason = "resume") {
  if (!isConfigured || !supabaseClient?.auth || document.visibilityState === "hidden") return;
  if (!isAuthenticatedV18()) return;
  if (typeof shouldSkipResumeRecoveryForFilePicker === "function" && shouldSkipResumeRecoveryForFilePicker()) {
    releaseFilePickerInteraction?.(1800);
    return;
  }

  const now = Date.now();
  if (now - Number(appState.lastResumeAttemptAtV18 || 0) < 1600) return;
  if (appState.resumeInProgressV18) return;

  appState.lastResumeAttemptAtV18 = now;
  appState.resumeInProgressV18 = true;

  try {
    hidePageBusy?.();
    showAppShellV18();
    await renderCurrentPage({ force: true, reason: `resume-${reason}-v18` });
  } catch (error) {
    console.warn(`recoverAppAfterResume v${FI_V18_CORRECTED_VERSION}`, error);
  } finally {
    appState.resumeInProgressV18 = false;
  }
}

window.FI_APP_VERSION = FI_V18_CORRECTED_VERSION;


// =======================================================
// v1.9.0 Clean Codebase Stabilization Layer
// Purpose: provide one final, predictable Auth / Router / Render lifecycle
// while preserving feature parity from the v1.8.0 corrected integration build.
// =======================================================

const FI_V19_VERSION = "1.9.1";
window.FI_APP_VERSION = FI_V19_VERSION;

Object.assign(appState, {
  authSeqV19: 0,
  renderSeqV19: 0,
  pendingHashV19: null,
  authStateV19: "booting",
  lastSuccessfulRenderAtV19: 0,
  lastResumeAtV19: 0,
  isBootingV19: false,
});

const FI_ROUTES_V19 = [
  {
    key: "dashboard",
    label: "แดชบอร์ด",
    menu: true,
    roles: ["admin", "manager", "sales"],
    match: (page) => page === "dashboard",
    render: () => renderDashboardPage(),
  },
  {
    key: "quotations",
    label: "ใบเสนอราคา",
    menu: true,
    roles: ["admin", "manager", "sales"],
    match: (page) => page === "quotations",
    render: () => renderQuotationsPage(),
  },
  {
    key: "quotation-new",
    label: "สร้างใบเสนอราคา",
    roles: ["admin", "sales"],
    match: (page) => page === "quotation-new",
    render: () => renderQuotationCreatePage(),
  },
  {
    key: "quotation-edit",
    label: "แก้ไข Draft",
    roles: ["admin", "sales"],
    match: (page) => page.startsWith("quotation-edit/"),
    render: (page) => renderQuotationEditPage(page.replace("quotation-edit/", "")),
  },
  {
    key: "quotation-view",
    label: "รายละเอียดใบเสนอราคา",
    roles: ["admin", "manager", "sales"],
    match: (page) => page.startsWith("quotation-view/"),
    render: (page) => renderQuotationViewPage(page.replace("quotation-view/", "")),
  },
  {
    key: "quotation-print",
    label: "Preview / Print",
    roles: ["admin", "manager", "sales"],
    match: (page) => page.startsWith("quotation-print/"),
    render: (page) => renderQuotationPrintPage(page.replace("quotation-print/", "")),
  },
  {
    key: "customers",
    label: "ลูกค้า",
    menu: true,
    roles: ["admin", "manager", "sales"],
    match: (page) => page === "customers",
    render: () => renderCustomersPage(),
  },
  {
    key: "products",
    label: "สินค้า/บริการ",
    menu: true,
    roles: ["admin", "manager", "sales"],
    match: (page) => page === "products",
    render: () => renderProductsPage(),
  },
  {
    key: "product-new",
    label: "เพิ่มสินค้า",
    roles: ["admin"],
    match: (page) => page === "product-new",
    render: () => renderProductFormPage({ mode: "create", productId: null }),
  },
  {
    key: "product-edit",
    label: "แก้ไขสินค้า",
    roles: ["admin"],
    match: (page) => page.startsWith("product-edit/"),
    render: (page) => renderProductFormPage({ mode: "edit", productId: page.replace("product-edit/", "") }),
  },
  {
    key: "company",
    label: "Company Profile",
    menu: true,
    roles: ["admin"],
    match: (page) => page === "company",
    render: () => renderCompanyPage(),
  },
  {
    key: "settings",
    label: "ตั้งค่า",
    menu: true,
    roles: ["admin"],
    match: (page) => page === "settings",
    render: () => renderSettingsPage(),
  },
];

function withTimeoutV19(promise, milliseconds, label = "การทำงาน") {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label}ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง`));
    }, milliseconds);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function isUsableSessionV19(session) {
  return Boolean(session?.access_token && session?.user?.id);
}

function isAuthenticatedV19() {
  return Boolean(appState.user?.id && appState.profile?.id);
}

function rememberCurrentHashV19() {
  const hash = location.hash || "#dashboard";
  if (hash && hash !== "#") appState.pendingHashV19 = hash;
}

function hideBootPageV19() {
  const bootPage = document.querySelector("#bootPage");
  if (bootPage) bootPage.classList.add("hidden");
}

function resetLoginButtonV19() {
  if (!elements.loginButton) return;
  elements.loginButton.disabled = false;
  elements.loginButton.removeAttribute("aria-busy");
  elements.loginButton.textContent = "เข้าสู่ระบบ";
}

function showLoginPageCleanV19(options = {}) {
  const { showError = false, message = "", rememberHash = true } = options;

  if (rememberHash) rememberCurrentHashV19();

  appState.user = null;
  appState.profile = null;
  appState.authStateV19 = "unauthenticated";

  hideBootPageV19();
  if (typeof hidePageBusy === "function") hidePageBusy();

  elements.appShell?.classList.add("hidden");
  elements.loginPage?.classList.remove("hidden");
  resetLoginButtonV19();

  if (showError && message) {
    showLoginError(message);
  } else if (typeof hideLoginError === "function") {
    hideLoginError();
  }
}

function showAppShellV19() {
  if (!isAuthenticatedV19()) {
    showLoginPageCleanV19({ rememberHash: true });
    return;
  }

  hideBootPageV19();
  elements.loginPage?.classList.add("hidden");
  elements.appShell?.classList.remove("hidden");

  if (elements.userName) {
    elements.userName.textContent = appState.profile.full_name || appState.profile.email || "-";
  }

  if (elements.userRole) {
    elements.userRole.textContent = roleLabel(appState.profile.role);
  }

  const userChip = document.querySelector("#headerUserChip");
  if (userChip) {
    const name = appState.profile.full_name || appState.profile.email || "-";
    userChip.textContent = `${name} · ${roleLabel(appState.profile.role)}`;
  }

  renderMenu();
}

async function loadProfile(sessionArg) {
  const session = sessionArg || (await supabaseClient.auth.getSession()).data?.session;

  if (!isUsableSessionV19(session)) {
    throw new Error("AUTH_NO_SESSION");
  }

  appState.user = session.user;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    console.error("loadProfile v1.9", error);
    throw new Error("ไม่สามารถโหลดข้อมูลผู้ใช้ได้ กรุณาติดต่อ Admin หรือลองเข้าสู่ระบบใหม่");
  }

  if (!data) {
    throw new Error("ไม่พบข้อมูลผู้ใช้ในตาราง profiles กรุณาให้ Admin ตรวจสอบบัญชีนี้");
  }

  if (data.is_active === false) {
    await supabaseClient.auth.signOut();
    throw new Error("บัญชีนี้ถูกปิดการใช้งาน");
  }

  appState.profile = data;
  return data;
}

function findRouteV19(page) {
  return FI_ROUTES_V19.find((route) => route.match(page));
}

function canAccessRouteV19(route) {
  if (!route) return false;
  const role = appState.profile?.role;
  return Boolean(role && route.roles.includes(role));
}

function getCurrentPageV19() {
  return (location.hash || "#dashboard").replace(/^#/, "") || "dashboard";
}

function getMenuActiveKeyV19(page) {
  if (page.startsWith("quotation-")) return "quotations";
  if (page.startsWith("product-")) return "products";
  return page;
}

function renderMenu() {
  if (!elements.sidebarMenu || !appState.profile?.role) return;

  const role = appState.profile.role;
  const currentPage = getCurrentPageV19();
  const activeKey = getMenuActiveKeyV19(currentPage);

  const menus = FI_ROUTES_V19.filter((route) => route.menu && route.roles.includes(role));

  elements.sidebarMenu.innerHTML = menus
    .map((route) => `
      <button type="button" class="menu-item ${route.key === activeKey ? "active" : ""}" data-page="${escapeHTML(route.key)}">
        <span>${menuIcon(route.key)}</span>
        <span>${escapeHTML(route.label)}</span>
      </button>
    `)
    .join("");

  elements.sidebarMenu.querySelectorAll(".menu-item[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      location.hash = `#${button.dataset.page}`;
      elements.sidebarMenu?.classList.remove("is-open");
      document.body.classList.remove("nav-open");
    });
  });
}

async function bootAuthenticatedAppV19(session, reason = "boot") {
  if (!isUsableSessionV19(session)) {
    showLoginPageCleanV19({ rememberHash: true });
    return false;
  }

  const seq = ++appState.authSeqV19;
  appState.authStateV19 = "profile_loading";

  try {
    await withTimeoutV19(loadProfile(session), 15000, "การโหลดข้อมูลผู้ใช้ ");

    if (seq !== appState.authSeqV19) return false;

    appState.authStateV19 = "ready";
    showAppShellV19();

    const targetHash = appState.pendingHashV19 || location.hash || "#dashboard";
    appState.pendingHashV19 = null;

    if (location.hash !== targetHash) {
      location.hash = targetHash;
      return true;
    }

    window.setTimeout(() => {
      renderCurrentPage({ reason: `boot-v19-${reason}` }).catch((error) => {
        console.error("boot render v1.9", error);
        renderErrorStateV19(error.message || "ไม่สามารถโหลดหน้านี้ได้");
      });
    }, 0);

    return true;
  } catch (error) {
    if (seq !== appState.authSeqV19) return false;
    console.error("bootAuthenticatedApp v1.9", error);
    showLoginPageCleanV19({
      showError: true,
      message: error.message === "AUTH_NO_SESSION"
        ? "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่"
        : error.message || "ไม่สามารถเปิดระบบได้ กรุณาเข้าสู่ระบบใหม่",
      rememberHash: true,
    });
    return false;
  }
}

function bindAuthStateV19() {
  if (window.__fiAuthBoundV19) return;
  window.__fiAuthBoundV19 = true;

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      ++appState.authSeqV19;
      showLoginPageCleanV19({ rememberHash: false });
      return;
    }

    if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      if (isUsableSessionV19(session)) {
        bootAuthenticatedAppV19(session, event).catch((error) => {
          console.error("auth state v1.9", error);
          showLoginPageCleanV19({
            showError: true,
            message: error.message || "ไม่สามารถใช้ session ปัจจุบันได้ กรุณาเข้าสู่ระบบใหม่",
            rememberHash: true,
          });
        });
      }
    }
  });
}

function bindEvents() {
  if (elements.loginForm && !elements.loginForm.dataset.v19Bound) {
    elements.loginForm.dataset.v19Bound = "true";
    elements.loginForm.addEventListener("submit", handleLogin);
  }

  if (elements.logoutButton && !elements.logoutButton.dataset.v19Bound) {
    elements.logoutButton.dataset.v19Bound = "true";
    elements.logoutButton.addEventListener("click", handleLogout);
  }

  const mobileMenuButton = document.querySelector("#mobileMenuButton");
  if (mobileMenuButton && !mobileMenuButton.dataset.v19Bound) {
    mobileMenuButton.dataset.v19Bound = "true";
    mobileMenuButton.addEventListener("click", () => {
      elements.sidebarMenu?.classList.toggle("is-open");
      document.body.classList.toggle("nav-open");
    });
  }

  if (!window.__fiHashBoundV19) {
    window.__fiHashBoundV19 = true;
    window.addEventListener("hashchange", () => {
      appState.currentPage = getCurrentPageV19();
      if (isAuthenticatedV19()) {
        renderCurrentPage({ reason: "hashchange-v19" }).catch((error) => {
          console.error("hashchange v1.9", error);
          renderErrorStateV19(error.message || "ไม่สามารถโหลดหน้านี้ได้");
        });
      } else {
        showLoginPageCleanV19({ rememberHash: true });
      }
    });
  }

  if (!window.__fiLifecycleBoundV19) {
    window.__fiLifecycleBoundV19 = true;
    window.addEventListener("focus", () => recoverAppAfterResume("focus"));
    window.addEventListener("pageshow", (event) => recoverAppAfterResume(event.persisted ? "pageshow-cache" : "pageshow"));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") recoverAppAfterResume("visibilitychange");
    });
  }
}

async function initApp() {
  bindEvents();
  hideBootPageV19();

  if (!isConfigured || !supabaseClient?.auth) {
    showLoginPageCleanV19({
      showError: true,
      message: window.supabase?.createClient
        ? "ยังไม่ได้ตั้งค่า Supabase URL และ anon key ในไฟล์ script.js"
        : "โหลด Supabase SDK ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตหรือ CDN แล้วลองใหม่",
      rememberHash: false,
    });
    return;
  }

  appState.currentPage = getCurrentPageV19();
  showLoginPageCleanV19({ rememberHash: true });
  bindAuthStateV19();

  // Cosmetic only. Branding must not block login or boot.
  if (typeof loadAndApplyAppBranding === "function") {
    withTimeoutV19(loadAndApplyAppBranding(), 2500, "การโหลด Branding ")
      .catch((error) => console.warn("Branding skipped v1.9", error));
  }

  // Explicit background session check for browsers where INITIAL_SESSION is delayed.
  withTimeoutV19(supabaseClient.auth.getSession(), 8000, "การตรวจสอบ session ")
    .then(({ data }) => {
      if (isUsableSessionV19(data?.session)) return bootAuthenticatedAppV19(data.session, "getSession-v19");
      return null;
    })
    .catch((error) => {
      console.warn("Initial session check skipped v1.9", error);
      showLoginPageCleanV19({ rememberHash: true });
    });
}

async function handleLogin(event) {
  event.preventDefault();

  if (!supabaseClient?.auth) {
    showLoginError("ยังไม่ได้ตั้งค่า Supabase หรือโหลด Supabase SDK ไม่สำเร็จ");
    return;
  }

  const email = elements.loginEmail?.value?.trim() || "";
  const password = elements.loginPassword?.value || "";

  if (!email || !password) {
    showLoginError("กรุณากรอกอีเมลและรหัสผ่าน");
    return;
  }

  const seq = ++appState.authSeqV19;
  hideLoginError?.();

  if (elements.loginButton) {
    elements.loginButton.disabled = true;
    elements.loginButton.setAttribute("aria-busy", "true");
    elements.loginButton.textContent = "กำลังเข้าสู่ระบบ...";
  }

  try {
    const { data, error } = await withTimeoutV19(
      supabaseClient.auth.signInWithPassword({ email, password }),
      20000,
      "การเข้าสู่ระบบ "
    );

    if (seq !== appState.authSeqV19) return;

    if (error) {
      showLoginError("อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      return;
    }

    if (!isUsableSessionV19(data?.session)) {
      showLoginError("เข้าสู่ระบบสำเร็จแต่ยังไม่พบ session กรุณาลองใหม่อีกครั้ง");
      return;
    }

    const ok = await bootAuthenticatedAppV19(data.session, "login");
    if (ok) showToast?.("เข้าสู่ระบบสำเร็จ", "success");
  } catch (error) {
    if (seq !== appState.authSeqV19) return;
    console.error("handleLogin v1.9", error);
    showLoginError(error.message || "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง");
  } finally {
    if (seq === appState.authSeqV19) resetLoginButtonV19();
  }
}

async function handleLogout() {
  if (!supabaseClient?.auth) return;

  const ok = window.confirm("ต้องการออกจากระบบใช่ไหม?");
  if (!ok) return;

  ++appState.authSeqV19;
  try {
    await withTimeoutV19(supabaseClient.auth.signOut(), 10000, "การออกจากระบบ ");
  } catch (error) {
    console.warn("signOut v1.9", error);
  } finally {
    showLoginPageCleanV19({ rememberHash: false });
    showToast?.("ออกจากระบบแล้ว", "success");
  }
}

async function renderCurrentPage(options = {}) {
  if (!isAuthenticatedV19()) {
    showLoginPageCleanV19({ rememberHash: true });
    return;
  }

  const token = ++appState.renderSeqV19;
  const page = getCurrentPageV19();
  appState.currentPage = page;

  showAppShellV19();

  const route = findRouteV19(page);

  if (!route) {
    location.hash = "#dashboard";
    return;
  }

  if (!canAccessRouteV19(route)) {
    renderErrorStateV19("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
    return;
  }

  const watchdogId = window.setTimeout(() => {
    if (appState.renderSeqV19 !== token) return;
    renderErrorStateV19("โหลดข้อมูลนานเกินไปหรือการเชื่อมต่อค้าง กรุณากดโหลดข้อมูลใหม่");
  }, 20000);

  try {
    await route.render(page);

    if (appState.renderSeqV19 !== token) return;

    appState.lastSuccessfulRenderAtV19 = Date.now();
    appState.lastSuccessfulRenderAt = Date.now();

    if (typeof decorateRequiredStars === "function") decorateRequiredStars();
    renderMenu();
  } catch (error) {
    if (appState.renderSeqV19 !== token) return;
    console.error("renderCurrentPage v1.9", page, error);
    renderErrorStateV19(error.message || "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
  } finally {
    window.clearTimeout(watchdogId);
    if (typeof hidePageBusy === "function") hidePageBusy();
  }
}

function renderErrorStateV19(message) {
  if (!elements.pageContent) return;
  elements.pageContent.innerHTML = `
    <div class="card">
      <div class="alert alert-error">${escapeHTML(message || "ไม่สามารถโหลดข้อมูลได้")}</div>
      <div class="error-actions">
        <button type="button" id="retryCurrentPageButton" class="btn btn-primary">โหลดข้อมูลใหม่</button>
        <button type="button" id="goDashboardButton" class="btn btn-ghost">กลับแดชบอร์ด</button>
      </div>
    </div>
  `;

  document.querySelector("#retryCurrentPageButton")?.addEventListener("click", () => {
    renderCurrentPage({ reason: "retry-v19" });
  });

  document.querySelector("#goDashboardButton")?.addEventListener("click", () => {
    location.hash = "#dashboard";
  });
}

async function recoverAppAfterResume(reason = "resume") {
  if (!isConfigured || !supabaseClient?.auth || document.visibilityState === "hidden") return;
  if (!isAuthenticatedV19()) return;

  const now = Date.now();
  if (now - Number(appState.lastResumeAtV19 || 0) < 1800) return;
  appState.lastResumeAtV19 = now;

  try {
    if (typeof shouldSkipResumeRecoveryForFilePicker === "function" && shouldSkipResumeRecoveryForFilePicker()) {
      if (typeof releaseFilePickerInteraction === "function") releaseFilePickerInteraction(1800);
      return;
    }

    const { data } = await withTimeoutV19(supabaseClient.auth.getSession(), 6000, "การตรวจสอบ session ");

    if (!isUsableSessionV19(data?.session)) {
      showLoginPageCleanV19({ rememberHash: true });
      return;
    }

    await renderCurrentPage({ reason: `resume-${reason}` });
  } catch (error) {
    console.warn("recoverAppAfterResume v1.9", error);
  }
}

// Final visible version stamp for QA.
window.FI_APP_VERSION = FI_V19_VERSION;


// =======================================================
// v1.9.1 Foundation Stabilization Patch
// Scope: SQL/RLS guard, debug helper, clearer error states, and release support.
// This patch intentionally preserves v1.9 runtime feature parity.
// =======================================================

const FI_V191_VERSION = "1.9.1";
window.FI_APP_VERSION = FI_V191_VERSION;

function normalizeErrorMessageV191(error) {
  const raw = String(error?.message || error?.details || error || "");
  const code = String(error?.code || "");
  const lower = raw.toLowerCase();

  if (raw === "AUTH_NO_SESSION" || lower.includes("auth_no_session")) {
    return "Session หมดอายุหรือยังไม่พร้อม กรุณาเข้าสู่ระบบใหม่";
  }

  if (code === "42501" || lower.includes("permission denied") || lower.includes("rls")) {
    return "สิทธิ์ฐานข้อมูลยังไม่ครบหรือ RLS ยังไม่ถูกต้อง กรุณารัน supabase/patch_v1_9_1.sql แล้วลองใหม่";
  }

  if (code === "42P01" || lower.includes("does not exist") || lower.includes("function") || lower.includes("relation")) {
    return "โครงสร้างฐานข้อมูลหรือ function ยังไม่ครบ กรุณารัน supabase/patch_v1_9_1.sql แล้วลองใหม่";
  }

  if (lower.includes("network") || lower.includes("failed to fetch") || lower.includes("fetch")) {
    return "เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่";
  }

  if (raw.includes("ใช้เวลานานเกินไป")) {
    return raw;
  }

  return raw || "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง";
}

// Override profile loader with stricter session guard and clearer SQL/RLS errors.
async function loadProfile(sessionArg) {
  const session = sessionArg || (await supabaseClient.auth.getSession()).data?.session;

  if (!isUsableSessionV19(session)) {
    const error = new Error("AUTH_NO_SESSION");
    error.code = "AUTH_NO_SESSION";
    throw error;
  }

  appState.user = session.user;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    console.error("loadProfile v1.9.1", error);
    throw new Error(normalizeErrorMessageV191(error));
  }

  if (!data) {
    throw new Error("ไม่พบข้อมูลผู้ใช้ในตาราง profiles กรุณาให้ Admin ตรวจสอบบัญชีนี้");
  }

  if (data.is_active === false) {
    await supabaseClient.auth.signOut();
    throw new Error("บัญชีนี้ถูกปิดการใช้งาน");
  }

  appState.profile = data;
  return data;
}

// Override page error state with practical recovery actions and SQL hint mapping.
function renderErrorStateV19(message, options = {}) {
  if (!elements.pageContent) return;

  const normalized = normalizeErrorMessageV191(message);
  const current = escapeHTML(location.hash || "#dashboard");
  const version = escapeHTML(window.FI_APP_VERSION || "unknown");

  elements.pageContent.innerHTML = `
    <div class="card">
      <div class="alert alert-error">${escapeHTML(normalized)}</div>
      <div class="error-actions">
        <button type="button" id="retryCurrentPageButton" class="btn btn-primary">โหลดข้อมูลใหม่</button>
        <button type="button" id="goDashboardButton" class="btn btn-ghost">กลับแดชบอร์ด</button>
      </div>
      <div class="error-meta">
        Version: ${version}<br />
        Route: ${current}<br />
        หากเป็น error เรื่องสิทธิ์ฐานข้อมูล ให้รัน <strong>supabase/patch_v1_9_1.sql</strong>
      </div>
    </div>
  `;

  document.querySelector("#retryCurrentPageButton")?.addEventListener("click", () => {
    renderCurrentPage({ reason: "retry-v191" });
  });

  document.querySelector("#goDashboardButton")?.addEventListener("click", () => {
    location.hash = "#dashboard";
  });
}

// Debug helper for support. No secrets are returned.
window.FI_DEBUG = async function FI_DEBUG() {
  let sessionInfo = { checked: false, hasSession: false, userId: null, expiresAt: null };

  try {
    if (supabaseClient?.auth) {
      const { data } = await supabaseClient.auth.getSession();
      sessionInfo = {
        checked: true,
        hasSession: Boolean(data?.session?.access_token),
        userId: data?.session?.user?.id || null,
        expiresAt: data?.session?.expires_at || null,
      };
    }
  } catch (error) {
    sessionInfo = { checked: true, error: String(error?.message || error) };
  }

  const result = {
    version: window.FI_APP_VERSION || null,
    hash: location.hash || "#dashboard",
    currentPage: typeof getCurrentPageV19 === "function" ? getCurrentPageV19() : appState.currentPage,
    authState: appState.authStateV19 || null,
    hasUser: Boolean(appState.user?.id),
    hasProfile: Boolean(appState.profile?.id),
    role: appState.profile?.role || null,
    supabaseConfigured: Boolean(isConfigured && supabaseClient),
    session: sessionInfo,
    lastSuccessfulRenderAt: appState.lastSuccessfulRenderAtV19 || appState.lastSuccessfulRenderAt || null,
  };

  console.table(result);
  return result;
};

// Final visible version stamp for QA.
window.FI_APP_VERSION = FI_V191_VERSION;

// =======================================================
// v1.9.2 Hotfix: Restore Delegated Events
// Scope: quotation list view button, sortable headers, row checkboxes, select-all,
// and other document-level delegated interactions that were not rebound by the
// final v1.9.1 lifecycle layer.
// =======================================================

const FI_V192_VERSION = "1.9.2";

(function restoreDelegatedEventsV192() {
  window.FI_APP_VERSION = FI_V192_VERSION;

  if (window.__fiDelegatedEventsBoundV192) return;
  window.__fiDelegatedEventsBoundV192 = true;

  document.addEventListener(
    "click",
    (event) => {
      if (typeof handleDelegatedClick === "function") {
        handleDelegatedClick(event);
      }
    },
    true
  );

  document.addEventListener(
    "change",
    (event) => {
      if (typeof handleDelegatedChange === "function") {
        handleDelegatedChange(event);
      }
    },
    true
  );
})();

// Final visible version stamp for QA.
window.FI_APP_VERSION = FI_V192_VERSION;


// =======================================================
// v1.9.3 Hotfix: Quotation Form State Preservation
// Scope: preserve unsaved quotation-new / quotation-edit form data when the
// browser tab is hidden/resumed or the route is re-rendered by lifecycle recovery.
// =======================================================

const FI_V193_VERSION = "1.9.3";
const FI_V194_VERSION = "1.9.4";

const FI_QUOTATION_FORM_AUTOSAVE_FIELDS_V193 = [
  "draftCustomerName",
  "draftCustomerAddress",
  "draftQuoteDate",
  "draftValidUntil",
  "draftBillingType",
  "draftProductId",
  "draftQuantity",
  "draftUnitPrice",
  "draftUnit",
  "draftOneTimeName",
  "draftOneTimeQty",
  "draftOneTimePrice",
  "draftOneTimeDescription",
  "draftDiscountPercent",
  "draftVatEnabled",
  "draftWhtEnabled",
  "draftRoundingEnabled",
  "draftNote",
  "draftPaymentTerms",
];

const FI_QUOTATION_FORM_AUTOSAVE_TTL_MS_V193 = 24 * 60 * 60 * 1000;

function isQuotationFormPageV193(page = getCurrentPageV19?.() || appState.currentPage || "") {
  return page === "quotation-new" || page.startsWith("quotation-edit/");
}

function getQuotationFormAutosaveKeyV193(page = getCurrentPageV19?.() || appState.currentPage || "") {
  const userId = appState.user?.id || "anonymous";
  return `fi_quotation_form_autosave:v1.9.3:${userId}:${page}`;
}

function getQuotationFormElementV193() {
  return document.querySelector("#quotationDraftForm");
}

function getQuotationFormValueV193(id) {
  const element = document.getElementById(id);
  if (!element) return undefined;

  if (element.type === "checkbox") {
    return Boolean(element.checked);
  }

  return element.value;
}

function setQuotationFormValueV193(id, value) {
  const element = document.getElementById(id);
  if (!element || value === undefined || value === null) return;

  if (element.type === "checkbox") {
    element.checked = Boolean(value);
    return;
  }

  if (element.tagName === "SELECT") {
    const hasOption = Array.from(element.options || []).some((option) => option.value === String(value));
    if (!hasOption) return;
  }

  element.value = String(value);
}

function readQuotationFormStateV193() {
  const values = {};

  FI_QUOTATION_FORM_AUTOSAVE_FIELDS_V193.forEach((id) => {
    const value = getQuotationFormValueV193(id);
    if (value !== undefined) values[id] = value;
  });

  return {
    version: FI_V193_VERSION,
    userId: appState.user?.id || null,
    page: getCurrentPageV19?.() || appState.currentPage || "",
    savedAt: Date.now(),
    values,
  };
}

function hasMeaningfulQuotationFormDataV193(state) {
  const values = state?.values || {};
  const textFields = [
    "draftCustomerName",
    "draftCustomerAddress",
    "draftRecurringDescription",
    "draftOneTimeName",
    "draftOneTimeDescription",
    "draftNote",
    "draftPaymentTerms",
  ];

  return textFields.some((id) => String(values[id] || "").trim().length > 0) ||
    Number(values.draftUnitPrice || 0) !== 4500 ||
    Number(values.draftOneTimePrice || 0) !== 4500 ||
    Number(values.draftQuantity || 0) !== 20 ||
    String(values.draftBillingType || "monthly") !== "monthly";
}

function saveQuotationFormStateV193() {
  if (!isQuotationFormPageV193()) return;
  if (!getQuotationFormElementV193()) return;

  try {
    const state = readQuotationFormStateV193();
    sessionStorage.setItem(getQuotationFormAutosaveKeyV193(state.page), JSON.stringify(state));
    appState.quotationFormDirtyV193 = hasMeaningfulQuotationFormDataV193(state);
    appState.quotationFormLastSavedAtV193 = state.savedAt;
  } catch (error) {
    console.warn("saveQuotationFormStateV193 skipped", error);
  }
}

function loadQuotationFormStateV193(page = getCurrentPageV19?.() || appState.currentPage || "") {
  try {
    const raw = sessionStorage.getItem(getQuotationFormAutosaveKeyV193(page));
    if (!raw) return null;

    const state = JSON.parse(raw);
    if (!state?.savedAt || Date.now() - Number(state.savedAt) > FI_QUOTATION_FORM_AUTOSAVE_TTL_MS_V193) {
      sessionStorage.removeItem(getQuotationFormAutosaveKeyV193(page));
      return null;
    }

    return state;
  } catch (error) {
    console.warn("loadQuotationFormStateV193 skipped", error);
    return null;
  }
}

function restoreQuotationFormStateV193() {
  if (!isQuotationFormPageV193()) return false;
  if (!getQuotationFormElementV193()) return false;

  const state = loadQuotationFormStateV193();
  if (!state?.values || !hasMeaningfulQuotationFormDataV193(state)) return false;

  Object.entries(state.values).forEach(([id, value]) => {
    setQuotationFormValueV193(id, value);
  });

  appState.quotationFormDirtyV193 = true;

  if (typeof updateDraftSummary === "function") {
    updateDraftSummary();
  }

  return true;
}

function clearQuotationFormStateV193(page = getCurrentPageV19?.() || appState.currentPage || "") {
  try {
    sessionStorage.removeItem(getQuotationFormAutosaveKeyV193(page));
    appState.quotationFormDirtyV193 = false;
    appState.quotationFormLastSavedAtV193 = null;
  } catch (error) {
    console.warn("clearQuotationFormStateV193 skipped", error);
  }
}

function bindQuotationFormAutosaveV193() {
  const form = getQuotationFormElementV193();
  if (!form || form.dataset.autosaveV193 === "1") return;

  form.dataset.autosaveV193 = "1";

  const save = () => saveQuotationFormStateV193();

  form.addEventListener("input", save, true);
  form.addEventListener("change", save, true);

  document.getElementById("cancelDraftButton")?.addEventListener("click", () => {
    clearQuotationFormStateV193();
  }, true);

  document.getElementById("saveDraftButton")?.addEventListener("click", () => {
    saveQuotationFormStateV193();
  }, true);
}

(function patchQuotationDraftBindingV193() {
  window.FI_APP_VERSION = FI_V193_VERSION;

  if (window.__fiQuotationDraftBindingPatchedV193) return;
  window.__fiQuotationDraftBindingPatchedV193 = true;

  const originalBindQuotationDraftForm = window.bindQuotationDraftForm;
  if (typeof originalBindQuotationDraftForm === "function") {
    window.bindQuotationDraftForm = function bindQuotationDraftFormV193(products, options = {}) {
      originalBindQuotationDraftForm.call(this, products, options);
      const restored = restoreQuotationFormStateV193();
      bindQuotationFormAutosaveV193();

      if (restored) {
        showToast?.("กู้คืนข้อมูลที่กรอกไว้แล้ว", "success");
      }
    };

    try {
      bindQuotationDraftForm = window.bindQuotationDraftForm;
    } catch (_error) {
      // Some browsers may not allow reassignment in edge cases. The window
      // property is still used by subsequent inline runtime calls.
    }
  }

  const originalHandleSaveQuotationDraft = window.handleSaveQuotationDraft;
  if (typeof originalHandleSaveQuotationDraft === "function") {
    window.handleSaveQuotationDraft = async function handleSaveQuotationDraftV193(event, products, options = {}) {
      const pageBeforeSave = getCurrentPageV19?.() || appState.currentPage || "";
      saveQuotationFormStateV193();

      await originalHandleSaveQuotationDraft.call(this, event, products, options);

      window.setTimeout(() => {
        if (!isQuotationFormPageV193(getCurrentPageV19?.() || appState.currentPage || "")) {
          clearQuotationFormStateV193(pageBeforeSave);
        }
      }, 0);
    };

    try {
      handleSaveQuotationDraft = window.handleSaveQuotationDraft;
    } catch (_error) {
      // Keep the window override even if lexical reassignment is unavailable.
    }
  }
})();

window.addEventListener("pagehide", () => {
  saveQuotationFormStateV193();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    saveQuotationFormStateV193();
  }
});

// Override resume recovery so active quotation forms are not re-rendered over
// unsaved input values when the user returns from another browser tab.
async function recoverAppAfterResume(reason = "resume") {
  if (!isConfigured || !supabaseClient?.auth || document.visibilityState === "hidden") return;
  if (!isAuthenticatedV19()) return;

  const now = Date.now();
  if (now - Number(appState.lastResumeAtV19 || 0) < 1800) return;
  appState.lastResumeAtV19 = now;

  try {
    if (typeof shouldSkipResumeRecoveryForFilePicker === "function" && shouldSkipResumeRecoveryForFilePicker()) {
      if (typeof releaseFilePickerInteraction === "function") releaseFilePickerInteraction(1800);
      return;
    }

    const page = getCurrentPageV19?.() || appState.currentPage || "";
    const hasActiveQuotationForm = isQuotationFormPageV193(page) && Boolean(getQuotationFormElementV193());

    if (hasActiveQuotationForm) {
      saveQuotationFormStateV193();

      const { data } = await withTimeoutV19(supabaseClient.auth.getSession(), 6000, "การตรวจสอบ session ");
      if (!isUsableSessionV19(data?.session)) {
        showLoginPageCleanV19({ rememberHash: true });
        return;
      }

      restoreQuotationFormStateV193();
      bindQuotationFormAutosaveV193();
      return;
    }

    const { data } = await withTimeoutV19(supabaseClient.auth.getSession(), 6000, "การตรวจสอบ session ");
    if (!isUsableSessionV19(data?.session)) {
      showLoginPageCleanV19({ rememberHash: true });
      return;
    }

    await renderCurrentPage({ reason: `resume-${reason}` });
  } catch (error) {
    console.warn("recoverAppAfterResume v1.9.3", error);
  }
}

const originalDebugV193 = window.FI_DEBUG;
window.FI_DEBUG = async function FI_DEBUG_V193() {
  const result = typeof originalDebugV193 === "function" ? await originalDebugV193() : {};
  return {
    ...result,
    formAutosave: {
      isQuotationForm: isQuotationFormPageV193(),
      hasForm: Boolean(getQuotationFormElementV193()),
      dirty: Boolean(appState.quotationFormDirtyV193),
      lastSavedAt: appState.quotationFormLastSavedAtV193 || null,
    },
  };
};

// =======================================================
// v1.9.4 Hotfix: Recurring Item Description Defaults
// Scope: add recurring service description field, update one-time defaults,
// and include the new field in the existing v1.9.3 autosave flow.
// =======================================================

(function patchQuotationRecurringDescriptionV194() {
  window.FI_APP_VERSION = FI_V194_VERSION;

  if (Array.isArray(FI_QUOTATION_FORM_AUTOSAVE_FIELDS_V193) && !FI_QUOTATION_FORM_AUTOSAVE_FIELDS_V193.includes("draftRecurringDescription")) {
    const unitIndex = FI_QUOTATION_FORM_AUTOSAVE_FIELDS_V193.indexOf("draftUnit");
    FI_QUOTATION_FORM_AUTOSAVE_FIELDS_V193.splice(unitIndex >= 0 ? unitIndex + 1 : FI_QUOTATION_FORM_AUTOSAVE_FIELDS_V193.length, 0, "draftRecurringDescription");
  }
})();

// Final visible version stamp for QA.
window.FI_APP_VERSION = FI_V194_VERSION;


// =======================================================
// v1.9.5 Data Snapshot + Pagination + UI Polish
// Scope: preserve quotation item snapshots after master data changes,
// add pagination to screen data tables, refresh status colors, and use
// icon-only back/duplicate actions.
// =======================================================

const FI_V195_VERSION = "1.9.5";
const FI_V195_PAGE_SIZE = 10;

window.FI_APP_VERSION = FI_V195_VERSION;

function ensurePaginationStateV195() {
  if (!appState.paginationV195) {
    appState.paginationV195 = {};
  }
  return appState.paginationV195;
}

function getPaginationStateV195(key) {
  const store = ensurePaginationStateV195();
  if (!store[key]) {
    store[key] = { page: 1, pageSize: FI_V195_PAGE_SIZE, signature: "" };
  }
  return store[key];
}

function getRowsSignatureV195(rows) {
  return String((rows || []).map((row) => row?.id || row?.owner_id || row?.customer_name || row?.code || row?.name || "").join("|"));
}

function maybeResetPaginationV195(key, rows) {
  const state = getPaginationStateV195(key);
  const signature = getRowsSignatureV195(rows);
  if (state.signature !== signature) {
    state.signature = signature;
    state.page = 1;
  }
}

function paginateRowsV195(key, rows) {
  const allRows = Array.isArray(rows) ? rows : [];
  const state = getPaginationStateV195(key);
  const total = allRows.length;
  const pageSize = Number(state.pageSize || FI_V195_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  state.page = Math.min(Math.max(1, Number(state.page || 1)), totalPages);
  const start = (state.page - 1) * pageSize;
  const end = start + pageSize;

  return {
    rows: allRows.slice(start, end),
    offset: start,
    total,
    pageSize,
    page: state.page,
    totalPages,
  };
}

function renderPaginationV195(key, meta) {
  if (!meta || meta.total <= meta.pageSize) return "";
  const startNo = meta.total === 0 ? 0 : meta.offset + 1;
  const endNo = Math.min(meta.offset + meta.rows.length, meta.total);

  return `
    <div class="pagination-v195" data-pagination-key="${escapeHTML(key)}">
      <div class="pagination-summary-v195">
        แสดง ${number(startNo)}-${number(endNo)} จาก ${number(meta.total)} รายการ
      </div>
      <div class="pagination-controls-v195">
        <button type="button" class="btn btn-ghost" data-page-action="prev" ${meta.page <= 1 ? "disabled" : ""}>ก่อนหน้า</button>
        <span>${number(meta.page)} / ${number(meta.totalPages)}</span>
        <button type="button" class="btn btn-ghost" data-page-action="next" ${meta.page >= meta.totalPages ? "disabled" : ""}>ถัดไป</button>
      </div>
    </div>
  `;
}

function bindPaginationV195(key, onRender) {
  document.querySelectorAll(`[data-pagination-key='${key}'] [data-page-action]`).forEach((button) => {
    button.addEventListener("click", () => {
      const state = getPaginationStateV195(key);
      const action = button.dataset.pageAction;
      if (action === "prev") state.page = Math.max(1, Number(state.page || 1) - 1);
      if (action === "next") state.page = Number(state.page || 1) + 1;
      onRender?.();
    });
  });
}

function renderTableWithPaginationV195({ key, rows, renderTable, bind }) {
  const allRows = Array.isArray(rows) ? rows : [];
  maybeResetPaginationV195(key, allRows);
  const meta = paginateRowsV195(key, allRows);
  if (!allRows.length) {
    return renderTable([], { ...meta, offset: 0 });
  }
  return `${renderTable(meta.rows, meta)}${renderPaginationV195(key, meta)}`;
}

function renderQuotationTableV195(rows, meta = {}) {
  if (!rows.length) {
    return `<div class="empty-state">ยังไม่มีใบเสนอราคา</div>`;
  }

  const showSales = appState.profile.role !== "sales";
  const offset = Number(meta.offset || 0);

  return `
    <div class="table-wrap">
      <table class="data-table quotation-table-v13">
        <thead>
          <tr>
            <th class="select-col"><input id="selectAllQuotations" type="checkbox" ${areAllVisibleRowsSelected(rows) ? "checked" : ""} /></th>
            ${sortableTh("row_no", "ลำดับ")}
            ${sortableTh("quotation_no", "เลขที่")}
            ${sortableTh("customer_name", "ลูกค้า")}
            ${sortableTh("billing_type", "ประเภท")}
            ${showSales ? sortableTh("owner_name", "ฝ่ายขาย") : ""}
            ${sortableTh("quote_date", "วันที่เสนอราคา")}
            ${sortableTh("valid_until", "วันหมดอายุ")}
            ${sortableTh("grand_total_display", "ยอดรวม")}
            ${sortableTh("effective_status", "สถานะ")}
            ${sortableTh("created_at", "วันที่สร้าง")}
            <th>การกระทำ</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, index) => `
            <tr>
              <td class="select-col"><input type="checkbox" data-select-quotation="${row.id}" ${appState.selectedQuotationIds.has(row.id) ? "checked" : ""} /></td>
              <td>${offset + index + 1}</td>
              <td><strong>${escapeHTML(row.quotation_no || "ยังไม่ออกเลข")}</strong></td>
              <td>${escapeHTML(row.customer_name || "-")}</td>
              <td>${billingTypeLabel(row.billing_type)}</td>
              ${showSales ? `<td>${escapeHTML(row.owner_name || "-")}</td>` : ""}
              <td>${formatDate(row.quote_date)}</td>
              <td>${formatDate(row.valid_until)}</td>
              <td class="num-cell">${formatTHB(row.grand_total_display)}</td>
              <td>${statusBadge(row.effective_status || row.status)}</td>
              <td>${formatDate(row.created_at)}</td>
              <td><button class="btn btn-ghost" data-action="view" data-id="${row.id}">ดู</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function updateQuotationTableFromFilters() {
  const filter = appState.quotationFilters;
  const quoteRange = getDateRangeState(filter.quoteFrom, filter.quoteTo, "วันที่เสนอราคา");
  const validRange = getDateRangeState(filter.validFrom, filter.validTo, "วันหมดอายุ");
  const invalidReason = quoteRange.invalidReason || validRange.invalidReason;

  appState.quotationFilteredRows = appState.quotationListRows.filter((row) => {
    const keyword = (filter.keyword || "").toLowerCase();
    const text = `${row.quotation_no || ""} ${row.customer_name || ""} ${row.owner_name || ""}`.toLowerCase();

    return (!keyword || text.includes(keyword)) &&
      (!filter.status || row.effective_status === filter.status || row.status === filter.status) &&
      (!filter.billingType || row.billing_type === filter.billingType) &&
      (!filter.ownerId || row.owner_id === filter.ownerId) &&
      (!quoteRange.active || !quoteRange.valid || isDateWithinRange(row.quote_date, quoteRange.from, quoteRange.to)) &&
      (!validRange.active || !validRange.valid || isDateWithinRange(row.valid_until, validRange.from, validRange.to));
  });

  applyQuotationSort();
  pruneSelectionToRows(appState.quotationFilteredRows);
  renderQuotationTableFromState();
  updateExportStateV13({ quoteRange, validRange, invalidReason });
}

function renderQuotationTableFromState() {
  const tableTarget = document.getElementById("quotationTable");
  if (!tableTarget) return;

  tableTarget.innerHTML = renderTableWithPaginationV195({
    key: "quotations",
    rows: appState.quotationFilteredRows,
    renderTable: renderQuotationTableV195,
  });

  bindPaginationV195("quotations", () => renderQuotationTableFromState());
  updateBulkActionState();
}

function renderSalesSummaryTable(rows) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  return renderTableWithPaginationV195({
    key: "sales-summary",
    rows: sourceRows,
    renderTable: (pagedRows) => {
      if (!pagedRows.length) return `<div class="empty-state">ยังไม่มีข้อมูลใบเสนอราคา</div>`;
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
                <th>Paid</th>
                <th>Expired</th>
                <th>ยอดเดือนนี้</th>
              </tr>
            </thead>
            <tbody>
              ${pagedRows.map((row) => `
                <tr>
                  <td>${escapeHTML(row.owner_name || "-")}</td>
                  <td>${number(row.total_count)}</td>
                  <td>${number(row.draft_count)}</td>
                  <td>${number(row.confirmed_count)}</td>
                  <td>${number(row.sent_count)}</td>
                  <td>${number(row.paid_count)}</td>
                  <td>${number(row.expired_count)}</td>
                  <td>${formatTHB(row.total_amount_this_month)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    },
  });
}

function renderCustomerTable(rows) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  return renderTableWithPaginationV195({
    key: "customers",
    rows: sourceRows,
    renderTable: (pagedRows) => {
      if (!pagedRows.length) return `<div class="empty-state">ยังไม่มีข้อมูลลูกค้า</div>`;
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
              ${pagedRows.map((row) => `
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
    },
  });
}

function renderProductsTable(rows) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  return renderTableWithPaginationV195({
    key: "products",
    rows: sourceRows,
    renderTable: (pagedRows) => {
      if (!pagedRows.length) return `<div class="empty-state">ยังไม่มีสินค้า/บริการ</div>`;
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
                <th>การกระทำ</th>
              </tr>
            </thead>
            <tbody>
              ${pagedRows.map((row) => `
                <tr>
                  <td><strong>${escapeHTML(row.code || "-")}</strong></td>
                  <td>${escapeHTML(row.name || "-")}</td>
                  <td>${escapeHTML(row.description || "-")}</td>
                  <td>${escapeHTML(row.default_unit || "-")}</td>
                  <td>${row.is_active ? statusPill("Active", "confirmed") : statusPill("Inactive", "cancelled")}</td>
                  <td>${appState.profile?.role === "admin" ? `<button class="btn btn-ghost" data-product-edit="${row.id}">แก้ไข</button>` : "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    },
  });
}

(function patchPaginatedTablesV195() {
  if (window.__fiPaginationBoundV195) return;
  window.__fiPaginationBoundV195 = true;

  document.addEventListener("click", (event) => {
    const productEditButton = event.target.closest?.("[data-product-edit]");
    if (productEditButton) {
      location.hash = `#product-edit/${productEditButton.dataset.productEdit}`;
    }
  }, true);
})();

function statusLabel(status) {
  const map = {
    draft: "ร่าง",
    confirmed: "ยืนยันแล้ว",
    sent: "ส่งแล้ว",
    paid: "ชำระเงิน",
    expired: "หมดอายุ",
    cancelled: "ยกเลิก",
  };

  return map[status] || status || "-";
}

function statusBadge(status) {
  const key = status || "draft";
  return `<span class="status-badge status-${escapeHTML(key)}">${statusLabel(key)}</span>`;
}

function statusPill(label, style) {
  return `<span class="status-badge status-${escapeHTML(style || "draft")}">${escapeHTML(label)}</span>`;
}

function getOriginalQuotationSnapshotV195(quotationId) {
  return appState.quotationItemSnapshotsV195?.[quotationId] || null;
}

async function loadOriginalQuotationSnapshotV195(quotationId) {
  if (!quotationId) return null;
  if (!appState.quotationItemSnapshotsV195) appState.quotationItemSnapshotsV195 = {};

  try {
    const { data, error } = await supabaseClient
      .from("quotation_items")
      .select("id, product_id, product_name_snapshot, description, quantity_label, quantity, unit, unit_price, sort_order")
      .eq("quotation_id", quotationId)
      .eq("section_type", "recurring")
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    appState.quotationItemSnapshotsV195[quotationId] = data || null;
    return data || null;
  } catch (error) {
    console.warn("loadOriginalQuotationSnapshotV195 skipped", error);
    appState.quotationItemSnapshotsV195[quotationId] = null;
    return null;
  }
}

function patchProductSelectSnapshotDisplayV195(snapshot) {
  if (!snapshot?.product_id || !snapshot?.product_name_snapshot) return;
  const select = document.getElementById("draftProductId");
  if (!select) return;

  let option = [...select.options].find((item) => item.value === snapshot.product_id);
  if (!option) {
    option = new Option(snapshot.product_name_snapshot, snapshot.product_id, true, true);
    select.insertBefore(option, select.firstChild);
  }

  option.textContent = snapshot.product_name_snapshot;
  select.value = snapshot.product_id;
}

(function patchQuotationProductSnapshotV195() {
  if (window.__fiSnapshotPatchV195) return;
  window.__fiSnapshotPatchV195 = true;

  const originalRenderQuotationFormPage = window.renderQuotationFormPage;
  if (typeof originalRenderQuotationFormPage === "function") {
    window.renderQuotationFormPage = async function renderQuotationFormPageV195(options = {}) {
      const snapshot = options.mode === "edit" && options.quotationId
        ? await loadOriginalQuotationSnapshotV195(options.quotationId)
        : null;

      await originalRenderQuotationFormPage.call(this, options);
      patchProductSelectSnapshotDisplayV195(snapshot);
    };

    try {
      renderQuotationFormPage = window.renderQuotationFormPage;
    } catch (_error) {}
  }

  const originalHandleSaveQuotationDraft = window.handleSaveQuotationDraft;
  if (typeof originalHandleSaveQuotationDraft === "function") {
    window.handleSaveQuotationDraft = async function handleSaveQuotationDraftV195(event, products, options = {}) {
      const selectedProductId = document.getElementById("draftProductId")?.value || "";
      const snapshot = options.mode === "edit" ? getOriginalQuotationSnapshotV195(options.quotationId) : null;
      let effectiveProducts = Array.isArray(products) ? products : [];

      if (snapshot?.product_id && selectedProductId === snapshot.product_id) {
        const snapshotProduct = {
          ...(effectiveProducts.find((item) => item.id === snapshot.product_id) || {}),
          id: snapshot.product_id,
          name: snapshot.product_name_snapshot || effectiveProducts.find((item) => item.id === snapshot.product_id)?.name || "สินค้า/บริการเดิม",
          default_unit: document.getElementById("draftUnit")?.value?.trim?.() || snapshot.unit || "คัน",
          is_active: true,
        };

        effectiveProducts = [
          snapshotProduct,
          ...effectiveProducts.filter((item) => item.id !== snapshot.product_id),
        ];
      }

      return originalHandleSaveQuotationDraft.call(this, event, effectiveProducts, options);
    };

    try {
      handleSaveQuotationDraft = window.handleSaveQuotationDraft;
    } catch (_error) {}
  }
})();

function applyIconOnlyActionsV195() {
  const iconMap = [
    ["backToListButton", "←"],
    ["backFromPrintButton", "←"],
    ["duplicateQuotationButton", "⧉"],
  ];

  iconMap.forEach(([id, icon]) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.textContent = icon;
    button.classList.add("btn-icon-only-v195");
  });

  document.querySelectorAll("button").forEach((button) => {
    const text = String(button.textContent || "").trim();
    if (/^กลับ/.test(text)) {
      button.textContent = "←";
      button.classList.add("btn-icon-only-v195");
    }
    if (text === "สร้างสำเนา") {
      button.textContent = "⧉";
      button.classList.add("btn-icon-only-v195");
    }
  });
}

(function patchIconOnlyActionsV195() {
  if (window.__fiIconActionsPatchedV195) return;
  window.__fiIconActionsPatchedV195 = true;

  const originalRenderQuotationViewPage = window.renderQuotationViewPage;
  if (typeof originalRenderQuotationViewPage === "function") {
    window.renderQuotationViewPage = async function renderQuotationViewPageV195(quotationId) {
      const result = await originalRenderQuotationViewPage.call(this, quotationId);
      applyIconOnlyActionsV195();
      return result;
    };
    try { renderQuotationViewPage = window.renderQuotationViewPage; } catch (_error) {}
  }

  const originalRenderQuotationPrintPage = window.renderQuotationPrintPage;
  if (typeof originalRenderQuotationPrintPage === "function") {
    window.renderQuotationPrintPage = async function renderQuotationPrintPageV195(quotationId) {
      const result = await originalRenderQuotationPrintPage.call(this, quotationId);
      applyIconOnlyActionsV195();
      return result;
    };
    try { renderQuotationPrintPage = window.renderQuotationPrintPage; } catch (_error) {}
  }
})();

const originalDebugV195 = window.FI_DEBUG;
window.FI_DEBUG = async function FI_DEBUG_V195() {
  const result = typeof originalDebugV195 === "function" ? await originalDebugV195() : {};
  return {
    ...result,
    version: FI_V195_VERSION,
    pagination: appState.paginationV195 || {},
    snapshotCache: Object.keys(appState.quotationItemSnapshotsV195 || {}).length,
  };
};

// Final visible version stamp for QA.
window.FI_APP_VERSION = FI_V195_VERSION;

// =======================================================
// v1.9.6 Quotation Section Summary + Print A4 Fix
// - Quotation view uses per-section summaries instead of one combined summary card
// - Price history lookup has pagination, default 5 rows
// - Print page A4 ratio/footer behavior handled in CSS
// =======================================================

const FI_V196_VERSION = "1.9.6";
const FI_V196_PRICE_LOOKUP_PAGE_SIZE = 5;

window.FI_APP_VERSION = FI_V196_VERSION;

function getQuotationLineSubtotalV196(item) {
  if (!item) return 0;
  if (item.line_subtotal !== null && item.line_subtotal !== undefined) {
    return roundMoney(Number(item.line_subtotal || 0));
  }
  if (item.section_type === "recurring") {
    return roundMoney(Number(item.unit_price || 0));
  }
  return roundMoney(Number(item.quantity || 0) * Number(item.unit_price || 0));
}

function calculateQuotationSectionSummaryV196(quotation, items) {
  const sourceItems = Array.isArray(items) ? items : [];
  const subtotal = roundMoney(sourceItems.reduce((sum, item) => sum + getQuotationLineSubtotalV196(item), 0));
  const discountPercent = Number(quotation?.discount_percent || 0);
  const discount = roundMoney(subtotal * discountPercent / 100);
  const taxable = roundMoney(subtotal - discount);
  const vatRate = Number(quotation?.vat_rate ?? 7);
  const whtRate = Number(quotation?.wht_rate ?? 3);
  const vat = quotation?.vat_enabled === false ? 0 : roundMoney(taxable * vatRate / 100);
  const wht = quotation?.wht_enabled === false ? 0 : roundMoney(taxable * whtRate / 100);
  const grandTotal = roundMoney(taxable + vat - wht);
  const grandTotalDisplay = quotation?.rounding_enabled ? Math.round(grandTotal) : grandTotal;
  const rounding = roundMoney(grandTotalDisplay - grandTotal);

  return {
    subtotal,
    discount,
    taxable,
    vat,
    wht,
    rounding,
    grandTotal,
    grandTotalDisplay,
    vatRate,
    whtRate,
    roundingEnabled: quotation?.rounding_enabled === true,
  };
}

function renderQuotationSectionSummaryV196(quotation, items) {
  const summary = calculateQuotationSectionSummaryV196(quotation, items);

  return `
    <div class="section-summary-v196">
      <div class="section-summary-row-v196">
        <span>มูลค่าก่อนภาษี</span>
        <strong>${formatTHB(summary.subtotal)}</strong>
      </div>
      <div class="section-summary-row-v196">
        <span>ส่วนลด</span>
        <strong>${formatTHB(summary.discount)}</strong>
      </div>
      <div class="section-summary-row-v196">
        <span>ฐานคำนวณภาษี</span>
        <strong>${formatTHB(summary.taxable)}</strong>
      </div>
      <div class="section-summary-row-v196">
        <span>VAT ${Number(summary.vatRate || 0)}%</span>
        <strong>${formatTHB(summary.vat)}</strong>
      </div>
      <div class="section-summary-row-v196">
        <span>หัก ณ ที่จ่าย ${Number(summary.whtRate || 0)}%</span>
        <strong>-${formatTHB(summary.wht)}</strong>
      </div>
      ${summary.roundingEnabled ? `
        <div class="section-summary-row-v196">
          <span>ส่วนต่างปัดเศษ</span>
          <strong>${formatTHB(summary.rounding)}</strong>
        </div>
      ` : ""}
      <div class="section-summary-total-v196">
        <span>ยอดรวมสุทธิ</span>
        <strong>${formatTHB(summary.grandTotalDisplay)}</strong>
      </div>
    </div>
  `;
}

function renderQuotationItemsTableWithSummaryV196(items, quotation) {
  return `
    ${renderQuotationItemsTable(items)}
    ${renderQuotationSectionSummaryV196(quotation, items)}
  `;
}

async function renderQuotationViewPageV196(quotationId) {
  if (!quotationId) {
    renderError("ไม่พบรหัสใบเสนอราคา");
    return;
  }

  setPageHeader("รายละเอียดใบเสนอราคา", "ตรวจสอบข้อมูลก่อน Confirm หรือส่งออกเอกสาร");
  renderLoading();

  const [quotationResult, itemsResult] = await Promise.all([
    supabaseClient
      .from("quotations")
      .select("*")
      .eq("id", quotationId)
      .single(),

    supabaseClient
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("section_type", { ascending: false })
      .order("sort_order", { ascending: true }),
  ]);

  if (quotationResult.error) throw quotationResult.error;
  if (itemsResult.error) throw itemsResult.error;

  const quotation = quotationResult.data;
  const items = itemsResult.data || [];

  const ownerResult = await supabaseClient
    .from("profiles")
    .select("full_name, email")
    .eq("id", quotation.owner_id)
    .maybeSingle();

  const ownerName =
    quotation.sales_name_snapshot ||
    ownerResult.data?.full_name ||
    ownerResult.data?.email ||
    "-";

  const recurringItems = items.filter((item) => item.section_type === "recurring");
  const oneTimeItems = items.filter((item) => item.section_type === "one_time");
  const effectiveStatus = getEffectiveStatusFromQuotation(quotation);

  elements.pageContent.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>${escapeHTML(quotation.quotation_no || "ยังไม่ออกเลขเอกสาร")}</h3>
          <p>${escapeHTML(quotation.customer_name || "-")} · ${billingTypeLabel(quotation.billing_type)}</p>
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end;">
          <button id="backToListButton" class="btn btn-ghost">←</button>
          ${renderQuotationActionButtons(quotation, effectiveStatus)}
        </div>
      </div>

      <div class="alert alert-warning ${quotation.status === "draft" ? "" : "hidden"}">
        เอกสารนี้ยังเป็น Draft และยังไม่มีเลขใบเสนอราคา กด Confirm เพื่อสร้างเลขและล็อกเอกสาร
      </div>

      <div class="kv-list">
        <div class="kv-row">
          <span>สถานะ</span>
          <strong>${statusBadge(effectiveStatus)}</strong>
        </div>
        <div class="kv-row">
          <span>ลูกค้า</span>
          <strong>${escapeHTML(quotation.customer_name || "-")}</strong>
        </div>
        <div class="kv-row">
          <span>ที่อยู่ลูกค้า</span>
          <strong>${escapeHTML(quotation.customer_address || "-")}</strong>
        </div>
        <div class="kv-row">
          <span>วันที่ออกเอกสาร</span>
          <strong>${formatDate(quotation.quote_date)}</strong>
        </div>
        <div class="kv-row">
          <span>วันหมดอายุ</span>
          <strong>${formatDate(quotation.valid_until)}</strong>
        </div>
        <div class="kv-row">
          <span>ผู้ขาย</span>
          <strong>${escapeHTML(ownerName)}</strong>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3>${quotation.billing_type === "yearly" ? "ค่าบริการชำระรายปี" : "ค่าบริการชำระรายเดือน"}</h3>
          <p>จำนวนรถใช้เป็นเงื่อนไขราคา ไม่ได้นำไปคูณกับราคา</p>
        </div>
      </div>
      ${renderQuotationItemsTableWithSummaryV196(recurringItems, quotation)}
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3>ค่าบริการชำระครั้งเดียวจบ</h3>
          <p>ค่าแรกเข้า / Setup / Training</p>
        </div>
      </div>
      ${renderQuotationItemsTableWithSummaryV196(oneTimeItems, quotation)}
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3>หมายเหตุและเงื่อนไข</h3>
          <p>ข้อความที่จะแสดงในเอกสาร</p>
        </div>
      </div>

      <div class="kv-list">
        <div class="kv-row">
          <span>หมายเหตุ</span>
          <strong style="white-space:pre-wrap;">${escapeHTML(quotation.note || "-")}</strong>
        </div>
        <div class="kv-row">
          <span>เงื่อนไขการชำระเงิน</span>
          <strong style="white-space:pre-wrap;">${escapeHTML(quotation.payment_terms || "-")}</strong>
        </div>
      </div>
    </div>
  `;

  bindQuotationViewActions(quotation);
  if (typeof applyIconOnlyActionsV195 === "function") {
    applyIconOnlyActionsV195();
  }
}

function renderPriceLookupPageV196(resultTarget, rows, page) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const pageSize = FI_V196_PRICE_LOOKUP_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(sourceRows.length / pageSize));
  const currentPage = Math.min(Math.max(Number(page || 1), 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  const pagedRows = sourceRows.slice(start, start + pageSize);

  resultTarget.innerHTML = `
    <div class="lookup-panel">
      <div class="lookup-panel-header lookup-panel-header-v196">
        <div>
          <strong>พบราคาเดิม ${number(sourceRows.length)} รายการ</strong>
          <span>เลือกใช้ราคาจากประวัติที่ตรงกับสินค้า ประเภท และจำนวนรถ</span>
        </div>
        <div class="lookup-page-status-v196">หน้า ${number(currentPage)} / ${number(totalPages)}</div>
      </div>

      <div class="lookup-list">
        ${pagedRows.map((row) => `
          <div class="lookup-item">
            <div>
              <div class="lookup-price">${formatTHB(row.unit_price)}</div>
              <div class="lookup-meta">
                <span>${escapeHTML(row.quotation_no || "-")}</span>
                <span>${escapeHTML(row.customer_name || "-")}</span>
                <span>${formatDate(row.quote_date)}</span>
                <span>${escapeHTML(row.sales_name || "-")}</span>
              </div>
            </div>

            <button type="button" class="btn btn-primary" data-history-price="${Number(row.unit_price || 0)}">
              ใช้ราคานี้
            </button>
          </div>
        `).join("")}
      </div>

      ${totalPages > 1 ? `
        <div class="lookup-pagination-v196">
          <button type="button" class="btn btn-ghost" data-price-page="${currentPage - 1}" ${currentPage <= 1 ? "disabled" : ""}>ก่อนหน้า</button>
          <span>แสดง ${number(start + 1)}-${number(start + pagedRows.length)} จาก ${number(sourceRows.length)}</span>
          <button type="button" class="btn btn-ghost" data-price-page="${currentPage + 1}" ${currentPage >= totalPages ? "disabled" : ""}>ถัดไป</button>
        </div>
      ` : ""}
    </div>
  `;

  resultTarget.querySelectorAll("[data-history-price]").forEach((button) => {
    button.addEventListener("click", () => {
      const unitPriceInput = document.getElementById("draftUnitPrice");
      if (unitPriceInput) unitPriceInput.value = button.dataset.historyPrice;
      updateDraftSummary();
      showToast("ใช้ราคาจากประวัติแล้ว");
    });
  });

  resultTarget.querySelectorAll("[data-price-page]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextPage = Number(button.dataset.pricePage || currentPage);
      renderPriceLookupPageV196(resultTarget, sourceRows, nextPage);
    });
  });
}

async function handlePriceLookupV196() {
  const resultTarget = document.getElementById("priceLookupResult");

  if (!resultTarget) return;

  const productId = document.getElementById("draftProductId")?.value || "";
  const billingType = document.getElementById("draftBillingType")?.value || "monthly";
  const quantity = readNumber("#draftQuantity");

  if (!productId) {
    resultTarget.innerHTML = `<div class="alert alert-error">กรุณาเลือกสินค้า/บริการก่อนค้นหาราคา</div>`;
    return;
  }

  if (!quantity || quantity <= 0) {
    resultTarget.innerHTML = `<div class="alert alert-error">กรุณากรอกจำนวนรถให้ถูกต้องก่อนค้นหาราคา</div>`;
    return;
  }

  resultTarget.innerHTML = `
    <div class="lookup-panel">
      <div class="lookup-panel-header">
        <div>
          <strong>กำลังค้นหาราคาเดิม...</strong>
          <span>ค้นหาจากใบเสนอราคาที่ Confirmed หรือ Sent แล้ว</span>
        </div>
      </div>
    </div>
  `;

  try {
    const { data, error } = await supabaseClient.rpc("search_price_history", {
      p_product_id: productId,
      p_billing_type: billingType,
      p_quantity: quantity,
      p_limit: 50,
    });

    if (error) throw error;

    const rows = data || [];

    if (!rows.length) {
      resultTarget.innerHTML = `
        <div class="lookup-panel">
          <div class="lookup-panel-header">
            <div>
              <strong>ไม่พบราคาที่เคยเสนอ</strong>
              <span>กรุณากรอกราคาเอง แล้วระบบจะใช้เป็นประวัติหลัง Confirm</span>
            </div>
          </div>
        </div>
      `;
      return;
    }

    renderPriceLookupPageV196(resultTarget, rows, 1);
  } catch (error) {
    console.error(error);
    resultTarget.innerHTML = `<div class="alert alert-error">${escapeHTML(error.message || "ไม่สามารถค้นหาราคาเดิมได้")}</div>`;
  }
}

(function patchV196Runtime() {
  if (window.__fiRuntimePatchedV196) return;
  window.__fiRuntimePatchedV196 = true;

  window.renderQuotationViewPage = renderQuotationViewPageV196;
  window.handlePriceLookup = handlePriceLookupV196;

  try {
    renderQuotationViewPage = window.renderQuotationViewPage;
    handlePriceLookup = window.handlePriceLookup;
  } catch (_error) {}
})();

const originalDebugV196 = window.FI_DEBUG;
window.FI_DEBUG = async function FI_DEBUG_V196() {
  const result = typeof originalDebugV196 === "function" ? await originalDebugV196() : {};
  return {
    ...result,
    version: FI_V196_VERSION,
    priceLookupPageSize: FI_V196_PRICE_LOOKUP_PAGE_SIZE,
    quotationSectionSummary: true,
    printA4Fix: true,
  };
};

// Final visible version stamp for QA.
window.FI_APP_VERSION = FI_V196_VERSION;

// =======================================================
// v1.9.7 Mobile UX Layer
// Scope: mobile bottom navigation, mobile card lists for key
// screen tables, mobile-friendly quotation form/action spacing,
// and safer mobile A4 preview behavior without changing SQL/RLS.
// =======================================================

const FI_V197_VERSION = "1.9.7";
const FI_V197_MOBILE_QUERY = "(max-width: 768px)";

window.FI_APP_VERSION = FI_V197_VERSION;

function isMobileViewportV197() {
  return window.matchMedia?.(FI_V197_MOBILE_QUERY)?.matches || window.innerWidth <= 768;
}

function getStatusValueV197(row) {
  return row?.effective_status || row?.status || "";
}

function renderMobileInfoRowV197(label, value, extraClass = "") {
  return `
    <div class="mobile-info-row-v197 ${extraClass}">
      <span>${escapeHTML(label)}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderMobileQuotationCardsV197(rows, meta = {}) {
  if (!Array.isArray(rows) || !rows.length) return "";
  const offset = Number(meta.offset || 0);
  const showSales = appState.profile?.role !== "sales";

  return `
    <div class="mobile-card-list-v197 mobile-quotation-list-v197">
      ${rows.map((row, index) => `
        <article class="mobile-data-card-v197 quotation-card-v197">
          <div class="mobile-card-top-v197">
            <label class="mobile-select-v197">
              <input type="checkbox" data-select-quotation="${row.id}" ${appState.selectedQuotationIds?.has(row.id) ? "checked" : ""} />
              <span>#${number(offset + index + 1)}</span>
            </label>
            ${statusBadge(getStatusValueV197(row))}
          </div>

          <button type="button" class="mobile-card-main-v197" data-action="view" data-id="${row.id}">
            <strong>${escapeHTML(row.customer_name || "-")}</strong>
            <span>${escapeHTML(row.quotation_no || "ยังไม่ออกเลข")}</span>
          </button>

          <div class="mobile-card-grid-v197">
            ${renderMobileInfoRowV197("ประเภท", billingTypeLabel(row.billing_type))}
            ${showSales ? renderMobileInfoRowV197("ฝ่ายขาย", escapeHTML(row.owner_name || "-")) : ""}
            ${renderMobileInfoRowV197("วันที่เสนอ", formatDate(row.quote_date))}
            ${renderMobileInfoRowV197("หมดอายุ", formatDate(row.valid_until))}
            ${renderMobileInfoRowV197("ยอดรวม", formatTHB(row.grand_total_display), "is-total")}
          </div>

          <div class="mobile-card-actions-v197">
            <button type="button" class="btn btn-primary" data-action="view" data-id="${row.id}">ดู</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderQuotationTableV195(rows, meta = {}) {
  if (!rows.length) {
    return `<div class="empty-state">ยังไม่มีใบเสนอราคา</div>`;
  }

  const showSales = appState.profile.role !== "sales";
  const offset = Number(meta.offset || 0);

  return `
    ${renderMobileQuotationCardsV197(rows, meta)}
    <div class="table-wrap desktop-table-v197">
      <table class="data-table quotation-table-v13">
        <thead>
          <tr>
            <th class="select-col"><input id="selectAllQuotations" type="checkbox" ${areAllVisibleRowsSelected(rows) ? "checked" : ""} /></th>
            ${sortableTh("row_no", "ลำดับ")}
            ${sortableTh("quotation_no", "เลขที่")}
            ${sortableTh("customer_name", "ลูกค้า")}
            ${sortableTh("billing_type", "ประเภท")}
            ${showSales ? sortableTh("owner_name", "ฝ่ายขาย") : ""}
            ${sortableTh("quote_date", "วันที่เสนอราคา")}
            ${sortableTh("valid_until", "วันหมดอายุ")}
            ${sortableTh("grand_total_display", "ยอดรวม")}
            ${sortableTh("effective_status", "สถานะ")}
            ${sortableTh("created_at", "วันที่สร้าง")}
            <th>การกระทำ</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, index) => `
            <tr>
              <td class="select-col"><input type="checkbox" data-select-quotation="${row.id}" ${appState.selectedQuotationIds?.has(row.id) ? "checked" : ""} /></td>
              <td>${offset + index + 1}</td>
              <td><strong>${escapeHTML(row.quotation_no || "ยังไม่ออกเลข")}</strong></td>
              <td>${escapeHTML(row.customer_name || "-")}</td>
              <td>${billingTypeLabel(row.billing_type)}</td>
              ${showSales ? `<td>${escapeHTML(row.owner_name || "-")}</td>` : ""}
              <td>${formatDate(row.quote_date)}</td>
              <td>${formatDate(row.valid_until)}</td>
              <td class="num-cell">${formatTHB(row.grand_total_display)}</td>
              <td>${statusBadge(getStatusValueV197(row))}</td>
              <td>${formatDate(row.created_at)}</td>
              <td><button class="btn btn-ghost" data-action="view" data-id="${row.id}">ดู</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderMobileCustomerCardsV197(rows) {
  if (!Array.isArray(rows) || !rows.length) return "";
  return `
    <div class="mobile-card-list-v197">
      ${rows.map((row) => `
        <article class="mobile-data-card-v197">
          <div class="mobile-card-main-static-v197">
            <strong>${escapeHTML(row.customer_name || "-")}</strong>
            <span>${escapeHTML(row.latest_customer_address || "-")}</span>
          </div>
          <div class="mobile-card-grid-v197">
            ${renderMobileInfoRowV197("จำนวนใบเสนอราคา", number(row.quotation_count))}
            ${renderMobileInfoRowV197("เสนอล่าสุด", formatDate(row.latest_quote_date))}
            ${renderMobileInfoRowV197("ยอดล่าสุด", formatTHB(row.latest_grand_total), "is-total")}
            ${renderMobileInfoRowV197("Sales ล่าสุด", escapeHTML(row.latest_sales_name || "-"))}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderCustomerTable(rows) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  return renderTableWithPaginationV195({
    key: "customers",
    rows: sourceRows,
    renderTable: (pagedRows) => {
      if (!pagedRows.length) return `<div class="empty-state">ยังไม่มีข้อมูลลูกค้า</div>`;
      return `
        ${renderMobileCustomerCardsV197(pagedRows)}
        <div class="table-wrap desktop-table-v197">
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
              ${pagedRows.map((row) => `
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
    },
  });
}

function renderMobileProductCardsV197(rows) {
  if (!Array.isArray(rows) || !rows.length) return "";
  return `
    <div class="mobile-card-list-v197">
      ${rows.map((row) => `
        <article class="mobile-data-card-v197">
          <div class="mobile-card-top-v197">
            <strong>${escapeHTML(row.code || "-")}</strong>
            ${row.is_active ? statusPill("Active", "confirmed") : statusPill("Inactive", "cancelled")}
          </div>
          <div class="mobile-card-main-static-v197">
            <strong>${escapeHTML(row.name || "-")}</strong>
            <span>${escapeHTML(row.description || "-")}</span>
          </div>
          <div class="mobile-card-grid-v197">
            ${renderMobileInfoRowV197("หน่วย", escapeHTML(row.default_unit || "-"))}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderProductsTable(rows) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  return renderTableWithPaginationV195({
    key: "products",
    rows: sourceRows,
    renderTable: (pagedRows) => {
      if (!pagedRows.length) return `<div class="empty-state">ยังไม่มีสินค้า/บริการ</div>`;
      return `
        ${renderMobileProductCardsV197(pagedRows)}
        <div class="table-wrap desktop-table-v197">
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
              ${pagedRows.map((row) => `
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
    },
  });
}

function renderMobileSalesSummaryCardsV197(rows) {
  if (!Array.isArray(rows) || !rows.length) return "";
  return `
    <div class="mobile-card-list-v197">
      ${rows.map((row) => `
        <article class="mobile-data-card-v197">
          <div class="mobile-card-main-static-v197">
            <strong>${escapeHTML(row.owner_name || "-")}</strong>
            <span>ใบเสนอราคา ${number(row.total_count)} รายการ</span>
          </div>
          <div class="mobile-card-grid-v197">
            ${renderMobileInfoRowV197("Draft", number(row.draft_count))}
            ${renderMobileInfoRowV197("Confirmed", number(row.confirmed_count))}
            ${renderMobileInfoRowV197("Sent", number(row.sent_count))}
            ${renderMobileInfoRowV197("Paid", number(row.paid_count))}
            ${renderMobileInfoRowV197("Expired", number(row.expired_count))}
            ${renderMobileInfoRowV197("ยอดเดือนนี้", formatTHB(row.total_amount_this_month), "is-total")}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderSalesSummaryTable(rows) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  return renderTableWithPaginationV195({
    key: "sales-summary",
    rows: sourceRows,
    renderTable: (pagedRows) => {
      if (!pagedRows.length) return `<div class="empty-state">ยังไม่มีข้อมูลใบเสนอราคา</div>`;
      return `
        ${renderMobileSalesSummaryCardsV197(pagedRows)}
        <div class="table-wrap desktop-table-v197">
          <table class="data-table">
            <thead>
              <tr>
                <th>Sales</th>
                <th>ทั้งหมด</th>
                <th>Draft</th>
                <th>Confirmed</th>
                <th>Sent</th>
                <th>Paid</th>
                <th>Expired</th>
                <th>ยอดเดือนนี้</th>
              </tr>
            </thead>
            <tbody>
              ${pagedRows.map((row) => `
                <tr>
                  <td>${escapeHTML(row.owner_name || "-")}</td>
                  <td>${number(row.total_count)}</td>
                  <td>${number(row.draft_count)}</td>
                  <td>${number(row.confirmed_count)}</td>
                  <td>${number(row.sent_count)}</td>
                  <td>${number(row.paid_count)}</td>
                  <td>${number(row.expired_count)}</td>
                  <td>${formatTHB(row.total_amount_this_month)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    },
  });
}

function renderMobileItemCardsV197(items) {
  if (!Array.isArray(items) || !items.length) return "";
  return `
    <div class="mobile-card-list-v197 mobile-items-list-v197">
      ${items.map((item, index) => {
        const lineSubtotal = item.line_subtotal ?? (item.section_type === "recurring" ? item.unit_price : Number(item.quantity || 0) * Number(item.unit_price || 0));
        return `
          <article class="mobile-data-card-v197">
            <div class="mobile-card-top-v197">
              <strong>#${number(index + 1)}</strong>
              <span>${escapeHTML(item.unit || "-")}</span>
            </div>
            <div class="mobile-card-main-static-v197">
              <strong>${escapeHTML(item.product_name_snapshot || "-")}</strong>
              ${item.description ? `<span class="pre-wrap-v197">${escapeHTML(item.description)}</span>` : ""}
            </div>
            <div class="mobile-card-grid-v197">
              ${renderMobileInfoRowV197("จำนวน", number(item.quantity))}
              ${renderMobileInfoRowV197("ราคา", formatTHB(item.unit_price))}
              ${renderMobileInfoRowV197("มูลค่าก่อนภาษี", formatTHB(lineSubtotal), "is-total")}
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderQuotationItemsTable(items) {
  if (!items.length) {
    return `<div class="empty-state">ไม่มีรายการในส่วนนี้</div>`;
  }

  return `
    ${renderMobileItemCardsV197(items)}
    <div class="table-wrap desktop-table-v197">
      <table class="data-table">
        <thead>
          <tr>
            <th>ลำดับ</th>
            <th>รายละเอียด</th>
            <th>จำนวน</th>
            <th>หน่วย</th>
            <th>ราคา</th>
            <th>มูลค่าก่อนภาษี</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => {
            const lineSubtotal = item.line_subtotal ?? (item.section_type === "recurring" ? item.unit_price : Number(item.quantity || 0) * Number(item.unit_price || 0));
            return `
              <tr>
                <td>${index + 1}</td>
                <td>
                  <strong>${escapeHTML(item.product_name_snapshot || "-")}</strong>
                  ${item.description ? `<div class="inline-note">${escapeHTML(item.description)}</div>` : ""}
                </td>
                <td>${number(item.quantity)}</td>
                <td>${escapeHTML(item.unit || "-")}</td>
                <td>${formatTHB(item.unit_price)}</td>
                <td>${formatTHB(lineSubtotal)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function syncMobileSummaryHintV197() {
  const total = document.getElementById("summaryGrandTotal")?.textContent || "";
  const form = document.getElementById("quotationDraftForm");
  let bar = document.getElementById("mobileSummaryHintV197");

  if (!form || !total) {
    bar?.remove();
    return;
  }

  if (!bar) {
    bar = document.createElement("button");
    bar.type = "button";
    bar.id = "mobileSummaryHintV197";
    bar.className = "mobile-summary-hint-v197";
    bar.addEventListener("click", () => {
      document.querySelector(".summary-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    document.body.appendChild(bar);
  }

  bar.innerHTML = `<span>สรุปยอด</span><strong>${escapeHTML(total)}</strong>`;
}

const originalUpdateDraftSummaryV197 = window.updateDraftSummary || updateDraftSummary;
window.updateDraftSummary = function updateDraftSummaryV197Wrapper(...args) {
  const result = originalUpdateDraftSummaryV197.apply(this, args);
  syncMobileSummaryHintV197();
  return result;
};
try { updateDraftSummary = window.updateDraftSummary; } catch (_error) {}

function applyMobileBodyStateV197() {
  document.body.classList.toggle("is-mobile-v197", isMobileViewportV197());
  const isQuotationForm = Boolean(document.getElementById("quotationDraftForm"));
  document.body.classList.toggle("has-mobile-summary-v197", isMobileViewportV197() && isQuotationForm);
  if (!isQuotationForm) document.getElementById("mobileSummaryHintV197")?.remove();
}

const originalRenderCurrentPageV197 = window.renderCurrentPage || renderCurrentPage;
window.renderCurrentPage = async function renderCurrentPageV197Wrapper(...args) {
  const result = await originalRenderCurrentPageV197.apply(this, args);
  applyMobileBodyStateV197();
  syncMobileSummaryHintV197();
  return result;
};
try { renderCurrentPage = window.renderCurrentPage; } catch (_error) {}

window.addEventListener("resize", applyMobileBodyStateV197);
window.addEventListener("orientationchange", () => setTimeout(applyMobileBodyStateV197, 250));
document.addEventListener("DOMContentLoaded", () => setTimeout(applyMobileBodyStateV197, 0));

document.addEventListener("click", (event) => {
  const menuButton = event.target?.closest?.(".menu-item");
  if (menuButton && isMobileViewportV197()) {
    document.body.classList.remove("nav-open");
  }
}, true);

const originalDebugV197 = window.FI_DEBUG;
window.FI_DEBUG = async function FI_DEBUG_V197() {
  const result = typeof originalDebugV197 === "function" ? await originalDebugV197() : {};
  return {
    ...result,
    version: FI_V197_VERSION,
    mobileUxLayer: true,
    mobileViewport: isMobileViewportV197(),
    mobileBottomNavigation: true,
    mobileCardLists: true,
  };
};

// Final visible version stamp for QA.
window.FI_APP_VERSION = FI_V197_VERSION;


// =======================================================
// v1.9.8 Dashboard Sent/Paid Business Logic Hotfix
// - "ยอดส่งแล้ว" means total quotation value already sent to customer,
//   therefore paid quotations are still included in sent value.
// - Paid value is tracked separately by paid_at/status paid.
// - Excel summary/by-sales uses the same business helpers as dashboard.
// =======================================================

const FI_V198_VERSION = "1.9.8";
window.FI_APP_VERSION = FI_V198_VERSION;

function getRawStatusV198(row) {
  return String(row?.status || row?.effective_status || "").toLowerCase();
}

function getAmountForBusinessAnalyticsV198(row) {
  return Number(row?.grand_total_display ?? row?.grand_total ?? 0) || 0;
}

function isPaidBusinessRowV198(row) {
  const status = getRawStatusV198(row);
  return status === "paid" || Boolean(row?.paid_at);
}

function isSentBusinessRowV198(row) {
  const status = getRawStatusV198(row);
  return status === "sent" || status === "paid" || Boolean(row?.sent_at) || Boolean(row?.paid_at);
}

function getSentBusinessDateV198(row) {
  if (!isSentBusinessRowV198(row)) return null;
  return parseDateOnly(row?.sent_at || row?.paid_at || row?.quote_date || row?.created_at || row?.updated_at);
}

function getPaidBusinessDateV198(row) {
  if (!isPaidBusinessRowV198(row)) return null;
  return parseDateOnly(row?.paid_at || row?.sent_at || row?.quote_date || row?.created_at || row?.updated_at);
}

function buildDashboardAnalytics(rows, options = {}) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const monthsBack = options.monthsBack || 6;
  const today = startOfToday();
  const currentKey = monthKey(today);
  const monthStarts = [];

  for (let index = monthsBack - 1; index >= 0; index -= 1) {
    monthStarts.push(new Date(today.getFullYear(), today.getMonth() - index, 1));
  }

  const months = monthStarts.map((date) => ({
    key: monthKey(date),
    label: formatMonthLabel(date),
    sentAmount: 0,
    paidAmount: 0,
    sentCount: 0,
    paidCount: 0,
  }));

  const monthMap = new Map(months.map((item) => [item.key, item]));
  const salesSentCounts = new Map();
  const statusCounts = {
    draft: 0,
    confirmed: 0,
    sent: 0,
    paid: 0,
    cancelled: 0,
    expired: 0,
  };

  let currentMonthSentAmount = 0;
  let currentMonthPaidAmount = 0;
  let currentMonthSentCount = 0;
  let currentMonthPaidCount = 0;
  let openSentAmount = 0;

  sourceRows.forEach((row) => {
    const status = getEffectiveStatusForAnalytics(row);
    if (statusCounts[status] !== undefined) statusCounts[status] += 1;

    const amount = getAmountForBusinessAnalyticsV198(row);
    const sentDate = getSentBusinessDateV198(row);
    const sentKey = sentDate ? monthKey(sentDate) : "";

    if (isSentBusinessRowV198(row)) {
      const month = monthMap.get(sentKey);

      if (month) {
        month.sentAmount += amount;
        month.sentCount += 1;
      }

      if (sentKey === currentKey) {
        currentMonthSentAmount += amount;
        currentMonthSentCount += 1;
      }

      if (!isPaidBusinessRowV198(row)) {
        openSentAmount += amount;
      }

      const salesName = row.owner_name || row.sales_name || "ไม่ระบุฝ่ายขาย";
      if (!salesSentCounts.has(salesName)) {
        salesSentCounts.set(salesName, Object.fromEntries(months.map((item) => [item.key, 0])));
      }
      if (sentKey && salesSentCounts.get(salesName)[sentKey] !== undefined) {
        salesSentCounts.get(salesName)[sentKey] += 1;
      }
    }

    if (isPaidBusinessRowV198(row)) {
      const paidDate = getPaidBusinessDateV198(row);
      const paidKey = paidDate ? monthKey(paidDate) : "";
      const month = monthMap.get(paidKey);

      if (month) {
        month.paidAmount += amount;
        month.paidCount += 1;
      }

      if (paidKey === currentKey) {
        currentMonthPaidAmount += amount;
        currentMonthPaidCount += 1;
      }
    }
  });

  months.forEach((month) => {
    month.sentAmount = roundMoney(month.sentAmount);
    month.paidAmount = roundMoney(month.paidAmount);
  });

  currentMonthSentAmount = roundMoney(currentMonthSentAmount);
  currentMonthPaidAmount = roundMoney(currentMonthPaidAmount);
  openSentAmount = roundMoney(openSentAmount);

  const soon = addDays(today, 7);
  const expiringSoon = sourceRows
    .filter((row) => ["confirmed", "sent"].includes(getRawStatus(row)))
    .filter((row) => {
      const validDate = parseDateOnly(row.valid_until);
      return validDate && validDate >= today && validDate <= soon;
    })
    .slice(0, 8);

  return {
    months,
    salesSentCounts,
    statusCounts,
    currentMonthSentAmount,
    currentMonthPaidAmount,
    currentMonthSentCount,
    currentMonthPaidCount,
    openSentAmount,
    expiringSoon,
    businessSentLogicV198: true,
  };
}

function buildExcelSummaryRowsV16(rows) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const filters = appState.quotationFilters || {};
  const counts = countByV16(sourceRows, (row) => statusLabel(row.effective_status || row.status));
  const sentRows = sourceRows.filter(isSentBusinessRowV198);
  const paidRows = sourceRows.filter(isPaidBusinessRowV198);
  const sentAmount = roundMoney(sentRows.reduce((sum, row) => sum + getAmountForBusinessAnalyticsV198(row), 0));
  const paidAmount = roundMoney(paidRows.reduce((sum, row) => sum + getAmountForBusinessAnalyticsV198(row), 0));

  const result = [
    { หัวข้อ: "Export เมื่อ", ค่า: new Date().toLocaleString("th-TH") },
    { หัวข้อ: "ผู้ Export", ค่า: appState.profile?.full_name || appState.profile?.email || "-" },
    { หัวข้อ: "ช่วงวันที่เสนอราคา", ค่า: formatRangeLabel(filters.quoteFrom, filters.quoteTo) },
    { หัวข้อ: "ช่วงวันหมดอายุ", ค่า: formatRangeLabel(filters.validFrom, filters.validTo) },
    { หัวข้อ: "สถานะที่กรอง", ค่า: filters.status ? statusLabel(filters.status) : "ทุกสถานะ" },
    { หัวข้อ: "ประเภทที่กรอง", ค่า: filters.billingType ? billingTypeLabel(filters.billingType) : "ทุกประเภท" },
    { หัวข้อ: "จำนวนใบเสนอราคา", ค่า: sourceRows.length },
    { หัวข้อ: "จำนวนที่เคยส่งแล้ว", ค่า: sentRows.length },
    { หัวข้อ: "จำนวนที่ชำระเงินแล้ว", ค่า: paidRows.length },
    { หัวข้อ: "ยอดส่งแล้ว", ค่า: sentAmount },
    { หัวข้อ: "ยอดชำระเงินแล้ว", ค่า: paidAmount },
    { หัวข้อ: "ส่วนต่างยอดส่งกับชำระ", ค่า: roundMoney(sentAmount - paidAmount) },
    { หัวข้อ: "Conversion โดยยอด (%)", ค่า: sentAmount > 0 ? roundMoney((paidAmount / sentAmount) * 100) : 0 },
  ];

  Object.entries(counts).forEach(([status, count]) => {
    result.push({ หัวข้อ: `จำนวนสถานะ ${status}`, ค่า: count });
  });

  return result;
}

function buildExcelBySalesRowsV16(rows) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const groups = groupByFunctionV16(sourceRows, (row) => row.owner_name || "ไม่ระบุฝ่ายขาย");

  return Array.from(groups.entries()).map(([sales, items]) => {
    const sentRows = items.filter(isSentBusinessRowV198);
    const paidRows = items.filter(isPaidBusinessRowV198);
    const sentAmount = roundMoney(sentRows.reduce((sum, row) => sum + getAmountForBusinessAnalyticsV198(row), 0));
    const paidAmount = roundMoney(paidRows.reduce((sum, row) => sum + getAmountForBusinessAnalyticsV198(row), 0));

    return {
      ฝ่ายขาย: sales,
      "จำนวนใบเสนอราคา": items.length,
      "จำนวนที่เคยส่งแล้ว": sentRows.length,
      "จำนวนชำระเงินแล้ว": paidRows.length,
      "ยอดส่งแล้ว": sentAmount,
      "ยอดชำระเงินแล้ว": paidAmount,
      "ส่วนต่างยอดส่งกับชำระ": roundMoney(sentAmount - paidAmount),
      "Conversion โดยยอด (%)": sentAmount > 0 ? roundMoney((paidAmount / sentAmount) * 100) : 0,
    };
  }).sort((a, b) => String(a.ฝ่ายขาย).localeCompare(String(b.ฝ่ายขาย), "th"));
}

const originalDebugV198 = window.FI_DEBUG;
window.FI_DEBUG = async function FI_DEBUG_V198() {
  const result = typeof originalDebugV198 === "function" ? await originalDebugV198() : {};
  return {
    ...result,
    version: FI_V198_VERSION,
    dashboardBusinessSentLogic: true,
    sentIncludesPaidRows: true,
    excelBusinessSentLogic: true,
  };
};

// Final visible version stamp for QA.
window.FI_APP_VERSION = FI_V198_VERSION;

// =======================================================
// v1.9.9 Owner Assignment + Sales Name Normalization
// - Admin can create/edit Draft quotations for self or active Sales users.
// - owner_id is the source of truth for Sales identity; display names are
//   resolved from current profiles data instead of sales_name_snapshot.
// - Auto-grow textarea fields for quotation detail descriptions.
// =======================================================

const FI_V199_VERSION = "1.9.9";
window.FI_APP_VERSION = FI_V199_VERSION;

if (Array.isArray(FI_QUOTATION_FORM_AUTOSAVE_FIELDS_V193) && !FI_QUOTATION_FORM_AUTOSAVE_FIELDS_V193.includes("draftOwnerId")) {
  const insertAt = FI_QUOTATION_FORM_AUTOSAVE_FIELDS_V193.indexOf("draftBillingType");
  FI_QUOTATION_FORM_AUTOSAVE_FIELDS_V193.splice(insertAt >= 0 ? insertAt : FI_QUOTATION_FORM_AUTOSAVE_FIELDS_V193.length, 0, "draftOwnerId");
}

function getProfileDisplayNameV199(profile) {
  if (!profile) return "-";
  const name = String(profile.full_name || "").trim();
  const email = String(profile.email || "").trim();
  return name || email || "-";
}

function getOwnerDisplayNameV199(row) {
  const ownerId = row?.owner_id || row?.id || "";
  if (ownerId && appState.profileNameByIdV199?.[ownerId]) {
    return appState.profileNameByIdV199[ownerId];
  }
  return row?.owner_name || row?.sales_name || row?.sales_name_snapshot || "ไม่ระบุฝ่ายขาย";
}

function getOwnerGroupKeyV199(row) {
  return row?.owner_id ? `owner:${row.owner_id}` : `name:${getOwnerDisplayNameV199(row)}`;
}

function normalizeOwnerNamesOnRowsV199(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    const displayName = getOwnerDisplayNameV199(row);
    return {
      ...row,
      owner_name: displayName,
      sales_name: displayName,
      _ownerDisplayNameV199: displayName,
      _ownerGroupKeyV199: getOwnerGroupKeyV199(row),
    };
  });
}

async function loadAssignableOwnerProfilesV199() {
  const currentProfile = appState.profile ? { ...appState.profile } : null;
  const currentUserId = appState.user?.id || currentProfile?.id || "";
  let rows = [];

  if (appState.profile?.role === "admin") {
    try {
      const { data, error } = await supabaseClient
        .from("profiles")
        .select("id, email, full_name, role, is_active")
        .eq("is_active", true)
        .in("role", ["admin", "sales"])
        .order("full_name", { ascending: true });
      if (error) throw error;
      rows = data || [];
    } catch (error) {
      console.warn("loadAssignableOwnerProfilesV199 fallback", error);
      rows = [];
    }
  }

  if (currentProfile?.id && !rows.some((profile) => profile.id === currentProfile.id)) {
    rows.unshift(currentProfile);
  }

  if (!rows.length && currentUserId) {
    rows.push({
      id: currentUserId,
      email: appState.profile?.email || "",
      full_name: appState.profile?.full_name || "",
      role: appState.profile?.role || "sales",
      is_active: true,
    });
  }

  const unique = new Map();
  rows.forEach((profile) => {
    if (!profile?.id) return;
    if (profile.is_active === false) return;
    if (!["admin", "sales"].includes(profile.role)) return;
    unique.set(profile.id, profile);
  });

  appState.assignableOwnersV199 = Array.from(unique.values()).sort((a, b) => {
    const aIsCurrent = a.id === currentUserId ? 0 : 1;
    const bIsCurrent = b.id === currentUserId ? 0 : 1;
    if (aIsCurrent !== bIsCurrent) return aIsCurrent - bIsCurrent;
    return getProfileDisplayNameV199(a).localeCompare(getProfileDisplayNameV199(b), "th");
  });

  if (!appState.profileNameByIdV199) appState.profileNameByIdV199 = {};
  appState.assignableOwnersV199.forEach((profile) => {
    appState.profileNameByIdV199[profile.id] = getProfileDisplayNameV199(profile);
  });

  return appState.assignableOwnersV199;
}

async function loadProfileNameMapV199() {
  if (!supabaseClient || !appState.profile) return appState.profileNameByIdV199 || {};

  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("id, email, full_name, role, is_active")
      .eq("is_active", true);

    if (error) throw error;

    appState.profileNameByIdV199 = {};
    (data || []).forEach((profile) => {
      if (!profile?.id) return;
      appState.profileNameByIdV199[profile.id] = getProfileDisplayNameV199(profile);
    });

    if (appState.profile?.id && !appState.profileNameByIdV199[appState.profile.id]) {
      appState.profileNameByIdV199[appState.profile.id] = getProfileDisplayNameV199(appState.profile);
    }
  } catch (error) {
    console.warn("loadProfileNameMapV199 fallback", error);
    if (!appState.profileNameByIdV199) appState.profileNameByIdV199 = {};
    if (appState.profile?.id) {
      appState.profileNameByIdV199[appState.profile.id] = getProfileDisplayNameV199(appState.profile);
    }
  }

  return appState.profileNameByIdV199;
}

async function getQuotationOwnerIdV199(quotationId) {
  if (!quotationId) return appState.user?.id || "";
  try {
    const { data, error } = await supabaseClient
      .from("quotations")
      .select("owner_id")
      .eq("id", quotationId)
      .maybeSingle();
    if (error) throw error;
    return data?.owner_id || appState.user?.id || "";
  } catch (error) {
    console.warn("getQuotationOwnerIdV199 fallback", error);
    return appState.user?.id || "";
  }
}

function renderOwnerOptionsV199(selectedOwnerId) {
  const owners = appState.assignableOwnersV199 || [];
  return owners.map((profile) => {
    const role = profile.role === "admin" ? "Admin" : "Sales";
    const label = `${getProfileDisplayNameV199(profile)} (${role})`;
    return `<option value="${escapeHTML(profile.id)}" ${profile.id === selectedOwnerId ? "selected" : ""}>${escapeHTML(label)}</option>`;
  }).join("");
}

function insertOwnerSelectorV199(selectedOwnerId) {
  const form = document.getElementById("quotationDraftForm");
  if (!form || appState.profile?.role !== "admin") return;
  if (document.getElementById("draftOwnerId")) return;

  const documentSection = Array.from(form.querySelectorAll(".form-section"))
    .find((section) => section.textContent.includes("ข้อมูลเอกสาร"));
  const grid = documentSection?.querySelector(".form-grid");
  if (!grid) return;

  const userField = Array.from(grid.querySelectorAll(".field"))
    .find((field) => field.querySelector("label")?.textContent.trim() === "ผู้ขาย");
  if (userField) {
    userField.querySelector("label").textContent = "ผู้ใช้งานปัจจุบัน";
  }

  const wrapper = document.createElement("div");
  wrapper.className = "field";
  wrapper.innerHTML = `
    <label for="draftOwnerId">เจ้าของใบเสนอราคา / Sales</label>
    <select id="draftOwnerId" required>
      ${renderOwnerOptionsV199(selectedOwnerId)}
    </select>
  `;

  if (userField?.nextSibling) {
    grid.insertBefore(wrapper, userField.nextSibling);
  } else {
    grid.appendChild(wrapper);
  }

  const select = wrapper.querySelector("#draftOwnerId");
  if (select && !select.value && appState.user?.id) select.value = appState.user.id;

  select?.addEventListener("change", () => {
    if (typeof saveQuotationFormStateV193 === "function") saveQuotationFormStateV193();
  });
}

function getSelectedOwnerIdV199() {
  if (appState.profile?.role !== "admin") return appState.user?.id || appState.profile?.id || "";
  const selected = document.getElementById("draftOwnerId")?.value;
  return selected || appState.user?.id || appState.profile?.id || "";
}

function autoGrowTextareaV199(element) {
  if (!element) return;
  element.style.height = "auto";
  const minHeight = Number(element.dataset.minHeightV199 || 0) || element.offsetHeight || 72;
  element.dataset.minHeightV199 = String(minHeight);
  element.style.height = `${Math.max(minHeight, element.scrollHeight + 2)}px`;
}

function bindAutoGrowTextareasV199(root = document) {
  root.querySelectorAll?.("textarea").forEach((textarea) => {
    if (textarea.dataset.autoGrowV199 === "1") {
      autoGrowTextareaV199(textarea);
      return;
    }
    textarea.dataset.autoGrowV199 = "1";
    textarea.classList.add("auto-grow-textarea-v199");
    textarea.addEventListener("input", () => autoGrowTextareaV199(textarea));
    textarea.addEventListener("change", () => autoGrowTextareaV199(textarea));
    window.requestAnimationFrame(() => autoGrowTextareaV199(textarea));
  });
}

function patchCurrentOwnerNameInQuotationViewV199(ownerName) {
  const safeName = escapeHTML(ownerName || "-");
  document.querySelectorAll(".kv-row").forEach((row) => {
    const label = row.querySelector("span")?.textContent.trim();
    if (label === "ผู้ขาย" || label === "ผู้เสนอราคา") {
      const value = row.querySelector("strong");
      if (value) value.innerHTML = safeName;
    }
  });
}

function patchCurrentOwnerNameInPrintV199(ownerName) {
  const safeName = escapeHTML(ownerName || "-");
  document.querySelectorAll(".print-row").forEach((row) => {
    const label = row.querySelector("span")?.textContent.trim();
    if (label === "ผู้เสนอราคา") {
      const value = row.querySelector("strong");
      if (value) value.innerHTML = safeName;
    }
  });

  document.querySelectorAll(".print-signature-box").forEach((box) => {
    const heading = box.querySelector("strong")?.textContent.trim();
    if (heading === "ผู้เสนอราคา") {
      const divs = box.querySelectorAll("div");
      const last = divs[divs.length - 1];
      if (last) last.innerHTML = safeName;
    }
  });
}

async function getCurrentOwnerNameForQuotationV199(quotationId) {
  if (!quotationId) return "-";
  try {
    const { data: quotation, error: quotationError } = await supabaseClient
      .from("quotations")
      .select("owner_id")
      .eq("id", quotationId)
      .maybeSingle();
    if (quotationError) throw quotationError;
    const ownerId = quotation?.owner_id;
    if (!ownerId) return "-";
    if (appState.profileNameByIdV199?.[ownerId]) return appState.profileNameByIdV199[ownerId];

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, email, full_name, role, is_active")
      .eq("id", ownerId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (profile?.id) {
      if (!appState.profileNameByIdV199) appState.profileNameByIdV199 = {};
      appState.profileNameByIdV199[profile.id] = getProfileDisplayNameV199(profile);
      return appState.profileNameByIdV199[profile.id];
    }
  } catch (error) {
    console.warn("getCurrentOwnerNameForQuotationV199 fallback", error);
  }
  return "-";
}

function getSavedProductForQuotationV199(products, options = {}) {
  const selectedProductId = document.getElementById("draftProductId")?.value || "";
  const baseProduct = (Array.isArray(products) ? products : []).find((item) => item.id === selectedProductId);
  const snapshot = options.mode === "edit" && typeof getOriginalQuotationSnapshotV195 === "function"
    ? getOriginalQuotationSnapshotV195(options.quotationId)
    : null;

  if (snapshot?.product_id && selectedProductId === snapshot.product_id) {
    return {
      ...(baseProduct || {}),
      id: snapshot.product_id,
      name: snapshot.product_name_snapshot || baseProduct?.name || "สินค้า/บริการเดิม",
      default_unit: document.getElementById("draftUnit")?.value?.trim?.() || snapshot.unit || baseProduct?.default_unit || "คัน",
      is_active: true,
    };
  }

  return baseProduct;
}

async function handleSaveQuotationDraftV199(event, products, options = {}) {
  event.preventDefault();

  const isEdit = options.mode === "edit";
  const quotationId = options.quotationId;
  const saveButton = document.getElementById("saveDraftButton");

  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = isEdit ? "กำลังบันทึกการแก้ไข..." : "กำลังบันทึก...";
  }

  try {
    const product = getSavedProductForQuotationV199(products, options);
    if (!product?.id) throw new Error("กรุณาเลือกสินค้า/บริการ");

    const customerName = document.getElementById("draftCustomerName")?.value.trim() || "";
    if (!customerName) throw new Error("กรุณากรอกชื่อลูกค้า");

    const selectedOwnerId = getSelectedOwnerIdV199();
    if (!selectedOwnerId) throw new Error("กรุณาเลือกเจ้าของใบเสนอราคา / Sales");

    const quotePayload = {
      owner_id: selectedOwnerId,
      billing_type: document.getElementById("draftBillingType")?.value || "monthly",
      customer_name: customerName,
      customer_address: document.getElementById("draftCustomerAddress")?.value.trim() || "",
      quote_date: document.getElementById("draftQuoteDate")?.value || toDateInputValue(new Date()),
      valid_until: document.getElementById("draftValidUntil")?.value || toDateInputValue(addDays(new Date(), 30)),
      vat_enabled: Boolean(document.getElementById("draftVatEnabled")?.checked),
      vat_rate: 7,
      wht_enabled: Boolean(document.getElementById("draftWhtEnabled")?.checked),
      wht_rate: 3,
      discount_percent: readNumber("#draftDiscountPercent"),
      rounding_enabled: Boolean(document.getElementById("draftRoundingEnabled")?.checked),
      note: document.getElementById("draftNote")?.value.trim() || "",
      payment_terms: document.getElementById("draftPaymentTerms")?.value.trim() || "",
    };

    let savedQuotationId = quotationId;

    if (isEdit) {
      const { data: updatedQuotation, error: updateError } = await supabaseClient
        .from("quotations")
        .update(quotePayload)
        .eq("id", quotationId)
        .select("id")
        .single();
      if (updateError) throw updateError;

      savedQuotationId = updatedQuotation.id;

      const { error: deleteError } = await supabaseClient
        .from("quotation_items")
        .delete()
        .eq("quotation_id", savedQuotationId);
      if (deleteError) throw deleteError;
    } else {
      const { data: quotation, error: quotationError } = await supabaseClient
        .from("quotations")
        .insert(quotePayload)
        .select("id")
        .single();
      if (quotationError) throw quotationError;
      savedQuotationId = quotation.id;
    }

    const quotationItems = [
      {
        quotation_id: savedQuotationId,
        section_type: "recurring",
        product_id: product.id,
        product_name_snapshot: product.name,
        description: document.getElementById("draftRecurringDescription")?.value.trim() || "",
        quantity_label: "จำนวนรถ",
        quantity: readNumber("#draftQuantity"),
        unit: document.getElementById("draftUnit")?.value.trim() || product.default_unit || "คัน",
        unit_price: readNumber("#draftUnitPrice"),
        sort_order: 1,
      },
      {
        quotation_id: savedQuotationId,
        section_type: "one_time",
        product_id: null,
        product_name_snapshot: document.getElementById("draftOneTimeName")?.value.trim() || "ค่าบริการชำระครั้งเดียว",
        description: document.getElementById("draftOneTimeDescription")?.value.trim() || "",
        quantity_label: "จำนวนครั้ง",
        quantity: readNumber("#draftOneTimeQty"),
        unit: "ครั้ง",
        unit_price: readNumber("#draftOneTimePrice"),
        sort_order: 1,
      },
    ];

    const { error: itemError } = await supabaseClient
      .from("quotation_items")
      .insert(quotationItems);
    if (itemError) throw itemError;

    await updateQuotationTotalsSnapshot(savedQuotationId);

    const pageBeforeSave = getCurrentPageV19?.() || appState.currentPage || "";
    if (typeof clearQuotationFormStateV193 === "function") clearQuotationFormStateV193(pageBeforeSave);

    showToast(isEdit ? "บันทึกการแก้ไขสำเร็จ" : "บันทึกร่างสำเร็จ", "success");
    location.hash = `#quotation-view/${savedQuotationId}`;
  } catch (error) {
    console.error(error);
    showToast(error.message || (isEdit ? "ไม่สามารถบันทึกการแก้ไขได้" : "ไม่สามารถบันทึกร่างได้"), "error");
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = isEdit ? "บันทึกการแก้ไข" : "บันทึกร่าง";
    }
  }
}

window.handleSaveQuotationDraft = handleSaveQuotationDraftV199;
try { handleSaveQuotationDraft = window.handleSaveQuotationDraft; } catch (_error) {}

(function patchOwnerAssignmentV199() {
  if (window.__fiOwnerAssignmentPatchedV199) return;
  window.__fiOwnerAssignmentPatchedV199 = true;

  const originalRenderCurrentPage = window.renderCurrentPage || renderCurrentPage;
  window.renderCurrentPage = async function renderCurrentPageV199(...args) {
    await loadProfileNameMapV199();
    const result = await originalRenderCurrentPage.apply(this, args);
    bindAutoGrowTextareasV199(document);
    return result;
  };
  try { renderCurrentPage = window.renderCurrentPage; } catch (_error) {}

  const originalRenderQuotationFormPage = window.renderQuotationFormPage || renderQuotationFormPage;
  if (typeof originalRenderQuotationFormPage === "function") {
    window.renderQuotationFormPage = async function renderQuotationFormPageV199(options = {}) {
      await loadAssignableOwnerProfilesV199();
      const selectedOwnerId = options.mode === "edit" && options.quotationId
        ? await getQuotationOwnerIdV199(options.quotationId)
        : appState.user?.id || appState.profile?.id || "";

      const result = await originalRenderQuotationFormPage.call(this, options);
      insertOwnerSelectorV199(selectedOwnerId);

      if (typeof restoreQuotationFormStateV193 === "function") {
        restoreQuotationFormStateV193();
      }
      bindAutoGrowTextareasV199(document);
      return result;
    };
    try { renderQuotationFormPage = window.renderQuotationFormPage; } catch (_error) {}
  }

  const originalRenderQuotationList = window.renderQuotationList || renderQuotationList;
  if (typeof originalRenderQuotationList === "function") {
    window.renderQuotationList = function renderQuotationListV199(rows) {
      return originalRenderQuotationList.call(this, normalizeOwnerNamesOnRowsV199(rows));
    };
    try { renderQuotationList = window.renderQuotationList; } catch (_error) {}
  }

  const originalRenderQuotationViewPage = window.renderQuotationViewPage || renderQuotationViewPage;
  if (typeof originalRenderQuotationViewPage === "function") {
    window.renderQuotationViewPage = async function renderQuotationViewPageV199(quotationId) {
      const result = await originalRenderQuotationViewPage.call(this, quotationId);
      const ownerName = await getCurrentOwnerNameForQuotationV199(quotationId);
      patchCurrentOwnerNameInQuotationViewV199(ownerName);
      return result;
    };
    try { renderQuotationViewPage = window.renderQuotationViewPage; } catch (_error) {}
  }

  const originalRenderQuotationPrintPage = window.renderQuotationPrintPage || renderQuotationPrintPage;
  if (typeof originalRenderQuotationPrintPage === "function") {
    window.renderQuotationPrintPage = async function renderQuotationPrintPageV199(quotationId) {
      const result = await originalRenderQuotationPrintPage.call(this, quotationId);
      const ownerName = await getCurrentOwnerNameForQuotationV199(quotationId);
      patchCurrentOwnerNameInPrintV199(ownerName);
      return result;
    };
    try { renderQuotationPrintPage = window.renderQuotationPrintPage; } catch (_error) {}
  }
})();

function buildSalesFilterOptions(rows) {
  const map = new Map();
  normalizeOwnerNamesOnRowsV199(rows).forEach((row) => {
    const id = row?.owner_id || row?._ownerGroupKeyV199;
    if (!id) return;
    map.set(id, getOwnerDisplayNameV199(row));
  });
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
}

function buildDashboardAnalytics(rows, options = {}) {
  const sourceRows = normalizeOwnerNamesOnRowsV199(Array.isArray(rows) ? rows : []);
  const monthsBack = options.monthsBack || 6;
  const today = startOfToday();
  const currentKey = monthKey(today);
  const monthStarts = [];

  for (let index = monthsBack - 1; index >= 0; index -= 1) {
    monthStarts.push(new Date(today.getFullYear(), today.getMonth() - index, 1));
  }

  const months = monthStarts.map((date) => ({
    key: monthKey(date),
    label: formatMonthLabel(date),
    sentAmount: 0,
    paidAmount: 0,
    sentCount: 0,
    paidCount: 0,
  }));

  const monthMap = new Map(months.map((item) => [item.key, item]));
  const salesSentCountsByKey = new Map();
  const salesDisplayByKey = new Map();
  const statusCounts = { draft: 0, confirmed: 0, sent: 0, paid: 0, cancelled: 0, expired: 0 };

  let currentMonthSentAmount = 0;
  let currentMonthPaidAmount = 0;
  let currentMonthSentCount = 0;
  let currentMonthPaidCount = 0;
  let openSentAmount = 0;

  sourceRows.forEach((row) => {
    const status = getEffectiveStatusForAnalytics(row);
    if (statusCounts[status] !== undefined) statusCounts[status] += 1;

    const amount = getAmountForBusinessAnalyticsV198(row);
    const sentDate = getSentBusinessDateV198(row);
    const sentKey = sentDate ? monthKey(sentDate) : "";

    if (isSentBusinessRowV198(row)) {
      const month = monthMap.get(sentKey);
      if (month) {
        month.sentAmount += amount;
        month.sentCount += 1;
      }
      if (sentKey === currentKey) {
        currentMonthSentAmount += amount;
        currentMonthSentCount += 1;
      }
      if (!isPaidBusinessRowV198(row)) openSentAmount += amount;

      const ownerKey = getOwnerGroupKeyV199(row);
      const ownerName = getOwnerDisplayNameV199(row);
      salesDisplayByKey.set(ownerKey, ownerName);
      if (!salesSentCountsByKey.has(ownerKey)) {
        salesSentCountsByKey.set(ownerKey, Object.fromEntries(months.map((item) => [item.key, 0])));
      }
      if (sentKey && salesSentCountsByKey.get(ownerKey)[sentKey] !== undefined) {
        salesSentCountsByKey.get(ownerKey)[sentKey] += 1;
      }
    }

    if (isPaidBusinessRowV198(row)) {
      const paidDate = getPaidBusinessDateV198(row);
      const paidKey = paidDate ? monthKey(paidDate) : "";
      const month = monthMap.get(paidKey);
      if (month) {
        month.paidAmount += amount;
        month.paidCount += 1;
      }
      if (paidKey === currentKey) {
        currentMonthPaidAmount += amount;
        currentMonthPaidCount += 1;
      }
    }
  });

  months.forEach((month) => {
    month.sentAmount = roundMoney(month.sentAmount);
    month.paidAmount = roundMoney(month.paidAmount);
  });

  const salesSentCounts = new Map();
  Array.from(salesSentCountsByKey.entries()).forEach(([ownerKey, counts]) => {
    const displayName = salesDisplayByKey.get(ownerKey) || "ไม่ระบุฝ่ายขาย";
    let key = displayName;
    let suffix = 2;
    while (salesSentCounts.has(key)) {
      key = `${displayName} (${suffix})`;
      suffix += 1;
    }
    salesSentCounts.set(key, counts);
  });

  const soon = addDays(today, 7);
  const expiringSoon = sourceRows
    .filter((row) => ["confirmed", "sent"].includes(getRawStatus(row)))
    .filter((row) => {
      const validDate = parseDateOnly(row.valid_until);
      return validDate && validDate >= today && validDate <= soon;
    })
    .slice(0, 8);

  return {
    months,
    salesSentCounts,
    statusCounts,
    currentMonthSentAmount: roundMoney(currentMonthSentAmount),
    currentMonthPaidAmount: roundMoney(currentMonthPaidAmount),
    currentMonthSentCount,
    currentMonthPaidCount,
    openSentAmount: roundMoney(openSentAmount),
    expiringSoon,
    businessSentLogicV198: true,
    ownerIdGroupingV199: true,
  };
}

function buildExcelQuotationRowsV16(rows) {
  return normalizeOwnerNamesOnRowsV199(rows).map((row) => ({
    "เลขที่ใบเสนอราคา": row.quotation_no || "ยังไม่ออกเลข",
    สถานะ: statusLabel(row.effective_status || row.status),
    ลูกค้า: row.customer_name || "",
    ฝ่ายขาย: getOwnerDisplayNameV199(row),
    ประเภท: billingTypeLabel(row.billing_type),
    "วันที่เสนอราคา": row.quote_date || "",
    "วันหมดอายุ": row.valid_until || "",
    "วันที่ส่ง": row.sent_at || "",
    "วันที่ชำระเงิน": row.paid_at || "",
    "ยอดรายเดือน/รายปี": Number(row._recurringTotal || 0),
    "ยอดครั้งเดียว": Number(row._oneTimeTotal || 0),
    "ยอดรวมสุทธิ": Number(row.grand_total_display || 0),
    VAT: Number(row.vat_amount || 0),
    "หัก ณ ที่จ่าย": Number(row.wht_amount || 0),
    ส่วนลด: Number(row.discount_amount || 0),
    "เหตุผลยกเลิก": row.cancelled_reason || "",
    "วันที่สร้าง": row.created_at || "",
    "วันที่แก้ไขล่าสุด": row.updated_at || "",
  }));
}

function buildExcelItemRowsV16(rows, itemsByQuotation, productById) {
  const result = [];
  normalizeOwnerNamesOnRowsV199(rows).forEach((row) => {
    const items = itemsByQuotation.get(row.id) || [];
    items.forEach((item) => {
      const product = item.product_id ? productById.get(item.product_id) : null;
      result.push({
        "เลขที่ใบเสนอราคา": row.quotation_no || "ยังไม่ออกเลข",
        ลูกค้า: row.customer_name || "",
        ฝ่ายขาย: getOwnerDisplayNameV199(row),
        Section: item.section_type === "recurring" ? billingTypeLabel(row.billing_type) : "ครั้งเดียว",
        "รหัสสินค้า": product?.code || "",
        "ชื่อสินค้า/บริการ": item.product_name_snapshot || product?.name || "",
        รายละเอียด: item.description || "",
        จำนวน: Number(item.quantity || 0),
        หน่วย: item.unit || "",
        "ราคา/หน่วย": Number(item.unit_price || 0),
        "มูลค่าก่อนภาษี": Number(getItemLineSubtotalV15(item) || 0),
      });
    });
  });
  return result;
}

function buildExcelBySalesRowsV16(rows) {
  const groups = groupByFunctionV16(normalizeOwnerNamesOnRowsV199(rows), (row) => getOwnerGroupKeyV199(row));
  return Array.from(groups.entries()).map(([, items]) => {
    const first = items[0] || {};
    const sales = getOwnerDisplayNameV199(first);
    const sentRows = items.filter(isSentBusinessRowV198);
    const paidRows = items.filter(isPaidBusinessRowV198);
    const sentAmount = roundMoney(sentRows.reduce((sum, row) => sum + getAmountForBusinessAnalyticsV198(row), 0));
    const paidAmount = roundMoney(paidRows.reduce((sum, row) => sum + getAmountForBusinessAnalyticsV198(row), 0));
    return {
      ฝ่ายขาย: sales,
      "จำนวนใบเสนอราคา": items.length,
      "จำนวนที่เคยส่งแล้ว": sentRows.length,
      "จำนวนชำระเงินแล้ว": paidRows.length,
      "ยอดส่งแล้ว": sentAmount,
      "ยอดชำระเงินแล้ว": paidAmount,
      "ส่วนต่างยอดส่งกับชำระ": roundMoney(sentAmount - paidAmount),
      "Conversion โดยยอด (%)": sentAmount > 0 ? roundMoney((paidAmount / sentAmount) * 100) : 0,
    };
  }).sort((a, b) => String(a.ฝ่ายขาย).localeCompare(String(b.ฝ่ายขาย), "th"));
}

const originalExportQuotationsXlsxV199 = window.exportQuotationsXlsx || exportQuotationsXlsx;
window.exportQuotationsXlsx = async function exportQuotationsXlsxV199(rows) {
  await loadProfileNameMapV199();
  return originalExportQuotationsXlsxV199.call(this, normalizeOwnerNamesOnRowsV199(rows));
};
try { exportQuotationsXlsx = window.exportQuotationsXlsx; } catch (_error) {}

const originalDebugV199 = window.FI_DEBUG;
window.FI_DEBUG = async function FI_DEBUG_V199() {
  const result = typeof originalDebugV199 === "function" ? await originalDebugV199() : {};
  return {
    ...result,
    version: FI_V199_VERSION,
    ownerAssignment: true,
    adminCanCreateOwnQuotation: true,
    ownerIdSourceOfTruth: true,
    assignableOwnerCount: (appState.assignableOwnersV199 || []).length,
    profileNameMapSize: Object.keys(appState.profileNameByIdV199 || {}).length,
    autoGrowTextarea: true,
  };
};

// Final visible version stamp for QA.
window.FI_APP_VERSION = FI_V199_VERSION;


// =======================================================
// v1.10.0 Mobile UX Audit + Clean Quotation Print Layout
// Scope: improve mobile usability across products/actions,
// add discoverable mobile logout/account sheet, and reduce
// excessive borders in quotation print/PDF layout.
// No SQL/RLS/business logic changes.
// =======================================================

const FI_V1100_VERSION = "1.10.0";
window.FI_APP_VERSION = FI_V1100_VERSION;

function isMobileViewportV1100() {
  return window.matchMedia?.("(max-width: 768px)")?.matches || window.innerWidth <= 768;
}

function getProductSearchTextV1100(row) {
  return `${row?.code || ""} ${row?.name || ""} ${row?.description || ""} ${row?.default_unit || ""}`.toLowerCase();
}

function getProductFilteredRowsV1100() {
  const rows = Array.isArray(appState.productRowsV1100) ? appState.productRowsV1100 : [];
  const keyword = String(document.getElementById("productSearchV1100")?.value || "").trim().toLowerCase();
  const status = String(document.getElementById("productStatusFilterV1100")?.value || "");

  return rows.filter((row) => {
    const matchText = !keyword || getProductSearchTextV1100(row).includes(keyword);
    const matchStatus = !status || (status === "active" ? Boolean(row.is_active) : !row.is_active);
    return matchText && matchStatus;
  });
}

function renderMobileProductCardsV1100(rows, canEdit) {
  if (!Array.isArray(rows) || !rows.length) return "";
  return `
    <div class="mobile-card-list-v197 mobile-product-list-v1100">
      ${rows.map((row) => `
        <article class="mobile-data-card-v197 mobile-product-card-v1100">
          <div class="mobile-card-top-v197">
            <strong class="mobile-product-code-v1100">${escapeHTML(row.code || "ไม่ระบุรหัส")}</strong>
            ${row.is_active ? statusPill("Active", "confirmed") : statusPill("Inactive", "cancelled")}
          </div>

          <div class="mobile-card-main-static-v197">
            <strong>${escapeHTML(row.name || "-")}</strong>
            <span class="mobile-product-description-v1100">${escapeHTML(row.description || "ไม่มีรายละเอียด")}</span>
          </div>

          <div class="mobile-card-grid-v197">
            ${renderMobileInfoRowV197("หน่วย", escapeHTML(row.default_unit || "-"))}
            ${renderMobileInfoRowV197("อัปเดตล่าสุด", formatDate(row.updated_at || row.created_at))}
          </div>

          ${canEdit ? `
            <div class="mobile-card-actions-v197">
              <button type="button" class="btn btn-primary" data-product-edit="${row.id}">แก้ไขสินค้า/บริการ</button>
            </div>
          ` : ""}
        </article>
      `).join("")}
    </div>
  `;
}

function renderProductsTableV1100(rows, canEdit) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  return renderTableWithPaginationV195({
    key: "products-v1100",
    rows: sourceRows,
    renderTable: (pagedRows) => {
      if (!pagedRows.length) return `<div class="empty-state">ไม่พบสินค้า/บริการตามเงื่อนไขที่เลือก</div>`;
      return `
        ${renderMobileProductCardsV1100(pagedRows, canEdit)}
        <div class="table-wrap desktop-table-v197 product-table-wrap-v1100">
          <table class="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>ชื่อสินค้า/บริการ</th>
                <th>รายละเอียด</th>
                <th>หน่วย</th>
                <th>สถานะ</th>
                ${canEdit ? "<th>การกระทำ</th>" : ""}
              </tr>
            </thead>
            <tbody>
              ${pagedRows.map((row) => `
                <tr>
                  <td><strong>${escapeHTML(row.code || "-")}</strong></td>
                  <td>${escapeHTML(row.name || "-")}</td>
                  <td>${escapeHTML(row.description || "-")}</td>
                  <td>${escapeHTML(row.default_unit || "-")}</td>
                  <td>${row.is_active ? statusPill("Active", "confirmed") : statusPill("Inactive", "cancelled")}</td>
                  ${canEdit ? `<td><button class="btn btn-ghost" data-product-edit="${row.id}">แก้ไข</button></td>` : ""}
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    },
  });
}

function bindProductActionsV1100() {
  document.querySelectorAll("[data-product-edit]").forEach((button) => {
    if (button.dataset.v1100Bound) return;
    button.dataset.v1100Bound = "true";
    button.addEventListener("click", () => {
      location.hash = `#product-edit/${button.dataset.productEdit}`;
    });
  });
}

function renderProductsListV1100(canEdit) {
  const target = document.getElementById("productsTableV1100");
  if (!target) return;
  const rows = getProductFilteredRowsV1100();
  target.innerHTML = renderProductsTableV1100(rows, canEdit);
  bindPaginationV195("products-v1100", () => renderProductsListV1100(canEdit));
  bindProductActionsV1100();
}

async function renderProductsPage() {
  setPageHeader("สินค้า/บริการ", "Master Data สำหรับใช้ในใบเสนอราคา");
  renderLoading();

  const { data, error } = await supabaseClient
    .from("products")
    .select("id, code, name, description, default_unit, is_active, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const canEdit = appState.profile?.role === "admin";
  appState.productRowsV1100 = data || [];

  elements.pageContent.innerHTML = `
    <div class="card products-page-card-v1100">
      <div class="card-header mobile-stack-header-v1100">
        <div>
          <h3>สินค้า/บริการ</h3>
          <p>${canEdit ? "Admin สามารถเพิ่ม แก้ไข และเปิด/ปิดสินค้าได้" : "หน้านี้เป็น read-only สำหรับ role ของคุณ"}</p>
        </div>
        ${canEdit ? `<button id="addProductButton" class="btn btn-primary">+ เพิ่มสินค้า</button>` : ""}
      </div>

      <div class="filter-bar mobile-filter-bar-v1100">
        <input id="productSearchV1100" type="search" placeholder="ค้นหารหัส / ชื่อ / รายละเอียด" />
        <select id="productStatusFilterV1100">
          <option value="">ทุกสถานะ</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div class="mobile-helper-v1100">บนมือถือระบบจะแสดงข้อมูลเป็นการ์ด เพื่อให้อ่านและกดใช้งานง่ายขึ้น</div>
      <div id="productsTableV1100"></div>
    </div>
  `;

  document.getElementById("addProductButton")?.addEventListener("click", () => {
    location.hash = "#product-new";
  });

  ["productSearchV1100", "productStatusFilterV1100"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => renderProductsListV1100(canEdit));
    document.getElementById(id)?.addEventListener("change", () => renderProductsListV1100(canEdit));
  });

  renderProductsListV1100(canEdit);
}

function ensureMobileAccountSheetV1100() {
  if (document.getElementById("mobileAccountSheetV1100")) return;

  const sheet = document.createElement("div");
  sheet.id = "mobileAccountSheetV1100";
  sheet.className = "mobile-account-sheet-v1100 hidden";
  sheet.innerHTML = `
    <div class="mobile-account-backdrop-v1100" data-account-action-v1100="close"></div>
    <section class="mobile-account-panel-v1100">
      <div class="mobile-account-grip-v1100"></div>
      <div class="mobile-account-user-v1100">
        <div class="brand-mark small">FI</div>
        <div>
          <strong id="mobileAccountNameV1100">-</strong>
          <span id="mobileAccountRoleV1100">-</span>
        </div>
      </div>
      <div class="mobile-account-actions-v1100">
        <button type="button" class="btn btn-ghost" data-account-action-v1100="settings">ตั้งค่า</button>
        <button type="button" class="btn btn-ghost" data-account-action-v1100="company">ข้อมูลบริษัท</button>
        <button type="button" class="btn btn-primary danger-mobile-v1100" data-account-action-v1100="logout">ออกจากระบบ</button>
        <button type="button" class="btn btn-ghost" data-account-action-v1100="close">ปิด</button>
      </div>
    </section>
  `;
  document.body.appendChild(sheet);
}

function updateMobileAccountLabelsV1100() {
  const name = appState.profile?.full_name || appState.profile?.email || "-";
  const role = roleLabel(appState.profile?.role || "-");
  const nameTarget = document.getElementById("mobileAccountNameV1100");
  const roleTarget = document.getElementById("mobileAccountRoleV1100");
  if (nameTarget) nameTarget.textContent = name;
  if (roleTarget) roleTarget.textContent = role;
}

function openMobileAccountSheetV1100() {
  ensureMobileAccountSheetV1100();
  updateMobileAccountLabelsV1100();
  document.getElementById("mobileAccountSheetV1100")?.classList.remove("hidden");
  document.body.classList.add("mobile-account-open-v1100");
}

function closeMobileAccountSheetV1100() {
  document.getElementById("mobileAccountSheetV1100")?.classList.add("hidden");
  document.body.classList.remove("mobile-account-open-v1100");
}

function ensureMobileAccountEntrypointsV1100() {
  const header = document.querySelector(".sidebar.app-header");
  const nav = elements.sidebarMenu || document.getElementById("sidebarMenu");

  if (header && !document.getElementById("mobileAccountHeaderButtonV1100")) {
    const headerButton = document.createElement("button");
    headerButton.id = "mobileAccountHeaderButtonV1100";
    headerButton.type = "button";
    headerButton.className = "mobile-account-header-v1100";
    headerButton.dataset.mobileAccountV1100 = "true";
    headerButton.textContent = "บัญชี";
    header.appendChild(headerButton);
  }

  if (nav && !document.getElementById("mobileAccountNavButtonV1100")) {
    const navButton = document.createElement("button");
    navButton.id = "mobileAccountNavButtonV1100";
    navButton.type = "button";
    navButton.className = "mobile-account-tab-v1100";
    navButton.dataset.mobileAccountV1100 = "true";
    navButton.innerHTML = `<span>👤</span><span>บัญชี</span>`;
    nav.appendChild(navButton);
  }
}

const originalRenderMenuV1100 = window.renderMenu || renderMenu;
window.renderMenu = function renderMenuV1100(...args) {
  const result = originalRenderMenuV1100.apply(this, args);
  window.setTimeout(() => {
    ensureMobileAccountSheetV1100();
    ensureMobileAccountEntrypointsV1100();
    updateMobileAccountLabelsV1100();
  }, 0);
  return result;
};
try { renderMenu = window.renderMenu; } catch (_error) {}

const originalRenderCurrentPageV1100 = window.renderCurrentPage || renderCurrentPage;
window.renderCurrentPage = async function renderCurrentPageV1100(...args) {
  const result = await originalRenderCurrentPageV1100.apply(this, args);
  ensureMobileAccountSheetV1100();
  ensureMobileAccountEntrypointsV1100();
  updateMobileAccountLabelsV1100();
  document.body.classList.toggle("is-mobile-v1100", isMobileViewportV1100());
  return result;
};
try { renderCurrentPage = window.renderCurrentPage; } catch (_error) {}

(function bindMobileAccountActionsV1100() {
  if (window.__fiMobileAccountBoundV1100) return;
  window.__fiMobileAccountBoundV1100 = true;

  document.addEventListener("click", async (event) => {
    if (event.target.closest?.("[data-mobile-account-v1100]")) {
      event.preventDefault();
      openMobileAccountSheetV1100();
      return;
    }

    const actionTarget = event.target.closest?.("[data-account-action-v1100]");
    if (!actionTarget) return;

    const action = actionTarget.dataset.accountActionV1100;
    if (action === "close") {
      closeMobileAccountSheetV1100();
      return;
    }

    if (action === "settings") {
      closeMobileAccountSheetV1100();
      location.hash = "#settings";
      return;
    }

    if (action === "company") {
      closeMobileAccountSheetV1100();
      location.hash = "#company";
      return;
    }

    if (action === "logout") {
      closeMobileAccountSheetV1100();
      await handleLogout();
    }
  }, true);

  window.addEventListener("resize", () => document.body.classList.toggle("is-mobile-v1100", isMobileViewportV1100()));
  document.addEventListener("DOMContentLoaded", () => window.setTimeout(() => {
    ensureMobileAccountSheetV1100();
    ensureMobileAccountEntrypointsV1100();
    document.body.classList.toggle("is-mobile-v1100", isMobileViewportV1100());
  }, 0));
})();

const originalDebugV1100 = window.FI_DEBUG;
window.FI_DEBUG = async function FI_DEBUG_V1100() {
  const result = typeof originalDebugV1100 === "function" ? await originalDebugV1100() : {};
  return {
    ...result,
    version: FI_V1100_VERSION,
    mobileUxAudit: true,
    mobileAccountMenu: true,
    mobileProductsCardView: true,
    cleanCorporatePrintLayout: true,
    sqlChanged: false,
  };
};

// Final visible version stamp for QA.
window.FI_APP_VERSION = FI_V1100_VERSION;


// =======================================================
// v1.10.1 Mobile Menu Cleanup + Suggested PDF Filename
// Scope: keep mobile navigation focused by hiding secondary
// admin pages from the mobile tab bar and set a suggested
// filename for browser Save as PDF flows.
// No SQL/RLS/business logic changes.
// =======================================================

const FI_V1101_VERSION = "1.10.1";
window.FI_APP_VERSION = FI_V1101_VERSION;

function sanitizeFilenamePartV1101(value, fallback = "-") {
  const text = String(value || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/g, "");

  return (text || fallback).slice(0, 90);
}

function getPrimaryPrintProductNameV1101(model) {
  const sections = Array.isArray(model?.sections) ? model.sections : [];
  const recurringSection = sections.find((section) => section?.type === "recurring");
  const firstSection = sections.find((section) => Array.isArray(section?.items) && section.items.length);
  const item =
    (recurringSection?.items || []).find(Boolean) ||
    (firstSection?.items || []).find(Boolean) ||
    null;

  return sanitizeFilenamePartV1101(
    item?.product_name_snapshot || item?.name || "สินค้า-บริการ",
    "สินค้า-บริการ"
  );
}

function buildSuggestedPdfTitleV1101(model) {
  const quotationNo = sanitizeFilenamePartV1101(
    model?.quotation?.quotation_no || "ใบเสนอราคา",
    "ใบเสนอราคา"
  );
  const productName = getPrimaryPrintProductNameV1101(model);
  return `${quotationNo} (${productName})`;
}

function printWithSuggestedFilenameV1101(model) {
  const previousTitle = document.title;
  const suggestedTitle = buildSuggestedPdfTitleV1101(model);
  let restored = false;

  const restoreTitle = () => {
    if (restored) return;
    restored = true;
    document.title = previousTitle;
    window.removeEventListener("afterprint", restoreTitle);
  };

  document.title = suggestedTitle;
  window.addEventListener("afterprint", restoreTitle, { once: true });

  try {
    window.print();
  } finally {
    // Fallback for browsers that do not fire afterprint reliably.
    window.setTimeout(restoreTitle, 60000);
  }
}

function bindPrintV15Actions(model) {
  const printButton = $("#printButton");
  const backButton = $("#backFromPrintButton");

  if (printButton) {
    printButton.addEventListener("click", () => printWithSuggestedFilenameV1101(model));
  }

  if (backButton) {
    backButton.addEventListener("click", () => {
      location.hash = `#quotation-view/${model.quotation.id}`;
    });
  }
}

const originalDebugV1101 = window.FI_DEBUG;
window.FI_DEBUG = async function FI_DEBUG_V1101() {
  const result = typeof originalDebugV1101 === "function" ? await originalDebugV1101() : {};
  return {
    ...result,
    version: FI_V1101_VERSION,
    mobileSecondaryMenuHidden: true,
    suggestedPdfFilename: true,
    sqlChanged: false,
  };
};

// Final visible version stamp for QA.
window.FI_APP_VERSION = FI_V1101_VERSION;


// =======================================================
// v1.10.2 Google Drive PDF Archive
// Scope: add Google Apps Script archive settings, one-time
// Drive PDF save per quotation, Sales subfolders, and Drive
// file log. Requires supabase/patch_v1_10_2.sql and Apps Script.
// =======================================================

const FI_V1102_VERSION = "1.10.2";
window.FI_APP_VERSION = FI_V1102_VERSION;

const FI_DRIVE_SETTING_KEYS_V1102 = {
  webAppUrl: "google_drive_web_app_url",
  parentFolderId: "google_drive_parent_folder_id",
  uploadSecret: "google_drive_upload_secret",
};

function sanitizeDriveNameV1102(value, fallback = "-") {
  const text = String(value || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/g, "");
  return (text || fallback).slice(0, 120);
}

function normalizeDriveWebAppUrlV1102(value) {
  return String(value || "").trim();
}

async function loadDriveArchiveSettingsV1102() {
  const empty = { webAppUrl: "", parentFolderId: "", uploadSecret: "" };
  if (!supabaseClient) return empty;

  const keys = Object.values(FI_DRIVE_SETTING_KEYS_V1102);
  const { data, error } = await supabaseClient
    .from("app_settings")
    .select("key, value")
    .in("key", keys);

  if (error) {
    console.warn("Cannot load Google Drive Archive settings. Run supabase/patch_v1_10_2.sql first.", error);
    return { ...empty, loadError: error.message || String(error) };
  }

  const settings = { ...empty };
  (data || []).forEach((row) => {
    if (row.key === FI_DRIVE_SETTING_KEYS_V1102.webAppUrl) settings.webAppUrl = row.value || "";
    if (row.key === FI_DRIVE_SETTING_KEYS_V1102.parentFolderId) settings.parentFolderId = row.value || "";
    if (row.key === FI_DRIVE_SETTING_KEYS_V1102.uploadSecret) settings.uploadSecret = row.value || "";
  });
  return settings;
}

function isDriveArchiveConfiguredV1102(settings) {
  return Boolean(
    normalizeDriveWebAppUrlV1102(settings?.webAppUrl) &&
    String(settings?.parentFolderId || "").trim() &&
    String(settings?.uploadSecret || "").trim()
  );
}

function validateDriveArchiveSettingsV1102(settings) {
  const webAppUrl = normalizeDriveWebAppUrlV1102(settings.webAppUrl);
  const parentFolderId = String(settings.parentFolderId || "").trim();
  const uploadSecret = String(settings.uploadSecret || "").trim();

  if (!webAppUrl) throw new Error("กรุณากรอก Google Apps Script Web App URL");
  if (!/^https:\/\/script\.google\.com\//.test(webAppUrl)) {
    throw new Error("Web App URL ควรเป็น URL จาก script.google.com");
  }
  if (!parentFolderId) throw new Error("กรุณากรอก Google Drive Parent Folder ID");
  if (!uploadSecret) throw new Error("กรุณากรอก Shared Secret / Upload Token");

  return { webAppUrl, parentFolderId, uploadSecret };
}

async function saveDriveArchiveSettingsV1102(settings) {
  const clean = validateDriveArchiveSettingsV1102(settings);
  await saveAppSetting(FI_DRIVE_SETTING_KEYS_V1102.webAppUrl, clean.webAppUrl);
  await saveAppSetting(FI_DRIVE_SETTING_KEYS_V1102.parentFolderId, clean.parentFolderId);
  await saveAppSetting(FI_DRIVE_SETTING_KEYS_V1102.uploadSecret, clean.uploadSecret);
  return clean;
}

async function renderSettingsPage() {
  if (appState.profile.role !== "admin") {
    renderError("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
    return;
  }

  setPageHeader("ตั้งค่า", "ตั้งค่าระบบ โลโก้ และ Google Drive Archive");
  renderLoading();

  const [branding, driveSettings] = await Promise.all([
    typeof loadAppBranding === "function" ? loadAppBranding() : Promise.resolve({ login_logo_url: "", favicon_url: "" }),
    loadDriveArchiveSettingsV1102(),
  ]);

  appState.appBranding = branding;
  appState.driveArchiveSettingsV1102 = driveSettings;

  elements.pageContent.innerHTML = `
    <div class="settings-grid-v14 settings-grid-v1102">
      <section class="card form-card">
        <div class="card-header">
          <div>
            <h3>โลโก้ระบบ</h3>
            <p>โลโก้หน้า Login, แถบเมนู และ Icon เว็บไซต์</p>
          </div>
        </div>

        <div class="branding-preview-grid">
          ${renderBrandingPreviewCard("โลโก้หน้า Login / แถบเมนู", branding.login_logo_url, "login")}
          ${renderBrandingPreviewCard("Icon บน Tab / Taskbar", branding.favicon_url, "favicon")}
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="loginLogoFile">อัปโหลดโลโก้ระบบ / แถบเมนู</label>
            <input id="loginLogoFile" type="file" accept="image/png,image/jpeg,image/webp" />
            <small class="field-hint">รองรับ PNG, JPG, WEBP ไม่เกิน 5 MB</small>
          </div>
          <div class="field">
            <label for="faviconFile">อัปโหลด Icon เว็บไซต์</label>
            <input id="faviconFile" type="file" accept="image/png,image/jpeg,image/webp" />
            <small class="field-hint">แนะนำภาพสี่เหลี่ยม เช่น 512×512 px</small>
          </div>
        </div>

        <div class="form-actions normal-flow">
          <button type="button" id="uploadLoginLogoButton" class="btn btn-primary">บันทึกโลโก้ระบบ</button>
          <button type="button" id="uploadFaviconButton" class="btn btn-primary">บันทึก Icon เว็บไซต์</button>
        </div>
      </section>

      <section class="card form-card drive-settings-card-v1102">
        <div class="card-header">
          <div>
            <h3>Google Drive Archive</h3>
            <p>ตั้งค่าการบันทึก PDF ใบเสนอราคาไปยัง Google Drive ผ่าน Google Apps Script</p>
          </div>
        </div>

        ${driveSettings.loadError ? `<div class="alert alert-warning">ยังโหลดการตั้งค่า Drive ไม่ได้: ${escapeHTML(driveSettings.loadError)}<br />กรุณารัน <strong>supabase/patch_v1_10_2.sql</strong> ก่อนใช้งาน</div>` : ""}

        <div class="form-grid">
          <div class="field full">
            <label for="driveWebAppUrlV1102">Google Apps Script Web App URL *</label>
            <input id="driveWebAppUrlV1102" type="url" placeholder="https://script.google.com/macros/s/.../exec" value="${escapeHTML(driveSettings.webAppUrl || "")}" />
          </div>

          <div class="field full">
            <label for="driveParentFolderIdV1102">Google Drive Parent Folder ID *</label>
            <input id="driveParentFolderIdV1102" type="text" placeholder="Folder ID จาก Google Drive" value="${escapeHTML(driveSettings.parentFolderId || "")}" />
            <small class="field-hint">ระบบจะสร้าง folder ย่อยของ Sales ใน Parent Folder นี้</small>
          </div>

          <div class="field full">
            <label for="driveUploadSecretV1102">Shared Secret / Upload Token *</label>
            <input id="driveUploadSecretV1102" type="password" autocomplete="new-password" placeholder="ต้องตรงกับค่า UPLOAD_SECRET ใน Apps Script" value="${escapeHTML(driveSettings.uploadSecret || "")}" />
            <small class="field-hint">ใช้ป้องกัน request ภายนอกระดับพื้นฐาน เนื่องจากระบบอยู่บน GitHub Pages ค่านี้ไม่ควรถูกมองว่าเป็น secret ระดับ backend</small>
          </div>
        </div>

        <div class="form-actions normal-flow drive-actions-v1102">
          <button type="button" id="saveDriveSettingsButtonV1102" class="btn btn-primary">บันทึกการตั้งค่า Drive</button>
          <button type="button" id="testDriveSettingsButtonV1102" class="btn btn-ghost">ทดสอบการเชื่อมต่อ</button>
        </div>

        <div id="driveSettingsResultV1102" class="drive-settings-result-v1102"></div>
      </section>

      <section class="card">
        <div class="card-header"><h3>การใช้งานผู้ใช้</h3></div>
        <div class="checklist-grid">
          <label class="checklist-item"><input type="checkbox" checked disabled /><span>Admin สร้างบัญชีผ่าน Supabase Dashboard</span></label>
          <label class="checklist-item"><input type="checkbox" checked disabled /><span>Role ใช้จากตาราง profiles</span></label>
          <label class="checklist-item"><input type="checkbox" checked disabled /><span>Sales เห็นข้อมูลของตัวเองตาม RLS</span></label>
          <label class="checklist-item"><input type="checkbox" checked disabled /><span>Manager/Admin ดูภาพรวมได้ตามสิทธิ์</span></label>
        </div>
      </section>
    </div>
  `;

  bindAppBrandingSettingsActions?.();
  bindDriveArchiveSettingsActionsV1102();
}

function readDriveSettingsFormV1102() {
  return {
    webAppUrl: document.getElementById("driveWebAppUrlV1102")?.value || "",
    parentFolderId: document.getElementById("driveParentFolderIdV1102")?.value || "",
    uploadSecret: document.getElementById("driveUploadSecretV1102")?.value || "",
  };
}

function setDriveSettingsResultV1102(message, type = "info") {
  const target = document.getElementById("driveSettingsResultV1102");
  if (!target) return;
  const className = type === "error" ? "alert alert-error" : type === "success" ? "alert alert-success-v1102" : "alert alert-warning";
  target.innerHTML = message ? `<div class="${className}">${escapeHTML(message)}</div>` : "";
}

function bindDriveArchiveSettingsActionsV1102() {
  document.getElementById("saveDriveSettingsButtonV1102")?.addEventListener("click", async () => {
    const button = document.getElementById("saveDriveSettingsButtonV1102");
    try {
      button.disabled = true;
      button.textContent = "กำลังบันทึก...";
      const clean = await saveDriveArchiveSettingsV1102(readDriveSettingsFormV1102());
      appState.driveArchiveSettingsV1102 = clean;
      setDriveSettingsResultV1102("บันทึกการตั้งค่า Google Drive สำเร็จ", "success");
      showToast("บันทึกการตั้งค่า Google Drive สำเร็จ");
    } catch (error) {
      console.error(error);
      setDriveSettingsResultV1102(error.message || "ไม่สามารถบันทึกการตั้งค่า Drive ได้", "error");
      showToast(error.message || "ไม่สามารถบันทึกการตั้งค่า Drive ได้");
    } finally {
      button.disabled = false;
      button.textContent = "บันทึกการตั้งค่า Drive";
    }
  });

  document.getElementById("testDriveSettingsButtonV1102")?.addEventListener("click", async () => {
    const button = document.getElementById("testDriveSettingsButtonV1102");
    try {
      button.disabled = true;
      button.textContent = "กำลังทดสอบ...";
      const settings = validateDriveArchiveSettingsV1102(readDriveSettingsFormV1102());
      const response = await postToAppsScriptIframeV1102(settings.webAppUrl, {
        action: "ping",
        secret: settings.uploadSecret,
        parentFolderId: settings.parentFolderId,
      }, 45000);

      if (!response.ok) throw new Error(response.error || "Apps Script ตอบกลับว่าไม่สำเร็จ");
      const folderName = response.parentFolderName ? ` (${response.parentFolderName})` : "";
      setDriveSettingsResultV1102(`เชื่อมต่อ Google Drive สำเร็จ${folderName}`, "success");
      showToast("เชื่อมต่อ Google Drive สำเร็จ");
    } catch (error) {
      console.error(error);
      setDriveSettingsResultV1102(error.message || "ทดสอบการเชื่อมต่อไม่สำเร็จ", "error");
      showToast(error.message || "ทดสอบการเชื่อมต่อไม่สำเร็จ");
    } finally {
      button.disabled = false;
      button.textContent = "ทดสอบการเชื่อมต่อ";
    }
  });
}

function postToAppsScriptIframeV1102(webAppUrl, payload, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const requestId = `fi-drive-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const frameName = `fiDriveFrame_${requestId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const iframe = document.createElement("iframe");
    const form = document.createElement("form");
    const input = document.createElement("input");
    let done = false;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
      form.remove();
      window.setTimeout(() => iframe.remove(), 1000);
    };

    const finish = (fn, value) => {
      if (done) return;
      done = true;
      cleanup();
      fn(value);
    };

    function onMessage(event) {
      const data = event.data || {};
      if (!data || data.source !== "fi-drive-archive-v1102" || data.requestId !== requestId) return;
      finish(resolve, data);
    }

    const timer = window.setTimeout(() => {
      finish(reject, new Error("การเชื่อมต่อ Google Apps Script ใช้เวลานานเกินไป กรุณาตรวจ Web App URL / Deploy permission"));
    }, timeoutMs);

    iframe.name = frameName;
    iframe.style.display = "none";
    iframe.setAttribute("aria-hidden", "true");

    form.method = "POST";
    form.action = webAppUrl;
    form.target = frameName;
    form.enctype = "application/x-www-form-urlencoded";
    form.style.display = "none";

    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify({ ...payload, requestId, version: FI_V1102_VERSION });

    form.appendChild(input);
    document.body.appendChild(iframe);
    document.body.appendChild(form);
    window.addEventListener("message", onMessage);
    form.submit();
  });
}

async function loadDriveFileLogV1102(quotationId) {
  if (!quotationId) return null;
  const { data, error } = await supabaseClient
    .from("quotation_drive_files")
    .select("*")
    .eq("quotation_id", quotationId)
    .maybeSingle();

  if (error) {
    console.warn("Cannot load quotation_drive_files. Run supabase/patch_v1_10_2.sql first.", error);
    return { loadError: error.message || String(error) };
  }
  return data || null;
}

async function loadQuotationOwnerProfileV1102(ownerId) {
  if (!ownerId) return { full_name: "-", email: "" };
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("full_name, email")
    .eq("id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data || { full_name: "-", email: "" };
}

function buildDriveFolderNameV1102(profile, fallbackName = "Sales") {
  const name = sanitizeDriveNameV1102(profile?.full_name || fallbackName || "Sales", "Sales");
  const email = sanitizeDriveNameV1102(profile?.email || "no-email", "no-email");
  return `${name} - ${email}`;
}

function buildDrivePdfFileNameV1102(model) {
  const title = typeof buildSuggestedPdfTitleV1101 === "function"
    ? buildSuggestedPdfTitleV1101(model)
    : `${model?.quotation?.quotation_no || "ใบเสนอราคา"} (${getPrimaryPrintProductNameV1101(model)})`;
  return `${sanitizeDriveNameV1102(title, "ใบเสนอราคา")}.pdf`;
}

async function collectPrintCssV1102() {
  const cssParts = [];
  for (const sheet of Array.from(document.styleSheets || [])) {
    try {
      const rules = Array.from(sheet.cssRules || []);
      if (rules.length) cssParts.push(rules.map((rule) => rule.cssText).join("\n"));
    } catch (_error) {
      // Cross-origin stylesheet; ignored intentionally.
    }
  }

  cssParts.push(`
    body { margin: 0; background: #ffffff; font-family: "Noto Sans Thai", Arial, sans-serif; }
    .print-v2-wrap { display: block !important; padding: 0 !important; background: #ffffff !important; }
    .print-v2-page { box-shadow: none !important; margin: 0 auto !important; border: 0 !important; }
  `);
  return cssParts.join("\n");
}

async function buildDriveArchiveHtmlV1102() {
  const page = document.getElementById("quotationPrintPage") || document.querySelector(".print-v2-page") || document.querySelector(".print-page");
  if (!page) throw new Error("ไม่พบพื้นที่เอกสารสำหรับสร้าง PDF");
  const css = await collectPrintCssV1102();
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <style>${css}</style>
</head>
<body>
  <div class="print-v2-wrap drive-export-v1102">
    ${page.outerHTML}
  </div>
</body>
</html>`;
}

function canArchiveQuotationToDriveV1102(quotation) {
  const role = appState.profile?.role;
  const isOwner = quotation?.owner_id === appState.user?.id;
  return role === "admin" || (role === "sales" && isOwner);
}

async function insertDriveFileLogV1102({ model, fileName, response, folderId }) {
  const payload = {
    quotation_id: model.quotation.id,
    owner_id: model.quotation.owner_id,
    file_name: fileName,
    file_id: response.fileId,
    file_url: response.fileUrl,
    folder_id: response.folderId || folderId || null,
    created_by: appState.user.id,
  };

  const { data, error } = await supabaseClient
    .from("quotation_drive_files")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    if (String(error.code || "") === "23505" || /duplicate|unique/i.test(error.message || "")) {
      const existing = await loadDriveFileLogV1102(model.quotation.id);
      if (existing && !existing.loadError) return existing;
    }
    throw error;
  }

  return data;
}

async function handleSaveQuotationPdfToDriveV1102(model) {
  const button = document.getElementById("saveDrivePdfButtonV1102");
  const target = document.getElementById("driveArchiveStatusV1102");

  try {
    if (!canArchiveQuotationToDriveV1102(model.quotation)) {
      throw new Error("คุณไม่มีสิทธิ์บันทึกใบเสนอราคานี้ไป Google Drive");
    }

    const existing = await loadDriveFileLogV1102(model.quotation.id);
    if (existing && !existing.loadError) {
      renderDriveArchiveStatusV1102(model, existing, appState.driveArchiveSettingsV1102 || {});
      showToast("ใบเสนอราคานี้ถูกบันทึกไป Google Drive แล้ว");
      return;
    }

    const settings = validateDriveArchiveSettingsV1102(appState.driveArchiveSettingsV1102 || await loadDriveArchiveSettingsV1102());
    const ownerProfile = await loadQuotationOwnerProfileV1102(model.quotation.owner_id);
    const salesFolderName = buildDriveFolderNameV1102(ownerProfile, model.ownerName);
    const fileName = buildDrivePdfFileNameV1102(model);
    const html = await buildDriveArchiveHtmlV1102();

    if (button) {
      button.disabled = true;
      button.textContent = "กำลังบันทึกไป Drive...";
    }
    if (target) target.innerHTML = `<div class="alert alert-warning">กำลังสร้าง PDF และบันทึกไป Google Drive...</div>`;

    const response = await postToAppsScriptIframeV1102(settings.webAppUrl, {
      action: "upload",
      secret: settings.uploadSecret,
      parentFolderId: settings.parentFolderId,
      quotationId: model.quotation.id,
      quotationNo: model.quotation.quotation_no || "",
      salesFolderName,
      fileName,
      html,
    });

    if (!response.ok) throw new Error(response.error || "Apps Script ไม่สามารถบันทึกไฟล์ได้");

    const savedLog = await insertDriveFileLogV1102({
      model,
      fileName,
      response,
      folderId: settings.parentFolderId,
    });

    renderDriveArchiveStatusV1102(model, savedLog, settings);
    showToast(response.existing ? "พบไฟล์เดิมใน Google Drive และบันทึก log แล้ว" : "บันทึก PDF ไป Google Drive สำเร็จ");
  } catch (error) {
    console.error(error);
    if (target) target.innerHTML = `<div class="alert alert-error">${escapeHTML(error.message || "ไม่สามารถบันทึกไป Google Drive ได้")}</div>`;
    showToast(error.message || "ไม่สามารถบันทึกไป Google Drive ได้");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "บันทึกไป Google Drive";
    }
  }
}

function renderDriveArchiveStatusV1102(model, driveLog, settings) {
  const target = document.getElementById("driveArchiveStatusV1102");
  if (!target) return;

  if (driveLog && driveLog.loadError) {
    target.innerHTML = `<div class="alert alert-warning">ยังตรวจประวัติ Google Drive ไม่ได้ กรุณารัน <strong>supabase/patch_v1_10_2.sql</strong></div>`;
    return;
  }

  if (driveLog?.file_url) {
    target.innerHTML = `
      <a class="btn btn-ghost drive-open-button-v1102" href="${escapeHTML(driveLog.file_url)}" target="_blank" rel="noopener">
        เปิดไฟล์ใน Google Drive
      </a>
      <span class="drive-status-text-v1102">บันทึกแล้ว: ${escapeHTML(driveLog.file_name || "PDF")}</span>
    `;
    return;
  }

  if (!canArchiveQuotationToDriveV1102(model.quotation)) {
    target.innerHTML = `<div class="alert alert-warning">คุณมีสิทธิ์ดูเอกสาร แต่ไม่มีสิทธิ์บันทึก PDF ไป Google Drive</div>`;
    return;
  }

  if (!isDriveArchiveConfiguredV1102(settings)) {
    target.innerHTML = `
      <div class="alert alert-warning">
        ยังไม่ได้ตั้งค่า Google Drive Archive กรุณาให้ Admin ตั้งค่า Web App URL, Folder ID และ Shared Secret ในเมนูตั้งค่า
      </div>
    `;
    return;
  }

  target.innerHTML = `<button id="saveDrivePdfButtonV1102" type="button" class="btn btn-ghost">บันทึกไป Google Drive</button>`;
  document.getElementById("saveDrivePdfButtonV1102")?.addEventListener("click", async () => {
    await handleSaveQuotationPdfToDriveV1102(model);
  });
}

async function initializeDriveArchiveToolbarV1102(model) {
  const actions = document.querySelector(".print-toolbar-actions") || document.querySelector(".print-v2-toolbar .print-toolbar-actions");
  if (!actions || document.getElementById("driveArchiveStatusV1102")) return;

  const holder = document.createElement("div");
  holder.id = "driveArchiveStatusV1102";
  holder.className = "drive-archive-status-v1102";
  holder.innerHTML = `<span class="drive-status-text-v1102">กำลังตรวจสถานะ Drive...</span>`;
  actions.appendChild(holder);

  const [settings, driveLog] = await Promise.all([
    loadDriveArchiveSettingsV1102(),
    loadDriveFileLogV1102(model.quotation.id),
  ]);

  appState.driveArchiveSettingsV1102 = settings;
  renderDriveArchiveStatusV1102(model, driveLog, settings);
}

function bindPrintV15Actions(model) {
  const printButton = $("#printButton");
  const backButton = $("#backFromPrintButton");

  if (printButton) {
    printButton.addEventListener("click", () => printWithSuggestedFilenameV1101(model));
  }

  if (backButton) {
    backButton.addEventListener("click", () => {
      location.hash = `#quotation-view/${model.quotation.id}`;
    });
  }

  initializeDriveArchiveToolbarV1102(model).catch((error) => {
    console.error(error);
    const target = document.getElementById("driveArchiveStatusV1102");
    if (target) target.innerHTML = `<div class="alert alert-error">${escapeHTML(error.message || "ไม่สามารถเตรียม Google Drive Archive ได้")}</div>`;
  });
}

const originalDebugV1102 = window.FI_DEBUG;
window.FI_DEBUG = async function FI_DEBUG_V1102() {
  const result = typeof originalDebugV1102 === "function" ? await originalDebugV1102() : {};
  return {
    ...result,
    version: FI_V1102_VERSION,
    googleDriveArchive: true,
    googleDriveSettingsInSettingsPage: true,
    onePdfPerQuotation: true,
    appsScriptIframePost: true,
    sqlChanged: true,
  };
};

// Final visible version stamp for QA.
window.FI_APP_VERSION = FI_V1102_VERSION;

// =======================================================
// v1.10.3 Drive PDF Rendering Fix
// Scope: render PDF in the user's browser and upload the
// finished PDF to Apps Script as base64. Apps Script no longer
// performs HTML-to-PDF conversion for new uploads.
// =======================================================

const FI_V1103_VERSION = "1.10.3";

function ensureDrivePdfLibrariesV1103() {
  if (typeof window.html2canvas !== "function") {
    throw new Error("ไม่พบ html2canvas library กรุณาตรวจการโหลด CDN หรืออินเทอร์เน็ต");
  }
  if (!window.jspdf?.jsPDF) {
    throw new Error("ไม่พบ jsPDF library กรุณาตรวจการโหลด CDN หรืออินเทอร์เน็ต");
  }
}

async function waitForPrintAssetsV1103(root) {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch (_error) {
      // Continue with fallback fonts if the browser cannot confirm font readiness.
    }
  }

  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(images.map((image) => new Promise((resolve) => {
    if (image.complete && image.naturalWidth > 0) {
      resolve();
      return;
    }
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", resolve, { once: true });
    setTimeout(resolve, 2500);
  })));
}

async function fetchImageAsDataUrlV1103(src) {
  const url = String(src || "").trim();
  if (!url || url.startsWith("data:")) return url;

  try {
    const response = await fetch(url, { mode: "cors", credentials: "omit", cache: "force-cache" });
    if (!response.ok) throw new Error(`Cannot fetch image: ${response.status}`);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Cannot read image"));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Drive PDF image inline skipped; html2canvas will try to load original image.", error);
    return url;
  }
}

async function inlineImagesForDriveCaptureV1103(root) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(images.map(async (image) => {
    const originalSrc = image.getAttribute("src") || image.currentSrc || "";
    const dataUrl = await fetchImageAsDataUrlV1103(originalSrc);
    if (dataUrl && dataUrl !== originalSrc) {
      image.setAttribute("src", dataUrl);
      image.removeAttribute("srcset");
      image.crossOrigin = "anonymous";
    }
  }));
}

function getPrintPageForDriveCaptureV1103() {
  return document.getElementById("quotationPrintPage") || document.querySelector(".print-v2-page") || document.querySelector(".print-page");
}

async function createDriveCaptureCloneV1103() {
  const page = getPrintPageForDriveCaptureV1103();
  if (!page) throw new Error("ไม่พบพื้นที่เอกสารสำหรับสร้าง PDF");

  const container = document.createElement("div");
  container.className = "drive-capture-root-v1103";

  const clone = page.cloneNode(true);
  clone.removeAttribute("id");
  clone.style.boxShadow = "none";
  clone.style.border = "0";
  clone.style.margin = "0";
  clone.style.background = "#ffffff";
  clone.style.maxWidth = "none";
  clone.style.width = "210mm";

  container.appendChild(clone);
  document.body.appendChild(container);

  await inlineImagesForDriveCaptureV1103(clone);
  await waitForPrintAssetsV1103(clone);

  // Let layout settle after image/font changes.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  return { container, clone };
}

function canvasToPdfBase64V1103(canvas) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const pageWidthMm = 210;
  const pageHeightMm = 297;
  const sourceWidth = canvas.width;
  const maxSourcePageHeight = Math.floor(sourceWidth * pageHeightMm / pageWidthMm);

  let sourceY = 0;
  let pageIndex = 0;

  while (sourceY < canvas.height) {
    const sliceHeight = Math.min(maxSourcePageHeight, canvas.height - sourceY);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = sourceWidth;
    pageCanvas.height = sliceHeight;
    const ctx = pageCanvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(canvas, 0, sourceY, sourceWidth, sliceHeight, 0, 0, sourceWidth, sliceHeight);

    const imgData = pageCanvas.toDataURL("image/png");
    const sliceHeightMm = sliceHeight * pageWidthMm / sourceWidth;
    if (pageIndex > 0) pdf.addPage("a4", "portrait");
    pdf.addImage(imgData, "PNG", 0, 0, pageWidthMm, sliceHeightMm, undefined, "FAST");

    sourceY += sliceHeight;
    pageIndex += 1;
  }

  const dataUri = pdf.output("datauristring");
  return dataUri.split(",")[1] || "";
}

async function buildDrivePdfBase64V1103() {
  ensureDrivePdfLibrariesV1103();

  const { container, clone } = await createDriveCaptureCloneV1103();
  try {
    const canvas = await window.html2canvas(clone, {
      backgroundColor: "#ffffff",
      scale: Math.min(2, Math.max(1.5, window.devicePixelRatio || 1.5)),
      useCORS: true,
      allowTaint: false,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: Math.max(document.documentElement.clientWidth, 1200),
      windowHeight: Math.max(document.documentElement.clientHeight, 1600),
    });

    const base64 = canvasToPdfBase64V1103(canvas);
    if (!base64) throw new Error("ไม่สามารถสร้าง PDF สำหรับบันทึก Google Drive ได้");
    return base64;
  } finally {
    container.remove();
  }
}

async function handleSaveQuotationPdfToDriveV1102(model) {
  const button = document.getElementById("saveDrivePdfButtonV1102");
  const target = document.getElementById("driveArchiveStatusV1102");

  try {
    if (!canArchiveQuotationToDriveV1102(model.quotation)) {
      throw new Error("คุณไม่มีสิทธิ์บันทึกใบเสนอราคานี้ไป Google Drive");
    }

    const existing = await loadDriveFileLogV1102(model.quotation.id);
    if (existing && !existing.loadError) {
      renderDriveArchiveStatusV1102(model, existing, appState.driveArchiveSettingsV1102 || {});
      showToast("ใบเสนอราคานี้ถูกบันทึกไป Google Drive แล้ว");
      return;
    }

    const settings = validateDriveArchiveSettingsV1102(appState.driveArchiveSettingsV1102 || await loadDriveArchiveSettingsV1102());
    const ownerProfile = await loadQuotationOwnerProfileV1102(model.quotation.owner_id);
    const salesFolderName = buildDriveFolderNameV1102(ownerProfile, model.ownerName);
    const fileName = buildDrivePdfFileNameV1102(model);

    if (button) {
      button.disabled = true;
      button.textContent = "กำลังสร้าง PDF...";
    }
    if (target) {
      target.innerHTML = `<div class="alert alert-warning">กำลังสร้าง PDF จากหน้าเอกสารจริงใน Browser...</div>`;
    }

    const pdfBase64 = await buildDrivePdfBase64V1103();

    if (button) button.textContent = "กำลังบันทึกไป Drive...";
    if (target) {
      target.innerHTML = `<div class="alert alert-warning">กำลังบันทึก PDF ไป Google Drive...</div>`;
    }

    const response = await postToAppsScriptIframeV1102(settings.webAppUrl, {
      action: "upload",
      secret: settings.uploadSecret,
      parentFolderId: settings.parentFolderId,
      quotationId: model.quotation.id,
      quotationNo: model.quotation.quotation_no || "",
      salesFolderName,
      fileName,
      pdfBase64,
      renderMode: "browser-pdf-base64",
      clientVersion: FI_V1103_VERSION,
    });

    if (!response.ok) throw new Error(response.error || "Apps Script ไม่สามารถบันทึกไฟล์ได้");

    const savedLog = await insertDriveFileLogV1102({
      model,
      fileName,
      response,
      folderId: settings.parentFolderId,
    });

    renderDriveArchiveStatusV1102(model, savedLog, settings);
    showToast(response.existing ? "พบไฟล์เดิมใน Google Drive และบันทึก log แล้ว" : "บันทึก PDF ไป Google Drive สำเร็จ");
  } catch (error) {
    console.error(error);
    if (target) target.innerHTML = `<div class="alert alert-error">${escapeHTML(error.message || "ไม่สามารถบันทึกไป Google Drive ได้")}</div>`;
    showToast(error.message || "ไม่สามารถบันทึกไป Google Drive ได้");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "บันทึกไป Google Drive";
    }
  }
}

function renderDriveArchiveStatusV1102(model, driveLog, settings) {
  const target = document.getElementById("driveArchiveStatusV1102");
  if (!target) return;

  if (driveLog && driveLog.loadError) {
    target.innerHTML = `<div class="alert alert-warning">ยังตรวจประวัติ Google Drive ไม่ได้ กรุณารัน <strong>supabase/patch_v1_10_2.sql</strong></div>`;
    return;
  }

  if (driveLog?.file_url) {
    target.innerHTML = `
      <a class="btn btn-ghost drive-open-button-v1102" href="${escapeHTML(driveLog.file_url)}" target="_blank" rel="noopener">
        เปิดไฟล์ใน Google Drive
      </a>
      <span class="drive-status-text-v1102">บันทึกแล้ว: ${escapeHTML(driveLog.file_name || "PDF")}</span>
    `;
    return;
  }

  if (!canArchiveQuotationToDriveV1102(model.quotation)) {
    target.innerHTML = `<div class="alert alert-warning">คุณมีสิทธิ์ดูเอกสาร แต่ไม่มีสิทธิ์บันทึก PDF ไป Google Drive</div>`;
    return;
  }

  if (!isDriveArchiveConfiguredV1102(settings)) {
    target.innerHTML = `
      <div class="alert alert-warning">
        ยังไม่ได้ตั้งค่า Google Drive Archive กรุณาให้ Admin ตั้งค่า Web App URL, Folder ID และ Shared Secret ในเมนูตั้งค่า
      </div>
    `;
    return;
  }

  target.innerHTML = `
    <button id="saveDrivePdfButtonV1102" type="button" class="btn btn-ghost">บันทึกไป Google Drive</button>
    <span class="drive-status-text-v1102">ระบบจะสร้าง PDF จากหน้าเอกสารที่ Browser แสดงอยู่ เพื่อให้ใกล้เคียงกับการกดบันทึก PDF เองมากที่สุด</span>
  `;
  document.getElementById("saveDrivePdfButtonV1102")?.addEventListener("click", async () => {
    await handleSaveQuotationPdfToDriveV1102(model);
  });
}

const originalDebugV1103 = window.FI_DEBUG;
window.FI_DEBUG = async function FI_DEBUG_V1103() {
  const result = typeof originalDebugV1103 === "function" ? await originalDebugV1103() : {};
  return {
    ...result,
    version: FI_V1103_VERSION,
    googleDriveArchive: true,
    onePdfPerQuotation: true,
    drivePdfRenderMode: "browser-pdf-base64",
    appsScriptSavesPdfBlobOnly: true,
    htmlToPdfInAppsScriptDisabledForNewUploads: true,
    sqlChanged: false,
  };
};

// Final visible version stamp for QA.
window.FI_APP_VERSION = FI_V1103_VERSION;

// =======================================================
// v1.10.4 Drive PDF Single Page Fix + Sent Workflow Gate
// Scope:
// - Prevent blank extra Drive PDF pages from html2canvas/jsPDF capture.
// - Remove technical PDF-rendering message from end-user UI.
// - Require Google Drive PDF archive before marking quotation as sent.
// - Capture recipient data when marking as sent.
// Requires supabase/patch_v1_10_4.sql.
// =======================================================

const FI_V1104_VERSION = "1.10.4";
window.FI_APP_VERSION = FI_V1104_VERSION;

function isQuotationSentV1104(quotation) {
  return String(quotation?.status || "") === "sent";
}

function canMarkQuotationSentV1104(quotation) {
  const role = appState.profile?.role;
  const isOwner = quotation?.owner_id === appState.user?.id;
  return quotation?.status === "confirmed" && (role === "admin" || (role === "sales" && isOwner));
}

function normalizeEmailV1104(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmailV1104(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmailV1104(value));
}

function formatSentDateForInputV1104(value) {
  if (!value) return toDateInputValue(new Date());
  try {
    return toDateInputValue(new Date(value));
  } catch (_error) {
    return toDateInputValue(new Date());
  }
}

function renderSentInfoHtmlV1104(quotation) {
  if (!isQuotationSentV1104(quotation)) return "";
  const sentAt = quotation?.sent_at ? formatDate(quotation.sent_at) : "-";
  const email = quotation?.sent_recipient_email || "-";
  const name = quotation?.sent_recipient_name || "-";
  const position = quotation?.sent_recipient_position || "-";
  return `
    <div class="sent-info-panel-v1104">
      <strong>ข้อมูลการส่งใบเสนอราคา</strong>
      <div class="sent-info-grid-v1104">
        <span>วันที่ส่ง</span><b>${escapeHTML(sentAt)}</b>
        <span>อีเมลผู้รับ</span><b>${escapeHTML(email)}</b>
        <span>ผู้รับ</span><b>${escapeHTML(name)}</b>
        <span>ตำแหน่ง</span><b>${escapeHTML(position)}</b>
      </div>
    </div>
  `;
}

function renderSentWorkflowInlineV1104(model, driveLog) {
  const quotation = model?.quotation || {};

  if (isQuotationSentV1104(quotation)) {
    return renderSentInfoHtmlV1104(quotation);
  }

  if (!canMarkQuotationSentV1104(quotation)) {
    return "";
  }

  if (!driveLog?.file_url) {
    return `
      <div class="sent-gate-v1104">
        <button type="button" class="btn btn-ghost" disabled>ส่งแล้ว</button>
        <span class="drive-status-text-v1102">ต้องบันทึก PDF ลง Google Drive ก่อนจึงจะเปลี่ยนสถานะเป็นส่งแล้วได้</span>
      </div>
    `;
  }

  return `
    <div class="sent-gate-v1104 ready">
      <button id="markSentAfterDriveButtonV1104" type="button" class="btn btn-primary">ส่งแล้ว</button>
    </div>
  `;
}

function bindSentWorkflowInlineV1104(model, driveLog) {
  document.getElementById("markSentAfterDriveButtonV1104")?.addEventListener("click", async () => {
    const freshLog = driveLog?.file_url ? driveLog : await loadDriveFileLogV1102(model.quotation.id);
    if (!freshLog?.file_url) {
      showToast("กรุณาบันทึก PDF ลง Google Drive ก่อน");
      renderDriveArchiveStatusV1102(model, freshLog, appState.driveArchiveSettingsV1102 || {});
      return;
    }
    openMarkSentModalV1104(model, freshLog);
  });
}

function closeMarkSentModalV1104() {
  document.getElementById("markSentModalV1104")?.remove();
}

function openMarkSentModalV1104(model, driveLog) {
  closeMarkSentModalV1104();

  const quotation = model?.quotation || {};
  const todayValue = formatSentDateForInputV1104(quotation.sent_at);
  const defaultName = quotation.sent_recipient_name || "";
  const defaultEmail = quotation.sent_recipient_email || "";
  const defaultPosition = quotation.sent_recipient_position || "";

  const modal = document.createElement("div");
  modal.id = "markSentModalV1104";
  modal.className = "modal-backdrop-v1104";
  modal.innerHTML = `
    <div class="modal-card-v1104" role="dialog" aria-modal="true">
      <div class="modal-header-v1104">
        <div>
          <h3>ข้อมูลการส่งใบเสนอราคา</h3>
          <p>กรอกข้อมูลผู้รับปลายทางก่อนเปลี่ยนสถานะเป็นส่งแล้ว</p>
        </div>
        <button id="closeSentModalButtonV1104" type="button" class="icon-button">×</button>
      </div>

      <form id="markSentFormV1104" class="form-stack">
        <div class="field">
          <label for="sentDateInputV1104">วันที่ส่งใบเสนอราคา <span class="required-star">*</span></label>
          <input id="sentDateInputV1104" type="date" value="${escapeHTML(todayValue)}" required />
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="sentRecipientEmailInputV1104">อีเมลผู้รับ <span class="required-star">*</span></label>
            <input id="sentRecipientEmailInputV1104" type="email" value="${escapeHTML(defaultEmail)}" placeholder="customer@company.com" required />
          </div>
          <div class="field">
            <label for="sentRecipientNameInputV1104">ผู้รับ <span class="required-star">*</span></label>
            <input id="sentRecipientNameInputV1104" type="text" value="${escapeHTML(defaultName)}" placeholder="ชื่อผู้รับปลายทาง" required />
          </div>
        </div>

        <div class="field">
          <label for="sentRecipientPositionInputV1104">ตำแหน่ง</label>
          <input id="sentRecipientPositionInputV1104" type="text" value="${escapeHTML(defaultPosition)}" placeholder="เช่น ผู้จัดการฝ่ายขนส่ง" />
        </div>

        <div class="drive-file-confirm-v1104">
          <span>ไฟล์ PDF ใน Google Drive</span>
          <a href="${escapeHTML(driveLog.file_url)}" target="_blank" rel="noopener">${escapeHTML(driveLog.file_name || "เปิดไฟล์")}</a>
        </div>

        <div id="markSentErrorV1104" class="alert alert-error hidden"></div>

        <div class="form-actions normal-flow modal-actions-v1104">
          <button type="button" id="cancelSentModalButtonV1104" class="btn btn-ghost">ยกเลิก</button>
          <button type="submit" id="submitSentButtonV1104" class="btn btn-primary">บันทึกและเปลี่ยนเป็นส่งแล้ว</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("closeSentModalButtonV1104")?.addEventListener("click", closeMarkSentModalV1104);
  document.getElementById("cancelSentModalButtonV1104")?.addEventListener("click", closeMarkSentModalV1104);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeMarkSentModalV1104();
  });
  document.getElementById("markSentFormV1104")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitMarkSentWithRecipientV1104(model);
  });

  document.getElementById("sentRecipientEmailInputV1104")?.focus();
}

function setMarkSentErrorV1104(message) {
  const target = document.getElementById("markSentErrorV1104");
  if (!target) return;
  target.textContent = message || "";
  target.classList.toggle("hidden", !message);
}

async function submitMarkSentWithRecipientV1104(model) {
  const button = document.getElementById("submitSentButtonV1104");
  const sentDate = document.getElementById("sentDateInputV1104")?.value || "";
  const email = normalizeEmailV1104(document.getElementById("sentRecipientEmailInputV1104")?.value || "");
  const name = String(document.getElementById("sentRecipientNameInputV1104")?.value || "").trim();
  const position = String(document.getElementById("sentRecipientPositionInputV1104")?.value || "").trim();

  setMarkSentErrorV1104("");

  if (!sentDate) {
    setMarkSentErrorV1104("กรุณาเลือกวันที่ส่งใบเสนอราคา");
    return;
  }
  if (!email || !isValidEmailV1104(email)) {
    setMarkSentErrorV1104("กรุณากรอกอีเมลผู้รับให้ถูกต้อง");
    return;
  }
  if (!name) {
    setMarkSentErrorV1104("กรุณากรอกชื่อผู้รับ");
    return;
  }

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "กำลังบันทึก...";
    }

    const driveLog = await loadDriveFileLogV1102(model.quotation.id);
    if (!driveLog?.file_url) {
      throw new Error("กรุณาบันทึก PDF ลง Google Drive ก่อนเปลี่ยนสถานะเป็นส่งแล้ว");
    }

    const { error } = await supabaseClient.rpc("mark_quotation_as_sent_v1104", {
      p_quotation_id: model.quotation.id,
      p_sent_at: sentDate,
      p_recipient_email: email,
      p_recipient_name: name,
      p_recipient_position: position || null,
    });

    if (error) throw error;

    closeMarkSentModalV1104();
    showToast("บันทึกข้อมูลการส่งและเปลี่ยนสถานะเป็นส่งแล้วสำเร็จ");
    location.hash = `#quotation-view/${model.quotation.id}`;
    await renderQuotationViewPage(model.quotation.id);
  } catch (error) {
    console.error(error);
    const message = error.message || "ไม่สามารถเปลี่ยนสถานะเป็นส่งแล้วได้";
    setMarkSentErrorV1104(message);
    showToast(message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "บันทึกและเปลี่ยนเป็นส่งแล้ว";
    }
  }
}

// Hide the old direct "sent" action from the detail page. Sending now starts from Preview / Print after Drive archive.
function renderQuotationActionButtons(quotation, effectiveStatus) {
  const role = appState.profile.role;
  const isOwner = quotation.owner_id === appState.user.id;
  const canModify = role === "admin" || (role === "sales" && isOwner);

  if (!canModify) return "";

  const buttons = [];

  if (quotation.status === "draft") {
    buttons.push(`
      <button id="editDraftButton" class="btn btn-ghost">
        แก้ไข Draft
      </button>
    `);
    buttons.push(`
      <button id="confirmQuotationButton" class="btn btn-primary">
        Confirm และสร้างเลข
      </button>
    `);
  }

  if (quotation.status === "confirmed" && effectiveStatus === "confirmed") {
    buttons.push(`
      <button type="button" class="btn btn-ghost" disabled>
        ส่งแล้ว
      </button>
    `);
  }

  if (quotation.status !== "draft") {
    buttons.push(`
      <button id="printPreviewButton" class="btn btn-primary">
        Preview / Print
      </button>
    `);
    buttons.push(`
      <button id="duplicateQuotationButton" class="btn btn-ghost">
        สร้างสำเนา
      </button>
    `);
  }

  return buttons.join("");
}

// Keep old function name as a safety net; it now guides users to Preview / Print.
async function markQuotationAsSent(quotationId) {
  showToast("กรุณาบันทึก PDF ลง Google Drive จากหน้า Preview / Print ก่อนเปลี่ยนสถานะเป็นส่งแล้ว");
  location.hash = `#quotation-print/${quotationId}`;
}

const originalRenderQuotationViewPageV1104 = window.renderQuotationViewPage || renderQuotationViewPage;
window.renderQuotationViewPage = async function renderQuotationViewPageV1104(quotationId) {
  const result = await originalRenderQuotationViewPageV1104.call(this, quotationId);
  await injectSentInfoIntoViewV1104(quotationId);
  return result;
};
try { renderQuotationViewPage = window.renderQuotationViewPage; } catch (_error) {}

async function injectSentInfoIntoViewV1104(quotationId) {
  if (!quotationId || !supabaseClient) return;
  try {
    const { data, error } = await supabaseClient
      .from("quotations")
      .select("id, status, sent_at, sent_recipient_email, sent_recipient_name, sent_recipient_position")
      .eq("id", quotationId)
      .maybeSingle();

    if (error || !data || !isQuotationSentV1104(data)) return;

    const host = document.querySelector(".page-content .card:first-child");
    if (!host || document.getElementById("sentInfoInViewV1104")) return;

    const panel = document.createElement("div");
    panel.id = "sentInfoInViewV1104";
    panel.innerHTML = renderSentInfoHtmlV1104(data);
    host.appendChild(panel);
  } catch (error) {
    console.warn("Cannot load sent recipient info. Run supabase/patch_v1_10_4.sql if this is a new release.", error);
  }
}

function isCanvasRowBlankV1104(ctx, y, width, options = {}) {
  const sampleStep = options.sampleStep || 8;
  const whiteThreshold = options.whiteThreshold || 248;
  const alphaThreshold = options.alphaThreshold || 8;
  const row = ctx.getImageData(0, y, width, 1).data;
  for (let x = 0; x < width; x += sampleStep) {
    const i = x * 4;
    const alpha = row[i + 3];
    if (alpha <= alphaThreshold) continue;
    if (row[i] < whiteThreshold || row[i + 1] < whiteThreshold || row[i + 2] < whiteThreshold) {
      return false;
    }
  }
  return true;
}

function findCanvasContentHeightV1104(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas.height;

  const sampleEveryY = 3;
  const bottomPadding = Math.ceil(canvas.width * 0.006); // small visual safety padding
  for (let y = canvas.height - 1; y >= 0; y -= sampleEveryY) {
    if (!isCanvasRowBlankV1104(ctx, y, canvas.width)) {
      return Math.min(canvas.height, y + bottomPadding);
    }
  }
  return canvas.height;
}

function canvasToPdfBase64V1104(canvas) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const pageWidthMm = 210;
  const pageHeightMm = 297;
  const sourceWidth = canvas.width;
  const maxSourcePageHeight = Math.floor(sourceWidth * pageHeightMm / pageWidthMm);
  const blankTolerancePx = Math.max(24, Math.ceil(maxSourcePageHeight * 0.015));
  const effectiveHeight = Math.min(canvas.height, findCanvasContentHeightV1104(canvas));

  let sourceY = 0;
  let pageIndex = 0;

  while (sourceY < effectiveHeight) {
    let remaining = effectiveHeight - sourceY;

    // If the only remaining area is tiny whitespace/rounding noise, do not create a blank trailing page.
    if (pageIndex > 0 && remaining <= blankTolerancePx) break;

    const sliceHeight = Math.min(maxSourcePageHeight, remaining);
    if (sliceHeight <= 0) break;

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = sourceWidth;
    pageCanvas.height = sliceHeight;
    const ctx = pageCanvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(canvas, 0, sourceY, sourceWidth, sliceHeight, 0, 0, sourceWidth, sliceHeight);

    const imgData = pageCanvas.toDataURL("image/png");
    const sliceHeightMm = sliceHeight * pageWidthMm / sourceWidth;
    if (pageIndex > 0) pdf.addPage("a4", "portrait");
    pdf.addImage(imgData, "PNG", 0, 0, pageWidthMm, Math.min(pageHeightMm, sliceHeightMm), undefined, "FAST");

    sourceY += sliceHeight;
    pageIndex += 1;
  }

  const dataUri = pdf.output("datauristring");
  return dataUri.split(",")[1] || "";
}

async function createDriveCaptureCloneV1104() {
  const page = getPrintPageForDriveCaptureV1103();
  if (!page) throw new Error("ไม่พบพื้นที่เอกสารสำหรับสร้าง PDF");

  const container = document.createElement("div");
  container.className = "drive-capture-root-v1103 drive-capture-root-v1104";

  const clone = page.cloneNode(true);
  clone.removeAttribute("id");
  clone.style.boxShadow = "none";
  clone.style.border = "0";
  clone.style.margin = "0";
  clone.style.background = "#ffffff";
  clone.style.maxWidth = "none";
  clone.style.width = "210mm";
  clone.style.minHeight = "297mm";

  container.appendChild(clone);
  document.body.appendChild(container);

  await inlineImagesForDriveCaptureV1103(clone);
  await waitForPrintAssetsV1103(clone);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  // If the document fits one A4 page, lock the capture height to one page.
  // This prevents a second blank PDF page caused by min-height/border/rounding noise.
  const contentOverflow = clone.scrollHeight - clone.clientHeight;
  if (contentOverflow <= 8) {
    clone.style.height = "297mm";
    clone.style.minHeight = "0";
    clone.style.overflow = "hidden";
  } else {
    clone.style.height = "auto";
    clone.style.overflow = "visible";
  }

  await new Promise((resolve) => requestAnimationFrame(resolve));
  return { container, clone };
}

async function buildDrivePdfBase64V1103() {
  ensureDrivePdfLibrariesV1103();

  const { container, clone } = await createDriveCaptureCloneV1104();
  try {
    const canvas = await window.html2canvas(clone, {
      backgroundColor: "#ffffff",
      scale: Math.min(2, Math.max(1.5, window.devicePixelRatio || 1.5)),
      useCORS: true,
      allowTaint: false,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: Math.max(document.documentElement.clientWidth, 1200),
      windowHeight: Math.max(document.documentElement.clientHeight, 1600),
    });

    const base64 = canvasToPdfBase64V1104(canvas);
    if (!base64) throw new Error("ไม่สามารถเตรียมไฟล์ PDF สำหรับบันทึก Google Drive ได้");
    return base64;
  } finally {
    container.remove();
  }
}

async function handleSaveQuotationPdfToDriveV1102(model) {
  const button = document.getElementById("saveDrivePdfButtonV1102");
  const target = document.getElementById("driveArchiveStatusV1102");

  try {
    if (!canArchiveQuotationToDriveV1102(model.quotation)) {
      throw new Error("คุณไม่มีสิทธิ์บันทึกใบเสนอราคานี้ไป Google Drive");
    }

    const existing = await loadDriveFileLogV1102(model.quotation.id);
    if (existing && !existing.loadError) {
      renderDriveArchiveStatusV1102(model, existing, appState.driveArchiveSettingsV1102 || {});
      showToast("ใบเสนอราคานี้ถูกบันทึกไป Google Drive แล้ว");
      return;
    }

    const settings = validateDriveArchiveSettingsV1102(appState.driveArchiveSettingsV1102 || await loadDriveArchiveSettingsV1102());
    const ownerProfile = await loadQuotationOwnerProfileV1102(model.quotation.owner_id);
    const salesFolderName = buildDriveFolderNameV1102(ownerProfile, model.ownerName);
    const fileName = buildDrivePdfFileNameV1102(model);

    if (button) {
      button.disabled = true;
      button.textContent = "กำลังเตรียม PDF...";
    }
    if (target) {
      target.innerHTML = `<div class="alert alert-warning">กำลังเตรียมไฟล์ PDF...</div>`;
    }

    const pdfBase64 = await buildDrivePdfBase64V1103();

    if (button) button.textContent = "กำลังบันทึกไป Drive...";
    if (target) {
      target.innerHTML = `<div class="alert alert-warning">กำลังบันทึก PDF ไป Google Drive...</div>`;
    }

    const response = await postToAppsScriptIframeV1102(settings.webAppUrl, {
      action: "upload",
      secret: settings.uploadSecret,
      parentFolderId: settings.parentFolderId,
      quotationId: model.quotation.id,
      quotationNo: model.quotation.quotation_no || "",
      salesFolderName,
      fileName,
      pdfBase64,
      renderMode: "browser-pdf-base64-v1104",
      clientVersion: FI_V1104_VERSION,
    });

    if (!response.ok) throw new Error(response.error || "Apps Script ไม่สามารถบันทึกไฟล์ได้");

    const savedLog = await insertDriveFileLogV1102({
      model,
      fileName,
      response,
      folderId: settings.parentFolderId,
    });

    renderDriveArchiveStatusV1102(model, savedLog, settings);
    showToast(response.existing ? "พบไฟล์เดิมใน Google Drive และบันทึก log แล้ว" : "บันทึก PDF ไป Google Drive สำเร็จ");
  } catch (error) {
    console.error(error);
    if (target) target.innerHTML = `<div class="alert alert-error">${escapeHTML(error.message || "ไม่สามารถบันทึกไป Google Drive ได้")}</div>`;
    showToast(error.message || "ไม่สามารถบันทึกไป Google Drive ได้");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "บันทึกไป Google Drive";
    }
  }
}

function renderDriveArchiveStatusV1102(model, driveLog, settings) {
  const target = document.getElementById("driveArchiveStatusV1102");
  if (!target) return;

  if (driveLog && driveLog.loadError) {
    target.innerHTML = `<div class="alert alert-warning">ยังตรวจประวัติ Google Drive ไม่ได้ กรุณารัน <strong>supabase/patch_v1_10_2.sql</strong></div>`;
    return;
  }

  if (driveLog?.file_url) {
    target.innerHTML = `
      <div class="drive-archive-stack-v1104">
        <div class="drive-archive-row-v1104">
          <a class="btn btn-ghost drive-open-button-v1102" href="${escapeHTML(driveLog.file_url)}" target="_blank" rel="noopener">
            เปิดไฟล์ใน Google Drive
          </a>
          <span class="drive-status-text-v1102">บันทึกแล้ว: ${escapeHTML(driveLog.file_name || "PDF")}</span>
        </div>
        ${renderSentWorkflowInlineV1104(model, driveLog)}
      </div>
    `;
    bindSentWorkflowInlineV1104(model, driveLog);
    return;
  }

  if (!canArchiveQuotationToDriveV1102(model.quotation)) {
    target.innerHTML = `<div class="alert alert-warning">คุณมีสิทธิ์ดูเอกสาร แต่ไม่มีสิทธิ์บันทึก PDF ไป Google Drive</div>`;
    return;
  }

  if (!isDriveArchiveConfiguredV1102(settings)) {
    target.innerHTML = `
      <div class="alert alert-warning">
        ยังไม่ได้ตั้งค่า Google Drive Archive กรุณาให้ Admin ตั้งค่า Web App URL, Folder ID และ Shared Secret ในเมนูตั้งค่า
      </div>
    `;
    return;
  }

  target.innerHTML = `
    <div class="drive-archive-stack-v1104">
      <div class="drive-archive-row-v1104">
        <button id="saveDrivePdfButtonV1102" type="button" class="btn btn-ghost">บันทึกไป Google Drive</button>
      </div>
      ${renderSentWorkflowInlineV1104(model, null)}
    </div>
  `;
  document.getElementById("saveDrivePdfButtonV1102")?.addEventListener("click", async () => {
    await handleSaveQuotationPdfToDriveV1102(model);
  });
}

const originalDebugV1104 = window.FI_DEBUG;
window.FI_DEBUG = async function FI_DEBUG_V1104() {
  const result = typeof originalDebugV1104 === "function" ? await originalDebugV1104() : {};
  return {
    ...result,
    version: FI_V1104_VERSION,
    drivePdfBlankPageFix: true,
    drivePdfTrimWhitespace: true,
    sentRequiresDrivePdf: true,
    sentRecipientFields: true,
    sqlChanged: true,
  };
};

// Final visible version stamp for QA.
window.FI_APP_VERSION = FI_V1104_VERSION;


// =======================================================
// v1.10.5 Sent Action UI Polish + View Sent Action
// Scope:
// - Keep button wording as "ส่งแล้ว" only.
// - Keep sent button disabled until Drive PDF exists.
// - Allow marking sent from both #quotation-view and #quotation-print.
// - Compact Drive / Sent delivery UI so toolbar buttons do not become oversized.
// No SQL changes. Uses supabase/patch_v1_10_4.sql from v1.10.4.
// =======================================================

const FI_V1105_VERSION = "1.10.5";
window.FI_APP_VERSION = FI_V1105_VERSION;

function renderSentInfoHtmlV1104(quotation) {
  if (!isQuotationSentV1104(quotation)) return "";

  const sentAt = quotation?.sent_at ? formatDate(quotation.sent_at) : "-";
  const email = quotation?.sent_recipient_email || "-";
  const name = quotation?.sent_recipient_name || "-";
  const position = quotation?.sent_recipient_position || "-";

  return `
    <div class="sent-info-card-v1105">
      <div class="sent-info-head-v1105">
        <span class="sent-info-icon-v1105">✓</span>
        <div>
          <strong>ข้อมูลการส่งใบเสนอราคา</strong>
          <small>ส่งเมื่อ ${escapeHTML(sentAt)}</small>
        </div>
      </div>
      <div class="sent-info-grid-v1105">
        <div class="sent-info-item-v1105">
          <span>อีเมลผู้รับ</span>
          <b>${escapeHTML(email)}</b>
        </div>
        <div class="sent-info-item-v1105">
          <span>ผู้รับ</span>
          <b>${escapeHTML(name)}</b>
        </div>
        <div class="sent-info-item-v1105">
          <span>ตำแหน่ง</span>
          <b>${escapeHTML(position)}</b>
        </div>
      </div>
    </div>
  `;
}

function renderSentWorkflowInlineV1104(model, driveLog) {
  const quotation = model?.quotation || {};

  if (isQuotationSentV1104(quotation)) {
    return renderSentInfoHtmlV1104(quotation);
  }

  if (!canMarkQuotationSentV1104(quotation)) {
    return "";
  }

  const hasDrivePdf = Boolean(driveLog?.file_url);

  return `
    <div class="sent-action-v1105 ${hasDrivePdf ? "is-ready" : "is-disabled"}">
      <button
        id="markSentAfterDriveButtonV1104"
        type="button"
        class="btn ${hasDrivePdf ? "btn-primary" : "btn-ghost"} btn-compact-v1105"
        ${hasDrivePdf ? "" : "disabled"}
      >ส่งแล้ว</button>
      ${hasDrivePdf ? "" : `<span class="sent-action-hint-v1105">ต้องบันทึก PDF ลง Google Drive ก่อน</span>`}
    </div>
  `;
}

function bindSentWorkflowInlineV1104(model, driveLog) {
  document.getElementById("markSentAfterDriveButtonV1104")?.addEventListener("click", async () => {
    const freshLog = driveLog?.file_url ? driveLog : await loadDriveFileLogV1102(model.quotation.id);
    if (!freshLog?.file_url) {
      showToast("กรุณาบันทึก PDF ลง Google Drive ก่อน");
      renderDriveArchiveStatusV1102(model, freshLog, appState.driveArchiveSettingsV1102 || {});
      return;
    }
    openMarkSentModalV1104(model, freshLog);
  });
}

function renderDriveArchiveStatusV1102(model, driveLog, settings) {
  const target = document.getElementById("driveArchiveStatusV1102");
  if (!target) return;

  if (driveLog && driveLog.loadError) {
    target.innerHTML = `<div class="alert alert-warning drive-alert-compact-v1105">ยังตรวจประวัติ Google Drive ไม่ได้ กรุณารัน <strong>supabase/patch_v1_10_2.sql</strong></div>`;
    return;
  }

  if (driveLog?.file_url) {
    target.innerHTML = `
      <div class="drive-panel-v1105">
        <div class="drive-line-v1105">
          <a class="btn btn-ghost btn-compact-v1105 drive-open-button-v1102" href="${escapeHTML(driveLog.file_url)}" target="_blank" rel="noopener">
            เปิดไฟล์ใน Google Drive
          </a>
          <span class="drive-saved-text-v1105">บันทึกแล้ว: ${escapeHTML(driveLog.file_name || "PDF")}</span>
        </div>
        ${renderSentWorkflowInlineV1104(model, driveLog)}
      </div>
    `;
    bindSentWorkflowInlineV1104(model, driveLog);
    return;
  }

  if (!canArchiveQuotationToDriveV1102(model.quotation)) {
    target.innerHTML = `<div class="alert alert-warning drive-alert-compact-v1105">คุณมีสิทธิ์ดูเอกสาร แต่ไม่มีสิทธิ์บันทึก PDF ไป Google Drive</div>`;
    return;
  }

  if (!isDriveArchiveConfiguredV1102(settings)) {
    target.innerHTML = `
      <div class="alert alert-warning drive-alert-compact-v1105">
        ยังไม่ได้ตั้งค่า Google Drive Archive กรุณาให้ Admin ตั้งค่า Web App URL, Folder ID และ Shared Secret ในเมนูตั้งค่า
      </div>
    `;
    return;
  }

  target.innerHTML = `
    <div class="drive-panel-v1105">
      <div class="drive-line-v1105">
        <button id="saveDrivePdfButtonV1102" type="button" class="btn btn-ghost btn-compact-v1105">บันทึกไป Google Drive</button>
      </div>
      ${renderSentWorkflowInlineV1104(model, null)}
    </div>
  `;
  document.getElementById("saveDrivePdfButtonV1102")?.addEventListener("click", async () => {
    await handleSaveQuotationPdfToDriveV1102(model);
  });
}

function renderQuotationActionButtons(quotation, effectiveStatus) {
  const role = appState.profile.role;
  const isOwner = quotation.owner_id === appState.user.id;
  const canModify = role === "admin" || (role === "sales" && isOwner);

  if (!canModify) return "";

  const buttons = [];

  if (quotation.status === "draft") {
    buttons.push(`
      <button id="editDraftButton" class="btn btn-ghost">
        แก้ไข Draft
      </button>
    `);
    buttons.push(`
      <button id="confirmQuotationButton" class="btn btn-primary">
        Confirm และสร้างเลข
      </button>
    `);
  }

  if (quotation.status === "confirmed" && effectiveStatus === "confirmed") {
    buttons.push(`
      <span class="view-sent-action-wrap-v1105">
        <button id="markSentButton" type="button" class="btn btn-ghost btn-compact-v1105" disabled>ส่งแล้ว</button>
        <span id="viewSentHintV1105" class="sent-action-hint-v1105">กำลังตรวจสถานะ Drive...</span>
      </span>
    `);
  }

  if (quotation.status !== "draft") {
    buttons.push(`
      <button id="printPreviewButton" class="btn btn-primary">
        Preview / Print
      </button>
    `);
    buttons.push(`
      <button id="duplicateQuotationButton" class="btn btn-ghost">
        สร้างสำเนา
      </button>
    `);
  }

  return buttons.join("");
}

async function loadQuotationForSentActionV1105(quotationId) {
  const { data, error } = await supabaseClient
    .from("quotations")
    .select("id, owner_id, status, sent_at, sent_recipient_email, sent_recipient_name, sent_recipient_position")
    .eq("id", quotationId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("ไม่พบใบเสนอราคา");
  return data;
}

async function setupSentActionInViewV1105(quotationId) {
  const button = document.getElementById("markSentButton");
  if (!button || !quotationId || !supabaseClient) return;

  const hint = document.getElementById("viewSentHintV1105");

  try {
    const quotation = await loadQuotationForSentActionV1105(quotationId);
    if (!canMarkQuotationSentV1104(quotation)) {
      button.remove();
      if (hint) hint.remove();
      return;
    }

    const driveLog = await loadDriveFileLogV1102(quotationId);
    const hasDrivePdf = Boolean(driveLog?.file_url);

    button.textContent = "ส่งแล้ว";
    button.disabled = !hasDrivePdf;
    button.classList.toggle("btn-primary", hasDrivePdf);
    button.classList.toggle("btn-ghost", !hasDrivePdf);
    button.classList.add("btn-compact-v1105");

    if (hint) {
      hint.textContent = hasDrivePdf ? "" : "ต้องบันทึก PDF ลง Google Drive ก่อน";
      hint.classList.toggle("hidden", hasDrivePdf);
    }
  } catch (error) {
    console.warn("Cannot prepare sent action in quotation view.", error);
    button.textContent = "ส่งแล้ว";
    button.disabled = true;
    if (hint) hint.textContent = "ยังตรวจสถานะ Drive ไม่ได้";
  }
}

async function markQuotationAsSent(quotationId) {
  try {
    const quotation = await loadQuotationForSentActionV1105(quotationId);

    if (!canMarkQuotationSentV1104(quotation)) {
      showToast("คุณไม่มีสิทธิ์เปลี่ยนสถานะใบเสนอราคานี้เป็นส่งแล้ว");
      return;
    }

    const driveLog = await loadDriveFileLogV1102(quotationId);
    if (!driveLog?.file_url) {
      showToast("กรุณาบันทึก PDF ลง Google Drive ก่อน");
      return;
    }

    openMarkSentModalV1104({ quotation }, driveLog);
  } catch (error) {
    console.error(error);
    showToast(error.message || "ไม่สามารถเปิดหน้าบันทึกข้อมูลการส่งได้");
  }
}

const originalRenderQuotationViewPageV1105 = window.renderQuotationViewPage || renderQuotationViewPage;
window.renderQuotationViewPage = async function renderQuotationViewPageV1105(quotationId) {
  const result = await originalRenderQuotationViewPageV1105.call(this, quotationId);
  await setupSentActionInViewV1105(quotationId);
  return result;
};
try { renderQuotationViewPage = window.renderQuotationViewPage; } catch (_error) {}

const originalDebugV1105 = window.FI_DEBUG;
window.FI_DEBUG = async function FI_DEBUG_V1105() {
  const result = typeof originalDebugV1105 === "function" ? await originalDebugV1105() : {};
  return {
    ...result,
    version: FI_V1105_VERSION,
    sentActionWording: "ส่งแล้ว",
    sentViewActionEnabledAfterDrive: true,
    compactSentDeliveryUI: true,
    sqlChanged: false,
  };
};

// Final visible version stamp for QA.
window.FI_APP_VERSION = FI_V1105_VERSION;

// =======================================================
// v1.11.0 Quotation Journey UX
// Scope: make the quotation flow guide users from login ->
// draft -> confirm -> Drive archive -> recipient delivery.
// Frontend-only release; no new SQL required beyond v1.10.2/v1.10.4.
// =======================================================

const FI_V1110_VERSION = "1.11.0";
window.FI_APP_VERSION = FI_V1110_VERSION;

function normalizeQuotationStatusV1110(quotation) {
  return quotation?.effective_status || quotation?.status || "-";
}

function hasDrivePdfV1110(driveLog) {
  return Boolean(driveLog && !driveLog.loadError && driveLog.file_url);
}

function getJourneyStateV1110(quotation, driveLog) {
  const status = normalizeQuotationStatusV1110(quotation);

  if (status === "draft" || quotation?.status === "draft") return "draft";
  if (status === "sent" || quotation?.status === "sent") return "sent";
  if (status === "cancelled" || quotation?.status === "cancelled") return "cancelled";
  if (status === "expired") return "expired";
  if (quotation?.status === "confirmed" || status === "confirmed") {
    return hasDrivePdfV1110(driveLog) ? "ready_to_send" : "needs_drive";
  }
  return status || "unknown";
}

function getJourneyStepsV1110(state) {
  const stepMap = {
    draft: 1,
    needs_drive: 2,
    ready_to_send: 3,
    sent: 4,
    expired: 2,
    cancelled: 0,
  };
  const activeIndex = stepMap[state] ?? 0;
  return [
    { key: "draft", label: "ร่าง", done: activeIndex > 1, active: activeIndex === 1 },
    { key: "confirmed", label: "ยืนยัน", done: activeIndex > 2, active: activeIndex === 2 },
    { key: "drive", label: "บันทึก PDF", done: activeIndex > 3, active: activeIndex === 3 },
    { key: "sent", label: "ส่งแล้ว", done: activeIndex >= 4, active: activeIndex === 4 },
  ];
}

function renderJourneyStepperV1110(state) {
  return `
    <div class="journey-stepper-v1110">
      ${getJourneyStepsV1110(state).map((step, index) => `
        <div class="journey-step-v1110 ${step.done ? "is-done" : ""} ${step.active ? "is-active" : ""}">
          <span class="journey-step-dot-v1110">${step.done ? "✓" : index + 1}</span>
          <span>${escapeHTML(step.label)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function getJourneyCopyV1110(state) {
  const map = {
    draft: {
      title: "ตรวจสอบร่างก่อนยืนยัน",
      desc: "เอกสารยังแก้ไขได้เต็มรูปแบบ เมื่อข้อมูลครบแล้วให้ยืนยันเพื่อสร้างเลขและล็อกเอกสาร",
      tone: "draft",
    },
    needs_drive: {
      title: "ขั้นตอนถัดไป: บันทึก PDF ลง Google Drive",
      desc: "เอกสารยืนยันแล้ว แต่ยังส่งไม่ได้จนกว่าจะเก็บไฟล์ PDF ลง Google Drive ก่อน",
      tone: "warning",
    },
    ready_to_send: {
      title: "พร้อมบันทึกข้อมูลการส่ง",
      desc: "มีไฟล์ PDF ใน Google Drive แล้ว กรอกข้อมูลผู้รับเพื่อเปลี่ยนสถานะเป็นส่งแล้ว",
      tone: "ready",
    },
    sent: {
      title: "ส่งใบเสนอราคาแล้ว",
      desc: "ใบเสนอราคานี้บันทึกข้อมูลการส่งเรียบร้อยแล้ว สามารถเปิดไฟล์ PDF หรือดูรายละเอียดได้",
      tone: "sent",
    },
    expired: {
      title: "ใบเสนอราคาหมดอายุ",
      desc: "เอกสารนี้หมดอายุแล้ว หากต้องการเสนอราคาใหม่ให้สร้างสำเนาเป็น Draft ใหม่",
      tone: "warning",
    },
    cancelled: {
      title: "ใบเสนอราคาถูกยกเลิก",
      desc: "เอกสารนี้ถูกยกเลิกแล้ว หากต้องการใช้งานต่อให้สร้างสำเนาใหม่",
      tone: "muted",
    },
  };
  return map[state] || {
    title: "สถานะใบเสนอราคา",
    desc: "ตรวจสอบสถานะและเลือก action ที่เหมาะสม",
    tone: "muted",
  };
}

function canModifyQuotationV1110(quotation) {
  const role = appState.profile?.role;
  const isOwner = quotation?.owner_id === appState.user?.id;
  return role === "admin" || (role === "sales" && isOwner);
}

function renderJourneyPrimaryActionV1110(quotation, state, driveLog) {
  if (!canModifyQuotationV1110(quotation)) return "";

  if (state === "draft") {
    return `
      <button type="button" class="btn btn-primary" data-journey-action-v1110="review-draft" data-id="${escapeHTML(quotation.id)}">
        ตรวจสอบ / ยืนยัน
      </button>
      <button type="button" class="btn btn-ghost" data-journey-action-v1110="edit-draft" data-id="${escapeHTML(quotation.id)}">
        แก้ไข Draft
      </button>
    `;
  }

  if (state === "needs_drive") {
    return `
      <button type="button" class="btn btn-primary" data-journey-action-v1110="save-drive" data-id="${escapeHTML(quotation.id)}">
        บันทึก PDF ลง Google Drive
      </button>
      <button type="button" class="btn btn-ghost" data-journey-action-v1110="print" data-id="${escapeHTML(quotation.id)}">
        Preview / Print
      </button>
    `;
  }

  if (state === "ready_to_send") {
    return `
      <button type="button" class="btn btn-primary" data-journey-action-v1110="mark-sent" data-id="${escapeHTML(quotation.id)}">
        ส่งแล้ว
      </button>
      ${driveLog?.file_url ? `<a class="btn btn-ghost" href="${escapeHTML(driveLog.file_url)}" target="_blank" rel="noopener">เปิดไฟล์ใน Google Drive</a>` : ""}
    `;
  }

  if (state === "sent") {
    return `
      ${driveLog?.file_url ? `<a class="btn btn-primary" href="${escapeHTML(driveLog.file_url)}" target="_blank" rel="noopener">เปิดไฟล์ใน Google Drive</a>` : ""}
      <button type="button" class="btn btn-ghost" data-journey-action-v1110="duplicate" data-id="${escapeHTML(quotation.id)}">
        สร้างสำเนา
      </button>
    `;
  }

  if (["expired", "cancelled"].includes(state)) {
    return `
      <button type="button" class="btn btn-ghost" data-journey-action-v1110="duplicate" data-id="${escapeHTML(quotation.id)}">
        สร้างสำเนา
      </button>
    `;
  }

  return "";
}

function renderQuotationJourneyCardV1110(quotation, driveLog, options = {}) {
  const state = getJourneyStateV1110(quotation, driveLog);
  const copy = getJourneyCopyV1110(state);
  const compact = options.compact ? "journey-card-compact-v1110" : "";
  const driveText = hasDrivePdfV1110(driveLog)
    ? `บันทึก PDF แล้ว: ${escapeHTML(driveLog.file_name || "Google Drive")}`
    : "ยังไม่ได้บันทึก PDF ลง Google Drive";

  return `
    <section id="quotationJourneyCardV1110" class="quotation-journey-card-v1110 ${compact} tone-${copy.tone}">
      <div class="journey-main-v1110">
        <div>
          <div class="journey-eyebrow-v1110">Quotation Journey</div>
          <h3>${escapeHTML(copy.title)}</h3>
          <p>${escapeHTML(copy.desc)}</p>
        </div>
        <div class="journey-status-pill-v1110">${statusBadge(normalizeQuotationStatusV1110(quotation))}</div>
      </div>
      ${renderJourneyStepperV1110(state)}
      <div class="journey-meta-v1110">
        <span>${escapeHTML(quotation.quotation_no || "ยังไม่ออกเลข")}</span>
        <span>${escapeHTML(quotation.customer_name || "-")}</span>
        <span>${driveText}</span>
      </div>
      <div class="journey-actions-v1110">
        ${renderJourneyPrimaryActionV1110(quotation, state, driveLog)}
      </div>
    </section>
  `;
}

function bindJourneyActionsV1110(root = document, quotation = null, driveLog = null) {
  root.querySelectorAll("[data-journey-action-v1110]").forEach((button) => {
    if (button.dataset.journeyBoundV1110 === "1") return;
    button.dataset.journeyBoundV1110 = "1";
    button.addEventListener("click", async () => {
      const action = button.dataset.journeyActionV1110;
      const id = button.dataset.id || quotation?.id;
      if (!id) return;

      if (action === "edit-draft") {
        location.hash = `#quotation-edit/${id}`;
        return;
      }
      if (action === "review-draft") {
        await confirmQuotation(id);
        return;
      }
      if (action === "save-drive" || action === "print") {
        location.hash = `#quotation-print/${id}`;
        return;
      }
      if (action === "mark-sent") {
        if (quotation && driveLog?.file_url && typeof openMarkSentModalV1104 === "function") {
          openMarkSentModalV1104({ quotation }, driveLog);
          return;
        }
        await markQuotationAsSent(id);
        return;
      }
      if (action === "duplicate") {
        await duplicateQuotation(id);
      }
    });
  });
}

async function loadDriveLogsMapV1110(quotationIds) {
  const ids = Array.from(new Set((quotationIds || []).filter(Boolean)));
  const map = new Map();
  if (!ids.length || !supabaseClient) return map;

  try {
    const { data, error } = await supabaseClient
      .from("quotation_drive_files")
      .select("quotation_id, file_name, file_url, file_id, folder_id, created_at")
      .in("quotation_id", ids);

    if (error) throw error;
    (data || []).forEach((row) => map.set(row.quotation_id, row));
  } catch (error) {
    console.warn("Cannot load drive logs for journey dashboard.", error);
  }
  return map;
}

function renderJourneyTaskListV1110(rows, driveMap, emptyText) {
  if (!rows.length) return `<div class="empty-state compact">${escapeHTML(emptyText)}</div>`;

  return `
    <div class="journey-task-list-v1110">
      ${rows.map((row) => {
        const driveLog = driveMap.get(row.id) || null;
        const state = getJourneyStateV1110(row, driveLog);
        const copy = getJourneyCopyV1110(state);
        const actionLabel = state === "draft"
          ? "ทำต่อ"
          : state === "needs_drive"
            ? "บันทึก PDF"
            : state === "ready_to_send"
              ? "ส่งแล้ว"
              : "ดูรายละเอียด";
        const target = state === "needs_drive" ? `quotation-print/${row.id}` : `quotation-view/${row.id}`;
        return `
          <button type="button" class="journey-task-item-v1110" data-journey-task-target-v1110="#${target}">
            <div>
              <strong>${escapeHTML(row.quotation_no || "ยังไม่ออกเลข")}</strong>
              <span>${escapeHTML(row.customer_name || "-")}</span>
              <small>${escapeHTML(copy.title)}</small>
            </div>
            <div class="journey-task-right-v1110">
              ${statusBadge(normalizeQuotationStatusV1110(row))}
              <b>${escapeHTML(actionLabel)}</b>
            </div>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function bindJourneyTaskLinksV1110() {
  document.querySelectorAll("[data-journey-task-target-v1110]").forEach((button) => {
    button.addEventListener("click", () => {
      location.hash = button.dataset.journeyTaskTargetV1110;
    });
  });
}

async function renderDashboardPage() {
  setPageHeader("Dashboard", "งานที่ต้องทำต่อและภาพรวมใบเสนอราคา");
  renderLoading();

  const isSales = appState.profile.role === "sales";

  const [dashboardResult, quotationsResult] = await Promise.all([
    isSales
      ? supabaseClient.from("v_dashboard_sales").select("*").eq("owner_id", appState.user.id).maybeSingle()
      : supabaseClient.from("v_dashboard_manager").select("*").order("owner_name", { ascending: true }),
    supabaseClient.from("v_quotations_list").select("*").order("updated_at", { ascending: false }).limit(160),
  ]);

  if (dashboardResult.error) throw dashboardResult.error;
  if (quotationsResult.error) throw quotationsResult.error;

  const quotations = quotationsResult.data || [];
  const metrics = isSales
    ? dashboardResult.data || emptyDashboardMetrics()
    : summarizeManagerDashboard(dashboardResult.data || []);

  const driveMap = await loadDriveLogsMapV1110(quotations.map((row) => row.id));
  const draftRows = quotations.filter((row) => normalizeQuotationStatusV1110(row) === "draft").slice(0, 8);
  const needsDriveRows = quotations
    .filter((row) => row.status === "confirmed" || normalizeQuotationStatusV1110(row) === "confirmed")
    .filter((row) => !driveMap.has(row.id))
    .slice(0, 8);
  const readyToSendRows = quotations
    .filter((row) => (row.status === "confirmed" || normalizeQuotationStatusV1110(row) === "confirmed") && driveMap.has(row.id))
    .slice(0, 8);
  const sentRows = quotations.filter((row) => normalizeQuotationStatusV1110(row) === "sent").slice(0, 8);

  elements.pageContent.innerHTML = `
    <section class="journey-workspace-v1110">
      <div class="journey-workspace-head-v1110">
        <div>
          <span class="journey-eyebrow-v1110">Quotation Workspace</span>
          <h3>งานที่ต้องทำต่อ</h3>
          <p>ระบบจัดกลุ่มใบเสนอราคาตามขั้นตอน เพื่อให้ทำงานต่อได้ทันที</p>
        </div>
        ${appState.profile.role !== "manager" ? `<button type="button" id="dashboardNewQuotationButtonV1110" class="btn btn-primary">+ สร้างใบเสนอราคา</button>` : ""}
      </div>
      <div class="journey-workspace-grid-v1110">
        <div class="journey-workspace-column-v1110"><h4>Draft ที่ยังไม่เสร็จ</h4>${renderJourneyTaskListV1110(draftRows, driveMap, "ไม่มี Draft ที่ต้องทำต่อ")}</div>
        <div class="journey-workspace-column-v1110"><h4>รอบันทึก PDF</h4>${renderJourneyTaskListV1110(needsDriveRows, driveMap, "ไม่มีใบที่รอบันทึก PDF")}</div>
        <div class="journey-workspace-column-v1110"><h4>พร้อมส่งแล้ว</h4>${renderJourneyTaskListV1110(readyToSendRows, driveMap, "ไม่มีใบที่พร้อมส่ง")}</div>
        <div class="journey-workspace-column-v1110"><h4>ส่งแล้วล่าสุด</h4>${renderJourneyTaskListV1110(sentRows, driveMap, "ยังไม่มีใบที่ส่งแล้ว")}</div>
      </div>
    </section>

    ${renderDashboardMetrics(metrics)}

    ${!isSales ? `
      <div class="card">
        <div class="card-header"><div><h3>ยอดรวมตาม Sales</h3><p>มุมมองสำหรับ Manager / Admin</p></div></div>
        ${renderSalesSummaryTable(dashboardResult.data || [])}
      </div>
    ` : ""}
  `;

  document.getElementById("dashboardNewQuotationButtonV1110")?.addEventListener("click", () => {
    location.hash = "#quotation-new";
  });
  bindJourneyTaskLinksV1110();
}

async function injectJourneyIntoQuotationViewV1110(quotationId) {
  if (!quotationId || document.getElementById("quotationJourneyCardV1110")) return;
  try {
    const { data: quotation, error } = await supabaseClient
      .from("quotations")
      .select("id, owner_id, status, quotation_no, customer_name, valid_until, sent_at, sent_recipient_email, sent_recipient_name, sent_recipient_position")
      .eq("id", quotationId)
      .maybeSingle();
    if (error || !quotation) return;

    const driveLog = await loadDriveFileLogV1102(quotationId);
    const html = renderQuotationJourneyCardV1110(quotation, driveLog);
    elements.pageContent.insertAdjacentHTML("afterbegin", html);
    bindJourneyActionsV1110(document.getElementById("quotationJourneyCardV1110"), quotation, driveLog);
  } catch (error) {
    console.warn("Cannot inject journey card.", error);
  }
}

const originalRenderQuotationViewPageV1110 = window.renderQuotationViewPage || renderQuotationViewPage;
window.renderQuotationViewPage = async function renderQuotationViewPageV1110(quotationId) {
  const result = await originalRenderQuotationViewPageV1110.call(this, quotationId);
  await injectJourneyIntoQuotationViewV1110(quotationId);
  return result;
};
try { renderQuotationViewPage = window.renderQuotationViewPage; } catch (_error) {}

const originalRenderQuotationPrintPageV1110 = window.renderQuotationPrintPage || renderQuotationPrintPage;
window.renderQuotationPrintPage = async function renderQuotationPrintPageV1110(quotationId) {
  const result = await originalRenderQuotationPrintPageV1110.call(this, quotationId);
  try {
    const { data: quotation } = await supabaseClient
      .from("quotations")
      .select("id, owner_id, status, quotation_no, customer_name, valid_until, sent_at")
      .eq("id", quotationId)
      .maybeSingle();
    const driveLog = await loadDriveFileLogV1102(quotationId);
    const toolbar = document.querySelector(".print-toolbar");
    if (toolbar && quotation && !document.getElementById("quotationPrintJourneyV1110")) {
      toolbar.insertAdjacentHTML("afterend", `<div id="quotationPrintJourneyV1110">${renderQuotationJourneyCardV1110(quotation, driveLog, { compact: true })}</div>`);
      bindJourneyActionsV1110(document.getElementById("quotationPrintJourneyV1110"), quotation, driveLog);
    }
  } catch (error) {
    console.warn("Cannot render print journey card.", error);
  }
  return result;
};
try { renderQuotationPrintPage = window.renderQuotationPrintPage; } catch (_error) {}

const originalRenderQuotationFormPageV1110 = window.renderQuotationFormPage || (typeof renderQuotationFormPage === "function" ? renderQuotationFormPage : null);
if (typeof originalRenderQuotationFormPageV1110 === "function") {
  window.renderQuotationFormPage = async function renderQuotationFormPageV1110(options) {
    const result = await originalRenderQuotationFormPageV1110.call(this, options);
    if (!document.getElementById("quotationFormJourneyV1110")) {
      const form = document.getElementById("quotationDraftForm");
      if (form) {
        form.insertAdjacentHTML("beforebegin", `
          <section id="quotationFormJourneyV1110" class="quotation-journey-card-v1110 journey-card-compact-v1110 tone-draft">
            <div class="journey-main-v1110">
              <div>
                <div class="journey-eyebrow-v1110">Create Quotation</div>
                <h3>${options?.mode === "edit" ? "แก้ไข Draft แล้วตรวจสอบก่อนยืนยัน" : "สร้าง Draft ให้ครบ แล้วไปตรวจสอบก่อนยืนยัน"}</h3>
                <p>เอกสารยังแก้ไขได้ในขั้น Draft เมื่อบันทึกแล้วระบบจะพาไปหน้าตรวจสอบก่อน Confirm</p>
              </div>
            </div>
            ${renderJourneyStepperV1110("draft")}
          </section>
        `);
      }
    }
    return result;
  };
  try { renderQuotationFormPage = window.renderQuotationFormPage; } catch (_error) {}
}

const originalConfirmQuotationV1110 = window.confirmQuotation || confirmQuotation;
window.confirmQuotation = async function confirmQuotationV1110(quotationId) {
  const result = await originalConfirmQuotationV1110.call(this, quotationId);
  showToast("ยืนยันแล้ว ขั้นตอนถัดไปคือบันทึก PDF ลง Google Drive");
  return result;
};
try { confirmQuotation = window.confirmQuotation; } catch (_error) {}

const originalDebugV1110 = window.FI_DEBUG;
window.FI_DEBUG = async function FI_DEBUG_V1110() {
  const result = typeof originalDebugV1110 === "function" ? await originalDebugV1110() : {};
  return {
    ...result,
    version: FI_V1110_VERSION,
    quotationJourneyUX: true,
    dashboardWorkspace: true,
    stateMachine: "draft -> confirmed_needs_drive -> ready_to_send -> sent",
    sqlChanged: false,
  };
};

window.FI_APP_VERSION = FI_V1110_VERSION;

// Keep original confirmation behavior to avoid duplicate confirmations; the Journey card explains next step after render.
try {
  if (typeof originalConfirmQuotationV1110 === "function") {
    window.confirmQuotation = originalConfirmQuotationV1110;
    confirmQuotation = originalConfirmQuotationV1110;
  }
} catch (_error) {}
window.FI_APP_VERSION = FI_V1110_VERSION;
