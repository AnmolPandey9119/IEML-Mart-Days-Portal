// IEML Mart Sourcing Days — admin dashboard (vanilla JS, no build step).

const viewArea = document.getElementById("viewArea");
const pageTitle = document.getElementById("pageTitle");
const headerActions = document.getElementById("headerActions");
const navList = document.getElementById("navList");

let currentView = "overview";
let branding = {};

// ---------------------------------------------------------------------
// Icon set — small inline SVGs (Feather-style, 24x24, currentColor)
// swapped in for what used to be emoji glyphs, so the whole dashboard
// reads as one deliberately-designed icon language instead of
// OS-dependent emoji rendering. Purely decorative: ic() just returns a
// markup string to drop into a template literal, nothing here touches
// data, event wiring, or element ids/classes used elsewhere in the file.
const ICON_PATHS = {
  users: '<path d="M2 20v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1"/><circle cx="8" cy="8" r="3.2"/><path d="M15 5.2a3.2 3.2 0 0 1 0 6.2"/><path d="M22 20v-1a3.6 3.6 0 0 0-2.5-3.4"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.6 2.6L16 9.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  store: '<path d="M3 9.5 4.5 4h15L21 9.5"/><path d="M4 9.5V20h16V9.5"/><path d="M9 20v-6h6v6"/><path d="M3 9.5h18"/>',
  printer: '<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="1.5"/><path d="M6 17v4h12v-4"/><circle cx="17.2" cy="12" r="0.9" fill="currentColor" stroke="none"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  link: '<path d="M9.5 14.5l5-5"/><path d="M8 16.5H6a4 4 0 0 1 0-8h2"/><path d="M16 7.5h2a4 4 0 0 1 0 8h-2"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/><path d="M6 7l1 13.5A1.5 1.5 0 0 0 8.5 22h7a1.5 1.5 0 0 0 1.5-1.5L18 7"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>',
  edit: '<path d="M4 16.5V20h3.5L18.7 8.8a1.5 1.5 0 0 0 0-2.1l-1.4-1.4a1.5 1.5 0 0 0-2.1 0L4 16.5z"/><path d="M13.5 6.5l3 3"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  x: '<path d="M5 5l14 14"/><path d="M19 5L5 19"/>',
  trendingUp: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 6h6v6"/>',
  dot: '<circle cx="12" cy="12" r="7" fill="currentColor" stroke="none"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none"/>',
  clipboard: '<rect x="6" y="4" width="12" height="17" rx="1.5"/><path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1z"/><path d="M9 11h6"/><path d="M9 15h6"/><path d="M9 19h3"/>',
  tag: '<path d="M3 11.5V5a1 1 0 0 1 1-1h6.5L21 13.5 12.5 22 3 12.5z"/><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18"/><path d="M12 3a15 15 0 0 0 0 18"/>',
  mapPin: '<path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  megaphone: '<path d="M3 10v4a1 1 0 0 0 1 1h2l4 4V5l-4 4H4a1 1 0 0 0-1 1z"/><path d="M14 8a4 4 0 0 1 0 8"/><path d="M17.5 5.5a8 8 0 0 1 0 13"/>',
  receipt: '<path d="M6 3h12v18l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z"/><path d="M9 8h6"/><path d="M9 12h6"/>',
  barChart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M4 20h16"/>',
  alertTriangle: '<path d="M12 3.5 21.5 20h-19L12 3.5z"/><path d="M12 9.5v4.5"/><circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none"/>',
  upload: '<path d="M12 20V9"/><path d="M7 13l5-5 5 5"/><path d="M4 20h16"/>',
};
function ic(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name] || ""}</svg>`;
}

// ---- shared state per view ----
const buyersState = {
  page: 1, pageSize: 25, total: 0, rows: [],
  name: "", companyName: "", emailMobile: "", city: "", state: "", country: "",
  buyerType: "", attended: "", status: "", source: "",
};
const ownersState = {
  page: 1, pageSize: 25, total: 0, rows: [],
  urn: "", fullName: "", companyName: "", category: "", mobile: "", email: "",
};
const OWNER_CHIP_FIELDS = {
  urn: "URN", fullName: "Full Name", companyName: "Company",
  category: "Category", mobile: "Mobile", email: "Email",
};
function ownerFilterParams() {
  const params = new URLSearchParams();
  Object.keys(OWNER_CHIP_FIELDS).forEach((k) => { if (ownersState[k]) params.set(k, ownersState[k]); });
  return params;
}

// ---------------------------------------------------------------------
// Bootstrapping
// ---------------------------------------------------------------------
async function init() {
  const session = await fetch("/api/session").then((r) => r.json());
  if (!session.authenticated) {
    window.location.href = "/login.html";
    return;
  }
  branding = await fetch("/api/branding").then((r) => r.json());
  document.getElementById("pageTitleTag").textContent = `Dashboard — ${branding.eventName}`;
  document.getElementById("brandEdition").textContent = branding.edition;
  document.getElementById("brandTag").textContent = branding.tagline;
  document.getElementById("eventCardDates").textContent = branding.dateRange;
  document.getElementById("eventCardVenue").textContent = branding.venue;

  navList.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item");
    if (!btn) return;
    setView(btn.dataset.view);
    closeSidebar();
  });

  // ---- Mobile sidebar drawer ----
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  const sidebarCloseBtn = document.getElementById("sidebarCloseBtn");

  function openSidebar() {
    sidebar.classList.add("open");
    sidebarOverlay.classList.add("show");
  }
  function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("show");
  }
  hamburgerBtn.addEventListener("click", openSidebar);
  sidebarCloseBtn.addEventListener("click", closeSidebar);
  sidebarOverlay.addEventListener("click", closeSidebar);

  const avatarBtn = document.getElementById("avatarBtn");
  const avatarMenu = document.getElementById("avatarMenu");
  avatarBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    avatarMenu.classList.toggle("show");
  });
  document.addEventListener("click", (e) => {
    if (!avatarMenu.contains(e.target) && e.target !== avatarBtn) avatarMenu.classList.remove("show");
  });
  document.getElementById("homeMenuBtn").addEventListener("click", () => {
    avatarMenu.classList.remove("show");
    setView("overview");
  });
  document.getElementById("logoutMenuBtn").addEventListener("click", async () => {
    avatarMenu.classList.remove("show");
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login.html";
  });

  setView("overview");
}

function setView(view) {
  currentView = view;
  [...navList.children].forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
  headerActions.innerHTML = "";
  if (view === "overview") renderOverview();
  else if (view === "buyers") renderbuyers();
  else if (view === "martOwners") renderOwners();
  else if (view === "analytics") renderAnalytics();
  else if (view === "printHistory") renderPrintHistory();
  else if (view === "dangerZone") renderDangerZone();
}

function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d)) return esc(val);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------
async function renderOverview() {
  pageTitle.textContent = "Overview";
  viewArea.innerHTML = `<div class="loading-state">Loading…</div>`;
  try {
    const [buyersRes, ownersRes, analytics, printSummary] = await Promise.all([
      fetch("/api/buyers?pageSize=1").then((r) => r.json()),
      fetch("/api/mart-owners?pageSize=1").then((r) => r.json()),
      fetch("/api/analytics/buyers").then((r) => r.json()),
      fetch("/api/print-history/summary").then((r) => r.json()).catch(() => ({ totalPrints: 0, todayPrints: 0 })),
    ]);
    viewArea.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-card-icon">${ic('users')}</div><div class="num">${buyersRes.total ?? 0}</div><div class="label">Total Registered Buyers</div></div>
        <div class="stat-card"><div class="stat-card-icon">${ic('checkCircle')}</div><div class="num">${analytics.attended ?? 0}</div><div class="label">Checked In at Mart</div></div>
        <div class="stat-card"><div class="stat-card-icon">${ic('clock')}</div><div class="num">${analytics.notAttended ?? 0}</div><div class="label">Yet to Arrive</div></div>
        <div class="stat-card"><div class="stat-card-icon">${ic('store')}</div><div class="num">${ownersRes.total ?? 0}</div><div class="label">Mart Owners on File</div></div>
        <div class="stat-card"><div class="stat-card-icon">${ic('printer')}</div><div class="num">${printSummary.totalPrints ?? 0}</div><div class="label">Total Badges Printed</div></div>
        <div class="stat-card"><div class="stat-card-icon">${ic('calendar')}</div><div class="num">${printSummary.todayPrints ?? 0}</div><div class="label">Printed Today</div></div>
      </div>
      <div class="panel">
        <h3>${ic('link')} Quick links</h3>
        <p style="font-size:13px;color:var(--muted);margin:0 0 10px;">
          Public buyer registration form: <a href="${esc(branding.registrationUrl)}" target="_blank" rel="noopener">${esc(branding.registrationUrl)}</a>
        </p>
        <button class="btn primary" onclick="setView('buyers')">Go to buyers →</button>
      </div>
    `;
  } catch (err) {
    viewArea.innerHTML = `<div class="empty-state">Could not load overview. ${esc(err.message)}</div>`;
  }
}

