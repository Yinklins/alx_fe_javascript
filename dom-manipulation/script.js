// ---- Keys ----
const LS_QUOTES_KEY = "quotes";
const LS_CATEGORY_FILTER = "lastCategoryFilter";
const SS_LAST_QUOTE_KEY = "lastViewedQuote";

// ---- Server Simulation ----
const SERVER_URL = "https://jsonplaceholder.typicode.com/posts"; // simulate quotes API
const SYNC_INTERVAL = 15000; // 15s sync

// ---- Conflict bookkeeping (for manual review) ----
let LAST_SYNC_CONFLICTS = [];     // [{local, server}]
let PRE_MERGE_QUOTES_SNAPSHOT = []; // snapshot before auto-merge (to allow "keep local")

// ---- Helpers ----
function loadQuotes() {
  try {
    const raw = localStorage.getItem(LS_QUOTES_KEY);
    if (!raw) return getDefaultQuotes();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return getDefaultQuotes();

    // Backfill minimal shape (id, lastModified, source)
    return parsed
      .filter(isValidQuote)
      .map(q => ({
        id: q.id || makeLocalId(),
        text: q.text.trim(),
        category: q.category.trim(),
        source: q.source || "local",
        lastModified: q.lastModified || Date.now()
      }));
  } catch {
    return getDefaultQuotes();
  }
}
function saveQuotes() {
  localStorage.setItem(LS_QUOTES_KEY, JSON.stringify(quotes));
}
function getDefaultQuotes() {
  const now = Date.now();
  return [
    { id: makeLocalId(), text: "The best way to get started is to quit talking and begin doing.", category: "Motivation", source: "local", lastModified: now },
    { id: makeLocalId(), text: "Don’t let yesterday take up too much of today.", category: "Inspiration", source: "local", lastModified: now },
    { id: makeLocalId(), text: "It’s not whether you get knocked down, it’s whether you get up.", category: "Resilience", source: "local", lastModified: now },
  ];
}
function isValidQuote(q) {
  return q && typeof q.text === "string" && q.text.trim() !== "" &&
         typeof q.category === "string" && q.category.trim() !== "";
}
function makeLocalId() {
  return `local-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

// ---- State ----
let quotes = loadQuotes();

// ---- DOM ----
const quoteDisplay = document.getElementById("quoteDisplay");
const newQuoteBtn = document.getElementById("newQuote");
const exportBtn = document.getElementById("exportBtn");
const categoryFilter = document.getElementById("categoryFilter");

// Ensure supporting UI exists (Sync button, notifications, conflict panel)
ensureSyncUI();

// ---- Render Quote ----
function renderQuote(q) {
  quoteDisplay.innerHTML = "";
  const p = document.createElement("p");
  p.textContent = `"${q.text}"`;
  const small = document.createElement("small");
  small.textContent = `Category: ${q.category}`;
  quoteDisplay.appendChild(p);
  quoteDisplay.appendChild(small);
}

// ---- Random Quote (respects category filter) ----
function showRandomQuote() {
  const selectedCategory = categoryFilter.value;
  const filtered = selectedCategory === "all"
    ? quotes
    : quotes.filter(q => q.category.toLowerCase() === selectedCategory.toLowerCase());

  if (filtered.length === 0) {
    quoteDisplay.textContent = "No quotes available in this category.";
    return;
  }

  const idx = Math.floor(Math.random() * filtered.length);
  renderQuote(filtered[idx]);

  // session preference: last viewed quote
  sessionStorage.setItem(SS_LAST_QUOTE_KEY, JSON.stringify(filtered[idx]));
}

// ---- Populate Categories ----
function populateCategories() {
  const uniqueCategories = [...new Set(quotes.map(q => q.category))];
  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
  uniqueCategories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });

  const savedFilter = localStorage.getItem(LS_CATEGORY_FILTER) || "all";
  categoryFilter.value = savedFilter;
}

// ---- Filter Quotes ----
function filterQuotes() {
  const selectedCategory = categoryFilter.value;
  localStorage.setItem(LS_CATEGORY_FILTER, selectedCategory);
  showRandomQuote();
}

// ---- Add Quote Form ----
function createAddQuoteForm() {
  const form = document.createElement("form");
  form.style.marginTop = "16px";
  form.id = "addQuoteForm";

  const quoteInput = document.createElement("input");
  quoteInput.type = "text";
  quoteInput.placeholder = "Enter a new quote";
  quoteInput.required = true;

  const categoryInput = document.createElement("input");
  categoryInput.type = "text";
  categoryInput.placeholder = "Enter category";
  categoryInput.required = true;

  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.textContent = "Add Quote";

  form.appendChild(quoteInput);
  form.appendChild(categoryInput);
  form.appendChild(submitBtn);
  document.body.appendChild(form);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newQuote = {
      id: makeLocalId(),
      text: quoteInput.value.trim(),
      category: categoryInput.value.trim(),
      source: "local",
      lastModified: Date.now()
    };
    if (!isValidQuote(newQuote)) return;

    quotes.push(newQuote);
    saveQuotes();
    populateCategories();
    notify("New quote added locally!");

    // Simulate sending to server (best-effort)
    try {
      await pushQuoteToServer(newQuote);
      notify("Quote sent to server (simulated).");
    } catch {
      // still fine: it stays local; can be retried in real app
      notify("Could not sync new quote to server (simulated).");
    }

    quoteInput.value = "";
    categoryInput.value = "";
    filterQuotes();
  });
}

// ---- Export JSON ----
function exportToJsonFile() {
  const data = JSON.stringify(quotes, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quotes.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---- Import JSON ----
function importFromJsonFile(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!Array.isArray(imported)) throw new Error();

      const valid = imported.filter(isValidQuote).map(q => ({
        id: q.id || makeLocalId(),
        text: q.text.trim(),
        category: q.category.trim(),
        source: q.source || "local",
        lastModified: q.lastModified || Date.now()
      }));

      // Deduplicate by (text, category)
      const existing = new Set(quotes.map(q => `${q.text}||${q.category}`));
      const toAdd = valid.filter(q => !existing.has(`${q.text}||${q.category}`));

      quotes.push(...toAdd);
      saveQuotes();
      populateCategories();
      notify(`Imported ${toAdd.length} quote(s).`);
      filterQuotes();
    } catch {
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
}

// ===============================
// ========== SERVER =============
// ===============================

// ---- Fetch Quotes from Server ----
async function fetchQuotesFromServer(limit = 5) {
  try {
    const res = await fetch(SERVER_URL + `?_limit=${limit}`);
    if (!res.ok) throw new Error("Failed to fetch server quotes");
    const serverData = await res.json();

    // Convert posts -> quotes format
    // Use synthetic ids with srv- prefix
    const now = Date.now();
    return serverData.map(post => ({
      id: `srv-${post.id}`,
      text: String(post.title || "").trim(),
      category: "Server",
      source: "server",
      lastModified: now // JSONPlaceholder doesn't give timestamps, so simulate
    })).filter(isValidQuote);
  } catch (err) {
    console.warn("fetchQuotesFromServer error:", err.message);
    return [];
  }
}

// ---- Push a new quote to the Server (simulated) ----
async function pushQuoteToServer(quote) {
  // We only send minimal data; JSONPlaceholder ignores extra fields
  const payload = { title: quote.text, body: quote.category };
  const res = await fetch(SERVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Failed to push quote to server");
  const out = await res.json(); // typically returns { id: 101 } etc.
  return out;
}

// ---- Merge with conflicts (server precedence) ----
function mergeWithServer(serverQuotes) {
  LAST_SYNC_CONFLICTS = [];
  PRE_MERGE_QUOTES_SNAPSHOT = JSON.parse(JSON.stringify(quotes)); // deep-ish copy

  // Index local by 'text' (case-insensitive) for simple conflict simulation
  const localByKey = new Map();
  quotes.forEach(q => localByKey.set(q.text.toLowerCase(), q));

  const merged = [...quotes];
  let changed = false;

  serverQuotes.forEach(sq => {
    const key = sq.text.toLowerCase();
    const local = localByKey.get(key);

    if (!local) {
      // new from server
      merged.push(sq);
      localByKey.set(key, sq);
      changed = true;
      return;
    }

    // If something differs (e.g., category/source), treat as conflict
    const differs = (local.category !== sq.category) || (local.source !== sq.source);
    if (differs) {
      LAST_SYNC_CONFLICTS.push({ local, server: sq });
      // Auto-resolution: server wins (default)
      const idx = merged.findIndex(m => m.id === local.id);
      if (idx !== -1) {
        merged[idx] = sq;
      } else {
        // fallback by text match
        const idxByText = merged.findIndex(m => m.text.toLowerCase() === key);
        if (idxByText !== -1) merged[idxByText] = sq;
      }
      changed = true;
    }
  });

  return { merged, changed, hadConflicts: LAST_SYNC_CONFLICTS.length > 0 };
}

// ---- Sync Orchestrator ----
async function syncWithServer() {
  const serverQuotes = await fetchQuotesFromServer(8);
  if (serverQuotes.length === 0) {
    notify("Server sync skipped (no server data).");
    return;
  }

  const { merged, changed, hadConflicts } = mergeWithServer(serverQuotes);

  if (changed) {
    quotes = merged;
    saveQuotes();
    populateCategories();
    filterQuotes();

    if (hadConflicts) {
      notify("Sync: conflicts detected — server version applied.");
      showConflictBanner(); // allow user to manually override
    } else {
      notify("Quotes synced with server (no conflicts).");
    }
  } else {
    notify("Already up to date.");
  }
}

// ===============================
// ======= UI / NOTIFICATIONS =====
// ===============================
function ensureSyncUI() {
  // Sync controls bar
  let bar = document.getElementById("syncBar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "syncBar";
    bar.style.display = "flex";
    bar.style.gap = "8px";
    bar.style.margin = "10px 0";
    document.body.insertBefore(bar, document.body.firstChild);
  }

  // Sync Now button
  if (!document.getElementById("syncNowBtn")) {
    const btn = document.createElement("button");
    btn.id = "syncNowBtn";
    btn.textContent = "Sync Now";
    btn.addEventListener("click", () => {
      syncWithServer();
    });
    bar.appendChild(btn);
  }

  // Import input (if not present in HTML)
  if (!document.getElementById("importFile")) {
    const file = document.createElement("input");
    file.type = "file";
    file.id = "importFile";
    file.accept = ".json";
    file.style.marginLeft = "4px";
    file.addEventListener("change", importFromJsonFile);
    bar.appendChild(file);
  }

  // Notification area
  if (!document.getElementById("notificationBox")) {
    const box = document.createElement("div");
    box.id = "notificationBox";
    box.style.position = "fixed";
    box.style.bottom = "10px";
    box.style.right = "10px";
    box.style.minWidth = "220px";
    box.style.maxWidth = "320px";
    box.style.padding = "10px";
    box.style.background = "rgba(40,40,40,.95)";
    box.style.color = "#fff";
    box.style.borderRadius = "8px";
    box.style.boxShadow = "0 2px 10px rgba(0,0,0,.2)";
    box.style.fontSize = "14px";
    box.style.display = "none";
    document.body.appendChild(box);
  }

  // Conflict panel container
  if (!document.getElementById("conflictPanel")) {
    const panel = document.createElement("div");
    panel.id = "conflictPanel";
    panel.style.position = "fixed";
    panel.style.left = "50%";
    panel.style.top = "50%";
    panel.style.transform = "translate(-50%,-50%)";
    panel.style.background = "#fff";
    panel.style.color = "#222";
    panel.style.width = "min(640px, 90vw)";
    panel.style.maxHeight = "70vh";
    panel.style.overflow = "auto";
    panel.style.padding = "16px";
    panel.style.border = "1px solid #ddd";
    panel.style.borderRadius = "10px";
    panel.style.boxShadow = "0 10px 30px rgba(0,0,0,.2)";
    panel.style.display = "none";
    panel.style.zIndex = "9999";
    document.body.appendChild(panel);
  }
}

function notify(message) {
  const box = document.getElementById("notificationBox");
  if (!box) return;
  box.textContent = message;
  box.style.display = "block";
  setTimeout(() => { box.style.display = "none"; }, 3500);
}

// Banner offering manual conflict resolution
function showConflictBanner() {
  const box = document.getElementById("notificationBox");
  if (!box) return;
  box.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      <strong>Conflicts resolved (server won).</strong>
      <div>Review and choose manually?</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="reviewConflictsBtn" style="padding:6px 10px">Review Conflicts</button>
        <button id="dismissConflictsBtn" style="padding:6px 10px">Dismiss</button>
      </div>
    </div>`;
  box.style.display = "block";

  document.getElementById("reviewConflictsBtn").onclick = openConflictPanel;
  document.getElementById("dismissConflictsBtn").onclick = () => { box.style.display = "none"; };
}

