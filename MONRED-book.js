const API_ROOT = "https://librivox.org/api/feed/audiobooks";
const ARCHIVE_METADATA_ROOT = "https://archive.org/metadata/";
const detailRoot = document.querySelector("#detailRoot");
const params = new URLSearchParams(window.location.search);
const bookId = params.get("id");

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `monredDetail_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
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
      reject(new Error("Unable to load book details from MONRED."));
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

function stripHtml(value) {
  const temp = document.createElement("div");
  temp.innerHTML = String(value ?? "");
  return temp.textContent || temp.innerText || "";
}

function shortenDescription(value, maxLength = 280) {
  const clean = stripHtml(value).replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) {
    return clean;
  }

  const shortened = clean.slice(0, maxLength);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastSpace > 160 ? lastSpace : maxLength).trim()}...`;
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

function getLanguage(book) {
  const language = Array.isArray(book.language) ? book.language[0] : book.language;
  return language || "Unknown";
}

function getCover(book) {
  if (book.url_cover_art || book.url_coverart || book.url_cover) {
    return book.url_cover_art || book.url_coverart || book.url_cover || "";
  }

  const identifier = archiveIdentifier(book);
  return identifier ? `https://archive.org/services/img/${identifier}` : "";
}

function getSections(book) {
  return Array.isArray(book.sections) ? book.sections : [];
}

function getReaderNames(section) {
  const names = [];
  if (Array.isArray(section?.readers)) {
    section.readers.forEach((reader) => {
      const name =
        typeof reader === "string"
          ? reader
          : `${reader?.display_name || ""}` ||
            `${reader?.first_name || ""} ${reader?.last_name || ""}`.trim();
      if (name.trim()) {
        names.push(name.trim());
      }
    });
  }

  [section?.reader_name, section?.reader, section?.display_name]
    .filter(Boolean)
    .forEach((name) => names.push(String(name).trim()));

  return [...new Set(names)];
}

function summarizeVersionReaders(book) {
  const readers = (Array.isArray(book.sections) ? book.sections : [])
    .flatMap((section) => getReaderNames(section))
    .filter(Boolean);
  const uniqueReaders = [...new Set(readers)];

  if (!uniqueReaders.length) {
    return "Multiple volunteer readers";
  }

  if (uniqueReaders.length <= 3) {
    return uniqueReaders.join(", ");
  }

  return `${uniqueReaders.slice(0, 3).join(", ")} +${uniqueReaders.length - 3} more`;
}

function archiveEmbedUrl(book) {
  const raw = String(book.url_iarchive || "");
  if (!raw) {
    return "";
  }

  const identifier = raw.split("/").filter(Boolean).pop();
  return identifier ? `https://archive.org/embed/${identifier}` : "";
}

function archiveIdentifier(book) {
  const raw = String(book.url_iarchive || "");
  return raw.split("/").filter(Boolean).pop() || "";
}

function normalizeTitle(title) {
  return String(title || "")
    .replace(/\(version[^)]*\)/gi, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildVersionLabel(book) {
  const match = String(book.title || "").match(/\(Version\s*([^)]+)\)/i);
  return match ? `Version ${match[1]}` : "Original listing";
}

function sectionAudioUrl(section) {
  return (
    section?.listen_url ||
    section?.play_url ||
    section?.url ||
    section?.mp3 ||
    section?.url_zip_file ||
    ""
  );
}

function buildSectionTitle(section, index) {
  return (
    section?.title ||
    section?.section_name ||
    section?.name ||
    `Chapter ${index + 1}`
  );
}

function normalizeArchiveFileUrl(identifier, fileName) {
  return `https://archive.org/download/${identifier}/${encodeURIComponent(fileName).replaceAll("%2F", "/")}`;
}