// ---------------------------------------------------------------------
// buyers
// ---------------------------------------------------------------------
const BUYER_TYPES = ["Overseas buyers", "Domestic volume buyers", "Buying/Sourcing consultants"];
const STATUS_TABS = ["", "Registered", "Approved", "Rejected"];
const STATUS_TAB_LABELS = { "": "All", Registered: "Registered", Approved: "Approved", Rejected: "Rejected" };
const CHIP_FIELDS = {
  name: "Name", companyName: "Company", emailMobile: "Email/Mobile",
  city: "City", state: "State", country: "Country",
  buyerType: "Buyer Type", source: "Source", attended: "Checked In",
};
const CHIP_INPUT_IDS = {
  name: "fName", companyName: "fCompanyName", emailMobile: "fEmailMobile",
  city: "fCity", state: "fState", country: "fCountry",
  buyerType: "fBuyerType", source: "fSource", attended: "fAttended",
};
const SOURCE_OPTIONS = ["Website", "Meta", "Other"];
const VISITOR_FIELD_LABELS = {
  urn: "URN", fullName: "Full Name", companyName: "Company Name", designation: "Designation",
  buyerType: "Buyer Type", source: "Source", email: "Email", phone: "Phone", address: "Address",
  country: "Country", state: "State", district: "City / District", pincode: "Pincode",
  createdAt: "Registered On", status: "Status", attended: "Checked In",
  natureOfBusiness: "Nature of Business", annualTurnover: "Annual Turnover",
  knownThrough: "Known Through", onlineSeller: "Online Seller (E-commerce)",
  productsOfInterest: "Products of Interest",
  printCount: "Badge Print Count", scanCount: "Badge Scan Count",
  lastScannedAt: "Last Scanned At", badgeDownloadCount: "Badge Download Count",
};
const KNOWN_THROUGH_OPTIONS = [
  "Advertisement", "Phone call from organiser", "Email from organiser",
  "IHGF Delhi Fair website", "Invitation by Exhibitors", "Social media",
  "Invitation from India Representative / buying agent in India",
];
const ONLINE_SELLER_OPTIONS = ["Yes", "No"];

function visitorFilterParams() {
  const params = new URLSearchParams();
  Object.keys(CHIP_FIELDS).forEach((k) => { if (buyersState[k]) params.set(k, buyersState[k]); });
  if (buyersState.status) params.set("status", buyersState.status);
  return params;
}

function renderbuyers() {
  pageTitle.textContent = "Buyers";
  headerActions.innerHTML = `
    <button class="btn" id="bulkUploadBtn">${ic('upload')} Bulk Upload</button>
    <button class="btn" id="exportBtn">${ic('download')} Export CSV</button>
  `;
  document.getElementById("bulkUploadBtn").addEventListener("click", openBulkUploadModal);
  document.getElementById("exportBtn").addEventListener("click", () => {
    window.location.href = "/api/buyers/export?" + visitorFilterParams().toString();
  });

  viewArea.innerHTML = `
    <div class="status-tabs" id="statusTabs">
      ${STATUS_TABS.map((s) => `<button class="status-tab ${buyersState.status === s ? "active" : ""}" data-status="${s}">${STATUS_TAB_LABELS[s]}</button>`).join("")}
    </div>
    <div class="toolbar">
      <div class="field-mini"><label>Company Name</label><input type="text" id="fCompanyName" value="${esc(buyersState.companyName)}" /></div>
      <div class="field-mini"><label>Email / Mobile</label><input type="text" id="fEmailMobile" value="${esc(buyersState.emailMobile)}" /></div>
      <div class="field-mini"><label>Name</label><input type="text" id="fName" value="${esc(buyersState.name)}" /></div>
      <div class="field-mini"><label>City</label><input type="text" id="fCity" value="${esc(buyersState.city)}" /></div>
      <div class="field-mini"><label>State</label><input type="text" id="fState" value="${esc(buyersState.state)}" /></div>
      <div class="field-mini"><label>Country</label><input type="text" id="fCountry" value="${esc(buyersState.country)}" /></div>
      <div class="field-mini"><label>Buyer Type</label>
        <select id="fBuyerType">
          <option value="">All</option>
          ${BUYER_TYPES.map((t) => `<option value="${esc(t)}" ${buyersState.buyerType === t ? "selected" : ""}>${esc(t)}</option>`).join("")}
        </select>
      </div>
      <div class="field-mini"><label>Source</label>
        <select id="fSource">
          <option value="">All</option>
          ${SOURCE_OPTIONS.map((s) => `<option value="${esc(s)}" ${buyersState.source === s ? "selected" : ""}>${esc(s)}</option>`).join("")}
        </select>
      </div>
      <div class="field-mini"><label>Checked In</label>
        <select id="fAttended">
          <option value="">All</option>
          <option value="true" ${buyersState.attended === "true" ? "selected" : ""}>Yes</option>
          <option value="false" ${buyersState.attended === "false" ? "selected" : ""}>No</option>
        </select>
      </div>
    </div>
    <div class="filters-summary">
      <span class="result-count" id="resultCount"></span>
      <div class="filters-chip-box" id="filtersChipBox" style="display:none;">
        <div class="filter-chips" id="filterChips"></div>
        <button class="clear-all-btn" id="clearAllFilters">${ic('trash')} Clear</button>
      </div>
    </div>
    <div class="table-wrap">
      <div class="table-scroll"><div id="visitorTableArea"><div class="loading-state">Loading buyers…</div></div></div>
      <div class="table-footer">
        <span id="footerInfo"></span>
        <div class="table-footer-right">
          <div class="page-size-picker">
            <label for="visitorPageSize">Rows per page</label>
            <select id="visitorPageSize">
              ${[10, 25, 50, 100].map((n) => `<option value="${n}" ${n === buyersState.pageSize ? "selected" : ""}>${n}</option>`).join("")}
            </select>
          </div>
          <div class="pager">
            <button id="prevPage">‹ Prev</button>
            <span id="pageIndicator"></span>
            <button id="nextPage">Next ›</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("statusTabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".status-tab");
    if (!btn) return;
    buyersState.status = btn.dataset.status;
    buyersState.page = 1;
    renderbuyers();
  });

  document.getElementById("visitorPageSize").addEventListener("change", (e) => {
    buyersState.pageSize = parseInt(e.target.value, 10);
    buyersState.page = 1;
    loadbuyers();
  });

  // Each field filters ONLY its own column — no combined search box.
  let searchTimer;
  const wireTextFilter = (id, stateKey) => {
    const el = document.getElementById(id);
    el.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        buyersState[stateKey] = el.value;
        buyersState.page = 1;
        loadbuyers();
      }, 350);
    });
  };
  wireTextFilter("fCompanyName", "companyName");
  wireTextFilter("fEmailMobile", "emailMobile");
  wireTextFilter("fName", "name");
  wireTextFilter("fCity", "city");
  wireTextFilter("fState", "state");
  wireTextFilter("fCountry", "country");

  document.getElementById("fBuyerType").addEventListener("change", (e) => {
    buyersState.buyerType = e.target.value;
    buyersState.page = 1;
    loadbuyers();
  });
  document.getElementById("fSource").addEventListener("change", (e) => {
    buyersState.source = e.target.value;
    buyersState.page = 1;
    loadbuyers();
  });
  document.getElementById("fAttended").addEventListener("change", (e) => {
    buyersState.attended = e.target.value;
    buyersState.page = 1;
    loadbuyers();
  });
  document.getElementById("clearAllFilters").addEventListener("click", () => {
    Object.keys(CHIP_FIELDS).forEach((k) => (buyersState[k] = ""));
    buyersState.page = 1;
    renderbuyers();
  });
  document.getElementById("prevPage").addEventListener("click", () => {
    if (buyersState.page > 1) { buyersState.page--; loadbuyers(); }
  });
  document.getElementById("nextPage").addEventListener("click", () => {
    const maxPage = Math.max(1, Math.ceil(buyersState.total / buyersState.pageSize));
    if (buyersState.page < maxPage) { buyersState.page++; loadbuyers(); }
  });

  loadbuyers();
}

function renderFilterChips() {
  const box = document.getElementById("filtersChipBox");
  const chipsEl = document.getElementById("filterChips");
  if (!box || !chipsEl) return;
  const activeKeys = Object.keys(CHIP_FIELDS).filter((k) => buyersState[k]);
  if (activeKeys.length === 0) {
    box.style.display = "none";
    return;
  }
  box.style.display = "flex";
  chipsEl.innerHTML = activeKeys.map((k) => {
    const displayVal = k === "attended" ? (buyersState[k] === "true" ? "Yes" : "No") : buyersState[k];
    return `<span class="filter-chip"><b>${esc(CHIP_FIELDS[k])}:</b> ${esc(displayVal)} <button data-clear="${k}" title="Remove">${ic('x')}</button></span>`;
  }).join("");
  chipsEl.querySelectorAll("[data-clear]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.clear;
      buyersState[key] = "";
      buyersState.page = 1;
      const inputEl = document.getElementById(CHIP_INPUT_IDS[key]);
      if (inputEl) inputEl.value = "";
      loadbuyers();
      renderFilterChips();
    });
  });
}

async function patchbuyerstatus(id, status) {
  const res = await fetch(`/api/buyers/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not update status.");
}

