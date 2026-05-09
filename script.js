import { animate } from "motion";
import {
  loadStoredCalligraphyCapture,
  renderCalligraphyCapture,
} from "./calligraphy-renderer.js";
import defaultLetterCalligraphyCapture from "./assets/letter-calligraphy-strokes-6.json";

const letterCalligraphyModules = import.meta.env.DEV
  ? import.meta.glob("./assets/letter-calligraphy-strokes*.json", {
      eager: true,
      import: "default",
    })
  : {};

const seal = document.querySelector(".seal");
const sealArt = document.querySelector(".seal-art");
const envelope = document.querySelector(".envelope");
const flap = document.querySelector(".flap");
const letter = document.querySelector(".letter");
const letterCalligraphy = document.querySelector(".letter-calligraphy");
const site = document.querySelector("#site");
const letterMask = document.querySelector(".letter-mask");
const debugControls = document.querySelector(".debug-controls");
const resetIntro = document.querySelector(".reset-intro");
const nextLetterOption = document.querySelector(".next-letter-option");
const siteRedwood = document.querySelector(".ink-redwood");
const redwoodSplash = document.querySelector(".redwood-splash");
const paintImages = document.querySelectorAll(".paint-image");

const introSeenKey = "weddingIntroSeen";
const letterOptionKey = "weddingLetterCalligraphyOption";
const sealGlow = "drop-shadow(0 0 16px rgba(255, 194, 220, 0.75))";
const sealHoverGlow = "drop-shadow(0 0 24px rgba(255, 178, 214, 0.95))";
const defaultLetterOption = {
  id: "default",
  label: "strokes-6",
  capture: defaultLetterCalligraphyCapture,
};
const importedLetterOptions = (
  import.meta.env.DEV ? Object.entries(letterCalligraphyModules) : []
)
  .sort(([firstPath], [secondPath]) =>
    firstPath.localeCompare(secondPath, undefined, { numeric: true }),
  )
  .map(([path, capture]) => ({
    id: path,
    label: path.replace(/^.*\/letter-calligraphy-/, "").replace(/\.json$/, ""),
    capture,
  }));
const packagedLetterOptions = import.meta.env.DEV
  ? importedLetterOptions
  : [defaultLetterOption];
let opened = false;
let sealAnimation;
let letterYAnimation;
let envelopeYAnimation;
let letterTiltAnimations = [];
let calligraphyDuration = 0;
let calligraphyPlayback = null;
let calligraphyRevealToken = 0;
let currentLetterOptionId = localStorage.getItem(letterOptionKey);
let currentLetterOptionIndex = 0;
let userStartedScrolling = false;
let scrollWatchBaseline = 0;
const introSeen = localStorage.getItem(introSeenKey) === "true";
const letterTransform = { y: 75, rotateX: 0, rotateY: 0 };
const envelopeTransform = { baseY: 0, bobY: 0 };

letter.style.transformOrigin = "center";
letter.style.transformStyle = "preserve-3d";
sealArt.style.transformOrigin = "center";
sealArt.style.filter = sealGlow;

function markIntroSeen() {
  localStorage.setItem(introSeenKey, "true");
}

function getLetterCalligraphyOptions() {
  if (packagedLetterOptions.length) return packagedLetterOptions;

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

function updateLetterOptionButton(options = getLetterCalligraphyOptions()) {
  if (!nextLetterOption) return;

  const shouldShow = import.meta.env.DEV && options.length > 1;
  nextLetterOption.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) return;

  const currentOption = options[currentLetterOptionIndex];
  nextLetterOption.textContent = `Next letter (${currentLetterOptionIndex + 1}/${options.length})`;
  nextLetterOption.title = currentOption
    ? `Current letter option: ${currentOption.label}`
    : "Next letter option";
}

function prepareLetterCalligraphy() {
  const options = getLetterCalligraphyOptions();
  const optionIndex = Math.max(
    0,
    options.findIndex((option) => option.id === currentLetterOptionId),
  );
  const selectedOption = options[optionIndex];
  const capture = selectedOption?.capture;
  if (!letterCalligraphy) return;

  delete letterCalligraphy.dataset.hasCapture;
  calligraphyDuration = 0;
  if (!capture) {
    updateLetterOptionButton(options);
    return;
  }

  currentLetterOptionIndex = optionIndex;
  currentLetterOptionId = selectedOption.id;
  calligraphyPlayback?.destroy();
  calligraphyPlayback = renderCalligraphyCapture(letterCalligraphy, capture, {
    playbackSpeed: 5,
    strokeGap: 0.03,
    lastStrokeDurationMultiplier: 2,
  });
  calligraphyDuration = calligraphyPlayback?.duration || 0;
  if (!calligraphyDuration) {
    updateLetterOptionButton(options);
    return;
  }

  letterCalligraphy.dataset.hasCapture = "true";
  updateLetterOptionButton(options);
}

