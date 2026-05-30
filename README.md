# ◈ MONRED

> **Audiobooks and reading — public domain, beautifully served.**

[![Live App](https://img.shields.io/badge/⬡_Live_App-MONRED-1a1a2e?style=for-the-badge&logoColor=white)](https://coding-to-void.github.io/MONRED/MONRED-live.html)
[![LibriVox](https://img.shields.io/badge/API-LibriVox-8b1a1a?style=for-the-badge)](https://librivox.org/)
[![Internet Archive](https://img.shields.io/badge/API-Internet_Archive-2c3e50?style=for-the-badge)](https://archive.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-555?style=for-the-badge)](./LICENSE)

```
  M ── O ── N ── R ── E ── D
  │                         │
  └── Public domain.       ─┘
      Acoustically free.
      Always open.
```

MONRED is a precision-built, zero-friction frontend that fuses the world's most powerful public domain archives into a single, unified reading and listening experience. No accounts. No subscriptions. No noise.

It pulls live data from **LibriVox** and the **Internet Archive** simultaneously — serving 21,000+ volunteer-narrated audiobooks and millions of digitized texts — then hands you off directly to a play-ready audiobook player or an in-browser PDF reader.

---

## ◈ Live Demo

**👉 [coding-to-void.github.io/MONRED/MONRED-live.html](https://coding-to-void.github.io/MONRED/MONRED-live.html)**

No install. No setup. Open and listen.

---

## ◈ Features

```
  ┌──────────────────────────────────────────────────────┐
  │  🎧  Audiobook mode  ──  21,000+ play-ready books    │
  │  📄  PDF mode        ──  millions of free texts      │
  │  🔍  Search          ──  title, author, genre        │
  │  🗂️  Live catalog   ──  newest releases first        │
  │  📚  Personal library ── resume where you left off   │
  │  🌍  Multi-language  ──  2,664+ non-English works    │
  │  🌙  Dark mode       ──  easy on the eyes            │
  │  📰  LibriVox feed   ──  live news and new releases  │
  └──────────────────────────────────────────────────────┘
```

### Search Modes

| Mode | What it does |
|---|---|
| `Title` | Find a specific audiobook by name |
| `Author` | Browse by public domain writers |
| `Genre / Subject` | MONRED genre matching across the catalog |
| `Latest Releases` | Newest catalog additions, always live |

### Curated Collections

| Shelf | Vibe |
|---|---|
| Dark Academia | Stone libraries, candlelight, annotated margins |
| Philosophy Essentials | Clear minds, difficult questions, lasting arguments |
| Sci-Fi Classics | Machines, futures, strange planets, human doubt |
| Malayalam Literature | Regional voices, layered memory, literary warmth |
| Psychological Thrillers | Unreliable narrators and rooms that feel too quiet |

---

## ◈ The Stack

| Source | Role | What it powers |
|---|---|---|
| 🎙️ **LibriVox API** | Live catalog & audio streams | 21,000+ audiobooks, MP3 playback, metadata |
| 📚 **Internet Archive API** | Full-text & PDF sourcing | Millions of public domain texts |
| 📖 **Readest** | In-browser reading | PDF viewer, no friction |

**Tech:** Pure HTML, CSS, and JavaScript. No npm. No build step. No framework.

---

## ◈ App Pages

| Page | URL | Purpose |
|---|---|---|
| Discover | `MONRED-live.html` | Featured shelf, curated collections, latest releases |
| Library | `MONRED-library.html` | Resume audiobooks and saved PDFs |
| Audiobooks | `MONRED-audiobooks.html` | Full live audiobook catalog |
| Search | `MONRED-search.html` | Search by title, author, genre, narrator |
| Profile | `MONRED-profile.html` | Reading progress, finished books, dark mode |

---

## ◈ Getting Started

### Use it live (recommended)

```
https://coding-to-void.github.io/MONRED/MONRED-live.html
```

### Run locally

```bash
git clone https://github.com/CODING-to-void/MONRED.git
cd MONRED
open MONRED-live.html
```

> No `npm install`. No build pipeline. Clone → Open → Done.

---

## ◈ File Structure

```
MONRED/
├── index.html              ── Entry point / redirect
├── MONRED-live.html        ── Discover page (main app)
├── MONRED-library.html     ── Personal library
├── MONRED-audiobooks.html  ── Audiobook catalog
├── MONRED-search.html      ── Search interface
├── MONRED-profile.html     ── User profile & progress
├── MONRED-book.html        ── Individual book detail view
├── MONRED-live.css         ── Stylesheet (all pages)
├── MONRED-live.js          ── Core app logic
├── MONRED-book.js          ── Book detail page logic
├── MONRED-pdf.js           ── PDF handler
└── MONRED-logo.svg         ── Logo
```

---

## ◈ APIs Used

### 🎙️ LibriVox API

Powering every audiobook search, catalog listing, and play-ready detail page.

- **Endpoint:** `https://librivox.org/api/`
- **Returns:** Book metadata, reader info, MP3 URLs, language, genre

### 📚 Internet Archive API

Used to surface public domain PDF texts and match them to audiobook entries.

- **Endpoints:**
  - `https://archive.org/advancedsearch.php`
  - `https://archive.org/metadata/{identifier}`
- **Returns:** Full-text items, PDF links, subject metadata

### 📖 Readest Integration

Matching PDFs open directly inside Readest — a clean in-browser ebook reader — without ever leaving MONRED.

---

## ◈ Library Pulse

```
  ╔══════════════════════════════════════════╗
  ║   📖  21,346   cataloged works           ║
  ║   👥  14,697   volunteer readers         ║
  ║   🌍   2,664   non-English works         ║
  ║   📅      83   new works last month      ║
  ╚══════════════════════════════════════════╝
             — live from LibriVox —
```

---

## ◈ How It Works

```
  You type a search
        │
        ├──▶  LibriVox API  ──▶  Audiobook player (play-ready)
        │
        └──▶  Internet Archive API  ──▶  PDF via Readest (direct open)
```

1. **Search** — Enter a title, author, genre, or narrator
2. **Pick a lane** — Audiobook or PDF mode
3. **Play or Read** — Jump straight in, zero friction

---

## ◈ Philosophy

> *"Acoustical Liberation"* — public domain books should be heard, not just archived.

LibriVox volunteers have spent 20 years recording over 21,000 books. The Internet Archive holds civilisation's memory. MONRED makes it accessible. Fast. Beautiful. Free.

No accounts. No paywalls. No friction. Just the books. Just the signal.

---

## ◈ Milestones

```
  2005  ── LibriVox project founded
  2025  ── LibriVox 20th anniversary 🎉
  2025  ── MONRED built — bringing it all together
```

---

## ◈ Contributing

Pull requests are welcome. Whether it's a UI fix, a new search mode, or deeper API integration — open an issue and let's talk.

---

## ◈ License

[MIT](./LICENSE) — free to use, fork, and build on.

---

*Built on LibriVox · Internet Archive · Readest*
*Public domain. Always free.*