async function loadbuyers() {
  const area = document.getElementById("visitorTableArea");
  if (!area) return;
  area.innerHTML = `<div class="loading-state">Loading buyers…</div>`;
  const params = visitorFilterParams();
  params.set("page", buyersState.page);
  params.set("pageSize", buyersState.pageSize);

  try {
    const res = await fetch("/api/buyers?" + params.toString());
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load buyers.");
    buyersState.total = data.total;
    buyersState.rows = data.rows;
    renderFilterChips();

    if (data.rows.length === 0) {
      area.innerHTML = `<div class="empty-state">No buyers found for this filter.</div>`;
    } else {
      const cols = data.columns;
      area.innerHTML = `
        <table>
          <thead><tr><th>Actions</th><th>Status</th>${cols.map((c) => `<th>${esc(c.label)}</th>`).join("")}<th>Checked In</th></tr></thead>
          <tbody>
            ${data.rows.map((row) => {
              const statusClass = "status-" + String(row.status || "registered").toLowerCase();
              return `
              <tr>
                <td>
                  <div class="actions-cell">
                    <button class="action-btn view" title="View" data-view="${esc(row.id)}">${ic('eye')}</button>
                    <button class="action-btn edit" title="Edit" data-edit="${esc(row.id)}">${ic('edit')}</button>
                    <button class="action-btn approve" title="Approve" data-approve="${esc(row.id)}">${ic('check')}</button>
                    <button class="action-btn reject" title="Reject" data-reject="${esc(row.id)}">${ic('x')}</button>
                    <button class="action-btn delete" title="Delete" data-delete="${esc(row.id)}">${ic('trash')}</button>
                  </div>
                </td>
                <td><span class="pill ${statusClass}">${esc(row.status || "Registered")}</span></td>
                ${cols.map((c) => `<td>${c.key === "createdAt" ? fmtDate(row[c.key]) : esc(row[c.key])}</td>`).join("")}
                <td>
                  <label style="display:flex;align-items:center;gap:8px;">
                    <input type="checkbox" class="attend-checkbox" data-id="${esc(row.id)}" ${row.attended ? "checked" : ""} />
                    <span class="pill ${row.attended ? "yes" : "no"}">${row.attended ? "Arrived" : "Pending"}</span>
                  </label>
                </td>
              </tr>
            `;
            }).join("")}
          </tbody>
        </table>
      `;

      area.querySelectorAll(".attend-checkbox").forEach((cb) => {
        cb.addEventListener("change", async (e) => {
          const id = e.target.dataset.id;
          const attended = e.target.checked;
          e.target.disabled = true;
          try {
            const r = await fetch(`/api/buyers/${id}/attended`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ attended }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Failed to update.");
            const pillEl = e.target.closest("label").querySelector(".pill");
            pillEl.textContent = attended ? "Arrived" : "Pending";
            pillEl.className = "pill " + (attended ? "yes" : "no");
          } catch (err) {
            alert(err.message);
            e.target.checked = !attended;
          } finally {
            e.target.disabled = false;
          }
        });
      });

      area.querySelectorAll("[data-view]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const row = buyersState.rows.find((r) => String(r.id) === btn.dataset.view);
          if (row) openVisitorModal(row, "view");
        });
      });
      area.querySelectorAll("[data-edit]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const row = buyersState.rows.find((r) => String(r.id) === btn.dataset.edit);
          if (row) openVisitorModal(row, "edit");
        });
      });
      area.querySelectorAll("[data-approve]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          try {
            await patchbuyerstatus(btn.dataset.approve, "Approved");
            loadbuyers();
          } catch (err) {
            alert(err.message);
            btn.disabled = false;
          }
        });
      });
      area.querySelectorAll("[data-reject]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!confirm("Mark this buyer as Rejected?")) return;
          btn.disabled = true;
          try {
            await patchbuyerstatus(btn.dataset.reject, "Rejected");
            loadbuyers();
          } catch (err) {
            alert(err.message);
            btn.disabled = false;
          }
        });
      });
      area.querySelectorAll("[data-delete]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!confirm("Permanently delete this buyer registration? This cannot be undone.")) return;
          btn.disabled = true;
          try {
            const r = await fetch(`/api/buyers/${btn.dataset.delete}`, { method: "DELETE" });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Could not delete.");
            loadbuyers();
          } catch (err) {
            alert(err.message);
            btn.disabled = false;
          }
        });
      });
    }

    const maxPage = Math.max(1, Math.ceil(data.total / buyersState.pageSize));
    document.getElementById("resultCount").textContent = `${data.total} result${data.total === 1 ? "" : "s"} found`;
    document.getElementById("footerInfo").textContent = `Showing page ${data.page} of ${maxPage}`;
    document.getElementById("pageIndicator").textContent = `Page ${data.page} / ${maxPage}`;
    document.getElementById("prevPage").disabled = data.page <= 1;
    document.getElementById("nextPage").disabled = data.page >= maxPage;
  } catch (err) {
    area.innerHTML = `<div class="empty-state">${esc(err.message)}<br><span style="font-size:12px;">Tip: while signed in, open <code>/api/schema-check</code> directly in the browser to confirm the column names in server.js match your table.</span></div>`;
  }
}

// ---- View / Edit visitor modal ----
let currentVisitorModalRow = null;

