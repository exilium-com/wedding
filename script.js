const body = document.body;
const openControls = document.querySelectorAll("[data-open-letter]");
const continueControl = document.querySelector("[data-continue]");
const welcome = document.querySelector("#welcome");

function openLetter() {
  if (body.classList.contains("opened")) return;

  body.classList.add("opened");

  window.setTimeout(() => {
    body.classList.add("settled");
  }, 2850);
}

openControls.forEach((control) => {
  control.addEventListener("click", openLetter);
});

continueControl.addEventListener("click", () => {
  body.classList.remove("locked");
  requestAnimationFrame(() => {
    welcome.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

if (new URLSearchParams(window.location.search).has("open")) {
  body.classList.add("opened");
  body.classList.add("settled");
}
