// ---- Fetch Quotes from Server ----
async function fetchQuotesFromServer(limit = 5) {
  try {
    const res = await fetch(SERVER_URL + `?_limit=${limit}`);
    if (!res.ok) throw new Error("Failed to fetch server quotes");

    const serverData = await res.json();
    // Convert posts -> quotes format
    return serverData.map(post => ({
      text: post.title,
      category: "Server"
    }));
  } catch (err) {
    console.warn("fetchQuotesFromServer error:", err.message);
    return [];
  }
}

// ---- Server Sync ----
async function syncWithServer() {
  const serverQuotes = await fetchQuotesFromServer(5);

  // ---- Conflict resolution: server overrides duplicates ----
  const merged = [...quotes];
  serverQuotes.forEach(sq => {
    const exists = merged.some(lq => lq.text === sq.text);
    if (!exists) merged.push(sq);
  });

  if (merged.length !== quotes.length) {
    quotes = merged;
    saveQuotes();
    populateCategories();
    filterQuotes();
    showNotification("Quotes synced with server. New quotes added!");
  }
}