function openVisitorModal(row, mode) {
  const backdrop = document.getElementById("visitorModalBackdrop");
  const title = document.getElementById("visitorModalTitle");
  const body = document.getElementById("visitorModalBody");
  const errorEl = document.getElementById("visitorModalError");
  const saveBtn = document.getElementById("visitorModalSave");
  errorEl.textContent = "";
  currentVisitorModalRow = row;

  if (mode === "view") {
    title.textContent = "Buyer Details";
    saveBtn.style.display = "none";
    const viewKeys = [
      "urn", "fullName", "companyName", "designation", "buyerType", "source", "email", "phone",
      "address", "country", "state", "district", "pincode",
      "natureOfBusiness", "annualTurnover", "knownThrough", "onlineSeller", "productsOfInterest",
      "createdAt", "status", "attended",
      "printCount", "scanCount", "lastScannedAt", "badgeDownloadCount",
    ];
    body.innerHTML = `<div class="view-grid">${viewKeys.map((k) => {
      let val = row[k];
      if (k === "createdAt" || k === "lastScannedAt") val = fmtDate(val);
      if (k === "attended") val = val ? "Yes" : "No";
      return `<div class="view-item"><label>${esc(VISITOR_FIELD_LABELS[k])}</label><div>${esc(val) || "—"}</div></div>`;
    }).join("")}</div>`;
  } else {
    title.textContent = "Edit Buyer";
    saveBtn.style.display = "inline-block";
    body.innerHTML = `
      <div class="edit-grid">
        <div class="field"><label>Full Name</label><input type="text" id="evFullName" value="${esc(row.fullName)}" /></div>
        <div class="field"><label>Company Name</label><input type="text" id="evCompanyName" value="${esc(row.companyName)}" /></div>
        <div class="field"><label>Designation</label><input type="text" id="evDesignation" value="${esc(row.designation)}" /></div>
        <div class="field"><label>Buyer Type</label>
          <select id="evBuyerType">
            <option value="" ${!row.buyerType ? "selected" : ""}>—</option>
            ${BUYER_TYPES.map((t) => `<option value="${esc(t)}" ${row.buyerType === t ? "selected" : ""}>${esc(t)}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Source</label>${selectWithFallbackHTML("evSource", SOURCE_OPTIONS, row.source, "Select source")}</div>
        <div class="field"><label>Email</label><input type="text" id="evEmail" value="${esc(row.email)}" /></div>
        <div class="field"><label>Phone</label><input type="text" id="evPhone" value="${esc(row.phone)}" /></div>
        <div class="field full"><label>Address</label><input type="text" id="evAddress" value="${esc(row.address)}" /></div>
        <div class="field"><label>Country</label>
          <select id="evCountry">
            <option value="">Select country</option>
            ${COUNTRIES.map((c) => `<option value="${esc(c)}" ${row.country === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>State</label><div id="evStateWrap">${renderStateFieldHTML(row.country, row.state)}</div></div>
        <div class="field"><label>City / District</label><div id="evDistrictWrap">${renderDistrictFieldHTML(row.state, row.district)}</div></div>
        <div class="field"><label>Pincode</label><input type="text" id="evPincode" value="${esc(row.pincode)}" /></div>
        <div class="field"><label>Nature of Business</label><input type="text" id="evNatureOfBusiness" value="${esc(row.natureOfBusiness)}" /></div>
        <div class="field"><label>Annual Turnover</label><input type="text" id="evAnnualTurnover" value="${esc(row.annualTurnover)}" /></div>
        <div class="field"><label>Known Through</label>${selectWithFallbackHTML("evKnownThrough", KNOWN_THROUGH_OPTIONS, row.knownThrough, "Select")}</div>
        <div class="field"><label>Online Seller</label>${selectWithFallbackHTML("evOnlineSeller", ONLINE_SELLER_OPTIONS, row.onlineSeller, "Select")}</div>
        <div class="field full"><label>Products of Interest <span style="font-weight:400;color:var(--muted)">(comma-separated)</span></label><input type="text" id="evProductsOfInterest" value="${esc(row.productsOfInterest)}" /></div>
      </div>
    `;
    wireGeoCascade();
  }
  backdrop.classList.add("show");
}

// Builds a <select> with the given options, pre-selected to currentValue.
// If currentValue doesn't match any option (older/odd data), it's kept as
// an extra selected option instead of being silently dropped.
function selectWithFallbackHTML(id, options, currentValue, placeholderLabel) {
  const known = options.includes(currentValue);
  return `
    <select id="${id}">
      <option value="" ${!currentValue ? "selected" : ""}>${esc(placeholderLabel)}</option>
      ${options.map((o) => `<option value="${esc(o)}" ${currentValue === o ? "selected" : ""}>${esc(o)}</option>`).join("")}
      ${currentValue && !known ? `<option value="${esc(currentValue)}" selected>${esc(currentValue)} (existing value)</option>` : ""}
    </select>
  `;
}

// ---- Cascading Country → State → District for the edit modal ----
// State: India gets a real dropdown (36 states/UTs are stable and known).
// Any other country gets a free-text field, since we don't have a
// reliable global state/province list. Either way it's disabled until a
// Country is picked, matching the public registration form's behaviour.
function renderStateFieldHTML(country, currentState) {
  if (!country) {
    return `<input type="text" id="evState" value="" placeholder="Select country first" disabled />`;
  }
  if (country === "India") {
    const known = INDIA_STATES.includes(currentState);
    return `
      <select id="evState">
        <option value="">Select state</option>
        ${INDIA_STATES.map((s) => `<option value="${esc(s)}" ${currentState === s ? "selected" : ""}>${esc(s)}</option>`).join("")}
        ${currentState && !known ? `<option value="${esc(currentState)}" selected>${esc(currentState)} (existing value)</option>` : ""}
      </select>
    `;
  }
  return `<input type="text" id="evState" value="${esc(currentState)}" placeholder="State / Province" />`;
}

// District is always free-text (district lists change too often to
// hardcode reliably) but stays disabled until a State is chosen.
function renderDistrictFieldHTML(currentStateValue, currentDistrict) {
  if (!currentStateValue) {
    return `<input type="text" id="evDistrict" value="" placeholder="Select state first" disabled />`;
  }
  return `<input type="text" id="evDistrict" value="${esc(currentDistrict)}" placeholder="City / District" />`;
}

// Re-wires the State/District blocks whenever Country or State changes,
// so District only ever unlocks once its parent field has a value.
function wireGeoCascade() {
  const countryEl = document.getElementById("evCountry");
  if (!countryEl) return;

  const attachStateListener = () => {
    const stateEl = document.getElementById("evState");
    if (!stateEl) return;
    const evt = stateEl.tagName === "SELECT" ? "change" : "input";
    stateEl.addEventListener(evt, () => {
      document.getElementById("evDistrictWrap").innerHTML =
        renderDistrictFieldHTML(stateEl.value, "");
    });
  };

  countryEl.addEventListener("change", () => {
    document.getElementById("evStateWrap").innerHTML = renderStateFieldHTML(countryEl.value, "");
    document.getElementById("evDistrictWrap").innerHTML = renderDistrictFieldHTML("", "");
    attachStateListener();
  });

  attachStateListener();
}

document.getElementById("visitorModalCancel").addEventListener("click", () => {
  document.getElementById("visitorModalBackdrop").classList.remove("show");
});
document.getElementById("visitorModalSave").addEventListener("click", async () => {
  if (!currentVisitorModalRow) return;
  const errorEl = document.getElementById("visitorModalError");
  const body = {
    fullName: document.getElementById("evFullName").value.trim(),
    companyName: document.getElementById("evCompanyName").value.trim(),
    designation: document.getElementById("evDesignation").value.trim(),
    buyerType: document.getElementById("evBuyerType").value,
    source: document.getElementById("evSource").value,
    email: document.getElementById("evEmail").value.trim(),
    phone: document.getElementById("evPhone").value.trim(),
    address: document.getElementById("evAddress").value.trim(),
    district: document.getElementById("evDistrict").value.trim(),
    state: document.getElementById("evState").value.trim(),
    country: document.getElementById("evCountry").value.trim(),
    pincode: document.getElementById("evPincode").value.trim(),
    natureOfBusiness: document.getElementById("evNatureOfBusiness").value.trim(),
    annualTurnover: document.getElementById("evAnnualTurnover").value.trim(),
    knownThrough: document.getElementById("evKnownThrough").value,
    onlineSeller: document.getElementById("evOnlineSeller").value,
    productsOfInterest: document.getElementById("evProductsOfInterest").value.trim(),
  };
  if (!body.fullName) {
    errorEl.textContent = "Full name is required.";
    return;
  }
  try {
    const res = await fetch(`/api/buyers/${currentVisitorModalRow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not save changes.");
    document.getElementById("visitorModalBackdrop").classList.remove("show");
    loadbuyers();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// ---------------------------------------------------------------------
// Bulk Upload (CSV) — for buyers sourced from outside the registration
// site (e.g. a Meta/Facebook lead-ads export). Every row imported this
// way is tagged Source: Meta by the backend automatically. Parsing
// happens entirely client-side; only the mapped rows are posted.
// ---------------------------------------------------------------------
const BULK_UPLOAD_TEMPLATE_HEADERS = [
  "Full Name", "Company Name", "Designation", "Buyer Type", "Email", "Phone",
  "Address", "Country", "State", "District", "Pincode",
  "Nature of Business", "Annual Turnover", "Known Through", "Online Seller", "Products of Interest",
];
// Column headers are matched loosely (case/space/underscore-insensitive)
// against these aliases, so a Meta export or a hand-built CSV both work
// as long as the key columns are named something recognisable.
const BULK_HEADER_ALIASES = {
  fullname: "fullName", name: "fullName", buyername: "fullName", contactname: "fullName",
  companyname: "companyName", company: "companyName", organisation: "companyName", organization: "companyName",
  designation: "designation", jobtitle: "designation", role: "designation",
  buyertype: "buyerType", type: "buyerType",
  email: "email", emailaddress: "email", emailid: "email",
  phone: "phone", phonenumber: "phone", mobile: "phone", mobilenumber: "phone", contactnumber: "phone", whatsappnumber: "phone",
  address: "address",
  country: "country",
  state: "state", stateprovince: "state", province: "state",
  district: "district", city: "district", citydistrict: "district",
  pincode: "pincode", zip: "pincode", zipcode: "pincode", postalcode: "pincode",
  natureofbusiness: "natureOfBusiness", business: "natureOfBusiness", industry: "natureOfBusiness",
  annualturnover: "annualTurnover", turnover: "annualTurnover",
  knownthrough: "knownThrough", howdidyouhear: "knownThrough", hearaboutus: "knownThrough",
  onlineseller: "onlineSeller", ecommerce: "onlineSeller",
  productsofinterest: "productsOfInterest", products: "productsOfInterest", interest: "productsOfInterest", interests: "productsOfInterest",
};
function normalizeHeader(h) {
  return String(h || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Minimal CSV parser — handles quoted fields, embedded commas/newlines,
// and escaped ("") quotes. Good enough for exports from Excel/Sheets/Meta.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const s = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

let bulkUploadParsedRows = null;

function openBulkUploadModal() {
  bulkUploadParsedRows = null;
  const backdrop = document.getElementById("bulkUploadModalBackdrop");
  const body = document.getElementById("bulkUploadModalBody");
  const errorEl = document.getElementById("bulkUploadModalError");
  const submitBtn = document.getElementById("bulkUploadModalSubmit");
  errorEl.textContent = "";
  submitBtn.style.display = "none";
  submitBtn.disabled = false;
  submitBtn.textContent = "Import";

  body.innerHTML = `
    <p style="font-size:13px;color:var(--muted);line-height:1.5;margin:0 0 12px;">
      Upload a CSV or Excel (.xlsx) file of buyers from an external source (e.g. a Meta / Facebook
      lead-ads export). Every row imported here is tagged <b>Source: Meta</b> automatically.
      Required columns: Full Name, Company Name, Email, Phone.
    </p>
    <p style="font-size:12.5px;margin:0 0 14px;">
      <a href="#" id="bulkUploadSampleLink">${ic('download')} Download a sample Excel template</a>
    </p>
    <div class="field full" style="margin-bottom:14px;">
      <label>CSV or Excel File</label>
      <input type="file" id="bulkUploadFileInput" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" />
    </div>
    <div id="bulkUploadPreview"></div>
  `;

  document.getElementById("bulkUploadSampleLink").addEventListener("click", (e) => {
    e.preventDefault();
    const sampleRows = [
      BULK_UPLOAD_TEMPLATE_HEADERS,
      ["Jane Doe", "Acme Traders", "Purchase Manager", "Overseas buyers", "jane@acme.com", "+1 555 0100", "123 Main St", "United States", "", "New York", "10001", "Home Decor", "USD 1-5 Million", "Social media", "Yes", "Furniture, Lighting"],
      ["Rahul Sharma", "Sharma Exports", "Director", "Domestic volume buyers", "rahul@sharmaexports.in", "9876543210", "45 MG Road", "India", "Delhi", "New Delhi", "110001", "Handicrafts", "INR 1-5 Crore", "Advertisement", "No", "Home Textiles, Decor"],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Buyers");
    XLSX.writeFile(workbook, "buyer-bulk-upload-template.xlsx");
  });

  document.getElementById("bulkUploadFileInput").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    errorEl.textContent = "";
    submitBtn.style.display = "none";
    bulkUploadParsedRows = null;
    const previewEl = document.getElementById("bulkUploadPreview");
    previewEl.innerHTML = "";
    if (!file) return;

    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        let rows;
        if (isExcel) {
          const workbook = XLSX.read(new Uint8Array(reader.result), { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false })
            .map((r) => r.map((c) => (c === undefined || c === null ? "" : String(c))))
            .filter((r) => !(r.length === 0 || (r.length === 1 && r[0].trim() === "")));
        } else {
          rows = parseCsv(String(reader.result));
        }
        bulkUploadHandleParsedRows(rows, previewEl, errorEl, submitBtn);
      } catch (err) {
        errorEl.textContent = err.message;
      }
    };
    reader.onerror = () => { errorEl.textContent = "Could not read that file."; };
    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  });

  backdrop.classList.add("show");
}

// Shared row-mapping logic for both CSV and Excel input — both are
// normalised to an array-of-arrays of strings (rows[0] = headers) before
// reaching here.
function bulkUploadHandleParsedRows(rows, previewEl, errorEl, submitBtn) {
  if (rows.length < 2) throw new Error("File has no data rows.");
  const headerRow = rows[0].map(normalizeHeader);
  const mappedKeys = headerRow.map((h) => BULK_HEADER_ALIASES[h] || null);
  if (!mappedKeys.includes("fullName") || !mappedKeys.includes("companyName") ||
      !mappedKeys.includes("email") || !mappedKeys.includes("phone")) {
    throw new Error('File must include columns for Full Name, Company Name, Email, and Phone (names are matched loosely — "Name", "Company", "Mobile" etc. also work).');
  }
  const parsed = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.every((c) => !c || !String(c).trim())) continue;
    const obj = {};
    mappedKeys.forEach((key, idx) => {
      if (!key) return;
      const val = (cells[idx] || "").toString().trim();
      if (val) obj[key] = val;
    });
    if (Object.keys(obj).length) parsed.push(obj);
  }
  if (parsed.length === 0) throw new Error("No usable data rows found in this file.");
  bulkUploadParsedRows = parsed;
  const unmapped = rows[0].filter((_, idx) => !mappedKeys[idx]);
  previewEl.innerHTML = `
    <div class="empty-state" style="text-align:left;padding:12px;">
      <b>${parsed.length} row${parsed.length === 1 ? "" : "s"}</b> ready to import, all tagged <b>Source: Meta</b>.
      ${unmapped.length ? `<br><span style="font-size:12px;color:var(--muted);">Columns not recognised (ignored): ${unmapped.map(esc).join(", ")}</span>` : ""}
    </div>
  `;
  submitBtn.style.display = "inline-block";
}

document.getElementById("bulkUploadModalCancel").addEventListener("click", () => {
  document.getElementById("bulkUploadModalBackdrop").classList.remove("show");
});

document.getElementById("bulkUploadModalSubmit").addEventListener("click", async () => {
  if (!bulkUploadParsedRows || bulkUploadParsedRows.length === 0) return;
  const errorEl = document.getElementById("bulkUploadModalError");
  const submitBtn = document.getElementById("bulkUploadModalSubmit");
  errorEl.textContent = "";
  submitBtn.disabled = true;
  submitBtn.textContent = "Importing…";
  try {
    const res = await fetch("/api/buyers/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: bulkUploadParsedRows }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Bulk upload failed.");
    const previewEl = document.getElementById("bulkUploadPreview");
    previewEl.innerHTML = `
      <div class="empty-state" style="text-align:left;padding:12px;">
        <b style="color:var(--success);">${data.inserted} buyer${data.inserted === 1 ? "" : "s"} imported</b> with Source: Meta.
        ${data.failedCount ? `<br><span style="color:var(--error);">${data.failedCount} row${data.failedCount === 1 ? "" : "s"} failed:</span>
          <ul style="margin:6px 0 0 18px;font-size:12.5px;">
            ${data.failed.map((f) => `<li>Row ${f.row}: ${esc(f.error)}</li>`).join("")}
          </ul>` : ""}
      </div>
    `;
    submitBtn.style.display = "none";
    bulkUploadParsedRows = null;
    if (currentView === "buyers") loadbuyers();
  } catch (err) {
    errorEl.textContent = err.message;
    submitBtn.disabled = false;
    submitBtn.textContent = "Import";
  }
});

// ---------------------------------------------------------------------
// Mart Owners
// ---------------------------------------------------------------------
function renderOwners() {
  pageTitle.textContent = "Mart Owners";
  headerActions.innerHTML = `
    <button class="btn" id="exportOwnersBtn">${ic('download')} Export CSV</button>
    <button class="btn primary" id="addOwnerBtn">+ Add Mart Owner</button>
  `;
  document.getElementById("addOwnerBtn").addEventListener("click", () => openOwnerModal());
  document.getElementById("exportOwnersBtn").addEventListener("click", () => {
    window.location.href = "/api/mart-owners/export?" + ownerFilterParams().toString();
  });

  viewArea.innerHTML = `
    <div class="toolbar">
      <div class="field-mini"><label>URN</label><input type="text" id="oUrn" value="${esc(ownersState.urn)}" /></div>
      <div class="field-mini"><label>Full Name</label><input type="text" id="oFullName" value="${esc(ownersState.fullName)}" /></div>
      <div class="field-mini"><label>Company Name</label><input type="text" id="oCompanyName" value="${esc(ownersState.companyName)}" /></div>
      <div class="field-mini"><label>Category</label><input type="text" id="oCategory" value="${esc(ownersState.category)}" /></div>
      <div class="field-mini"><label>Mobile</label><input type="text" id="oMobile" value="${esc(ownersState.mobile)}" /></div>
      <div class="field-mini"><label>Email</label><input type="text" id="oEmail" value="${esc(ownersState.email)}" /></div>
    </div>
    <div class="filters-summary">
      <span class="result-count" id="ownerResultCount"></span>
    </div>
    <div class="table-wrap">
      <div class="table-scroll"><div id="ownerTableArea"><div class="loading-state">Loading…</div></div></div>
      <div class="table-footer">
        <span id="ownerFooterInfo"></span>
        <div class="table-footer-right">
          <div class="page-size-picker">
            <label for="ownerPageSize">Rows per page</label>
            <select id="ownerPageSize">
              ${[10, 25, 50, 100].map((n) => `<option value="${n}" ${n === ownersState.pageSize ? "selected" : ""}>${n}</option>`).join("")}
            </select>
          </div>
          <div class="pager">
            <button id="ownerPrevPage">‹ Prev</button>
            <span id="ownerPageIndicator"></span>
            <button id="ownerNextPage">Next ›</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("ownerPageSize").addEventListener("change", (e) => {
    ownersState.pageSize = parseInt(e.target.value, 10);
    ownersState.page = 1;
    loadOwners();
  });

  // Each field filters ONLY its own column — no combined search box.
  let searchTimer;
  const wireOwnerFilter = (id, stateKey) => {
    const el = document.getElementById(id);
    el.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        ownersState[stateKey] = el.value;
        ownersState.page = 1;
        loadOwners();
      }, 350);
    });
  };
  wireOwnerFilter("oUrn", "urn");
  wireOwnerFilter("oFullName", "fullName");
  wireOwnerFilter("oCompanyName", "companyName");
  wireOwnerFilter("oCategory", "category");
  wireOwnerFilter("oMobile", "mobile");
  wireOwnerFilter("oEmail", "email");

  document.getElementById("ownerPrevPage").addEventListener("click", () => {
    if (ownersState.page > 1) { ownersState.page--; loadOwners(); }
  });
  document.getElementById("ownerNextPage").addEventListener("click", () => {
    const maxPage = Math.max(1, Math.ceil(ownersState.total / ownersState.pageSize));
    if (ownersState.page < maxPage) { ownersState.page++; loadOwners(); }
  });

  loadOwners();
}

async function loadOwners() {
  const area = document.getElementById("ownerTableArea");
  if (!area) return;
  area.innerHTML = `<div class="loading-state">Loading…</div>`;
  const params = ownerFilterParams();
  params.set("page", ownersState.page);
  params.set("pageSize", ownersState.pageSize);

  try {
    const res = await fetch("/api/mart-owners?" + params.toString());
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load mart owners.");
    ownersState.total = data.total;
    ownersState.rows = data.rows;

    if (data.rows.length === 0) {
      area.innerHTML = `<div class="empty-state">No mart owners added yet. Click "+ Add Mart Owner" once you have the list.</div>`;
    } else {
      area.innerHTML = `
        <table>
          <thead><tr><th>URN</th><th>Full Name</th><th>Company</th><th>Category</th><th>Mobile</th><th>Email</th><th>Notes</th><th>Added On</th><th></th></tr></thead>
          <tbody>
            ${data.rows.map((row) => `
              <tr>
                <td>${esc(row.urn)}</td>
                <td>${esc(row.full_name)}</td>
                <td>${esc(row.company_name)}</td>
                <td>${esc(row.category)}</td>
                <td>${esc(row.mobile_number)}</td>
                <td>${esc(row.email)}</td>
                <td>${esc(row.notes)}</td>
                <td>${fmtDate(row.created_at)}</td>
                <td>
                  <button class="btn" data-edit="${row.id}">Edit</button>
                  <button class="btn" data-delete="${row.id}">Delete</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
      area.querySelectorAll("[data-edit]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const row = ownersState.rows.find((r) => String(r.id) === btn.dataset.edit);
          openOwnerModal(row);
        });
      });
      area.querySelectorAll("[data-delete]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!confirm("Delete this mart owner?")) return;
          await fetch(`/api/mart-owners/${btn.dataset.delete}`, { method: "DELETE" });
          loadOwners();
        });
      });
    }

    const maxPage = Math.max(1, Math.ceil(data.total / ownersState.pageSize));
    document.getElementById("ownerResultCount").textContent = `${data.total} result${data.total === 1 ? "" : "s"}`;
    document.getElementById("ownerFooterInfo").textContent = `Showing page ${data.page} of ${maxPage}`;
    document.getElementById("ownerPageIndicator").textContent = `Page ${data.page} / ${maxPage}`;
    document.getElementById("ownerPrevPage").disabled = data.page <= 1;
    document.getElementById("ownerNextPage").disabled = data.page >= maxPage;
  } catch (err) {
    area.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
  }
}