async function fetchArchiveTracks(identifier) {
  if (!identifier) {
    return [];
  }

  const response = await fetch(`${ARCHIVE_METADATA_ROOT}${encodeURIComponent(identifier)}`);
  if (!response.ok) {
    throw new Error("Unable to load chapter metadata from Internet Archive.");
  }

  const data = await response.json();
  const files = Array.isArray(data?.files) ? data.files : [];
  return files
    .filter((file) => {
      const name = String(file.name || "").toLowerCase();
      const format = String(file.format || "").toLowerCase();
      return name.endsWith(".mp3") || format.includes("mp3");
    })
    .map((file, index) => ({
      index,
      fileName: file.name,
      title: file.title || file.name,
      duration: file.length || "",
      url: normalizeArchiveFileUrl(identifier, file.name),
    }));
}

function mergeTracks(book, archiveTracks) {
  const sections = getSections(book);
  if (!sections.length && !archiveTracks.length) {
    return [];
  }

  const maxLength = Math.max(sections.length, archiveTracks.length);
  return Array.from({ length: maxLength }, (_, index) => {
    const section = sections[index] || {};
    const archiveTrack = archiveTracks[index] || {};
    const readers = getReaderNames(section);
    return {
      index,
      title: buildSectionTitle(section, index),
      duration: section?.playtime || archiveTrack.duration || "",
      url: sectionAudioUrl(section) || archiveTrack.url || "",
      reader: readers.join(", "),
    };
  }).filter((track) => track.url);
}

async function fetchRelatedVersions(book) {
  const baseTitle = normalizeTitle(book.title);
  if (!baseTitle) {
    return [book];
  }

  try {
    const data = await jsonp(
      `${API_ROOT}?extended=1&coverart=1&limit=25&title=${encodeURIComponent(baseTitle)}`,
    );
    const books = Array.isArray(data?.books) ? data.books : [];
    const exactish = books.filter(
      (item) => normalizeTitle(item.title).toLowerCase() === baseTitle.toLowerCase(),
    );

    const deduped = new Map();
    [book, ...exactish].forEach((item) => {
      deduped.set(String(item.id), item);
    });
    return [...deduped.values()];
  } catch {
    return [book];
  }
}

function bindPlayer(tracks) {
  const audio = document.querySelector("#chapterAudio");
  const chapterButtons = [...document.querySelectorAll(".chapter-item")];
  const currentTitle = document.querySelector("#currentChapterTitle");
  const currentMeta = document.querySelector("#currentChapterMeta");
  const prevButton = document.querySelector("#prevChapter");
  const nextButton = document.querySelector("#nextChapter");
  const playPauseButton = document.querySelector("#playPauseButton");
  const seekBar = document.querySelector("#seekBar");
  const currentTime = document.querySelector("#currentTime");
  const totalTime = document.querySelector("#totalTime");

  if (!(audio instanceof HTMLAudioElement) || !tracks.length) {
    return;
  }

  let currentIndex = 0;
  let isSeeking = false;

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "0:00";
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const syncButtons = () => {
    chapterButtons.forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.chapterIndex) === currentIndex);
    });
    const track = tracks[currentIndex];
    currentTitle.textContent = track.title;
    currentMeta.textContent = [track.reader, track.duration].filter(Boolean).join(" | ");
    prevButton.disabled = currentIndex === 0;
    nextButton.disabled = currentIndex === tracks.length - 1;
    if (playPauseButton) {
      playPauseButton.textContent = audio.paused ? "Play" : "Pause";
    }
  };

  const loadTrack = (index, shouldPlay = false) => {
    currentIndex = index;
    audio.src = tracks[currentIndex].url;
    audio.load();
    if (seekBar instanceof HTMLInputElement) {
      seekBar.value = "0";
    }
    if (currentTime) {
      currentTime.textContent = "0:00";
    }
    if (totalTime) {
      totalTime.textContent = tracks[currentIndex].duration || "--:--";
    }
    syncButtons();
    if (shouldPlay) {
      void audio.play().catch(() => {});
    }
  };

  chapterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.chapterIndex);
      if (!Number.isNaN(index)) {
        loadTrack(index, true);
      }
    });
  });

  prevButton?.addEventListener("click", () => {
    if (currentIndex > 0) {
      loadTrack(currentIndex - 1, true);
    }
  });

  nextButton?.addEventListener("click", () => {
    if (currentIndex < tracks.length - 1) {
      loadTrack(currentIndex + 1, true);
    }
  });

  playPauseButton?.addEventListener("click", () => {
    if (audio.paused) {
      void audio.play().catch(() => {});
      return;
    }
    audio.pause();
  });

  seekBar?.addEventListener("input", () => {
    isSeeking = true;
    if (!(seekBar instanceof HTMLInputElement)) {
      return;
    }
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const nextTime = (Number(seekBar.value) / 100) * duration;
    if (currentTime) {
      currentTime.textContent = formatTime(nextTime);
    }
  });

  seekBar?.addEventListener("change", () => {
    if (!(seekBar instanceof HTMLInputElement)) {
      return;
    }
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    audio.currentTime = (Number(seekBar.value) / 100) * duration;
    isSeeking = false;
  });

  audio.addEventListener("loadedmetadata", () => {
    if (totalTime) {
      totalTime.textContent = formatTime(audio.duration);
    }
  });

  audio.addEventListener("timeupdate", () => {
    if (currentTime) {
      currentTime.textContent = formatTime(audio.currentTime);
    }
    if (seekBar instanceof HTMLInputElement && !isSeeking && Number.isFinite(audio.duration)) {
      seekBar.value = String((audio.currentTime / audio.duration) * 100);
    }
  });

  audio.addEventListener("play", syncButtons);
  audio.addEventListener("pause", syncButtons);

  audio.addEventListener("ended", () => {
    if (currentIndex < tracks.length - 1) {
      loadTrack(currentIndex + 1, true);
      return;
    }
    syncButtons();
  });

  loadTrack(0);
}

