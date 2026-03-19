# Focus-First UI Redesign

## Context

Current UI puts the Rules tab first, forcing users to navigate configuration before they can start focusing. Forest app proves the better pattern: timer front-and-center, configuration buried deeper. Users configure rules once and reuse them — the primary action is "start focusing", not "edit rules".

User also requested: after categories are configured, show only labels (not full CRUD form).

---

## New Layout Structure

```
┌──────────────┬──────────────────────────────────────┐
│  Sidebar     │  Topbar: "Ready to Focus" / "Focusing"│
│  320px       │                                        │
│              │  ┌──────────────────────────────────┐  │
│  Sprout      │  │  TIMER HERO                      │  │
│  AW Status   │  │  idle: 25:00 + duration picker   │  │
│  Context     │  │       + [Start Focus] btn        │  │
│  Rule Summary│  │  running: countdown + metrics     │  │
│              │  │  result: summary stats            │  │
│              │  └──────────────────────────────────┘  │
│              │                                        │
│              │  ┌──────────────────────────────────┐  │
│              │  │  COMPACT RULE SUMMARY (read-only)│  │
│  ──────────  │  │  "3 windows · 2 domains · AI..."│  │
│  📋 History  │  │  [Edit Rules] → opens drawer     │  │
│  ⚙ Settings  │  └──────────────────────────────────┘  │
│              │                                        │
│              │  (running: violations timeline)        │
│              │  (result: result detail + violations)  │
└──────────────┴──────────────────────────────────────┘
```

Rules / History / Settings each open as **right-side drawer overlays** (560px, slide from right with backdrop blur).

---

## Implementation Steps

### Step 1: HTML restructure (`app/index.html`)

**Remove:**
- `<nav class="main-tabs">` (the 4 tab buttons)
- `<section id="tab-rules">` wrapper (contents move to rules drawer)
- `<section id="tab-focus">` wrapper (contents restructure into focus view)
- `<section id="tab-history">` wrapper (contents move to history drawer)
- `<section id="tab-settings">` wrapper (contents move to settings drawer)

**Add to `<main class="main">`:**

1. **Topbar** — keep existing, change `#main-heading` to reflect session state dynamically ("Ready to Focus" / "Focusing..." / "Session Complete")

2. **Focus View** `<section id="focus-view">` — the only main content:
   - **Timer Hero** `.panel.timer-hero` — three mutually exclusive states:
     - `#hero-idle`: large timer display (configured duration), duration input (number + "minutes"), large "Start Focus" button
     - `#hero-running`: countdown timer (64px font), metrics row (violations, AW mode), exit challenge button
     - `#hero-result`: result title, 3 stat cards (duration, violations, reason), "Start New Session" button
   - **Compact Rule Summary** `#rule-summary-panel`: eyebrow "Current Rules", one-line text summary ("3 windows · 2 domains · AI, Notes"), read-only chips (labels only, category chips with color dots, no X buttons), [Edit Rules] button (hidden during running session)
   - **Running Details** `#focus-running-details` (hidden when idle): live context panel + violations timeline
   - **Result Details** `#focus-result-details` (hidden when not result): 3-column result grid (allowed windows/domains/categories) + violations timeline

3. **Three drawer overlays** (at end of `<body>`, before `<script>`):

   ```html
   <!-- Rules Drawer -->
   <div id="rules-drawer-overlay" class="drawer-overlay hidden">
     <div class="drawer">
       <div class="drawer-header">
         <h3>Edit Rules</h3>
         <button id="close-rules-drawer" class="btn ghost">Done</button>
       </div>
       <!-- Move all rules editing panels here:
            windows panel, domains panel, categories panel,
            selected categories panel -->
     </div>
   </div>

   <!-- History Drawer -->
   <div id="history-drawer-overlay" class="drawer-overlay hidden">
     <div class="drawer drawer-wide">
       <div class="drawer-header">...</div>
       <!-- Move history layout here -->
     </div>
   </div>

   <!-- Settings Drawer -->
   <div id="settings-drawer-overlay" class="drawer-overlay hidden">
     <div class="drawer">
       <div class="drawer-header">...</div>
       <!-- Move settings panels here -->
     </div>
   </div>
   ```

4. **Sidebar additions** — add at bottom:
   ```html
   <div class="sidebar-actions">
     <button id="open-history-btn" class="sidebar-action-btn">📋 History</button>
     <button id="open-settings-btn" class="sidebar-action-btn">⚙ Settings</button>
   </div>
   ```

### Step 2: CSS changes (`app/styles.css`)

**Remove:**
- `.main-tabs`, `.main-tab`, `.main-tab.active` (lines 66-81)
- `.tab-panel`, `.tab-panel.active` (lines 82-83)