const ownerModalBackdrop = document.getElementById("ownerModalBackdrop");
const ownerModalBody = document.getElementById("ownerModalBody");
const ownerModalError = document.getElementById("ownerModalError");
const ownerModalTitle = document.getElementById("ownerModalTitle");
let editingOwnerId = null;

function openOwnerModal(row) {
  editingOwnerId = row ? row.id : null;
  ownerModalTitle.textContent = row ? "Edit Mart Owner" : "Add Mart Owner";
  ownerModalError.textContent = "";
  const f = (key) => esc(row ? row[key] : "");
  ownerModalBody.innerHTML = `
    <div class="field"><label>URN</label><input type="text" id="ownerUrn" value="${f("urn")}" placeholder="Optional reference number" /></div>
    <div class="field"><label>Full Name *</label><input type="text" id="ownerFullName" value="${f("full_name")}" /></div>
    <div class="field"><label>Company Name</label><input type="text" id="ownerCompanyName" value="${f("company_name")}" /></div>
    <div class="field"><label>Category</label><input type="text" id="ownerCategory" value="${f("category")}" placeholder="e.g. Home Decor, Fashion Jewelry" /></div>
    <div class="field"><label>Mobile Number</label><input type="text" id="ownerMobile" value="${f("mobile_number")}" /></div>
    <div class="field"><label>Email</label><input type="text" id="ownerEmail" value="${f("email")}" /></div>
    <div class="field"><label>Notes</label><input type="text" id="ownerNotes" value="${f("notes")}" /></div>
  `;
  ownerModalBackdrop.classList.add("show");
}
document.getElementById("ownerModalCancel").addEventListener("click", () => ownerModalBackdrop.classList.remove("show"));
document.getElementById("ownerModalSave").addEventListener("click", async () => {
  const body = {
    urn: document.getElementById("ownerUrn").value.trim(),
    full_name: document.getElementById("ownerFullName").value.trim(),
    company_name: document.getElementById("ownerCompanyName").value.trim(),
    category: document.getElementById("ownerCategory").value.trim(),
    mobile_number: document.getElementById("ownerMobile").value.trim(),
    email: document.getElementById("ownerEmail").value.trim(),
    notes: document.getElementById("ownerNotes").value.trim(),
  };
  if (!body.full_name) {
    ownerModalError.textContent = "Full name is required.";
    return;
  }
  try {
    const url = editingOwnerId ? `/api/mart-owners/${editingOwnerId}` : "/api/mart-owners";
    const method = editingOwnerId ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not save.");
    ownerModalBackdrop.classList.remove("show");
    loadOwners();
  } catch (err) {
    ownerModalError.textContent = err.message;
  }
});