function renderBook(book, tracks, relatedVersions) {
  const embedUrl = archiveEmbedUrl(book);
  const description = shortenDescription(
    book.description || "No description available from the live feed.",
  );
  const cover = getCover(book);
  const versionMarkup = relatedVersions
    .map((item) => {
      const sectionCount = Array.isArray(item.sections) ? item.sections.length : item.num_sections || "?";
      const isActive = String(item.id) === String(book.id);
      const readerText = summarizeVersionReaders(item);

      return `
        <a class="version-item ${isActive ? "active" : ""}" href="./MONRED-book.html?id=${encodeURIComponent(item.id)}">
          <strong>${escapeHtml(buildVersionLabel(item))}</strong>
          <span>${escapeHtml(item.totaltime || "Unknown length")} | ${escapeHtml(String(sectionCount))} chapters</span>
          <small>${escapeHtml(readerText)}</small>
        </a>
      `;
    })
    .join("");

  document.title = `${book.title} | MONRED`;
  detailRoot.innerHTML = `
    <div class="detail-layout">
      <section class="detail-copy detail-section">
        <div class="detail-header">
          <p class="eyebrow">Playable Detail Page</p>
          <div class="detail-book-top">
            ${
              cover
                ? `<div class="detail-cover cover-frame"><img src="${escapeHtml(cover)}" alt="${escapeHtml(book.title)} cover" /></div>`
                : ""
            }
            <div class="detail-title-block">
              <h1>${escapeHtml(book.title)}</h1>
              <div class="detail-meta-grid">
                <div class="detail-stat">
                  <strong>Author</strong>
                  <span>${escapeHtml(buildAuthor(book))}</span>
                </div>
                <div class="detail-stat">
                  <strong>Language</strong>
                  <span>${escapeHtml(getLanguage(book))}</span>
                </div>
                <div class="detail-stat">
                  <strong>Duration</strong>
                  <span>${escapeHtml(book.totaltime || "Unknown length")}</span>
                </div>
                <div class="detail-stat">
                  <strong>Chapters</strong>
                  <span>${escapeHtml(String(book.num_sections || tracks.length || "?"))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p class="detail-description">${escapeHtml(description)}</p>
        <div class="detail-actions">
          <a class="card-link primary" href="${escapeHtml(book.url_librivox)}" target="_blank" rel="noreferrer">Open official source page</a>
          ${book.url_rss ? `<a class="card-link" href="${escapeHtml(book.url_rss)}" target="_blank" rel="noreferrer">Podcast feed</a>` : ""}
          ${book.url_iarchive ? `<a class="card-link" href="${escapeHtml(book.url_iarchive)}" target="_blank" rel="noreferrer">Internet Archive</a>` : ""}
        </div>
      </section>
      <section class="detail-player">
        <div class="version-panel detail-section">
          <h3>Choose A Recording</h3>
          <div class="version-list">
            ${versionMarkup}
          </div>
        </div>
        <div class="player-shell detail-section">
          ${
            tracks.length
              ? `
                <audio id="chapterAudio" preload="metadata"></audio>
                <div class="player-header">
                  <h3>Audio Player</h3>
                  <p class="chapter-meta">Playback stays in this section and no longer floats over the page.</p>
                </div>
                <div class="player-controls">
                  <button class="primary-button player-button" id="playPauseButton" type="button">Play</button>
                  <div class="player-progress">
                    <input id="seekBar" type="range" min="0" max="100" value="0" step="0.1" />
                    <div class="player-times">
                      <span id="currentTime">0:00</span>
                      <span id="totalTime">${escapeHtml(tracks[0].duration || "--:--")}</span>
                    </div>
                  </div>
                </div>
              `
              : embedUrl
                ? `
                  <div class="player-header">
                    <h3>Embedded Archive Player</h3>
                    <p class="chapter-meta">Chapter playlist was not available, so this version falls back to the Internet Archive player.</p>
                  </div>
                  <iframe src="${escapeHtml(embedUrl)}" allow="autoplay" title="${escapeHtml(book.title)} player"></iframe>
                `
                : '<div class="empty-state">No playable audio was available for this audiobook.</div>'
          }
        </div>
        ${
          tracks.length
            ? `
              <div class="current-chapter-panel detail-section">
                <div class="player-header">
                  <h3 id="currentChapterTitle">${escapeHtml(tracks[0].title)}</h3>
                  <p class="chapter-meta" id="currentChapterMeta">${escapeHtml([tracks[0].reader, tracks[0].duration].filter(Boolean).join(" | "))}</p>
                </div>
                <div class="chapter-controls">
                  <button class="ghost-button" id="prevChapter" type="button">Previous chapter</button>
                  <button class="primary-button" id="nextChapter" type="button">Next chapter</button>
                </div>
              </div>
              <div class="chapter-list detail-section">
                <div class="player-header">
                  <h3>Chapter List</h3>
                  <p class="chapter-meta">Select any chapter directly.</p>
                </div>
                <div class="chapter-list-scroll">
                  ${tracks
                    .map(
                      (track, index) => `
                        <button class="chapter-item ${index === 0 ? "active" : ""}" type="button" data-chapter-index="${index}">
                          <span class="chapter-main">
                            <strong>${escapeHtml(track.title)}</strong>
                            <span class="chapter-meta">${escapeHtml(track.reader || "Unknown reader")}</span>
                          </span>
                          <span class="chapter-side">${escapeHtml(track.duration || "")}</span>
                        </button>
                      `,
                    )
                    .join("")}
                </div>
              </div>
            `
            : ""
        }
      </section>
    </div>
  `;

  if (tracks.length) {
    bindPlayer(tracks);
  }
}

async function init() {
  if (!bookId) {
    detailRoot.innerHTML = '<div class="empty-state">No book id was provided.</div>';
    return;
  }

  try {
    const data = await jsonp(`${API_ROOT}?extended=1&coverart=1&id=${encodeURIComponent(bookId)}`);
    const book = Array.isArray(data?.books) ? data.books[0] : null;
    if (!book) {
      detailRoot.innerHTML = '<div class="empty-state">The selected book could not be found.</div>';
      return;
    }

    let tracks = [];
    let relatedVersions = [book];
    try {
      tracks = mergeTracks(book, await fetchArchiveTracks(archiveIdentifier(book)));
    } catch {
      tracks = mergeTracks(book, []);
    }

    relatedVersions = await fetchRelatedVersions(book);
    renderBook(book, tracks, relatedVersions);
  } catch (error) {
    detailRoot.innerHTML = `<div class="empty-state">${escapeHtml(error instanceof Error ? error.message : "Unable to load details.")}</div>`;
  }
}

void init();
