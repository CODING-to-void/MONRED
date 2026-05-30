const API_ROOT = "https://librivox.org/api/feed/audiobooks";
const RECENT_KEY = "monred_recent_searches";

const state = {
  mode: "title",
  books: [],
  filteredBooks: [],
  lastQuery: "",
  lastRawQuery: "",
};

const dom = {
  searchForm: document.querySelector("#searchForm"),
  searchInput: document.querySelector("#searchInput"),
  featuredCard: document.querySelector("#featuredCard"),
  featuredRail: document.querySelector("#featuredRail"),
  resultsGrid: document.querySelector("#resultsGrid"),
  resultsHeading: document.querySelector("#resultsHeading"),
  statusBanner: document.querySelector("#statusBanner"),
  browseModes: [...document.querySelectorAll("#browseModes [data-mode]")],
  searchModes: [...document.querySelectorAll("#searchModes [data-mode]")],
  loadLatestButton: document.querySelector("#loadLatestButton"),
  resultMeta: document.querySelector("#resultMeta"),
  recentSearches: document.querySelector("#recentSearches"),
  trendingGenres: document.querySelector("#trendingGenres"),
  searchPanel: document.querySelector("#searchPanel"),
};

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `monredCallback_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const script = document.createElement("script");
    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Unable to reach the MONRED catalog from this page."));
    };

    script.src = `${url}${url.includes("?") ? "&" : "?"}format=jsonp&callback=${callbackName}`;
    document.body.append(script);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function parseDuration(value) {
  const parts = String(value || "0:0:0").split(":").map(Number);
  while (parts.length < 3) {
    parts.unshift(0);
  }
  const [hours, minutes, seconds] = parts;
  return hours * 3600 + minutes * 60 + seconds;
}

function getSections(book) {
  return Array.isArray(book.sections) ? book.sections : [];
}

function buildAuthor(book) {
  const authors = Array.isArray(book.authors) ? book.authors : [];
  if (!authors.length) {
    return "Unknown author";
  }

  return authors
    .map((author) => `${author.first_name || ""} ${author.last_name || ""}`.trim())
    .filter(Boolean)
    .join(", ");
}

function getReaderNames(book) {
  const names = new Set();

  getSections(book).forEach((section) => {
    if (Array.isArray(section.readers)) {
      section.readers.forEach((reader) => {
        const name =
          typeof reader === "string"
            ? reader
            : `${reader?.display_name || ""}` ||
              `${reader?.first_name || ""} ${reader?.last_name || ""}`.trim();
        if (name.trim()) {
          names.add(name.trim());
        }
      });
    }

    [section.reader_name, section.reader, section.display_name, section.name]
      .filter(Boolean)
      .forEach((name) => names.add(String(name).trim()));
  });

  return [...names];
}

function summarizeReaders(book, maxNames = 2) {
  const readers = getReaderNames(book);
  if (!readers.length) {
    return "Volunteer narration";
  }

  if (readers.length <= maxNames) {
    return readers.join(", ");
  }

  return `${readers.slice(0, maxNames).join(", ")} +${readers.length - maxNames} more`;
}

function getLanguage(book) {
  const language = Array.isArray(book.language) ? book.language[0] : book.language;
  return language || "Unknown";
}

function getCover(book) {
  if (book.url_cover_art || book.url_coverart || book.url_cover) {
    return book.url_cover_art || book.url_coverart || book.url_cover || "";
  }

  const archiveUrl = String(book.url_iarchive || "");
  const identifier = archiveUrl.split("/").filter(Boolean).pop();
  return identifier ? `https://archive.org/services/img/${identifier}` : "";
}

function buildVersionLabel(book) {
  const match = String(book.title || "").match(/\(Version\s*([^)]+)\)/i);
  return match ? `Version ${match[1]}` : "Original recording";
}

function normalizeTitle(title) {
  return String(title || "")
    .replace(/\(version[^)]*\)/gi, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function groupBooksByTitle(books) {
  const map = new Map();

  books.forEach((book) => {
    const key = normalizeTitle(book.title).toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        title: normalizeTitle(book.title) || book.title,
        books: [],
      });
    }

    map.get(key).books.push(book);
  });

  return [...map.values()].sort((a, b) => b.books.length - a.books.length);
}

function detailHref(book) {
  return `./MONRED-book.html?id=${encodeURIComponent(book.id)}`;
}

function placeholderCover(title, author = "MONRED") {
  const cleanTitle = escapeHtml(normalizeTitle(title) || "Untitled");
  return `
    <div class="placeholder-cover" role="img" aria-label="${cleanTitle} cover">
      <span>MONRED</span>
      <strong>${cleanTitle}</strong>
      <span>${escapeHtml(author)}</span>
    </div>
  `;
}