// ---------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------
const STATUS_COLORS = { Registered: "#3a4fb0", Approved: "#1e8e5a", Rejected: "#c0392b" };
const CHART_PALETTE = ["#d3004c", "#f4b942", "#3a4fb0", "#1e8e5a", "#b3690a", "#7a3fc9", "#2ba8b0", "#c0392b", "#8a8a3a", "#5a5a7a"];
const chartInstances = {};

function destroyChart(key) {
  if (chartInstances[key]) {
    chartInstances[key].destroy();
    delete chartInstances[key];
  }
}

function makeDoughnut(canvasId, labels, values, colors, key) {
  destroyChart(key);
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === "undefined") return;
  chartInstances[key] = new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: "#fff" }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "68%",
      plugins: { legend: { position: "bottom", labels: { boxWidth: 12, padding: 14, font: { size: 12 } } } },
    },
  });
}

function makeHBar(canvasId, labels, values, key, color) {
  destroyChart(key);
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === "undefined") return;
  chartInstances[key] = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ data: values, backgroundColor: color || "#d3004c", borderRadius: 5, maxBarThickness: 22 }] },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#f2e6ec" } },
        y: { grid: { display: false } },
      },
    },
  });
}

function makeLine(canvasId, labels, dailyValues, cumulativeValues, key) {
  destroyChart(key);
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === "undefined") return;
  chartInstances[key] = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Daily registrations", data: dailyValues, borderColor: "#d3004c",
          backgroundColor: "rgba(211,0,76,0.12)", fill: true, tension: 0.3, pointRadius: 2, yAxisID: "y",
        },
        {
          label: "Cumulative total", data: cumulativeValues, borderColor: "#3a4fb0",
          backgroundColor: "transparent", borderDash: [5, 4], fill: false, tension: 0.25, pointRadius: 0, yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { position: "bottom", labels: { boxWidth: 12, padding: 14, font: { size: 12 } } } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#f2e6ec" }, title: { display: true, text: "Per day" } },
        y1: { beginAtZero: true, position: "right", grid: { display: false }, ticks: { precision: 0 }, title: { display: true, text: "Cumulative" } },
      },
    },
  });
}

