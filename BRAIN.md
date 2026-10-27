# 🧠 BRAIN — Kaam (Task & Habit Tracker PWA)

## 1. Project kya hai
**Kaam** — ek simple, fast, offline-first task tracker. Mobile-first PWA, no login, no backend.
Tagline: *"Aaj ka kaam, aaj hi."*

## 2. Kya karna hai / Next steps
- [x] Core task CRUD + priority + due date
- [x] Filters (Aaj / Sab / Done) + search? (v2)
- [x] Daily progress ring + stats + streak
- [x] Dark/light theme
- [x] Export / Import JSON backup
- [x] PWA install + offline service worker
- [x] Unit + DOM tests
- [x] GitHub Pages deploy
- [ ] v2 ideas: reminders/notifications, recurring tasks, drag reorder, cloud sync (Supabase)

## 3. Stack + free hosting
- **Stack:** Vanilla HTML + CSS + JS (zero dependencies, zero build step)
- **Testing:** Node built-in test runner + jsdom (dev only)
- **Hosting:** GitHub Pages (free, HTTPS, custom domain possible)
- **Repo:** https://github.com/quitsaurabhverma2008-sketch/kaam
- **Live:** https://quitsaurabhverma2008-sketch.github.io/kaam/
- **Data:** localStorage only (`kaam.tasks.v1`) — 100% private, device par

## 4. Parts + status
| Part | Status |
|---|---|
| UI (index.html + styles.css) | ✅ Done |
| Core logic (app.js) | ✅ Done |
| PWA (manifest + sw.js + icons) | ✅ Done |
| Tests (core + DOM) | ✅ Passing |
| Deploy (GitHub Pages) | ✅ Live |
| Docs (README) | ✅ Done |

## 5. Important decisions
- No framework — fastest load, works offline, no npm install for users.
- No backend — privacy + zero cost. Export/Import se backup.
- `today` logic local timezone based (IST friendly).
- Undo delete (5s) instead of confirm dialog.
- Title max 120 chars, HTML escaped via textContent (XSS-safe).
- PWA icons generated locally via Node PNG encoder (no external assets).

## 6. Verify commands
```bash
cd ~/projects/kaam
npm test                 # core + DOM tests
python3 -m http.server 8080   # local preview
gh run list / gh api repos/.../pages   # deploy status
```

## 7. Session log
- 2026-10-27: Project created, full app built, tested (28/28), deployed to GitHub Pages.
- 2026-10-27: Live assets verified (HTTP 200), repo topics added, memory + learnings updated.
- 2026-10-27: Backup repo `agent-brain` created (private) with secret-scan sync script.
- Next session: read this file first, then `cd ~/projects/kaam && npm test`.