function markLoadedImages(root = document) {
  root.querySelectorAll("img.blur-img, img.book-cover, .pdf-tile img").forEach((image) => {
    if (image.complete && image.naturalWidth > 0) {
      image.classList.add("loaded");
      return;
    }
    image.addEventListener("load", () => image.classList.add("loaded"), { once: true });
    image.addEventListener("error", () => {
      const title = image.closest("[data-title]")?.dataset.title || image.alt || "Untitled";
      const author = image.closest("[data-author]")?.dataset.author || "MONRED";
      image.insertAdjacentHTML("afterend", placeholderCover(title, author));
      image.remove();
    }, { once: true });
  });
}

function bookCard(book, index = 0, featured = false) {
  const cover = getCover(book);
  const title = escapeHtml(normalizeTitle(book.title) || book.title);
  const author = escapeHtml(buildAuthor(book));
  const language = escapeHtml(getLanguage(book));
  const time = escapeHtml(book.totaltime || "Unknown length");
  const sections = escapeHtml(String(book.num_sections || "?"));
  const coverMarkup = cover
    ? `<img class="book-cover blur-img" src="${escapeHtml(cover)}" alt="${title} cover" loading="${featured ? "eager" : "lazy"}" decoding="async" />`
    : placeholderCover(book.title, buildAuthor(book));

  return `
    <article class="${featured ? "feature-card" : "release-card"} ${index === 0 ? "featured-release" : ""}">
      ${coverMarkup}
      <div class="book-card-copy">
        <span class="release-badge">${language}</span>
        <h${featured ? "2" : "3"}>${title}</h${featured ? "2" : "3"}>
        <p class="release-author">${author}</p>
        <p class="reader-label">Read by ${escapeHtml(summarizeReaders(book))}</p>
        <p class="release-meta">${time} | ${sections} sections | ${escapeHtml(buildVersionLabel(book))}</p>
        <div class="card-actions">
          <a class="card-link primary" href="${detailHref(book)}">${featured ? "Open book" : "Details"}</a>
          <a class="card-link" href="${escapeHtml(book.url_librivox)}" target="_blank" rel="noreferrer">Source</a>
        </div>
      </div>
    </article>
  `;
}

function renderFeatured(books) {
  if (!dom.featuredRail) {
    return;
  }

  if (!books.length) {
    dom.featuredRail.innerHTML = '<div class="empty-state">No featured audiobook found.</div>';
    return;
  }

  dom.featuredRail.innerHTML = books.slice(0, 6).map((book, index) => bookCard(book, index, true)).join("");
  markLoadedImages(dom.featuredRail);
}

function renderRecentSearches() {
  if (!dom.recentSearches) {
    return;
  }

  const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  dom.recentSearches.innerHTML = recent.length
    ? recent
        .slice(0, 4)
        .map((query) => `<button type="button" data-suggestion="${escapeHtml(query)}">${escapeHtml(query)}</button>`)
        .join("")
    : '<button type="button" data-suggestion="Jane Austen">Jane Austen</button>';
}

function saveRecentSearch(query) {
  const clean = query.trim();
  if (!clean) {
    return;
  }

  const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  const next = [clean, ...recent.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  renderRecentSearches();
}

function sortBooks(books) {
  return [...books].sort((a, b) => {
    const coverScore = Number(Boolean(getCover(b))) - Number(Boolean(getCover(a)));
    if (coverScore) {
      return coverScore;
    }
    return parseDuration(b.totaltime) - parseDuration(a.totaltime);
  });
}

function filterByNarrator(books, rawQuery) {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return books;
  }

  return books.filter((book) => getReaderNames(book).join(" ").toLowerCase().includes(query));
}

function applyFilters() {
  const filtered =
    state.mode === "narrator" && state.lastRawQuery ? filterByNarrator(state.books, state.lastRawQuery) : state.books;
  state.filteredBooks = sortBooks(filtered);
  renderResults(state.filteredBooks);
}

function renderResults(books) {
  if (!dom.resultsGrid) {
    return;
  }

  if (!books.length) {
    dom.resultsGrid.innerHTML = '<div class="empty-state">No audiobooks matched this search.</div>';
    return;
  }

  if (state.mode === "title" && state.lastRawQuery) {
    const groups = groupBooksByTitle(books);
    dom.resultsGrid.innerHTML = groups
      .map((group) => {
        const primary = group.books[0];
        const versions = group.books
          .slice(0, 3)
          .map((book) => {
            const readers = getReaderNames(book).join(", ") || "Reader details inside";
            return `
              <div class="version-preview">
                <strong>${escapeHtml(buildVersionLabel(book))}</strong>
                <span>${escapeHtml(readers)}</span>
                <span>${escapeHtml(book.totaltime || "Unknown length")} | ${escapeHtml(getLanguage(book))}</span>
              </div>
            `;
          })
          .join("");

        return `
          <article class="result-group-card">
            <div>
              <span class="release-badge">${group.books.length} recording${group.books.length === 1 ? "" : "s"}</span>
              <h3>${escapeHtml(group.title)}</h3>
            </div>
            <p class="release-meta">Same title, different recordings. Compare voices and versions before listening.</p>
            <div class="version-preview-list">${versions}</div>
            <div class="card-actions">
              <a class="card-link primary" href="${detailHref(primary)}">View recordings</a>
            </div>
          </article>
        `;
      })
      .join("");
    return;
  }

  dom.resultsGrid.innerHTML = books.map((book, index) => bookCard(book, index)).join("");
  markLoadedImages(dom.resultsGrid);
}