async function renderAnalytics() {
  pageTitle.textContent = "Analytics";
  viewArea.innerHTML = `<div class="loading-state">Loading analytics…</div>`;
  try {
    const data = await fetch("/api/analytics/buyers").then((r) => r.json());
    const turnoutPct = data.total ? Math.round((data.attended / data.total) * 100) : 0;
    const byStatus = data.byStatus && data.byStatus.length ? data.byStatus : [];
    const approved = byStatus.find((r) => r.label === "Approved");
    const rejected = byStatus.find((r) => r.label === "Rejected");

    // cumulative trend
    let running = 0;
    const cumulative = (data.trend || []).map((r) => (running += r.count));

    viewArea.innerHTML = `
      <div class="analytics-hero">
        <div class="hero-ring" style="--pct:${turnoutPct}">
          <svg class="hero-ring-svg" viewBox="0 0 120 120">
            <defs>
              <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ff2d78"/>
                <stop offset="100%" stop-color="#a3003b"/>
              </linearGradient>
            </defs>
            <circle class="ring-track" cx="60" cy="60" r="52"></circle>
            <circle class="ring-fill" cx="60" cy="60" r="52"></circle>
          </svg>
          <div class="hero-ring-center">
            <div class="hero-ring-pct">${turnoutPct}%</div>
            <div class="hero-ring-caption">Turnout</div>
          </div>
        </div>
        <div class="hero-summary">
          <p class="hero-summary-title">Live Snapshot</p>
          <p class="hero-summary-text"><strong>${data.attended}</strong> of <strong>${data.total}</strong> registered buyers have checked in so far${data.notAttended ? `, with <strong>${data.notAttended}</strong> yet to arrive` : ""}.</p>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card"><div class="stat-card-icon">${ic('users')}</div><div class="num">${data.total}</div><div class="label">Total buyers</div></div>
        <div class="stat-card"><div class="stat-card-icon">${ic('checkCircle')}</div><div class="num">${data.attended}</div><div class="label">Checked In</div></div>
        <div class="stat-card"><div class="stat-card-icon">${ic('clock')}</div><div class="num">${data.notAttended}</div><div class="label">Yet to Arrive</div></div>
        <div class="stat-card"><div class="stat-card-icon">${ic('trendingUp')}</div><div class="num">${turnoutPct}%</div><div class="label">Turnout So Far</div></div>
        <div class="stat-card"><div class="stat-card-icon" style="color:#1e8e5a">${ic('dot')}</div><div class="num">${approved ? approved.count : 0}</div><div class="label">Approved</div></div>
        <div class="stat-card"><div class="stat-card-icon" style="color:#c0392b">${ic('dot')}</div><div class="num">${rejected ? rejected.count : 0}</div><div class="label">Rejected</div></div>
      </div>

      <div class="charts-grid">
        <div class="panel chart-card">
          <h3>${ic('target')} Check-in Progress</h3>
          <p class="chart-card-sub">Share of registered buyers who have checked in at the venue.</p>
          ${data.total ? `<div class="chart-wrap chart-wrap-sm"><canvas id="chkCheckin"></canvas></div>`
            : `<div class="empty-state">No data yet.</div>`}
        </div>

        <div class="panel chart-card">
          <h3>${ic('clipboard')} Registration Status</h3>
          <p class="chart-card-sub">How many registrations are approved, rejected, or still pending.</p>
          ${byStatus.length ? `<div class="chart-wrap chart-wrap-sm"><canvas id="chkStatus"></canvas></div>`
            : `<div class="empty-state">No data yet.</div>`}
        </div>

        <div class="panel chart-card chart-card-wide">
          <h3>${ic('trendingUp')} Registrations Over Time</h3>
          <p class="chart-card-sub">Daily sign-ups (solid line) against the running total (dashed line).</p>
          ${data.trend.length ? `<div class="chart-wrap"><canvas id="chkTrend"></canvas></div>`
            : `<div class="empty-state">No data yet.</div>`}
        </div>

        <div class="panel chart-card">
          <h3>${ic('tag')} By Buyer Type</h3>
          <p class="chart-card-sub">How registrations split across the three buyer categories.</p>
          ${data.byBuyerType.length ? `<div class="chart-wrap" style="height:${Math.max(180, data.byBuyerType.length * 42)}px"><canvas id="chkBuyerType"></canvas></div>`
            : `<div class="empty-state">No data yet.</div>`}
        </div>

        <div class="panel chart-card">
          <h3>${ic('globe')} Top Countries</h3>
          <p class="chart-card-sub">Countries buyers are travelling from, most first.</p>
          ${data.byCountry.length ? `<div class="chart-wrap" style="height:${Math.max(180, data.byCountry.length * 32)}px"><canvas id="chkCountry"></canvas></div>`
            : `<div class="empty-state">No data yet.</div>`}
        </div>

        <div class="panel chart-card">
          <h3>${ic('mapPin')} Top States</h3>
          <p class="chart-card-sub">Indian states sending the most registered buyers.</p>
          ${data.byState && data.byState.length ? `<div class="chart-wrap" style="height:${Math.max(180, data.byState.length * 32)}px"><canvas id="chkState"></canvas></div>`
            : `<div class="empty-state">No data yet.</div>`}
        </div>

        <div class="panel chart-card">
          <h3>${ic('megaphone')} How Buyers Heard About Us</h3>
          <p class="chart-card-sub">Which outreach channel brought each buyer to register.</p>
          ${data.byKnownThrough && data.byKnownThrough.length ? `<div class="chart-wrap" style="height:${Math.max(180, data.byKnownThrough.length * 32)}px"><canvas id="chkKnownThrough"></canvas></div>`
            : `<div class="empty-state">No data yet.</div>`}
        </div>
      </div>
    `;

    if (data.total) {
      makeDoughnut("chkCheckin", ["Checked In", "Yet to Arrive"], [data.attended, data.notAttended], ["#1e8e5a", "#fde6ee"], "checkin");
    }
    if (byStatus.length) {
      makeDoughnut("chkStatus", byStatus.map((r) => r.label),
        byStatus.map((r) => r.count),
        byStatus.map((r) => STATUS_COLORS[r.label] || "#7a6b7d"), "status");
    }
    if (data.trend.length) {
      makeLine("chkTrend", data.trend.map((r) => r.label), data.trend.map((r) => r.count), cumulative, "trend");
    }
    if (data.byBuyerType.length) {
      makeHBar("chkBuyerType", data.byBuyerType.map((r) => r.label), data.byBuyerType.map((r) => r.count), "buyerType", "#d3004c");
    }
    if (data.byCountry.length) {
      makeHBar("chkCountry", data.byCountry.map((r) => r.label), data.byCountry.map((r) => r.count), "country", "#3a4fb0");
    }
    if (data.byState && data.byState.length) {
      makeHBar("chkState", data.byState.map((r) => r.label), data.byState.map((r) => r.count), "state", "#1e8e5a");
    }
    if (data.byKnownThrough && data.byKnownThrough.length) {
      makeHBar("chkKnownThrough", data.byKnownThrough.map((r) => r.label), data.byKnownThrough.map((r) => r.count), "knownThrough", "#b3690a");
    }
  } catch (err) {
    viewArea.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
  }
}

