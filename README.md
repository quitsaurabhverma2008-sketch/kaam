# ✅ Kaam — Aaj ka kaam, aaj hi

Simple, fast, **offline-first** task tracker. No login, no ads, no server. Data sirf aapke device me.

**Live:** https://quitsaurabhverma2008-sketch.github.io/kaam/

## ✨ Features

- ➕ Add task with **priority** (Low / Medium / High) + optional **due date**
- ✅ Complete / reopen, ✏️ edit, 🗑️ delete with **5-second undo**
- 📅 Filters: **Aaj**, **Sab**, **Done** (live counts)
- 📊 Daily progress ring, pending count, **streak** 🔥
- 🌗 Dark / light theme (auto + manual toggle)
- 📱 Installable PWA — offline chalega
- 💾 Export / Import JSON backup
- 🔒 100% private — `localStorage` only, zero network calls
- 🪶 Zero dependencies, zero build step (~30 KB)

## 🚀 Local run

```bash
cd ~/projects/kaam
python3 -m http.server 8080
# open http://localhost:8080
```

## 🧪 Tests

```bash
npm install        # jsdom (dev only)
npm test           # core logic + DOM tests
```

## 📦 Deploy (GitHub Pages)

```bash
git add -A && git commit -m "update" && git push
# Pages branch: main / root — already configured
```

## 🧱 Structure

```
index.html          UI shell
styles.css          design system (dark/light)
app.js              pure core logic + UI (single file)
sw.js               offline service worker
manifest.webmanifest
icons/              generated PNG icons
scripts/make-icons.js  local PNG generator (no deps)
tests/              node:test + jsdom
BRAIN.md            project brain / decisions
```

## 🔐 Privacy

Koi analytics nahi, koi server nahi, koi account nahi. Tasks browser ke `localStorage` me
(`kaam.tasks.v1`) rehte hain. Backup ke liye Export use karo.

## 📄 License

MIT