function setMode(mode) {
  state.mode = mode;
  const placeholderMap = {
    title: "Search by title",
    author: "Search by author",
    genre: "Search by genre or subject",
    narrator: "Search by narrator",
  };
  if (dom.searchInput) {
    dom.searchInput.placeholder = placeholderMap[mode] || "Search MONRED";
  }
  [...dom.browseModes, ...dom.searchModes].forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
}

async function loadBooks(params = "", heading = "Latest audiobook releases", meta = "Showing the newest books first.") {
  if (dom.statusBanner) {
    dom.statusBanner.textContent = "Loading catalog...";
  }
  if (dom.resultsHeading) {
    dom.resultsHeading.textContent = heading;
  }
  if (dom.resultMeta) {
    dom.resultMeta.textContent = meta;
  }

  try {
    const data = await jsonp(`${API_ROOT}?extended=1&coverart=1&limit=24${params}`);
    const books = Array.isArray(data?.books) ? data.books : [];
    const queryFromParams = new URLSearchParams(params.replace(/^&/, "")).get(state.mode) || "";
    state.books = books;
    state.lastQuery = queryFromParams;
    state.lastRawQuery = queryFromParams || "";
    renderFeatured(sortBooks(books));
    applyFilters();
    if (dom.statusBanner) {
      dom.statusBanner.textContent = `Loaded ${books.length} audiobook${books.length === 1 ? "" : "s"} from LibriVox and Internet Archive.`;
    }
  } catch (error) {
    if (dom.statusBanner) {
      dom.statusBanner.textContent =
        error instanceof Error ? error.message : "Unable to load the MONRED catalog.";
    }
    if (dom.resultsGrid) {
      dom.resultsGrid.innerHTML =
        '<div class="empty-state">The live catalog could not be loaded in this browser context.</div>';
    }
  }
}

function buildQuery(mode, rawQuery) {
  const query = encodeURIComponent(rawQuery.trim());
  if (!query) {
    return "";
  }

  if (mode === "author") {
    return `&author=${query}`;
  }

  if (mode === "genre") {
    return `&genre=${query}`;
  }

  if (mode === "narrator") {
    return "";
  }

  return `&title=${query}`;
}

function submitSearch(rawQuery = dom.searchInput.value, immediate = false) {
  const query = rawQuery.trim();
  state.lastRawQuery = query;

  if (!query) {
    state.lastRawQuery = "";
    void loadBooks("", "Latest audiobook releases");
    return;
  }

  saveRecentSearch(query);
  const params = buildQuery(state.mode, query);
  if (state.mode === "narrator") {
    if (dom.resultsHeading) {
      dom.resultsHeading.textContent = `Narrators matching "${query}"`;
    }
    if (dom.statusBanner) {
      dom.statusBanner.textContent = "Filtering loaded audiobooks by narrator.";
    }
    applyFilters();
    return;
  }

  void loadBooks(params, `Results for "${query}"`, `Search mode: ${state.mode}${immediate ? " | instant" : ""}`);
}

function debounce(fn, wait = 420) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

const debouncedSearch = debounce(() => {
  if (dom.searchInput.value.trim().length >= 3) {
    submitSearch(dom.searchInput.value, true);
  }
});

dom.searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  submitSearch();
});

dom.searchInput?.addEventListener("input", debouncedSearch);

dom.loadLatestButton?.addEventListener("click", () => {
  dom.searchInput.value = "";
  state.lastRawQuery = "";
  void loadBooks("", "Latest audiobook releases");
});

dom.browseModes.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode;
    if (!mode) {
      return;
    }

    if (!document.body.classList.contains("search-page")) {
      window.location.href = `./MONRED-search.html?mode=${encodeURIComponent(mode)}`;
      return;
    }

    setMode(mode);
    dom.searchInput?.focus();
  });
});

dom.searchModes.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode;
    if (mode) {
      setMode(mode);
      if (dom.searchInput.value.trim()) {
        submitSearch(dom.searchInput.value, true);
      }
    }
  });
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-suggestion]");
  if (!button) {
    return;
  }

  const value = button.dataset.suggestion || "";
  dom.searchInput.value = value;
  if (button.closest("#trendingGenres")) {
    setMode("genre");
  }
  submitSearch(value);
});

const initialMode = new URLSearchParams(window.location.search).get("mode") || "title";
renderRecentSearches();
markLoadedImages();
setMode(initialMode);
void loadBooks("", "Latest audiobook releases");