**Add:**
```css
/* Timer Hero */
.timer-hero { text-align: center; padding: 40px 22px; }
.timer-hero h2 { font-size: 64px; margin: 0; }
.timer-hero .duration-picker { display: inline-flex; align-items: center; gap: 10px; margin: 16px 0; }
.timer-hero .duration-picker input { width: 80px; text-align: center; font-size: 18px; }

/* Compact Rule Summary */
.rule-summary-panel .chips .chip { cursor: default; }  /* read-only chips */

/* Drawer overlay */
.drawer-overlay {
  position: fixed; inset: 0; z-index: 900;
  background: rgba(20, 40, 15, 0.35);
  backdrop-filter: blur(3px);
}
.drawer {
  position: fixed; top: 0; right: 0; bottom: 0;
  width: min(560px, 85vw);
  background: var(--bg);
  border-left: 1px solid var(--line);
  box-shadow: -10px 0 40px rgba(30, 60, 20, 0.15);
  overflow-y: auto; padding: 28px;
  display: grid; gap: 18px; align-content: start;
}
.drawer-wide { width: min(900px, 90vw); }
.drawer-header { display: flex; justify-content: space-between; align-items: center; }

/* Sidebar action buttons */
.sidebar-actions { margin-top: auto; display: flex; flex-direction: column; gap: 8px; }
.sidebar-action-btn {
  background: rgba(70,120,50,0.10); color: var(--text);
  border-radius: 14px; padding: 12px 16px; font-weight: 600;
  text-align: left; width: 100%;
}

/* Responsive: drawer full-width on narrow screens */
@media (max-width: 1380px) {
  .drawer { width: 100vw; }
}
```

### Step 3: renderer.js refactor (`app/renderer.js`)

**State changes:**
- Remove: `activeMainTab`
- Add: `rulesDrawerOpen`, `historyDrawerOpen`, `settingsDrawerOpen`
- Add: `lastUsedRules` (loaded from localStorage key `sprout-last-rules`)

**Remove:**
- `setMainTab()` function and `tabHeading` map
- All tab button click bindings in `bindEvents()`
- Startup line `setMainTab('rules')`

**Add functions:**
- `openDrawer(name)` / `closeDrawer(name)` — toggle `.hidden` on `#${name}-drawer-overlay`, call appropriate render on close
- `renderFocusView()` — master render based on session status (idle/running/result), toggles hero states and detail sections
- `renderCompactRuleSummary()` — generates one-line text summary + read-only chips (category chips: color dot + label only; window chips: process name only; domain chips: domain only)
- `loadLastRules()` / `persistLastRules()` — localStorage read/write for `sprout-last-rules` (saves `{allowedWindows, allowedDomains, allowedCategories}`)

**Modify:**
- `handleStartSession()`: call `persistLastRules()`, remove `setMainTab('focus')`, call `renderFocusView()`
- `backToRules()` → rename to `startNewSession()`: reset session, keep rules, call `renderFocusView()` (stays on focus view, no tab switch)
- `refreshInitialState()`: load last rules from localStorage on startup, call `renderFocusView()` instead of `setMainTab('rules')`
- `subscribeState` callback: replace `setMainTab('focus')` with `renderFocusView()`
- `bindEvents()`: add drawer open/close button bindings, sidebar history/settings button bindings

**Startup sequence change:**
```js
bindEvents();
renderFocusView();          // was: setMainTab('rules')
refreshInitialState();
setInterval(refreshGuardianHealth, 4000);
```

### Step 4: Polish

- Drawer close on Escape key
- Drawer close on backdrop click
- Animate drawer slide-in with CSS transition (`transform: translateX(100%)` → `translateX(0)`)
- Topbar heading updates: "Ready to Focus" (idle) / "Focusing..." (running) / "Session Complete" (result)
- [Edit Rules] button hidden during running session
- Start button disabled when no rules configured, with hint text "No rules configured"

---

## Files to Modify

| File | Scope |
|------|-------|
| `app/index.html` | Full restructure: remove tabs, create focus view + 3 drawers |
| `app/renderer.js` | Remove tab system, add drawer logic, add renderFocusView, add last-rules persistence |
| `app/styles.css` | Remove tab styles, add drawer/hero/sidebar-action styles |

No changes to: `main.js`, `preload.cjs`, `guardian/*`, `shared/*`

---

## Verification

1. `npm run check` — syntax check passes
2. `npm start` — app launches with focus view as default screen
3. Verify idle state: timer hero shows duration + start button, compact rule summary visible
4. Click "Edit Rules" → drawer slides in with all rule editing UI
5. Add windows/domains/categories in drawer → close drawer → compact summary updates
6. Start session → hero switches to running state, violations appear below
7. End session (challenge or timeout) → hero shows result stats
8. "Start New Session" → resets to idle, rules persist
9. Sidebar history/settings buttons open their respective drawers
10. Close app → reopen → last used rules auto-loaded
11. Responsive: narrow window → sidebar stacks on top, drawer goes full-width