function openConflictPanel() {
  const panel = document.getElementById("conflictPanel");
  if (!panel) return;

  if (LAST_SYNC_CONFLICTS.length === 0) {
    panel.innerHTML = `<h3>No conflicts to review</h3>
      <div style="text-align:right"><button onclick="closeConflictPanel()">Close</button></div>`;
    panel.style.display = "block";
    return;
  }

  const items = LAST_SYNC_CONFLICTS.map(({ local, server }, i) => `
    <li style="margin-bottom:10px">
      <div><strong>${local.text}</strong></div>
      <div style="font-size:12px;color:#666">
        Local: <em>${local.category}</em> | Server: <em>${server.category}</em>
      </div>
    </li>
  `).join("");

  panel.innerHTML = `
    <h3 style="margin-top:0">Resolve Conflicts</h3>
    <p>Choose which side to keep for all conflicts:</p>
    <ul style="list-style:disc;padding-left:18px">${items}</ul>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button id="keepServerAllBtn">Keep Server for All</button>
      <button id="keepLocalAllBtn">Keep Local for All</button>
      <button id="closeConflictBtn">Close</button>
    </div>
  `;
  panel.style.display = "block";

  document.getElementById("keepServerAllBtn").onclick = () => {
    // Already applied; just confirm & close
    notify("Server versions kept.");
    closeConflictPanel();
  };
  document.getElementById("keepLocalAllBtn").onclick = () => {
    // Revert to PRE_MERGE for the conflicting items
    const preByText = new Map(PRE_MERGE_QUOTES_SNAPSHOT.map(q => [q.text.toLowerCase(), q]));
    quotes = quotes.map(q => {
      const c = LAST_SYNC_CONFLICTS.find(cf => cf.server.text.toLowerCase() === q.text.toLowerCase());
      if (c) {
        // replace with original local version
        return preByText.get(q.text.toLowerCase()) || q;
      }
      return q;
    });
    saveQuotes();
    populateCategories();
    filterQuotes();
    notify("Local versions restored for all conflicts.");
    closeConflictPanel();
  };
  document.getElementById("closeConflictBtn").onclick = closeConflictPanel;
}
function closeConflictPanel() {
  const panel = document.getElementById("conflictPanel");
  if (panel) panel.style.display = "none";
}

// ===============================
// ===== Events & App Init =======
// ===============================
newQuoteBtn && newQuoteBtn.addEventListener("click", showRandomQuote);
exportBtn && exportBtn.addEventListener("click", exportToJsonFile);
// If your HTML wired the file input inline, this keeps it working:
window.importFromJsonFile = importFromJsonFile;

window.addEventListener("DOMContentLoaded", () => {
  populateCategories();

  // Restore last viewed from Session, else show random
  const last = sessionStorage.getItem(SS_LAST_QUOTE_KEY);
  if (last) {
    try {
      renderQuote(JSON.parse(last));
    } catch {
      showRandomQuote();
    }
  } else {
    showRandomQuote();
  }

  createAddQuoteForm();

  // Start syncing periodically + initial sync
  syncWithServer();
  setInterval(syncWithServer, SYNC_INTERVAL);
});
