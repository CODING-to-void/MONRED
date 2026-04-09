
<div align="center">

<img src="https://coding-to-void.github.io/MONRED/MONRED-logo.svg" alt="MONRED Logo" width="160"/>

# ◈ MONRED

### *Acoustical Liberation*

> **Read and hear your favorite books — in one place, on your terms.**

[![Live App](https://img.shields.io/badge/◈_Live_App-MONRED-1a1a2e?style=for-the-badge&logoColor=white)](https://coding-to-void.github.io/MONRED/MONRED-live.html)
[![LibriVox](https://img.shields.io/badge/API-LibriVox-8b1a1a?style=for-the-badge)](https://librivox.org/)
[![Internet Archive](https://img.shields.io/badge/API-Internet_Archive-2c3e50?style=for-the-badge)](https://archive.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-555?style=for-the-badge)](LICENSE)

---

```
  M ── O ── N ── R ── E ── D
  │                         │
  └──  Public domain.      ─┘
       Acoustically free.
       Always open.
```

</div>

---

## ◈ What is MONRED?

**MONRED** is a beautifully minimal frontend that unifies the world's largest collections of free, public domain audiobooks and texts into a single, fast, play-ready experience. No accounts. No paywalls. Just books — heard and read.

It bridges **LibriVox**, **Internet Archive**, and **Readest** into one seamless interface, letting you jump straight from a search into an audiobook player or a PDF reader without a single unnecessary click.

---

## ◈ The Stack Behind the Magic

<div align="center">

| Source | What It Powers | Role |
|--------|---------------|------|
| 🎙️ **LibriVox API** | 21,000+ volunteer-narrated audiobooks | Live catalog, metadata, MP3 streams |
| 📚 **Internet Archive API** | Millions of public domain texts & PDFs | Full-text search, PDF sourcing |
| 🌐 **MONRED API** | Live source layer | Aggregates & serves catalog data |

</div>

---

## ◈ Features

```
  ┌─────────────────────────────────────────────────┐
  │  🎧  Audiobook mode  ──  play-ready detail pages │
  │  📄  PDF mode        ──  open texts in Readest   │
  │  🔍  Search by title, author, genre, subject     │
  │  🗂️  Live catalog    ──  newest releases first   │
  │  🌍  Multi-language  ──  2,664+ non-English works│
  │  📰  News feed       ──  direct from LibriVox    │
  │  📊  Library stats   ──  live public domain pulse│
  └─────────────────────────────────────────────────┘
```

### Search Modes

| Mode | Description |
|------|-------------|
| `01 · Title` | Find a specific audiobook by name — fast |
| `02 · Author` | Browse by public domain writers directly |
| `03 · Genre / Subject` | MONRED genre matching across the catalog |
| `04 · Latest Releases` | Newest catalog additions, always live |

---

## ◈ Library Pulse

<div align="center">

```
  ╔══════════════════════════════════════════╗
  ║   📖  21,346   cataloged works           ║
  ║   👥  14,697   volunteer readers         ║
  ║   🌍   2,664   non-English works         ║
  ║   📅      83   new works last month      ║
  ╚══════════════════════════════════════════╝
             — live from LibriVox —
```

</div>

---

## ◈ How It Works

```
You type a search
        │
        ▼
  ┌─────────────┐       ┌──────────────────┐
  │ LibriVox API│──────▶│ Audiobook player │
  └─────────────┘       │ (play-ready page)│
                        └──────────────────┘
        │
        ▼
  ┌──────────────────┐   ┌────────────────┐
  │ Internet Archive │──▶│ PDF via Readest│
  │ Texts API        │   │ (direct open)  │
  └──────────────────┘   └────────────────┘
```

1. **Search** — Enter a title, author, or subject
2. **Pick a lane** — Audiobook or PDF mode
3. **Play or Read** — Jump straight in, no friction

---

## ◈ Getting Started

### Use it live (recommended)

👉 **[coding-to-void.github.io/MONRED/MONRED-live.html](https://coding-to-void.github.io/MONRED/MONRED-live.html)**

No install. No setup. Open and listen.

### Run locally

```bash
git clone https://github.com/CODING-to-void/MONRED.git
cd MONRED
# Open MONRED-live.html in your browser
open MONRED-live.html
```

> It's a single HTML file. No build step. No dependencies to install.

---

## ◈ APIs Used

### 🎙️ LibriVox API
The official LibriVox catalog API — powering every audiobook search, catalog listing, and play-ready detail page in MONRED.
- Endpoint: `https://librivox.org/api/`
- Returns: Book metadata, reader info, MP3 URLs, language, genre

### 📚 Internet Archive API
The Internet Archive's open search and item API — used to surface public domain PDF texts and match them to audiobook entries.
- Endpoint: `https://archive.org/advancedsearch.php` & `https://archive.org/metadata/`
- Returns: Full-text items, PDF links, subject metadata

### 📖 Readest Integration
Matching PDFs are opened directly inside **Readest**, a clean in-browser ebook reader, without leaving the MONRED experience.

---

## ◈ Philosophy

> *"Acoustical Liberation"* — public domain books should be heard, not just stored.

MONRED exists because the world's largest free audiobook library deserves a frontend that feels as good as the content inside it. LibriVox volunteers have recorded over **21,000 books**. MONRED makes sure you can find and play them — beautifully.

---

## ◈ Milestones

```
  2005  ── LibriVox project founded
  2025  ── LibriVox 20th anniversary 🎉
  2025  ── MONRED built — bringing it all together
```

---

## ◈ Contributing

Pull requests are welcome. Whether it's a UI improvement, a new search mode, or a better API integration — open an issue and let's talk.

---

<div align="center">

**◈ MONRED**

*Real books. Playable detail views. Acoustical liberation.*

[![Live App](https://img.shields.io/badge/◈_Open_MONRED-Now-1a1a2e?style=for-the-badge)](https://coding-to-void.github.io/MONRED/MONRED-live.html)

---

*Built on LibriVox · Internet Archive · Readest*
*Public domain. Always free.*

</div>
