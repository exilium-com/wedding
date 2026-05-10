import {
  loadStoredCalligraphyCapture,
  renderCalligraphyCapture,
} from "./calligraphy-renderer.js";
import defaultLetterCalligraphyCapture from "./assets/letter-calligraphy-strokes-6.json";

const LETTER_OPTION_KEY = "weddingLetterCalligraphyOption";
const DEFAULT_OPTION_LABEL = "strokes-6";
const DEFAULT_DEV_OPTION_ID = "./assets/letter-calligraphy-strokes-6.json";
const DEFAULT_PLAYBACK_OPTIONS = {
  playbackSpeed: 10,
  strokeGap: 0.03,
  lastStrokeDurationMultiplier: 2,
};
const letterCalligraphyModules = import.meta.env.DEV
  ? import.meta.glob("./assets/letter-calligraphy-strokes*.json", {
      eager: true,
      import: "default",
    })
  : {};
const defaultOptionId = import.meta.env.DEV ? DEFAULT_DEV_OPTION_ID : "default";
const importedLetterOptions = Object.entries(letterCalligraphyModules)
  .sort(([firstPath], [secondPath]) =>
    firstPath.localeCompare(secondPath, undefined, { numeric: true }),
  )
  .map(([path, capture]) => ({
    id: path,
    label: path.replace(/^.*\/letter-calligraphy-/, "").replace(/\.json$/, ""),
    capture,
  }));

function packagedLetterOptions() {
  if (import.meta.env.DEV) return importedLetterOptions;

  return [
    {
      id: "default",
      label: DEFAULT_OPTION_LABEL,
      capture: defaultLetterCalligraphyCapture,
    },
  ];
}

function storedLetterOption() {
  const storedCapture = loadStoredCalligraphyCapture();
  return storedCapture
    ? [
        {
          id: "stored",
          label: "local capture",
          capture: storedCapture,
        },
      ]
    : [];
}

function letterOptions() {
  const packagedOptions = packagedLetterOptions();
  return packagedOptions.length ? packagedOptions : storedLetterOption();
}

function optionIndexFor(options, optionId) {
  const exactIndex = options.findIndex((option) => option.id === optionId);
  if (exactIndex >= 0) return exactIndex;

  const defaultIndex = options.findIndex(
    (option) =>
      option.id === defaultOptionId || option.label === DEFAULT_OPTION_LABEL,
  );

  return Math.max(defaultIndex, 0);
}

function setVisible(element, isVisible) {
  element?.classList.toggle("hidden", !isVisible);
}

export function createLetterCalligraphyController({
  canvas,
  nextButton,
  onDebugSwitch = () => {},
  playbackOptions = {},
} = {}) {
  let playback = null;
  let revealToken = 0;
  let currentOptionId =
    localStorage.getItem(LETTER_OPTION_KEY) || defaultOptionId;
  let currentOptionIndex = 0;

  function updateButton(options = letterOptions()) {
    if (!nextButton) return;

    const shouldShow = import.meta.env.DEV && options.length > 1;
    setVisible(nextButton, shouldShow);
    if (!shouldShow) return;

    const currentOption = options[currentOptionIndex];
    nextButton.textContent = `Next letter (${currentOptionIndex + 1}/${options.length})`;
    nextButton.title = currentOption
      ? `Current letter option: ${currentOption.label}`
      : "Next letter option";
  }

  function prepare() {
    const options = letterOptions();
    const optionIndex = optionIndexFor(options, currentOptionId);
    const selectedOption = options[optionIndex];

    if (!canvas) return;

    delete canvas.dataset.hasCapture;

    if (!selectedOption?.capture) {
      updateButton(options);
      return;
    }

    currentOptionIndex = optionIndex;
    currentOptionId = selectedOption.id;
    playback?.destroy();
    playback = renderCalligraphyCapture(canvas, selectedOption.capture, {
      ...DEFAULT_PLAYBACK_OPTIONS,
      ...playbackOptions,
    });
    const duration = playback?.duration || 0;

    if (duration) {
      canvas.dataset.hasCapture = "true";
    }

    updateButton(options);
  }

  function complete() {
    if (!canvas?.dataset.hasCapture) return;

    revealToken += 1;
    canvas.classList.remove("is-animating");
    canvas.classList.add("is-visible", "is-complete");
    playback?.complete();
  }

  function resolveIfStale(token, resolve) {
    if (token === revealToken) return false;

    resolve();
    return true;
  }

  function reveal(delay = 0.25) {
    if (!canvas?.dataset.hasCapture) return Promise.resolve();

    const token = (revealToken += 1);
    const activePlayback = playback;

    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      complete();
      return Promise.resolve();
    }

    canvas.classList.remove("is-visible", "is-animating", "is-complete");
    activePlayback?.reset();
    canvas.getBoundingClientRect();

    return new Promise((resolve) => {
      setTimeout(() => {
        if (resolveIfStale(token, resolve)) return;

        canvas.classList.add("is-visible");
        requestAnimationFrame(() => {
          if (resolveIfStale(token, resolve)) return;

          canvas.classList.add("is-animating");
          const playbackFinished = activePlayback?.play() || Promise.resolve();
          playbackFinished.then(() => {
            if (resolveIfStale(token, resolve)) return;

            canvas.classList.remove("is-animating");
            canvas.classList.add("is-complete");
            resolve();
          });
        });
      }, delay * 1000);
    });
  }

  function selectNext() {
    const options = letterOptions();
    if (options.length < 2) return;

    onDebugSwitch();
    currentOptionIndex = (currentOptionIndex + 1) % options.length;
    currentOptionId = options[currentOptionIndex].id;
    localStorage.setItem(LETTER_OPTION_KEY, currentOptionId);
    prepare();
    reveal(0);
  }

  nextButton?.addEventListener("click", selectNext);

  return {
    complete,
    prepare,
    reveal,
  };
}
