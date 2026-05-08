import { animate } from "motion";

const seal = document.querySelector(".seal");
const sealArt = document.querySelector(".seal-art");
const envelope = document.querySelector(".envelope");
const flap = document.querySelector(".flap");
const letter = document.querySelector(".letter");
const site = document.querySelector("#site");
const letterMask = document.querySelector(".letter-mask");
const resetIntro = document.querySelector(".reset-intro");
const siteRedwood = document.querySelector(".ink-redwood");
const redwoodSplash = document.querySelector(".redwood-splash");

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

letter.style.transformOrigin = "center";
letter.style.transformStyle = "preserve-3d";
sealArt.style.transformOrigin = "center";
sealArt.style.filter = sealGlow;

function markIntroSeen() {
  localStorage.setItem(introSeenKey, "true");
}

function revealSite() {
  site.classList.remove("hidden");
  document.body.classList.remove("overflow-hidden");
  resetIntro.classList.remove("hidden");
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
  const redwoodReveal = revealRedwood();

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
  ]);

  markIntroSeen();

  animate(window.scrollY, site.offsetTop, {
    duration: 2.4,
    delay: 1,
    ease: "easeOut",
    onUpdate(value) {
      scrollTo(0, value);
    },
  });
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
