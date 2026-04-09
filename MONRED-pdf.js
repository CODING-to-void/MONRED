(() => {
  const STORAGE_KEY = "monredPdfState";
  const state = {
    contentMode: "audiobook",
    searchMode: "title",
    lastQuery: "",
    resolvingIdentifier: "",
    results: [],
  };

  const dom = {
    body: document.body,
    contentModes: [...document.querySelectorAll("#contentModes [data-content-mode]")],
    audiobookSearch: document.querySelector("#searchForm"),
    audiobookPills: document.querySelector("#searchModes"),
    heroStage: document.querySelector(".hero-stage"),
    pdfShell: document.querySelector("#pdfSearchShell"),
    pdfForm: document.querySelector("#pdfSearchForm"),
    pdfInput: document.querySelector("#pdfSearchInput"),
    pdfModes: [...document.querySelectorAll("#pdfSearchModes [data-pdf-mode]")],
    pdfResults: document.querySelector("#pdfResults"),
    pdfResultsGrid: document.querySelector("#pdfResultsGrid"),
    pdfResultsHeading: document.querySelector("#pdfResultsHeading"),
    pdfStatusBanner: document.querySelector("#pdfStatusBanner"),
    discover: document.querySelector("#discover"),
    results: document.querySelector("#results"),
    news: document.querySelector("#news"),
    stats: document.querySelector("#stats"),
    communityGrid: document.querySelector(".community-grid"),
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function setContentMode(mode) {
    state.contentMode = mode;
    const pdfMode = mode === "pdf";

    dom.body.classList.toggle("pdf-mode", pdfMode);
    dom.pdfShell.hidden = !pdfMode;
    dom.pdfResults.hidden = !pdfMode;

    dom.contentModes.forEach((button) => {
      button.classList.toggle("active", button.dataset.contentMode === mode);
    });

    persistState();
  }

  function setPdfSearchMode(mode) {
    state.searchMode = mode;
    const placeholders = {
      title: "Search PDF titles",
      author: "Search PDF authors",
      subject: "Search PDF subjects",
    };

    if (dom.pdfInput) {
      dom.pdfInput.placeholder = placeholders[mode] || "Search Internet Archive texts";
    }

    dom.pdfModes.forEach((button) => {
      button.classList.toggle("active", button.dataset.pdfMode === mode);
    });

    persistState();
  }

  function setPdfStatus(message) {
    if (dom.pdfStatusBanner) {
      dom.pdfStatusBanner.textContent = message;
    }
  }

  function renderEmpty(message) {
    if (dom.pdfResultsGrid) {
      dom.pdfResultsGrid.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    }
  }

  function normalizeCreator(creator) {
    if (Array.isArray(creator)) {
      return creator.filter(Boolean).join(", ");
    }

    return String(creator || "").trim();
  }

  function normalizeDescription(description) {
    if (Array.isArray(description)) {
      return description.filter(Boolean).join(" ");
    }

    return String(description || "").trim();
  }

  function isRestrictedItem(item) {
    const value = item?.["access-restricted-item"];
    if (Array.isArray(value)) {
      return value.some((entry) => String(entry).toLowerCase() === "true");
    }

    return String(value || "").toLowerCase() === "true";
  }

  function buildAdvancedSearchUrl(query, mode) {
    const fieldMap = {
      title: "title",
      author: "creator",
      subject: "subject",
    };

    const field = fieldMap[mode] || "title";
    const encodedQuery = `"${query.replace(/"/g, '\\"')}"`;
    const params = new URLSearchParams();
    params.set(
      "q",
      `${field}:(${encodedQuery}) AND mediatype:texts AND NOT access-restricted-item:true`,
    );
    params.append("fl[]", "identifier");
    params.append("fl[]", "title");
    params.append("fl[]", "creator");
    params.append("fl[]", "description");
    params.append("fl[]", "access-restricted-item");
    params.set("rows", "20");
    params.set("page", "1");
    params.set("output", "json");

    return `https://archive.org/advancedsearch.php?${params.toString()}`;
  }

  function renderResults(docs) {
    if (!dom.pdfResultsGrid) {
      return;
    }

    state.results = docs;
    persistState();

    if (!docs.length) {
      renderEmpty("No PDF-ready Internet Archive texts matched this search.");
      return;
    }

    dom.pdfResultsGrid.innerHTML = docs
      .map((doc) => {
        const identifier = String(doc.identifier || "").trim();
        const title = String(doc.title || "Untitled item").trim();
        const creator = normalizeCreator(doc.creator) || "Unknown author";
        const description = normalizeDescription(doc.description);

        return `
          <article class="release-card pdf-release-card" data-pdf-card="${escapeHtml(identifier)}">
            <span class="release-badge">PDF</span>
            <h3>${escapeHtml(title)}</h3>
            <p class="release-author">${escapeHtml(creator)}</p>
            ${
              description
                ? `<p class="release-meta pdf-description">${escapeHtml(description)}</p>`
                : '<p class="release-meta">Internet Archive text item</p>'
            }
            <div class="card-actions">
              <button
                class="card-link primary pdf-open-button"
                type="button"
                data-pdf-open="${escapeHtml(identifier)}"
              >
                Open PDF
              </button>
            </div>
            <p class="pdf-inline-message" data-pdf-message="${escapeHtml(identifier)}" hidden></p>
          </article>
        `;
      })
      .join("");
  }

  async function searchPdfs(rawQuery) {
    const query = rawQuery.trim();
    state.lastQuery = query;
    persistState();

    if (!query) {
      dom.pdfResultsHeading.textContent = "Search PDF-ready public domain texts";
      setPdfStatus("Enter a title, author, or subject to search Internet Archive texts.");
      renderEmpty("Search for a PDF title, author, or subject to begin.");
      return;
    }

    dom.pdfResultsHeading.textContent = `PDF results for "${query}"`;
    setPdfStatus("Loading Internet Archive results...");
    renderEmpty("Loading PDF results...");

    try {
      const response = await fetch(buildAdvancedSearchUrl(query, state.searchMode), {
        mode: "cors",
      });

      if (!response.ok) {
        throw new Error("Internet Archive search failed.");
      }

      const data = await response.json();
      const docs = Array.isArray(data?.response?.docs)
        ? data.response.docs.filter((doc) => !isRestrictedItem(doc))
        : [];

      renderResults(docs);
      setPdfStatus(
        docs.length
          ? `Loaded ${docs.length} result${docs.length === 1 ? "" : "s"} for ${state.searchMode} search.`
          : "No matching Internet Archive texts were found.",
      );

      if (!docs.length) {
        renderEmpty("No PDF-ready Internet Archive texts matched this search.");
      }
    } catch (error) {
      setPdfStatus(
        error instanceof Error ? error.message : "Unable to load Internet Archive results.",
      );
      renderEmpty("The PDF catalog could not be loaded in this browser context.");
    }
  }

  function persistState() {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          contentMode: state.contentMode,
          searchMode: state.searchMode,
          lastQuery: state.lastQuery,
          results: state.results,
        }),
      );
    } catch {
      // Ignore storage failures and keep the UI functional.
    }
  }

  function loadStoredState() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }

      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function restorePdfState(storedState) {
    if (!storedState || storedState.contentMode !== "pdf") {
      return;
    }

    setContentMode("pdf");
    setPdfSearchMode(storedState.searchMode || "title");

    if (dom.pdfInput) {
      dom.pdfInput.value = storedState.lastQuery || "";
    }

    const storedResults = Array.isArray(storedState.results) ? storedState.results : [];
    if (storedResults.length) {
      dom.pdfResultsHeading.textContent = storedState.lastQuery
        ? `PDF results for "${storedState.lastQuery}"`
        : "Search PDF-ready public domain texts";
      setPdfStatus(
        `Restored ${storedResults.length} PDF result${storedResults.length === 1 ? "" : "s"} from your last search.`,
      );
      renderResults(storedResults);
      return;
    }

    if (storedState.lastQuery) {
      void searchPdfs(storedState.lastQuery);
    }
  }

  function setCardMessage(identifier, message = "") {
    const messageNode = document.querySelector(`[data-pdf-message="${CSS.escape(identifier)}"]`);
    if (!messageNode) {
      return;
    }

    if (message) {
      messageNode.textContent = message;
      messageNode.hidden = false;
      return;
    }

    messageNode.textContent = "";
    messageNode.hidden = true;
  }

  function setResolvingState(identifier, resolving) {
    const button = document.querySelector(`[data-pdf-open="${CSS.escape(identifier)}"]`);
    if (!button) {
      return;
    }

    button.disabled = resolving;
    button.textContent = resolving ? "Resolving PDF..." : "Open PDF";
  }

  async function getItemMetadata(identifier) {
    const response = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`, {
      mode: "cors",
    });

    if (!response.ok) {
      throw new Error("Unable to load Internet Archive metadata.");
    }

    return response.json();
  }

  function getPublicPdfFile(data) {
    if (isRestrictedItem(data?.metadata || {})) {
      return null;
    }

    const files = Array.isArray(data?.files) ? data.files : [];
    return files.find((file) => {
      const name = String(file?.name || "");
      return /\.pdf$/i.test(name) && !/\.jp2\.pdf$/i.test(name);
    }) || null;
  }

  function triggerPdfDownload(pdfUrl, filename) {
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = filename || "document.pdf";
    link.rel = "noreferrer";
    document.body.append(link);
    link.click();
    link.remove();
  }

  async function openPdf(identifier) {
    if (!identifier || state.resolvingIdentifier) {
      return;
    }

    state.resolvingIdentifier = identifier;
    setCardMessage(identifier, "");
    setResolvingState(identifier, true);

    try {
      const data = await getItemMetadata(identifier);
      const pdfFile = getPublicPdfFile(data);

      if (!pdfFile?.name) {
        setCardMessage(identifier, "No public PDF available for this item.");
        return;
      }

      const pdfUrl = `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(pdfFile.name).replaceAll("%2F", "/")}`;
      triggerPdfDownload(pdfUrl, pdfFile.name);
      setCardMessage(
        identifier,
        "PDF download started. Open the downloaded file in Readest manually.",
      );
    } catch (error) {
      setCardMessage(
        identifier,
        error instanceof Error ? error.message : "Unable to resolve a PDF for this item.",
      );
    } finally {
      setResolvingState(identifier, false);
      state.resolvingIdentifier = "";
    }
  }

  dom.contentModes.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.contentMode;
      if (mode) {
        setContentMode(mode);
      }
    });
  });

  dom.pdfModes.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.pdfMode;
      if (mode) {
        setPdfSearchMode(mode);
      }
    });
  });

  dom.pdfForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void searchPdfs(dom.pdfInput?.value || "");
  });

  dom.pdfResultsGrid?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest("[data-pdf-open]");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const identifier = button.dataset.pdfOpen;
    if (identifier) {
      void openPdf(identifier);
    }
  });

  const storedState = loadStoredState();
  setContentMode("audiobook");
  setPdfSearchMode("title");
  restorePdfState(storedState);
})();
