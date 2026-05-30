const API_ROOT = "https://librivox.org/api/feed/audiobooks";
const params = new URLSearchParams(window.location.search);
const type = params.get("type") === "pdf" ? "pdf" : "audio";
const query = (params.get("q") || "").trim();
const titleNode = document.querySelector("#resultsTitle");
const typeNode = document.querySelector("#resultsType");
const statusNode = document.querySelector("#resultsStatus");
const listNode = document.querySelector("#resultsList");
let resolvingPdfIdentifier = "";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `monredResults_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
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
      reject(new Error("Unable to load audiobook results."));
    };

    script.src = `${url}${url.includes("?") ? "&" : "?"}format=jsonp&callback=${callbackName}`;
    document.body.append(script);
  });
}

function authorName(book) {
  const authors = Array.isArray(book.authors) ? book.authors : [];
  return authors
    .map((author) => `${author.first_name || ""} ${author.last_name || ""}`.trim())
    .filter(Boolean)
    .join(", ") || "Unknown author";
}

function archiveIdentifier(book) {
  return String(book.url_iarchive || "").split("/").filter(Boolean).pop() || "";
}

function coverForBook(book) {
  return book.url_cover_art || book.url_coverart || book.url_cover || (archiveIdentifier(book) ? `https://archive.org/services/img/${archiveIdentifier(book)}` : "");
}

function detailHref(book) {
  return `./MONRED-book.html?id=${encodeURIComponent(book.id)}`;
}

function markLoadedImages(root = document) {
  root.querySelectorAll("img.blur-img, img.book-cover").forEach((image) => {
    if (image.complete && image.naturalWidth > 0) {
      image.classList.add("loaded");
      return;
    }
    image.addEventListener("load", () => image.classList.add("loaded"), { once: true });
  });
}

function audioCard(book) {
  const cover = coverForBook(book);
  return `
    <article class="release-card">
      ${cover ? `<img class="book-cover blur-img" src="${escapeHtml(cover)}" alt="${escapeHtml(book.title)} cover" loading="lazy" decoding="async" />` : ""}
      <div class="book-card-copy">
        <span class="release-badge">Audiobook</span>
        <h3>${escapeHtml(book.title || "Untitled")}</h3>
        <p class="release-author">${escapeHtml(authorName(book))}</p>
        <p class="release-meta">${escapeHtml(book.totaltime || "Unknown length")}</p>
        <div class="card-actions">
          <a class="card-link primary" href="${detailHref(book)}">Open</a>
        </div>
      </div>
    </article>
  `;
}

function pdfCard(doc) {
  const identifier = String(doc.identifier || "");
  const title = String(doc.title || "Untitled PDF");
  const creator = Array.isArray(doc.creator) ? doc.creator.join(", ") : String(doc.creator || "Unknown author");
  return `
    <article class="release-card" data-pdf-card="${escapeHtml(identifier)}" data-pdf-title="${escapeHtml(title)}">
      <img class="book-cover blur-img" src="https://archive.org/services/img/${escapeHtml(identifier)}" alt="${escapeHtml(title)} cover" loading="lazy" decoding="async" />
      <div class="book-card-copy">
        <span class="release-badge">PDF</span>
        <h3>${escapeHtml(title)}</h3>
        <p class="release-author">${escapeHtml(creator)}</p>
        <p class="release-meta">Internet Archive text</p>
        <div class="card-actions">
          <button class="card-link primary" type="button" data-pdf-open="${escapeHtml(identifier)}">Open PDF</button>
        </div>
        <p class="pdf-inline-message" data-pdf-message="${escapeHtml(identifier)}" hidden></p>
      </div>
    </article>
  `;
}

function setPdfMessage(identifier, message = "") {
  const node = document.querySelector(`[data-pdf-message="${CSS.escape(identifier)}"]`);
  if (!node) {
    return;
  }
  node.textContent = message;
  node.hidden = !message;
}

