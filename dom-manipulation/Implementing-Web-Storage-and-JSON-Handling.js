// ---- Storage Keys ----
const LS_QUOTES_KEY = "quotes";
const SS_LAST_QUOTE_KEY = "lastViewedQuote";

// ---- Load & Save Helpers (Local Storage) ----
function loadQuotes() {
  try {
    const raw = localStorage.getItem(LS_QUOTES_KEY);
    if (!raw) return getDefaultQuotes();
    const parsed = JSON.parse(raw);
    // Validate: must be an array of {text, category}
    if (!Array.isArray(parsed)) return getDefaultQuotes();
    return parsed.filter(isValidQuote);
  } catch {
    return getDefaultQuotes();
  }
}

function saveQuotes() {
  localStorage.setItem(LS_QUOTES_KEY, JSON.stringify(quotes));
}

function getDefaultQuotes() {
  return [
    { text: "The best way to get started is to quit talking and begin doing.", category: "Motivation" },
    { text: "Don’t let yesterday take up too much of today.", category: "Inspiration" },
    { text: "It’s not whether you get knocked down, it’s whether you get up.", category: "Resilience" },
  ];
}

function isValidQuote(q) {
  return q && typeof q.text === "string" && q.text.trim() !== "" &&
         typeof q.category === "string" && q.category.trim() !== "";
}

// ---- App State ----
let quotes = loadQuotes();

// ---- DOM ----
const quoteDisplay = document.getElementById("quoteDisplay");
const newQuoteBtn = document.getElementById("newQuote");
const exportBtn = document.getElementById("exportBtn");

// ---- Render / Actions ----
function showRandomQuote() {
  if (quotes.length === 0) {
    quoteDisplay.textContent = "No quotes available.";
    sessionStorage.removeItem(SS_LAST_QUOTE_KEY);
    return;
  }
  const idx = Math.floor(Math.random() * quotes.length);
  renderQuote(quotes[idx]);
  // Save last viewed quote (Session Storage)
  sessionStorage.setItem(SS_LAST_QUOTE_KEY, JSON.stringify(quotes[idx]));
}

function renderQuote(q) {
  quoteDisplay.innerHTML = "";
  const p = document.createElement("p");
  p.textContent = `"${q.text}"`;
  const small = document.createElement("small");
  small.textContent = `Category: ${q.category}`;
  quoteDisplay.appendChild(p);
  quoteDisplay.appendChild(small);
}

// Create a form dynamically to add quotes
function createAddQuoteForm() {
  const form = document.createElement("form");
  form.style.marginTop = "16px";

  const quoteInput = document.createElement("input");
  quoteInput.type = "text";
  quoteInput.placeholder = "Enter a new quote";
  quoteInput.required = true;
  quoteInput.style.marginRight = "8px";

  const categoryInput = document.createElement("input");
  categoryInput.type = "text";
  categoryInput.placeholder = "Enter category";
  categoryInput.required = true;
  categoryInput.style.marginRight = "8px";

  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.textContent = "Add Quote";

  form.appendChild(quoteInput);
  form.appendChild(categoryInput);
  form.appendChild(submitBtn);
  document.body.appendChild(form);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const newQuote = {
      text: quoteInput.value.trim(),
      category: categoryInput.value.trim(),
    };
    if (!isValidQuote(newQuote)) return;

    quotes.push(newQuote);
    saveQuotes(); // persist to Local Storage
    // Optional: show the newly added immediately
    renderQuote(newQuote);
    sessionStorage.setItem(SS_LAST_QUOTE_KEY, JSON.stringify(newQuote));

    quoteInput.value = "";
    categoryInput.value = "";
    quoteInput.focus();
  });
}

// ---- Export (JSON) ----
function exportToJsonFile() {
  const data = JSON.stringify(quotes, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `quotes-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---- Import (JSON) ----
// Connected via inline onchange in index.html
function importFromJsonFile(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);

      if (!Array.isArray(imported)) {
        alert("Invalid file: root must be an array of quotes.");
        return;
      }

      // Sanitize, validate, and merge (avoid exact duplicates)
      const cleaned = imported
        .filter(isValidQuote)
        .map(q => ({ text: q.text.trim(), category: q.category.trim() }));

      // Make a Set of existing "text||category" pairs for dedupe
      const existing = new Set(quotes.map(q => `${q.text}||${q.category}`));
      const toAdd = cleaned.filter(q => !existing.has(`${q.text}||${q.category}`));

      if (toAdd.length === 0) {
        alert("No new quotes to import (all duplicates or invalid).");
        return;
      }

      quotes.push(...toAdd);
      saveQuotes();
      alert(`Quotes imported successfully! Added ${toAdd.length}.`);

      // Optionally show one of the imported quotes
      renderQuote(toAdd[0]);
      sessionStorage.setItem(SS_LAST_QUOTE_KEY, JSON.stringify(toAdd[0]));
    } catch (err) {
      alert("Failed to import: invalid JSON.");
    } finally {
      // reset input so the same file can be imported again if needed
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

// ---- Events & Init ----
newQuoteBtn.addEventListener("click", showRandomQuote);
exportBtn.addEventListener("click", exportToJsonFile);

window.addEventListener("DOMContentLoaded", () => {
  // If session has a last viewed quote, show it; otherwise random
  const last = sessionStorage.getItem(SS_LAST_QUOTE_KEY);
  if (last) {
    try {
      const q = JSON.parse(last);
      if (isValidQuote(q)) {
        renderQuote(q);
      } else {
        showRandomQuote();
      }
    } catch {
      showRandomQuote();
    }
  } else {
    showRandomQuote();
  }
  createAddQuoteForm();
});

// Expose import handler globally for inline onchange
window.importFromJsonFile = importFromJsonFile;
