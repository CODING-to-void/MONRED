const params = new URLSearchParams(window.location.search);
const identifier = params.get("id") || "";
const file = params.get("file") || "";
const title = params.get("title") || "PDF Reader";
const frame = document.querySelector("#readerFrame");
const titleNode = document.querySelector("#readerTitle");
const metaNode = document.querySelector("#readerMeta");
const progressNode = document.querySelector("#readerProgress");
const themeButton = document.querySelector("#readerTheme");
const sizeButton = document.querySelector("#readerSize");
const fullscreenButton = document.querySelector("#readerFullscreen");
const fullscreenLabel = document.querySelector("#readerFullscreenLabel");
const readerShell = document.querySelector(".reader-shell");
const storageKey = `monred_reader_${identifier}_${file}`;

function pdfUrl() {
  if (!identifier || !file) {
    return "";
  }
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(file).replaceAll("%2F", "/")}`;
}

function restore() {
  const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
  document.body.classList.toggle("reader-dark", saved.theme === "dark");
  document.body.classList.toggle("reader-large", saved.size === "large");
  themeButton.textContent = saved.theme === "dark" ? "Light" : "Dark";
  progressNode.style.width = `${Number(saved.progress || 0)}%`;
}

function persist(next = {}) {
  const current = JSON.parse(localStorage.getItem(storageKey) || "{}");
  localStorage.setItem(storageKey, JSON.stringify({ ...current, ...next }));
}

if (titleNode) {
  titleNode.textContent = title;
}

if (metaNode) {
  metaNode.textContent = identifier ? `Internet Archive | ${identifier}` : "No PDF selected";
}

if (frame) {
  const url = pdfUrl();
  frame.src = url || "about:blank";
}

themeButton?.addEventListener("click", () => {
  const dark = !document.body.classList.contains("reader-dark");
  document.body.classList.toggle("reader-dark", dark);
  themeButton.textContent = dark ? "Light" : "Dark";
  persist({ theme: dark ? "dark" : "light" });
});

sizeButton?.addEventListener("click", () => {
  const large = !document.body.classList.contains("reader-large");
  document.body.classList.toggle("reader-large", large);
  persist({ size: large ? "large" : "normal" });
});

function isReaderFullscreen() {
  return document.fullscreenElement === readerShell;
}

function syncFullscreenState() {
  const active = isReaderFullscreen();
  document.body.classList.toggle("fullscreen-reading", active);

  if (fullscreenButton) {
    fullscreenButton.setAttribute("aria-label", active ? "Exit full screen" : "Enter full screen");
    fullscreenButton.classList.toggle("active", active);
  }

  if (fullscreenLabel) {
    fullscreenLabel.textContent = active ? "Exit Full Screen" : "Full Screen";
  }
}

async function toggleFullscreen() {
  if (!readerShell) {
    return;
  }

  try {
    if (isReaderFullscreen()) {
      await document.exitFullscreen();
      return;
    }

    await readerShell.requestFullscreen();
  } catch {
    syncFullscreenState();
  }
}

fullscreenButton?.addEventListener("click", () => {
  void toggleFullscreen();
});

document.addEventListener("fullscreenchange", syncFullscreenState);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isReaderFullscreen()) {
    void document.exitFullscreen();
  }
});

window.addEventListener("scroll", () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const progress = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0;
  progressNode.style.width = `${progress}%`;
  persist({ progress });
}, { passive: true });

let toolbarTimer;
document.addEventListener("mousemove", () => {
  document.body.classList.remove("toolbar-hidden");
  window.clearTimeout(toolbarTimer);
  if (!isReaderFullscreen()) {
    toolbarTimer = window.setTimeout(() => document.body.classList.add("toolbar-hidden"), 2400);
  }
});

restore();
syncFullscreenState();
