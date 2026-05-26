import { animate } from "motion";
import { createLetterCalligraphyController } from "./letter-calligraphy-controller.js";
import { createScrollInterruptionWatch } from "./scroll-interruption-watch.js";

const seal = document.querySelector(".seal");
const sealArt = document.querySelector(".seal-art");
const envelope = document.querySelector(".envelope");
const flap = document.querySelector(".flap");
const letter = document.querySelector(".letter");
const letterCalligraphy = document.querySelector(".letter-calligraphy");
const site = document.querySelector("#site");
const siteNav = document.querySelector(".site-nav");
const letterMask = document.querySelector(".letter-mask");
const debugControls = document.querySelector(".debug-controls");
const resetIntro = document.querySelector(".reset-intro");
const nextLetterOption = document.querySelector(".next-letter-option");
const siteRedwood = document.querySelector(".ink-redwood");
const redwoodSplash = document.querySelector(".redwood-splash");
const paintImages = document.querySelectorAll(".paint-image");

const introSeenKey = "weddingIntroSeen";
const sealGlow = "drop-shadow(0 0 16px rgba(255, 194, 220, 0.75))";
const sealHoverGlow = "drop-shadow(0 0 24px rgba(255, 178, 214, 0.95))";
let opened = false;
let sealAnimation;
let letterYAnimation;
let envelopeYAnimation;
let letterTiltAnimations = [];
const introSeen = localStorage.getItem(introSeenKey) === "true";
const letterTransform = { y: 75, rotateX: 0, rotateY: 0 };
const envelopeTransform = { baseY: 0, bobY: 0 };
const scrollWatch = createScrollInterruptionWatch();
const letterCalligraphyController = createLetterCalligraphyController({
  canvas: letterCalligraphy,
  nextButton: nextLetterOption,
  onDebugSwitch: scrollWatch.mark,
});

letter.style.transformOrigin = "center";
letter.style.transformStyle = "preserve-3d";
sealArt.style.transformOrigin = "center";
sealArt.style.filter = sealGlow;

function markIntroSeen() {
  localStorage.setItem(introSeenKey, "true");
}

function scrollToSiteUnlessInterrupted() {
  scrollWatch.stop();

  if (scrollWatch.interrupted) return;

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

function setupAutoHideNav() {
  const hideClasses = ["-translate-y-full", "opacity-0", "pointer-events-none"];
  let lastY = window.scrollY;
  let ticking = false;

  function setHidden(isHidden) {
    siteNav.classList.toggle(hideClasses[0], isHidden);
    siteNav.classList.toggle(hideClasses[1], isHidden);
    siteNav.classList.toggle(hideClasses[2], isHidden);
  }

  function update() {
    const currentY = window.scrollY;
    const delta = currentY - lastY;
    const nearSiteTop = currentY <= site.offsetTop + 24;

    if (nearSiteTop || delta < -8) {
      setHidden(false);
    } else if (delta > 8) {
      setHidden(true);
    }

    lastY = currentY;
    ticking = false;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;

      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true },
  );

  siteNav.addEventListener("focusin", () => setHidden(false));
  siteNav.addEventListener("pointerenter", () => setHidden(false));
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
  scrollWatch.start();
  const redwoodReveal = revealRedwood();
  const calligraphyReveal = letterCalligraphyController.reveal(0.4);

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
  letterCalligraphyController.complete();
  revealSite();
  siteRedwood.classList.add("is-active");
  requestAnimationFrame(() => scrollTo(0, site.offsetTop));
}

resetIntro.addEventListener("click", () => {
  localStorage.removeItem(introSeenKey);
  location.reload();
});

envelope.addEventListener("pointermove", tiltLetter);
envelope.addEventListener("pointerleave", () => animateLetterTilt(0, 0, 2));
letterCalligraphyController.prepare();
setupPaintImages();
setupAutoHideNav();

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
