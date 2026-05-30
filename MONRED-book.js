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

function getBookYear(book) {
  return book.copyright_year || book.year || book.project_date?.slice?.(0, 4) || "Unknown";
}

function getBookGenre(book) {
  const genres = Array.isArray(book.genres) ? book.genres : [];
  const firstGenre = genres[0];
  if (typeof firstGenre === "string") {
    return firstGenre;
  }
  return firstGenre?.name || firstGenre?.title || getLanguage(book);
}

function getCover(book) {
  if (book.url_cover_art || book.url_coverart || book.url_cover) {
    return book.url_cover_art || book.url_coverart || book.url_cover || "";
  }

  const identifier = archiveIdentifier(book);
  return identifier ? `https://archive.org/services/img/${identifier}` : "";
}

function placeholderCover(title, author = "MONRED") {
  return `
    <div class="placeholder-cover" role="img" aria-label="${escapeHtml(title)} cover">
      <span>MONRED</span>
      <strong>${escapeHtml(normalizeTitle(title) || "Untitled")}</strong>
      <span>${escapeHtml(author)}</span>
    </div>
  `;
}

function markLoadedImages(root = document) {
  root.querySelectorAll("img.blur-img, img.book-cover").forEach((image) => {
    if (image.complete && image.naturalWidth > 0) {
      image.classList.add("loaded");
      return;
    }
    image.addEventListener("load", () => image.classList.add("loaded"), { once: true });
    image.addEventListener("error", () => {
      image.insertAdjacentHTML("afterend", placeholderCover(image.alt.replace(/\scover$/i, "")));
      image.remove();
    }, { once: true });
  });
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
  const heroCurrentTitle = document.querySelector("#heroCurrentChapter");
  const chapterNavTitle = document.querySelector("#chapterNavTitle");
  const prevButton = document.querySelector("#prevChapter");
  const nextButton = document.querySelector("#nextChapter");
  const skipBackButton = document.querySelector("#skipBackButton");
  const skipForwardButton = document.querySelector("#skipForwardButton");
  const playPauseButton = document.querySelector("#playPauseButton");
  const seekBar = document.querySelector("#seekBar");
  const currentTime = document.querySelector("#currentTime");
  const totalTime = document.querySelector("#totalTime");
  const remainingTime = document.querySelector("#remainingTime");
  const playerProgressPercent = document.querySelector("#playerProgressPercent");
  const volumeControl = document.querySelector("#volumeControl");
  const speedControl = document.querySelector("#speedControl");
  const sleepTimer = document.querySelector("#sleepTimer");
  const waveBars = [...document.querySelectorAll("#waveProgress span")];
  const storageKey = `monred_audio_${bookId}`;

  if (!(audio instanceof HTMLAudioElement) || !tracks.length) {
    return;
  }

  let currentIndex = 0;
  let isSeeking = false;
  let sleepTimeout = 0;

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
    if (heroCurrentTitle) {
      heroCurrentTitle.textContent = track.title;
    }
    if (chapterNavTitle) {
      chapterNavTitle.textContent = track.title;
    }
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
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (saved.index === currentIndex && Number(saved.time) > 0) {
        audio.addEventListener("loadedmetadata", () => {
          audio.currentTime = Math.min(Number(saved.time), audio.duration || Number(saved.time));
        }, { once: true });
      }
    } catch {
      // Continue without restoring playback state.
    }
    if (seekBar instanceof HTMLInputElement) {
      seekBar.value = "0";
    }
    if (currentTime) {
      currentTime.textContent = "0:00";
    }
    if (totalTime) {
      totalTime.textContent = tracks[currentIndex].duration || "--:--";
    }
    if (remainingTime) {
      remainingTime.textContent = tracks[currentIndex].duration ? `-${tracks[currentIndex].duration}` : "--:--";
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

  skipBackButton?.addEventListener("click", () => {
    audio.currentTime = Math.max(0, audio.currentTime - 15);
  });

  skipForwardButton?.addEventListener("click", () => {
    const duration = Number.isFinite(audio.duration) ? audio.duration : audio.currentTime + 30;
    audio.currentTime = Math.min(duration, audio.currentTime + 30);
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
    if (remainingTime && Number.isFinite(audio.duration)) {
      remainingTime.textContent = `-${formatTime(Math.max(0, audio.duration - audio.currentTime))}`;
    }
    if (seekBar instanceof HTMLInputElement && !isSeeking && Number.isFinite(audio.duration)) {
      const progress = (audio.currentTime / audio.duration) * 100;
      seekBar.value = String(progress);
      if (playerProgressPercent) {
        playerProgressPercent.textContent = `${Math.round(progress)}% complete`;
      }
      waveBars.forEach((bar, index) => {
        bar.classList.toggle("played", index / Math.max(1, waveBars.length - 1) <= progress / 100);
      });
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify({ index: currentIndex, time: audio.currentTime }));
    } catch {
      // Ignore storage failures.
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

  speedControl?.addEventListener("change", () => {
    audio.playbackRate = Number(speedControl.value) || 1;
  });

  volumeControl?.addEventListener("input", () => {
    audio.volume = Math.min(1, Math.max(0, Number(volumeControl.value) || 0));
  });

  sleepTimer?.addEventListener("change", () => {
    window.clearTimeout(sleepTimeout);
    const minutes = Number(sleepTimer.value);
    if (minutes > 0) {
      sleepTimeout = window.setTimeout(() => audio.pause(), minutes * 60 * 1000);
    }
  });

  loadTrack(0);
}

function bindDetailTabs() {
  const tabs = [...document.querySelectorAll(".tab-nav button")];
  const panels = [...document.querySelectorAll(".tab-content > section")];
  if (!tabs.length || !panels.length) {
    return;
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      tabs.forEach((item, tabIndex) => {
        item.classList.toggle("active", tabIndex === index);
      });
      panels.forEach((panel, panelIndex) => {
        panel.classList.toggle("active", panelIndex === index);
      });
    });
  });
  panels[0].classList.add("active");
}