function setPdfButtonState(identifier, resolving) {
  const button = document.querySelector(`[data-pdf-open="${CSS.escape(identifier)}"]`);
  if (!button) {
    return;
  }
  button.disabled = resolving;
  button.textContent = resolving ? "Opening..." : "Open PDF";
}

async function getArchiveMetadata(identifier) {
  const response = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
  if (!response.ok) {
    throw new Error("Unable to load PDF metadata.");
  }
  return response.json();
}

function getPublicPdfFile(data) {
  const files = Array.isArray(data?.files) ? data.files : [];
  return files.find((file) => {
    const name = String(file?.name || "");
    return /\.pdf$/i.test(name) && !/\.jp2\.pdf$/i.test(name);
  }) || null;
}

function openReader(identifier, fileName, title) {
  const readerParams = new URLSearchParams();
  readerParams.set("id", identifier);
  readerParams.set("file", fileName);
  readerParams.set("title", title || "PDF Reader");
  window.location.href = `./MONRED-reader.html?${readerParams.toString()}`;
}

async function openPdf(identifier) {
  if (!identifier || resolvingPdfIdentifier) {
    return;
  }

  resolvingPdfIdentifier = identifier;
  setPdfMessage(identifier, "");
  setPdfButtonState(identifier, true);

  try {
    const data = await getArchiveMetadata(identifier);
    const pdfFile = getPublicPdfFile(data);
    if (!pdfFile?.name) {
      setPdfMessage(identifier, "No public PDF file is available for this item.");
      return;
    }
    const title = document.querySelector(`[data-pdf-card="${CSS.escape(identifier)}"]`)?.dataset.pdfTitle || "PDF Reader";
    openReader(identifier, pdfFile.name, title);
  } catch (error) {
    setPdfMessage(identifier, error instanceof Error ? error.message : "Unable to open this PDF.");
  } finally {
    setPdfButtonState(identifier, false);
    resolvingPdfIdentifier = "";
  }
}

async function loadAudioResults() {
  const data = await jsonp(`${API_ROOT}?extended=1&coverart=1&limit=24&title=${encodeURIComponent(query)}`);
  const books = Array.isArray(data?.books) ? data.books : [];
  listNode.innerHTML = books.length
    ? books.map(audioCard).join("")
    : '<div class="empty-state">No audiobook results found.</div>';
  statusNode.textContent = `Found ${books.length} audiobook result${books.length === 1 ? "" : "s"}.`;
  markLoadedImages(listNode);
}

async function loadPdfResults() {
  const searchParams = new URLSearchParams();
  searchParams.set("q", `title:("${query.replace(/"/g, '\\"')}") AND mediatype:texts AND NOT access-restricted-item:true`);
  searchParams.append("fl[]", "identifier");
  searchParams.append("fl[]", "title");
  searchParams.append("fl[]", "creator");
  searchParams.set("rows", "24");
  searchParams.set("output", "json");

  const response = await fetch(`https://archive.org/advancedsearch.php?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error("Unable to load PDF results.");
  }
  const data = await response.json();
  const docs = Array.isArray(data?.response?.docs) ? data.response.docs : [];
  listNode.innerHTML = docs.length
    ? docs.map(pdfCard).join("")
    : '<div class="empty-state">No PDF results found.</div>';
  statusNode.textContent = `Found ${docs.length} PDF result${docs.length === 1 ? "" : "s"}.`;
  markLoadedImages(listNode);
}

async function init() {
  if (!query) {
    titleNode.textContent = "No search entered";
    statusNode.textContent = "Go back and enter a search term.";
    return;
  }

  typeNode.textContent = type === "pdf" ? "PDF Results" : "Audiobook Results";
  titleNode.textContent = `Results for "${query}"`;
  document.title = `${query} | MONRED Results`;

  try {
    if (type === "pdf") {
      await loadPdfResults();
      return;
    }
    await loadAudioResults();
  } catch (error) {
    statusNode.textContent = error instanceof Error ? error.message : "Unable to load results.";
    listNode.innerHTML = '<div class="empty-state">Search results could not be loaded.</div>';
  }
}

listNode?.addEventListener("click", (event) => {
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

void init();