function completeLetterCalligraphy() {
  if (!letterCalligraphy?.dataset.hasCapture) return;

  calligraphyRevealToken += 1;
  letterCalligraphy.classList.remove("is-animating");
  letterCalligraphy.classList.add("is-visible", "is-complete");
  calligraphyPlayback?.complete();
}

function revealLetterCalligraphy(delay = 0.25) {
  if (!letterCalligraphy?.dataset.hasCapture) return Promise.resolve();

  const revealToken = (calligraphyRevealToken += 1);
  const playback = calligraphyPlayback;

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    completeLetterCalligraphy();
    return Promise.resolve();
  }

  letterCalligraphy.classList.remove(
    "is-visible",
    "is-animating",
    "is-complete",
  );
  playback?.reset();
  letterCalligraphy.getBoundingClientRect();

  return new Promise((resolve) => {
    setTimeout(() => {
      if (revealToken !== calligraphyRevealToken) {
        resolve();
        return;
      }

      letterCalligraphy.classList.add("is-visible");
      requestAnimationFrame(() => {
        if (revealToken !== calligraphyRevealToken) {
          resolve();
          return;
        }

        letterCalligraphy.classList.add("is-animating");
        playback?.play().then(() => {
          if (revealToken !== calligraphyRevealToken) {
            resolve();
            return;
          }

          letterCalligraphy.classList.remove("is-animating");
          letterCalligraphy.classList.add("is-complete");
          resolve();
        });
      });
    }, delay * 1000);
  });
}

function selectNextLetterOption() {
  const options = getLetterCalligraphyOptions();
  if (options.length < 2) return;

  markUserStartedScrolling();
  const nextIndex = (currentLetterOptionIndex + 1) % options.length;
  currentLetterOptionId = options[nextIndex].id;
  currentLetterOptionIndex = nextIndex;
  localStorage.setItem(letterOptionKey, currentLetterOptionId);
  prepareLetterCalligraphy();
  revealLetterCalligraphy(0);
}

function markUserStartedScrolling() {
  userStartedScrolling = true;
}

function markKeyboardScrollIntent(event) {
  const scrollKeys = new Set([
    " ",
    "ArrowDown",
    "ArrowUp",
    "End",
    "Home",
    "PageDown",
    "PageUp",
  ]);

  if (scrollKeys.has(event.key)) {
    markUserStartedScrolling();
  }
}

function detectManualScroll() {
  if (Math.abs(window.scrollY - scrollWatchBaseline) > 4) {
    markUserStartedScrolling();
  }
}

function startScrollWatch() {
  userStartedScrolling = false;
  scrollWatchBaseline = window.scrollY;
  window.addEventListener("wheel", markUserStartedScrolling, { passive: true });
  window.addEventListener("touchmove", markUserStartedScrolling, {
    passive: true,
  });
  window.addEventListener("keydown", markKeyboardScrollIntent);
  window.addEventListener("scroll", detectManualScroll, { passive: true });
}

function stopScrollWatch() {
  window.removeEventListener("wheel", markUserStartedScrolling);
  window.removeEventListener("touchmove", markUserStartedScrolling);
  window.removeEventListener("keydown", markKeyboardScrollIntent);
  window.removeEventListener("scroll", detectManualScroll);
}

function scrollToSiteUnlessInterrupted() {
  stopScrollWatch();

  if (userStartedScrolling) return;

  animate(window.scrollY, site.offsetTop, {
    duration: 2.4,
    delay: 1,
    ease: "easeOut",
    onUpdate(value) {
      scrollTo(0, value);
    },
  });
}

function revealSite() {
  site.classList.remove("hidden");
  document.body.classList.remove("overflow-hidden");
  debugControls.classList.remove("hidden");
}

function revealRedwood() {
  return new Promise((resolve) => {
    siteRedwood.classList.add("is-active");
    redwoodSplash.addEventListener(
      "animationend",
      () => {
        resolve();
      },
      { once: true },
    );
  });
}

function setupPaintImages() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    paintImages.forEach((image) => image.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -15% 0px", threshold: 0.15 },
  );

  paintImages.forEach((image) => observer.observe(image));
}

function setLetterTransform() {
  letter.style.transform = `perspective(900px) translateY(${letterTransform.y}%) rotateX(${letterTransform.rotateX}deg) rotateY(${letterTransform.rotateY}deg)`;
}

function setEnvelopeTransform() {
  envelope.style.transform = `translateY(${envelopeTransform.baseY + envelopeTransform.bobY}px)`;
}

setLetterTransform();
setEnvelopeTransform();

