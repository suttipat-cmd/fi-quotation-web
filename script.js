const SUPABASE_URL = "https://fjncvrsegkmrowvryttu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqbmN2cnNlZ2ttcm93dnJ5dHR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzkzMjYsImV4cCI6MjA5MzY1NTMyNn0.d8III1KlP5kJFes7ujFkfwZ9ombMYc-_4vNIazIg6zw";

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
            </div>
          </div>
        </section>

        <section class="form-section">
          <h3>5. ค่าบริการชำระครั้งเดียวจบ</h3>

          <div class="line-box">
            <div class="form-grid">
              <div class="field full">
                <label for="draftOneTimeName">รายการ</label>
                <input id="draftOneTimeName" type="text" value="ค่าบริการเซ็ตอัพทะเบียนรถ" />
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
                <textarea id="draftOneTimeDescription" rows="2">ค่าบริการเซ็ตอัพข้อมูลทั่วไปของหน่วยงาน / ค่าบริการฝึกอบรมซอฟต์แวร์ระบบ</textarea>
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
        description: `- ${product.name}`,
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
    oneTimeName: oneTimeItem.product_name_snapshot || "ค่าบริการเซ็ตอัพทะเบียนรถ",
    oneTimeQty: oneTimeItem.quantity ?? 1,
    oneTimePrice: oneTimeItem.unit_price ?? 4500,
    oneTimeDescription:
      oneTimeItem.description ||
      "ค่าบริการเซ็ตอัพข้อมูลทั่วไปของหน่วยงาน / ค่าบริการฝึกอบรมซอฟต์แวร์ระบบ",
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
        description: `- ${product.name}`,
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
      description: `- ${product.name}`,
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
// v1.6.1 Corrected Build
// Resume/session recovery must not block data rendering.
// This block intentionally sits at the end of the file so these
// function declarations override older appended release blocks.
// =======================================================

const FI_APP_VERSION = "1.6.1";
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
    console.error("initApp v1.6.1", error);
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
        console.error("auth listener v1.6.1", error);
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
      console.error("renderCurrentPage session bootstrap v1.6.1", error);
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
    console.error("renderCurrentPage v1.6.1", page, error);
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
    console.error("recoverAppAfterResume v1.6.1", reason, error);
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
