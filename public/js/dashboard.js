// IEML Mart Sourcing Days — admin dashboard (vanilla JS, no build step).

const viewArea = document.getElementById("viewArea");
const pageTitle = document.getElementById("pageTitle");
const headerActions = document.getElementById("headerActions");
const navList = document.getElementById("navList");

let currentView = "overview";
let branding = {};

// ---- shared state per view ----
const buyersState = {
  page: 1, pageSize: 25, total: 0, rows: [],
  name: "", companyName: "", emailMobile: "", city: "", state: "", country: "",
  buyerType: "", attended: "", status: "",
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
  });

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
    const [buyersRes, ownersRes] = await Promise.all([
      fetch("/api/buyers?pageSize=1").then((r) => r.json()),
      fetch("/api/mart-owners?pageSize=1").then((r) => r.json()),
    ]);
    const analytics = await fetch("/api/analytics/buyers").then((r) => r.json());
    const printSummary = await fetch("/api/print-history/summary").then((r) => r.json()).catch(() => ({ totalPrints: 0, todayPrints: 0 }));
    viewArea.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="num">${buyersRes.total ?? 0}</div><div class="label">Total Registered Buyers</div></div>
        <div class="stat-card"><div class="num">${analytics.attended ?? 0}</div><div class="label">Checked In at Mart</div></div>
        <div class="stat-card"><div class="num">${analytics.notAttended ?? 0}</div><div class="label">Yet to Arrive</div></div>
        <div class="stat-card"><div class="num">${ownersRes.total ?? 0}</div><div class="label">Mart Owners on File</div></div>
        <div class="stat-card"><div class="num">${printSummary.totalPrints ?? 0}</div><div class="label">Total Badges Printed</div></div>
        <div class="stat-card"><div class="num">${printSummary.todayPrints ?? 0}</div><div class="label">Printed Today</div></div>
      </div>
      <div class="panel">
        <h3>Quick links</h3>
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
  buyerType: "Buyer Type", attended: "Checked In",
};
const CHIP_INPUT_IDS = {
  name: "fName", companyName: "fCompanyName", emailMobile: "fEmailMobile",
  city: "fCity", state: "fState", country: "fCountry",
  buyerType: "fBuyerType", attended: "fAttended",
};
const VISITOR_FIELD_LABELS = {
  urn: "URN", fullName: "Full Name", companyName: "Company Name", designation: "Designation",
  buyerType: "Buyer Type", email: "Email", phone: "Phone", address: "Address",
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
  headerActions.innerHTML = `<button class="btn" id="exportBtn">⬇ Export CSV</button>`;
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
        <button class="clear-all-btn" id="clearAllFilters">🗑 Clear</button>
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
    return `<span class="filter-chip"><b>${esc(CHIP_FIELDS[k])}:</b> ${esc(displayVal)} <button data-clear="${k}" title="Remove">✕</button></span>`;
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
                    <button class="action-btn view" title="View" data-view="${esc(row.id)}">👁</button>
                    <button class="action-btn edit" title="Edit" data-edit="${esc(row.id)}">✏️</button>
                    <button class="action-btn print" title="Print Badge (auto checks-in)" data-print="${esc(row.id)}">🖨️</button>
                    <button class="action-btn approve" title="Approve" data-approve="${esc(row.id)}">✔️</button>
                    <button class="action-btn reject" title="Reject" data-reject="${esc(row.id)}">✖️</button>
                    <button class="action-btn delete" title="Delete" data-delete="${esc(row.id)}">🗑️</button>
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
      area.querySelectorAll("[data-print]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const row = buyersState.rows.find((r) => String(r.id) === btn.dataset.print);
          const name = row ? row.fullName : "this buyer";
          if (!confirm(`Print badge for ${name}? This will also mark them as checked-in.`)) return;
          btn.disabled = true;
          try {
            const r = await fetch(`/api/buyers/${btn.dataset.print}/print`, { method: "POST" });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Could not print badge.");
            loadbuyers();
          } catch (err) {
            alert(err.message);
            btn.disabled = false;
          }
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
      "urn", "fullName", "companyName", "designation", "buyerType", "email", "phone",
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
// Mart Owners
// ---------------------------------------------------------------------
function renderOwners() {
  pageTitle.textContent = "Mart Owners";
  headerActions.innerHTML = `
    <button class="btn" id="exportOwnersBtn">⬇ Export CSV</button>
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
async function renderAnalytics() {
  pageTitle.textContent = "Analytics";
  viewArea.innerHTML = `<div class="loading-state">Loading analytics…</div>`;
  try {
    const data = await fetch("/api/analytics/buyers").then((r) => r.json());
    const maxBuyer = Math.max(1, ...data.byBuyerType.map((r) => r.count));
    const maxCountry = Math.max(1, ...data.byCountry.map((r) => r.count));

    viewArea.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="num">${data.total}</div><div class="label">Total buyers</div></div>
        <div class="stat-card"><div class="num">${data.attended}</div><div class="label">Checked In</div></div>
        <div class="stat-card"><div class="num">${data.notAttended}</div><div class="label">Not Yet Checked In</div></div>
        <div class="stat-card"><div class="num">${data.total ? Math.round((data.attended / data.total) * 100) : 0}%</div><div class="label">Turnout So Far</div></div>
      </div>

      <div class="panel">
        <h3>By Buyer Type</h3>
        ${data.byBuyerType.length ? data.byBuyerType.map((r) => `
          <div class="bar-row">
            <span class="bar-label">${esc(r.label)}</span>
            <span class="bar-track"><span class="bar-fill" style="width:${(r.count / maxBuyer) * 100}%"></span></span>
            <span class="bar-count">${r.count}</span>
          </div>`).join("") : `<div class="empty-state">No data yet.</div>`}
      </div>

      <div class="panel">
        <h3>Top Countries</h3>
        ${data.byCountry.length ? data.byCountry.map((r) => `
          <div class="bar-row">
            <span class="bar-label">${esc(r.label)}</span>
            <span class="bar-track"><span class="bar-fill" style="width:${(r.count / maxCountry) * 100}%"></span></span>
            <span class="bar-count">${r.count}</span>
          </div>`).join("") : `<div class="empty-state">No data yet.</div>`}
      </div>

      <div class="panel">
        <h3>Registrations Over Time</h3>
        ${data.trend.length ? `<div class="table-scroll"><table><thead><tr><th>Date</th><th>Registrations</th></tr></thead><tbody>
          ${data.trend.map((r) => `<tr><td>${esc(r.label)}</td><td>${r.count}</td></tr>`).join("")}
        </tbody></table></div>` : `<div class="empty-state">No data yet.</div>`}
      </div>
    `;
  } catch (err) {
    viewArea.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
  }
}

// ---------------------------------------------------------------------
// Print History — audit trail of every "Print Badge" click, with
// day-wise counts (bar chart, same pattern as Analytics) and a
// "Clear History" action. Clearing this log never touches any buyer's
// own print_count or checked-in status — it's purely the audit trail.
// ---------------------------------------------------------------------
const printHistoryState = { page: 1, pageSize: 25 };

async function renderPrintHistory() {
  pageTitle.textContent = "Print History";
  headerActions.innerHTML = `<button class="btn danger" id="clearHistoryBtn">🗑️ Clear History</button>`;
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
        <div class="stat-card"><div class="num">${summary.totalPrints}</div><div class="label">Total Badges Printed</div></div>
        <div class="stat-card"><div class="num">${summary.todayPrints}</div><div class="label">Printed Today</div></div>
      </div>

      <div class="panel">
        <h3>Prints per day (last 30 days with activity)</h3>
        ${summary.byDay.length ? summary.byDay.map((r) => `
          <div class="bar-row">
            <span class="bar-label">${esc(r.day)}</span>
            <span class="bar-track"><span class="bar-fill" style="width:${(r.count / maxDay) * 100}%"></span></span>
            <span class="bar-count">${r.count}</span>
          </div>`).join("") : `<div class="empty-state">No badges printed yet.</div>`}
      </div>

      <div class="panel">
        <h3>Recent print events</h3>
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
      <h3>⚠️ Delete ALL buyer registrations</h3>
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