animate(0, [0, -8, 0], {
  duration: 3,
  repeat: Infinity,
  ease: "easeInOut",
  onUpdate(value) {
    envelopeTransform.bobY = value;
    setEnvelopeTransform();
  },
});

function animateSeal(scale, filter, duration) {
  if (opened) return;

  sealAnimation?.stop();
  sealAnimation = animate(
    sealArt,
    { scale, filter },
    { duration, ease: "easeOut" },
  );
}

function animateLetterTilt(rotateX, rotateY, duration) {
  letterTiltAnimations.forEach((animation) => animation.stop());
  letterTiltAnimations = [
    animate(letterTransform.rotateX, rotateX, {
      duration,
      ease: "easeOut",
      onUpdate(value) {
        letterTransform.rotateX = value;
        setLetterTransform();
      },
    }),
    animate(letterTransform.rotateY, rotateY, {
      duration,
      ease: "easeOut",
      onUpdate(value) {
        letterTransform.rotateY = value;
        setLetterTransform();
      },
    }),
  ];
}

function tiltLetter(event) {
  const rect = envelope.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
  animateLetterTilt(y * 10, -x * 10, 0.25);
}

async function openEnvelope() {
  if (opened) return;

  seal.disabled = true;

  animate(
    sealArt,
    { opacity: 0 },
    {
      duration: 0.24,
      ease: "easeOut",
      onComplete() {
        seal.remove();
      },
    },
  );

  await animate(
    flap,
    { transform: ["rotateX(0deg)", "rotateX(90deg)"] },
    { duration: 0.52, delay: 0.12, ease: "easeIn" },
  ).finished;

  flap.style.zIndex = "0";

  await animate(
    flap,
    { transform: ["rotateX(90deg)", "rotateX(180deg) translateY(-4px)"] },
    { duration: 0.68, ease: [0.2, 0.82, 0.18, 1] },
  ).finished;

  letterYAnimation?.stop();
  envelopeYAnimation?.stop();
  const letterStartY = letterTransform.y;
  const envelopeDrop = (letter.offsetHeight * letterStartY) / 300;
  revealSite();
  startScrollWatch();
  const redwoodReveal = revealRedwood();
  const calligraphyReveal = revealLetterCalligraphy(0.4);

  letterYAnimation = animate(letterStartY, 0, {
    duration: 1.5,
    ease: "easeOut",
    onUpdate(value) {
      letterTransform.y = value;
      setLetterTransform();
    },
    onComplete() {
      opened = true;
      letterMask.classList.remove("overflow-hidden");
    },
  });

  envelopeYAnimation = animate(envelopeTransform.baseY, envelopeDrop, {
    duration: 3,
    delay: 0.12,
    ease: "backOut",
    onUpdate(value) {
      envelopeTransform.baseY = value;
      setEnvelopeTransform();
    },
  });

  await Promise.all([
    letterYAnimation.finished,
    envelopeYAnimation.finished,
    redwoodReveal,
    calligraphyReveal,
  ]);

  markIntroSeen();

  scrollToSiteUnlessInterrupted();
}

function completeIntroState() {
  opened = true;
  letterTransform.y = 0;
  letterTransform.rotateX = 0;
  letterTransform.rotateY = 0;
  envelopeTransform.baseY = 0;
  envelopeTransform.bobY = 0;
  setLetterTransform();
  setEnvelopeTransform();
  letterMask.classList.remove("overflow-hidden");
  flap.style.zIndex = "0";
  flap.style.transform = "rotateX(180deg) translateY(-4px)";
  seal.remove();
  completeLetterCalligraphy();
  revealSite();
  siteRedwood.classList.add("is-active");
  requestAnimationFrame(() => scrollTo(0, site.offsetTop));
}

resetIntro.addEventListener("click", () => {
  localStorage.removeItem(introSeenKey);
  location.reload();
});
nextLetterOption.addEventListener("click", selectNextLetterOption);

envelope.addEventListener("pointermove", tiltLetter);
envelope.addEventListener("pointerleave", () => animateLetterTilt(0, 0, 2));
prepareLetterCalligraphy();
setupPaintImages();

if (introSeen) {
  completeIntroState();
} else {
  seal.addEventListener("pointerenter", () =>
    animateSeal(1.1, sealHoverGlow, 0.2),
  );
  seal.addEventListener("pointerleave", () => animateSeal(1, sealGlow, 0.2));
  seal.addEventListener("pointerdown", () =>
    animateSeal(0.9, sealHoverGlow, 0.1),
  );
  seal.addEventListener("pointerup", () =>
    animateSeal(1.1, sealHoverGlow, 0.2),
  );
  seal.addEventListener("pointercancel", () => animateSeal(1, sealGlow, 0.2));
  seal.addEventListener("click", openEnvelope);
}