function renderBook(book, tracks, relatedVersions) {
  const embedUrl = archiveEmbedUrl(book);
  const description = shortenDescription(
    book.description || "No description available from the live feed.",
    520,
  );
  const cover = getCover(book);
  if (cover) {
    document.body.style.setProperty("--detail-ambient", `url("${cover}") center / cover no-repeat`);
  }
  const relatedMarkup = relatedVersions
    .filter((item) => String(item.id) !== String(book.id))
    .slice(0, 3)
    .map((item) => {
      const itemCover = getCover(item);
      return `
        <a class="related-mini" href="./MONRED-book.html?id=${encodeURIComponent(item.id)}">
          ${
            itemCover
              ? `<img class="blur-img" src="${escapeHtml(itemCover)}" alt="${escapeHtml(item.title)} cover" loading="lazy" decoding="async" />`
              : placeholderCover(item.title, buildAuthor(item))
          }
          <strong>${escapeHtml(normalizeTitle(item.title) || item.title)}</strong>
          <span>${escapeHtml(buildVersionLabel(item))}</span>
        </a>
      `;
    })
    .join("");
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
  const author = buildAuthor(book);
  const narrator = tracks[0]?.reader || summarizeVersionReaders(book);
  const totalChapters = String(book.num_sections || tracks.length || "?");
  const duration = book.totaltime || "Unknown";
  const year = getBookYear(book);
  const genre = getBookGenre(book);
  const archiveId = archiveIdentifier(book);
  const downloadHref = archiveId ? `https://archive.org/download/${encodeURIComponent(archiveId)}` : book.url_iarchive || "#";
  const chapterStripMarkup = tracks
    .slice(0, 18)
    .map(
      (track, index) => `
        <button class="chapter-pill chapter-item ${index === 0 ? "active" : ""}" type="button" data-chapter-index="${index}">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <strong>${escapeHtml(track.title)}</strong>
        </button>
      `,
    )
    .join("");
  const fullChapterMarkup = tracks
    .map(
      (track, index) => `
        <button class="chapter-row chapter-item ${index === 0 ? "active" : ""}" type="button" data-chapter-index="${index}">
          <span class="chapter-index">${String(index + 1).padStart(2, "0")}</span>
          <span class="chapter-main">
            <strong>${escapeHtml(track.title)}</strong>
            <span class="chapter-meta">${escapeHtml(track.reader || "Unknown reader")}</span>
          </span>
          <span class="chapter-side">${escapeHtml(track.duration || "")}</span>
        </button>
      `,
    )
    .join("");

  document.title = `${book.title} | MONRED`;
  detailRoot.innerHTML = `
    <div class="detail-cinematic-page">
      <section class="cinematic-hero">
        <div class="cinematic-backdrop" aria-hidden="true"></div>
        <div class="cinematic-hero-grid">
          <div class="cinematic-cover-column">
            ${
              cover
                ? `<div class="cinematic-cover"><img class="blur-img" src="${escapeHtml(cover)}" alt="${escapeHtml(book.title)} cover" loading="eager" decoding="async" /></div>`
                : placeholderCover(book.title, author)
            }
            <div class="cinematic-actions">
              <a class="primary-button" href="#audioPlayer">Listen Now</a>
              <a class="ghost-button" href="${escapeHtml(downloadHref)}" target="_blank" rel="noreferrer">Download</a>
              <button class="ghost-button" id="saveBookButton" type="button">Save</button>
              <button class="ghost-button" id="shareBookButton" type="button">Share</button>
            </div>
          </div>

          <div class="cinematic-title-column">
            <p class="eyebrow">Audiobook</p>
            <h1>${escapeHtml(book.title)}</h1>
            <p class="detail-author-line">by ${escapeHtml(author)}</p>
            <div class="cinematic-meta-line">
              <span>Narrator: ${escapeHtml(narrator || "Unknown")}</span>
              <span>${escapeHtml(duration)}</span>
              <span>${escapeHtml(genre)}</span>
              <span>${escapeHtml(year)}</span>
            </div>
            <p class="detail-description" id="detailDescription">${escapeHtml(description)}</p>
            <button class="text-expand-button" id="expandDescription" type="button">Read More</button>
          </div>

          <aside class="cinematic-stats-panel">
            <div><span>Listening Progress</span><strong>Saved locally</strong></div>
            <div><span>Current Chapter</span><strong id="heroCurrentChapter">${escapeHtml(tracks[0]?.title || "Not available")}</strong></div>
            <div><span>Total Chapters</span><strong>${escapeHtml(totalChapters)}</strong></div>
            <div><span>Duration</span><strong>${escapeHtml(duration)}</strong></div>
            <div><span>Last Played</span><strong>On this device</strong></div>
            <div><span>Completion</span><strong>0%</strong></div>
          </aside>
        </div>
      </section>

      <section class="cinematic-player-section">
        <div class="player-shell" id="audioPlayer">
          ${
            tracks.length
              ? `
                <audio id="chapterAudio" preload="metadata"></audio>
                <div class="player-header">
                  <div class="player-now-art">
                    ${
                      cover
                        ? `<img class="blur-img" src="${escapeHtml(cover)}" alt="${escapeHtml(book.title)} cover thumbnail" loading="lazy" decoding="async" />`
                        : placeholderCover(book.title, author)
                    }
                  </div>
                  <div class="player-now-copy">
                    <span>Now Playing</span>
                    <h3 id="currentChapterTitle">${escapeHtml(tracks[0].title)}</h3>
                    <p class="chapter-meta" id="currentChapterMeta">${escapeHtml([tracks[0].reader, tracks[0].duration].filter(Boolean).join(" | "))}</p>
                  </div>
                  <div class="player-now-progress">
                    <span>Progress</span>
                    <strong id="playerProgressPercent">0% complete</strong>
                  </div>
                </div>
                <div class="wave-progress" id="waveProgress" aria-hidden="true">
                  ${Array.from({ length: 74 }, (_, index) => `<span style="--h:${((index * 7) % 13) / 12}"></span>`).join("")}
                </div>
                <div class="player-controls">
                  <button class="ghost-button player-skip" id="skipBackButton" type="button">-15s</button>
                  <button class="primary-button player-button" id="playPauseButton" type="button">Play</button>
                  <button class="ghost-button player-skip" id="skipForwardButton" type="button">+30s</button>
                  <div class="player-progress">
                    <input id="seekBar" type="range" min="0" max="100" value="0" step="0.1" />
                    <div class="player-times">
                      <span id="currentTime">0:00</span>
                      <span id="totalTime">${escapeHtml(tracks[0].duration || "--:--")}</span>
                    </div>
                  </div>
                </div>
                <div class="player-options">
                  <label>
                    <span>Volume</span>
                    <input id="volumeControl" type="range" min="0" max="1" value="1" step="0.01" />
                  </label>
                  <label>
                    <span>Speed</span>
                    <select id="speedControl">
                      <option value="0.85">0.85x</option>
                      <option value="1" selected>1x</option>
                      <option value="1.15">1.15x</option>
                      <option value="1.25">1.25x</option>
                      <option value="1.5">1.5x</option>
                    </select>
                  </label>
                  <label>
                    <span>Sleep Timer</span>
                    <select id="sleepTimer">
                      <option value="0">Sleep off</option>
                      <option value="10">10 min</option>
                      <option value="20">20 min</option>
                      <option value="30">30 min</option>
                    </select>
                  </label>
                  <div class="remaining-time">
                    <span>Remaining</span>
                    <strong id="remainingTime">${escapeHtml(tracks[0].duration ? `-${tracks[0].duration}` : "--:--")}</strong>
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
      </section>

        ${
          tracks.length
            ? `
              <section class="cinematic-chapter-nav">
                <button class="ghost-button" id="prevChapter" type="button">Previous Chapter</button>
                <div>
                  <span>Chapter Navigation</span>
                  <strong id="chapterNavTitle">${escapeHtml(tracks[0].title)}</strong>
                </div>
                <button class="primary-button" id="nextChapter" type="button">Next Chapter</button>
              </section>
              <section class="chapter-strip" aria-label="Chapter browser">
                ${chapterStripMarkup}
              </section>
            `
            : ""
        }

      <section class="cinematic-content-grid">
        <div class="cinematic-main-copy">
          <section>
            <p class="eyebrow">About The Book</p>
            <h2>Summary</h2>
            <p>${escapeHtml(description)}</p>
          </section>
          <section>
            <p class="eyebrow">Themes</p>
            <div class="theme-tags">
              <span>${escapeHtml(genre)}</span>
              <span>Public Domain</span>
              <span>${escapeHtml(getLanguage(book))}</span>
              <span>Longform Listening</span>
            </div>
          </section>
          <section>
            <p class="eyebrow">Author Information</p>
            <h2>${escapeHtml(author)}</h2>
            <p>Catalog information is provided by LibriVox and Internet Archive. This edition is available for focused listening with chapter-by-chapter playback.</p>
          </section>
          <section class="all-chapters-section">
            <p class="eyebrow">All Chapters</p>
            ${
              tracks.length
                ? `<div class="chapter-list-scroll">${fullChapterMarkup}</div>`
                : `<p class="release-meta">Chapter metadata is unavailable for this recording.</p>`
            }
          </section>
        </div>

        <aside class="cinematic-side-copy">
          <section>
            <p class="eyebrow">Related Audiobooks</p>
            <h2>Recommended Titles</h2>
            ${relatedMarkup ? `<div class="related-books">${relatedMarkup}</div>` : `<p class="release-meta">No related recordings were found for this title.</p>`}
          </section>
          <section>
            <p class="eyebrow">Recordings</p>
            <h2>Choose A Version</h2>
            <div class="version-list">${versionMarkup}</div>
          </section>
          <section>
            <p class="eyebrow">Recently Played</p>
            <h2>Local Progress</h2>
            <p class="release-meta">Your listening position is saved locally when audio playback starts.</p>
          </section>
        </aside>
      </section>
      </div>
  `;

  if (tracks.length) {
    bindPlayer(tracks);
  }
  bindDetailTabs();

  document.querySelector("#expandDescription")?.addEventListener("click", () => {
    const descriptionNode = document.querySelector("#detailDescription");
    descriptionNode?.classList.toggle("expanded");
    document.querySelector("#expandDescription").textContent = descriptionNode?.classList.contains("expanded")
      ? "Show less"
      : "Read more";
  });

  document.querySelector("#saveBookButton")?.addEventListener("click", () => {
    try {
      const saved = JSON.parse(localStorage.getItem("monred_saved_books") || "[]");
      const next = [{ id: book.id, title: book.title, author }, ...saved.filter((item) => String(item.id) !== String(book.id))].slice(0, 30);
      localStorage.setItem("monred_saved_books", JSON.stringify(next));
      document.querySelector("#saveBookButton").textContent = "Saved";
    } catch {
      document.querySelector("#saveBookButton").textContent = "Saved";
    }
  });

  document.querySelector("#shareBookButton")?.addEventListener("click", async () => {
    const shareData = { title: book.title, text: `${book.title} by ${author}`, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard?.writeText(window.location.href);
      document.querySelector("#shareBookButton").textContent = "Copied";
    } catch {
      document.querySelector("#shareBookButton").textContent = "Share";
    }
  });

  markLoadedImages(detailRoot);
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
