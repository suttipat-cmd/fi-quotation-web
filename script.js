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
            <strong id="summarySubtotal">฿0.00</strong>
          </div>

          <div class="summary-row">
            <span>ส่วนลด</span>
            <strong id="summaryDiscount">฿0.00</strong>
          </div>

          <div class="summary-row">
            <span>ฐานคำนวณภาษี</span>
            <strong id="summaryTaxable">฿0.00</strong>
          </div>

          <div class="summary-row">
            <span>VAT 7%</span>
            <strong id="summaryVat">฿0.00</strong>
          </div>

          <div class="summary-row">
            <span>หัก ณ ที่จ่าย 3%</span>
            <strong id="summaryWht">-฿0.00</strong>
          </div>

          <div class="summary-row">
            <span>ส่วนต่างปัดเศษ</span>
            <strong id="summaryRounding">฿0.00</strong>
          </div>

          <div class="summary-total">
            <span>ยอดรวมสุทธิ</span>
            <strong id="summaryGrandTotal">฿0.00</strong>
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

          <div class="summary-row"><span>มูลค่าก่อนภาษี</span><strong id="summarySubtotal">฿0.00</strong></div>
          <div class="summary-row"><span>ส่วนลด</span><strong id="summaryDiscount">฿0.00</strong></div>
          <div class="summary-row"><span>ฐานคำนวณภาษี</span><strong id="summaryTaxable">฿0.00</strong></div>
          <div class="summary-row"><span>VAT 7%</span><strong id="summaryVat">฿0.00</strong></div>
          <div class="summary-row"><span>หัก ณ ที่จ่าย 3%</span><strong id="summaryWht">-฿0.00</strong></div>
          <div class="summary-row"><span>ส่วนต่างปัดเศษ</span><strong id="summaryRounding">฿0.00</strong></div>

          <div class="summary-total">
            <span>ยอดรวมสุทธิ</span>
            <strong id="summaryGrandTotal">฿0.00</strong>
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