// ---------------------------------------------------------------------
// Print History — audit trail of every badge print. Printing itself
// happens at the badge kiosk (ieml-badgedesk.vercel.app), never from
// this portal — a database trigger logs each print here automatically
// as soon as badgedesk updates print_count, so this page is purely a
// read-only view (with a "Clear History" action for the audit log only;
// it never touches any buyer's own print_count or checked-in status).
// ---------------------------------------------------------------------
const printHistoryState = { page: 1, pageSize: 25 };

async function renderPrintHistory() {
  pageTitle.textContent = "Print History";
  headerActions.innerHTML = `<button class="btn danger" id="clearHistoryBtn">${ic('trash')} Clear History</button>`;
  document.getElementById("clearHistoryBtn").addEventListener("click", async () => {
    if (!confirm("Clear the entire print history log? This only removes the audit trail — buyers keep their individual print counts and checked-in status. This cannot be undone.")) return;
    try {
      const r = await fetch("/api/print-history", { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not clear history.");
      printHistoryState.page = 1;
      renderPrintHistory();
    } catch (err) {
      alert(err.message);
    }
  });

  viewArea.innerHTML = `<div class="loading-state">Loading print history…</div>`;
  try {
    const [summary, historyRes] = await Promise.all([
      fetch("/api/print-history/summary").then((r) => r.json()),
      fetch(`/api/print-history?page=${printHistoryState.page}&pageSize=${printHistoryState.pageSize}`).then((r) => r.json()),
    ]);
    const maxDay = Math.max(1, ...summary.byDay.map((r) => r.count));
    const maxPage = Math.max(1, Math.ceil(historyRes.total / printHistoryState.pageSize));

    viewArea.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-card-icon">${ic('printer')}</div><div class="num">${summary.totalPrints}</div><div class="label">Total Badges Printed</div></div>
        <div class="stat-card"><div class="stat-card-icon">${ic('calendar')}</div><div class="num">${summary.todayPrints}</div><div class="label">Printed Today</div></div>
      </div>

      <div class="panel">
        <h3>${ic('barChart')} Prints per day (last 30 days with activity)</h3>
        ${summary.byDay.length ? summary.byDay.map((r) => `
          <div class="bar-row">
            <span class="bar-label">${esc(r.day)}</span>
            <span class="bar-track"><span class="bar-fill" style="width:${(r.count / maxDay) * 100}%"></span></span>
            <span class="bar-count">${r.count}</span>
          </div>`).join("") : `<div class="empty-state">No badges printed yet.</div>`}
      </div>

      <div class="panel">
        <h3>${ic('receipt')} Recent print events</h3>
        ${historyRes.rows.length ? `
          <div class="table-scroll">
            <table>
              <thead><tr><th>Printed At</th><th>URN</th><th>Name</th><th>Company</th></tr></thead>
              <tbody>
                ${historyRes.rows.map((r) => `
                  <tr>
                    <td>${fmtDate(r.printed_at)}</td>
                    <td>${esc(r.urn)}</td>
                    <td>${esc(r.full_name) || "—"}</td>
                    <td>${esc(r.company_name) || "—"}</td>
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>
          <div class="pager" style="margin-top:14px;">
            <button class="btn" id="phPrevPage" ${printHistoryState.page <= 1 ? "disabled" : ""}>← Prev</button>
            <span>Page ${historyRes.page} / ${maxPage}</span>
            <button class="btn" id="phNextPage" ${printHistoryState.page >= maxPage ? "disabled" : ""}>Next →</button>
          </div>
        ` : `<div class="empty-state">No print events yet.</div>`}
      </div>
    `;

    const prevBtn = document.getElementById("phPrevPage");
    const nextBtn = document.getElementById("phNextPage");
    if (prevBtn) prevBtn.addEventListener("click", () => { printHistoryState.page--; renderPrintHistory(); });
    if (nextBtn) nextBtn.addEventListener("click", () => { printHistoryState.page++; renderPrintHistory(); });
  } catch (err) {
    viewArea.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
  }
}

// ---------------------------------------------------------------------
// Danger Zone — permanently deletes every buyer registration. Guarded by
// TWO separate confirmations before the request even goes out:
//   1. Type the exact phrase into the text box (button stays disabled
//      until it matches character-for-character).
//   2. A second popup names exactly how many rows will be destroyed and
//      requires one more explicit click.
// The server independently re-checks the same phrase — see server.js.
// ---------------------------------------------------------------------
const DANGER_PHRASE = "DELETE ALL DATA";

async function renderDangerZone() {
  pageTitle.textContent = "Danger Zone";
  headerActions.innerHTML = "";
  viewArea.innerHTML = `<div class="loading-state">Loading…</div>`;

  let totalBuyers = 0;
  try {
    const buyersRes = await fetch("/api/buyers?pageSize=1").then((r) => r.json());
    totalBuyers = buyersRes.total ?? 0;
  } catch {
    // fall through with totalBuyers = 0 — the count is informational only
  }

  viewArea.innerHTML = `
    <div class="danger-panel">
      <h3>${ic('alertTriangle')} Delete ALL buyer registrations</h3>
      <p>
        This permanently deletes every row in the Buyers table — currently
        <strong>${totalBuyers}</strong> registration${totalBuyers === 1 ? "" : "s"} —
        along with their print history. Mart Owners are not affected.
        <strong>There is no undo.</strong>
      </p>
      <p>Type <code>${esc(DANGER_PHRASE)}</code> exactly to unlock the delete button:</p>
      <div class="danger-confirm-row">
        <input type="text" id="dangerPhraseInput" placeholder="${esc(DANGER_PHRASE)}" autocomplete="off" />
        <button class="btn danger" id="dangerDeleteBtn" disabled>Delete All Data</button>
      </div>
      <div class="modal-error" id="dangerZoneError" style="margin-top:10px;"></div>
    </div>
  `;

  const input = document.getElementById("dangerPhraseInput");
  const deleteBtn = document.getElementById("dangerDeleteBtn");
  const errorEl = document.getElementById("dangerZoneError");

  input.addEventListener("input", () => {
    deleteBtn.disabled = input.value !== DANGER_PHRASE;
  });

  deleteBtn.addEventListener("click", () => {
    errorEl.textContent = "";
    openDangerConfirmModal(
      `You are about to permanently delete all ${totalBuyers} buyer registration${totalBuyers === 1 ? "" : "s"} and their print history. This action cannot be reversed.`,
      async () => {
        const res = await fetch("/api/buyers/danger-zone/delete-all", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmationPhrase: DANGER_PHRASE }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not delete all data.");
        return data;
      },
      () => { renderDangerZone(); }
    );
  });
}

// Generic "final confirmation" popup used by the Danger Zone. `onConfirm`
// must return a Promise; `onDone` runs after a successful delete.
function openDangerConfirmModal(message, onConfirm, onDone) {
  const backdrop = document.getElementById("dangerConfirmModalBackdrop");
  const messageEl = document.getElementById("dangerConfirmMessage");
  const errorEl = document.getElementById("dangerConfirmError");
  const proceedBtn = document.getElementById("dangerConfirmProceed");
  const cancelBtn = document.getElementById("dangerConfirmCancel");
  messageEl.textContent = message;
  errorEl.textContent = "";
  proceedBtn.disabled = false;
  backdrop.classList.add("show");

  const cleanup = () => {
    backdrop.classList.remove("show");
    proceedBtn.removeEventListener("click", handleProceed);
    cancelBtn.removeEventListener("click", handleCancel);
  };
  const handleCancel = () => cleanup();
  const handleProceed = async () => {
    proceedBtn.disabled = true;
    errorEl.textContent = "";
    try {
      const result = await onConfirm();
      cleanup();
      alert(`Done. ${result.deletedCount ?? ""} row(s) deleted.`.trim());
      if (onDone) onDone();
    } catch (err) {
      errorEl.textContent = err.message;
      proceedBtn.disabled = false;
    }
  };
  proceedBtn.addEventListener("click", handleProceed);
  cancelBtn.addEventListener("click", handleCancel);
}

// ---------------------------------------------------------------------
// Schema check (debug helper) — no sidebar entry on purpose to keep the
// nav simple; open /api/schema-check directly in the browser (while
// signed in) if you ever need to double-check live column names.
// ---------------------------------------------------------------------

init();