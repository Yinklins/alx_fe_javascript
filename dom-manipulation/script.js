// ---- Keys ----
const LS_QUOTES_KEY = "quotes";
const LS_CATEGORY_FILTER = "lastCategoryFilter";
const SS_LAST_QUOTE_KEY = "lastViewedQuote";

// ---- Helpers ----
function loadQuotes() {
  try {
    const raw = localStorage.getItem(LS_QUOTES_KEY);
    if (!raw) return getDefaultQuotes();
    const parsed = JSON.parse(raw);
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

// ---- State ----
let quotes = loadQuotes();

// ---- DOM ----
const quoteDisplay = document.getElementById("quoteDisplay");
const newQuoteBtn = document.getElementById("newQuote");
const exportBtn = document.getElementById("exportBtn");
const categoryFilter = document.getElementById("categoryFilter");

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

// ---- Random Quote ----
function showRandomQuote() {
  const selectedCategory = categoryFilter.value; // ✅ renamed
  const filtered = selectedCategory === "all"
    ? quotes
    : quotes.filter(q => q.category.toLowerCase() === selectedCategory.toLowerCase());

  if (filtered.length === 0) {
    quoteDisplay.textContent = "No quotes available in this category.";
    return;
  }

  const idx = Math.floor(Math.random() * filtered.length);
  renderQuote(filtered[idx]);

  // Save last viewed in Session
  sessionStorage.setItem(SS_LAST_QUOTE_KEY, JSON.stringify(filtered[idx]));
}

// ---- Populate Categories ----
function populateCategories() {
  const uniqueCategories = [...new Set(quotes.map(q => q.category))];

  // Clear existing except "all"
  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;

  uniqueCategories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });

  // Restore last selected filter from Local Storage
  const savedFilter = localStorage.getItem(LS_CATEGORY_FILTER) || "all";
  categoryFilter.value = savedFilter;
}

// ---- Filter Quotes ----
function filterQuotes() {
  const selectedCategory = categoryFilter.value; // ✅ renamed
  localStorage.setItem(LS_CATEGORY_FILTER, selectedCategory);
  showRandomQuote();
}

// ---- Add Quote Form ----
function createAddQuoteForm() {
  const form = document.createElement("form");
  form.style.marginTop = "16px";

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

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const newQuote = { text: quoteInput.value.trim(), category: categoryInput.value.trim() };
    if (!isValidQuote(newQuote)) return;

    quotes.push(newQuote);
    saveQuotes();
    populateCategories(); // update dropdown if new category introduced
    alert("New quote added!");
    quoteInput.value = "";
    categoryInput.value = "";
    filterQuotes(); // refresh display
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

      const valid = imported.filter(isValidQuote);
      quotes.push(...valid);
      saveQuotes();
      populateCategories();
      alert(`Imported ${valid.length} quotes`);
      filterQuotes();
    } catch {
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
}

// ---- Events ----
newQuoteBtn.addEventListener("click", showRandomQuote);
exportBtn.addEventListener("click", exportToJsonFile);
window.importFromJsonFile = importFromJsonFile;

// ---- Init ----
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
});
