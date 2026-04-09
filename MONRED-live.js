const API_ROOT = "https://librivox.org/api/feed/audiobooks";
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
  resultsGrid: document.querySelector("#resultsGrid"),
  resultsHeading: document.querySelector("#resultsHeading"),
  statusBanner: document.querySelector("#statusBanner"),
  browseModes: [...document.querySelectorAll("#browseModes [data-mode]")],
  searchModes: [...document.querySelectorAll("#searchModes [data-mode]")],
  languageFilter: document.querySelector("#languageFilter"),
  sortFilter: document.querySelector("#sortFilter"),
  loadLatestButton: document.querySelector("#loadLatestButton"),
  resultMeta: document.querySelector("#resultMeta"),
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
      reject(new Error("Unable to reach the MONRED API from this page."));
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

    const rawNames = [
      section.reader_name,
      section.reader,
      section.display_name,
      section.name,
    ].filter(Boolean);

    rawNames.forEach((name) => names.add(String(name).trim()));
  });

  return [...names];
}

function summarizeReaders(book, maxNames = 3) {
  const readers = getReaderNames(book);
  if (!readers.length) {
    return "Multiple volunteer readers";
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
  return match ? `Version ${match[1]}` : "Original listing";
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

function renderFeatured(book) {
  if (!book) {
    dom.featuredCard.innerHTML = '<div class="empty-state">No featured audiobook found.</div>';
    return;
  }

  const cover = getCover(book);
  const readers = getReaderNames(book);
  dom.featuredCard.innerHTML = `
    <div class="feature-layout">
      ${
        cover
          ? `<div class="cover-frame"><img src="${escapeHtml(cover)}" alt="${escapeHtml(book.title)} cover" /></div>`
          : ""
      }
      <div>
        <div class="stage-topline">
          <span class="chip">Featured</span>
          <span class="chip chip-muted">${escapeHtml(getLanguage(book))}</span>
        </div>
        <h2>${escapeHtml(book.title)}</h2>
        <p class="stage-author">${escapeHtml(buildAuthor(book))}</p>
        <p class="reader-label">${escapeHtml(readers.length ? `Read by ${summarizeReaders(book)}` : "Multiple volunteer readers")}</p>
        <div class="waveform" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
        <div class="stage-meta">
          <span>${escapeHtml(book.totaltime || "Unknown length")}</span>
          <span>${escapeHtml(String(book.num_sections || "?"))} sections</span>
          <span>${escapeHtml(buildVersionLabel(book))}</span>
        </div>
        <div class="card-actions">
          <a class="card-link primary" href="${detailHref(book)}">Open detail page</a>
          <a class="card-link" href="${escapeHtml(book.url_librivox)}" target="_blank" rel="noreferrer">Official listing</a>
        </div>
      </div>
    </div>
  `;
}

function renderLanguageOptions(books) {
  const languages = [...new Set(books.map(getLanguage))].sort((a, b) => a.localeCompare(b));
  dom.languageFilter.innerHTML =
    '<option value="all">All languages</option>' +
    languages.map((language) => `<option value="${escapeHtml(language)}">${escapeHtml(language)}</option>`).join("");
}

function sortBooks(books) {
  const sorted = [...books];
  switch (dom.sortFilter.value) {
    case "title-asc":
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "title-desc":
      sorted.sort((a, b) => b.title.localeCompare(a.title));
      break;
    case "duration-desc":
      sorted.sort((a, b) => parseDuration(b.totaltime) - parseDuration(a.totaltime));
      break;
    default:
      break;
  }
  return sorted;
}

function applyFilters() {
  const selectedLanguage = dom.languageFilter.value;
  const filtered = state.books.filter((book) =>
    selectedLanguage === "all" ? true : getLanguage(book) === selectedLanguage,
  );
  state.filteredBooks = sortBooks(filtered);
  renderResults(state.filteredBooks);
}

function renderResults(books) {
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
          .slice(0, 4)
          .map((book) => {
            const readers = getReaderNames(book).join(", ") || "Reader info in detail page";
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
            <div class="result-topline">
              <div>
                <span class="release-badge">${group.books.length} recording${group.books.length === 1 ? "" : "s"}</span>
                <h3>${escapeHtml(group.title)}</h3>
              </div>
              <a class="card-link primary" href="${detailHref(primary)}">View recordings</a>
            </div>
            <p class="result-summary">
              Same book, different recordings. Open this title to compare versions and choose the one you want.
            </p>
            <div class="version-preview-list">${versions}</div>
          </article>
        `;
      })
      .join("");
    return;
  }

  dom.resultsGrid.innerHTML = books
    .map((book, index) => {
      const cover = book.url_zip_file || book.url_iarchive || book.url_librivox || "#";
      const featuredClass = index === 0 && state.lastQuery === "" ? "featured-release" : "";
      return `
        <article class="release-card ${featuredClass}">
          <span class="release-badge">${escapeHtml(getLanguage(book))}</span>
          <h3>${escapeHtml(book.title)}</h3>
          <p class="release-author">${escapeHtml(buildAuthor(book))}</p>
          <p class="reader-label">${escapeHtml(summarizeReaders(book))}</p>
          <p class="version-label">${escapeHtml(buildVersionLabel(book))}</p>
          <p class="release-meta">${escapeHtml(book.totaltime || "Unknown length")} | ${escapeHtml(String(book.num_sections || "?"))} sections</p>
          <div class="card-actions">
            <a class="card-link primary" href="${detailHref(book)}">Open detail</a>
            <a class="card-link" href="${escapeHtml(book.url_librivox)}" target="_blank" rel="noreferrer">Official source</a>
            <a class="card-link" href="${escapeHtml(cover)}" target="_blank" rel="noreferrer">Source</a>
          </div>
        </article>
      `;
    })
    .join("");
}

function setMode(mode) {
  state.mode = mode;
  const placeholderMap = {
    title: "Search by title",
    author: "Search by author",
    genre: "Search by genre or subject",
  };
  dom.searchInput.placeholder = placeholderMap[mode] || "Search MONRED";
  [...dom.browseModes, ...dom.searchModes].forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
}

async function loadBooks(params = "", heading = "Latest audiobook releases", meta = "Showing the newest books first.") {
  dom.statusBanner.textContent = "Loading catalog...";
  dom.resultsHeading.textContent = heading;
  dom.resultMeta.textContent = meta;

  try {
    const data = await jsonp(`${API_ROOT}?extended=1&coverart=1&limit=16${params}`);
    const books = Array.isArray(data?.books) ? data.books : [];
    state.books = books;
    state.lastQuery = new URLSearchParams(params.replace(/^&/, "")).get(state.mode) || "";
    state.lastRawQuery = state.lastQuery;
    renderLanguageOptions(books);
    renderFeatured(books[0]);
    applyFilters();
    dom.statusBanner.textContent = `Loaded ${books.length} audiobook${books.length === 1 ? "" : "s"}.`;
  } catch (error) {
    dom.statusBanner.textContent =
      error instanceof Error ? error.message : "Unable to load the MONRED catalog.";
    dom.resultsGrid.innerHTML =
      '<div class="empty-state">The live catalog could not be loaded in this browser context.</div>';
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

  return `&title=${query}`;
}

dom.searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = dom.searchInput.value.trim();
  if (!query) {
    void loadBooks("", "Latest audiobook releases");
    return;
  }

  const params = buildQuery(state.mode, query);
  void loadBooks(params, `Results for "${query}"`, `Search mode: ${state.mode}`);
});

dom.languageFilter?.addEventListener("change", applyFilters);
dom.sortFilter?.addEventListener("change", applyFilters);
dom.loadLatestButton?.addEventListener("click", () => {
  dom.searchInput.value = "";
  void loadBooks("", "Latest audiobook releases");
});

dom.browseModes.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode;
    if (!mode) {
      return;
    }

    if (mode === "latest") {
      dom.searchInput.value = "";
      void loadBooks("", "Latest audiobook releases");
      return;
    }

    setMode(mode);
    dom.searchInput.focus();
  });
});

dom.searchModes.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode;
    if (mode) {
      setMode(mode);
    }
  });
});

setMode("title");
void loadBooks("", "Latest audiobook releases");
