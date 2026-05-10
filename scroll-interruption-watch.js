const SCROLL_KEYS = new Set([
  " ",
  "ArrowDown",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
]);

export function createScrollInterruptionWatch({ threshold = 4 } = {}) {
  let interrupted = false;
  let baseline = 0;

  function mark() {
    interrupted = true;
  }

  function markKeyboardIntent(event) {
    if (SCROLL_KEYS.has(event.key)) mark();
  }

  function detectScrollDelta() {
    if (Math.abs(window.scrollY - baseline) > threshold) mark();
  }

  function start() {
    interrupted = false;
    baseline = window.scrollY;
    window.addEventListener("wheel", mark, { passive: true });
    window.addEventListener("touchmove", mark, { passive: true });
    window.addEventListener("keydown", markKeyboardIntent);
    window.addEventListener("scroll", detectScrollDelta, { passive: true });
  }

  function stop() {
    window.removeEventListener("wheel", mark);
    window.removeEventListener("touchmove", mark);
    window.removeEventListener("keydown", markKeyboardIntent);
    window.removeEventListener("scroll", detectScrollDelta);
  }

  return {
    mark,
    start,
    stop,
    get interrupted() {
      return interrupted;
    },
  };
}
