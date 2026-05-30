# Task Tracker

A lightweight task and habit tracker with a hand-drawn, notebook-style interface. Built as a single HTML file — no build step, no framework, no dependencies. Just open it and go.

**Live demo:** https://task-tracker-navy-five-21.vercel.app

---

## Features

- **One-off tasks** with optional deadlines. Each task shows a live ETA ("3 days", "~2 months") and flags items that are due soon or overdue.
- **Smart sorting** — active tasks are ordered by nearest deadline, completed tasks drop into a separate section ordered by most recently finished.
- **Recurring habits** with daily, weekday, weekly (pick a day), and monthly schedules. Each habit knows whether it's due today and can be ticked off once per cycle.
- **Two views** — a flat task list and a 7-day week grid you can navigate forward and back, with tasks placed on their deadline day.
- **Delete confirmation** so active tasks aren't removed by accident.
- **Persistent** — everything is saved to the browser via `localStorage`, so your tasks and habits survive a page refresh.
- **Responsive** — the three-pane layout collapses into a single column on narrow screens.

---

## Tech

- **HTML / CSS / vanilla JavaScript** — a single `index.html`, ~930 lines, zero dependencies.
- **localStorage** for persistence.
- **Google Fonts** (Caveat & Patrick Hand) for the hand-drawn look.
- Deployed on **Vercel** as a static site.

---

## Running locally

No build tools required. Either:

```bash
git clone https://github.com/uzeyir-bayramli-3379/task-tracker.git
cd task-tracker
```

Then open `index.html` directly in your browser, or serve it with any static server:

```bash
python3 -m http.server 8000
# visit http://localhost:8000
```

---

## How it works

The app is built around one simple loop:

1. A single `tasks` array (and a separate `recurring` array) is the source of truth.
2. Every action — add, toggle, delete — mutates that array, calls `save()` to write to `localStorage`, then calls `render()`.
3. `render()` rebuilds the visible list from the array every time.

That **mutate → save → redraw** cycle is the whole architecture. Click handling uses event delegation (one listener per list) so dynamically added rows work without rewiring anything. Deadlines are normalized to midnight before comparison to keep day-difference math accurate.

---

## Project structure

```
task-tracker/
├── index.html   # the entire app — markup, styles, and logic
└── .gitignore
```

---

## Possible next steps

- Edit a task in place instead of delete-and-readd
- Tags or categories with filtering
- Export / import tasks as JSON
- Sync across devices via a small backend or a cloud store

---

## Screenshots

![first](<Screenshot 2026-05-30 232221.png>) ![second](<Screenshot 2026-05-30 232241.png>)
Built by [Uzeyir Bayramli](https://github.com/uzeyir-bayramli-3379).
