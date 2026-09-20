// harryMovementController.js
//
// Single, app-wide movement scheduler for the Harry character.
//
// Rules encoded here (do not change without re-reading the spec):
//   - Harry waits until the user has spent HARRY_WAIT_INTERVAL of ACTIVE
//     (tab-visible) time on the site, then walks for exactly
//     HARRY_WALK_DURATION, then stops completely and the active-time count
//     starts over from zero.
//   - "Active time" means the browser tab is visible. Time spent with the
//     tab hidden/backgrounded is NOT counted - the countdown pauses while
//     hidden and resumes from where it left off when the tab becomes
//     visible again. We deliberately do NOT rely on a single long-lived
//     setTimeout for this, because background tabs are throttled/frozen by
//     the browser and a plain setTimeout can't reliably tell "1 hour of
//     wall-clock time" apart from "1 hour of active time". Instead we poll
//     with a 1-second ticker and only accumulate while
//     document.visibilityState === "visible".
//   - There is only ONE scheduler for the whole app lifetime. It is created
//     the first time this module is used (see init()) and is never
//     re-created just because a component re-rendered or the chat panel
//     opened/closed.
//   - If Harry is busy (listening / thinking / talking / mic open) when the
//     walk becomes due, the walk is postponed until he's free again -
//     speech and chat are never interrupted.
//   - When the user leaves/closes the site, nothing needs to keep running
//     in the background - the ticker simply stops with the page.
//
// This file has no React/DOM dependency beyond the (optional) `document`
// visibility check, so it survives component remounts unchanged and is easy
// to unit-test by calling _debugForceWalk()/tick() directly.

// ---- Production timing (per spec) -----------------------------------------
export const HARRY_WAIT_INTERVAL = 60 * 60 * 1000; // 1 hour of ACTIVE time
export const HARRY_WALK_DURATION = 60 * 1000; // 1 minute

// ---- Dev-only test timing --------------------------------------------------
// To smoke-test the walking cycle quickly during development, temporarily
// flip HARRY_TEST_MODE to true. This must be false before shipping.
const HARRY_TEST_MODE = false;
const TEST_WAIT_INTERVAL = 10 * 1000; // 10s of active time
const TEST_WALK_DURATION = 5 * 1000; // 5s

const WAIT_INTERVAL = HARRY_TEST_MODE ? TEST_WAIT_INTERVAL : HARRY_WAIT_INTERVAL;
const WALK_DURATION = HARRY_TEST_MODE ? TEST_WALK_DURATION : HARRY_WALK_DURATION;

// How often we sample "are we visible right now" and add to the active-time
// counter. 1s is precise enough for an hour-scale cycle and cheap to run.
const TICK_MS = 1000;

// Safe on-screen anchors. Each keeps clear of the top navbar, page footers,
// and (via the chat panel's own positioning) the chat controls themselves.
export const HARRY_POSITIONS = [
  { id: "bottom-right", top: "84vh", left: "92vw" },
  { id: "bottom-left", top: "84vh", left: "8vw" },
  { id: "middle-right", top: "48vh", left: "92vw" },
  { id: "middle-left", top: "48vh", left: "8vw" }
];

let positionIndex = 0; // starts at bottom-right
let state = "idle"; // "idle" | "walking"
let busy = false; // true while the widget is listening/thinking/talking/mic-open
let pendingWalk = false;
let activeMs = 0; // accumulated ACTIVE (tab-visible) time since the last walk
let tickTimer = null;
let walkTimer = null;
let started = false;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => {
    try { fn(getSnapshot()); } catch { /* ignore listener errors */ }
  });
}

function isTabVisible() {
  // In non-browser contexts (tests, SSR) treat as always visible.
  return typeof document === "undefined" || document.visibilityState === "visible";
}

function tick() {
  if (state === "walking") return; // the walk itself runs on its own real-time timer
  if (!isTabVisible()) return; // paused: tab is hidden, don't count this second

  activeMs += TICK_MS;
  if (activeMs >= WAIT_INTERVAL) {
    activeMs = 0;
    if (busy) {
      // Don't interrupt an active conversation/speech/mic session - try again
      // as soon as the widget reports it's free (see setBusy below).
      pendingWalk = true;
    } else {
      beginWalk();
    }
  }
}

function beginWalk() {
  pendingWalk = false;
  positionIndex = (positionIndex + 1) % HARRY_POSITIONS.length;
  state = "walking";
  emit();
  clearTimeout(walkTimer);
  walkTimer = setTimeout(() => {
    state = "idle";
    activeMs = 0; // start the next 1-hour active-time count from zero
    emit();
  }, WALK_DURATION);
}

/** Call once (idempotent) to start the active-time ticker. Safe to call from
 * every mount of the widget - only the first call has any effect. The
 * ticker naturally does nothing useful once the page/tab is closed, so
 * there is nothing to keep alive "in the background" after that. */
export function init() {
  if (started) return;
  started = true;
  clearInterval(tickTimer);
  tickTimer = setInterval(tick, TICK_MS);
}

/** The widget calls this whenever it enters/leaves a listening, thinking,
 * talking, or mic-open state, so the walk never interrupts it. */
export function setBusy(nextBusy) {
  busy = nextBusy;
  if (!busy && pendingWalk) beginWalk();
}

export function getSnapshot() {
  return { state, position: HARRY_POSITIONS[positionIndex] };
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Test-only helper, not used in production code paths. Forces a walk right
 * now regardless of accumulated active time (still respects `busy`). */
export function _debugForceWalk() {
  activeMs = WAIT_INTERVAL;
  tick();
}
