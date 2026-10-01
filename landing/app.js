/* Small, dependency-free enhancements. The page stays readable without motion. */
const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
const mobile = window.matchMedia("(max-width: 640px)");
const root = document.documentElement;
const hero = document.querySelector(".hero");
const layers = [...document.querySelectorAll("[data-depth]")];
const progress = document.querySelector(".scroll-progress");
let scheduled = false;

function paintScroll() {
  const y = window.scrollY;
  const limit = root.scrollHeight - window.innerHeight;
  progress.style.transform = `scaleX(${limit > 0 ? Math.min(1, y / limit) : 0})`;
  if (!motion.matches && !root.classList.contains("motion-paused")) {
    const offset = Math.min(y, hero.offsetHeight);
    root.style.setProperty("--scroll", `${offset}px`);
    for (const layer of layers) {
      const amount =
        offset * Number(layer.dataset.depth) * (mobile.matches ? 0.45 : 1);
      layer.style.setProperty("--parallax", `${amount.toFixed(1)}px`);
    }
  } else {
    root.style.setProperty("--scroll", "0px");
    layers.forEach((layer) => layer.style.setProperty("--parallax", "0px"));
  }
  scheduled = false;
}
function scheduleScroll() {
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(paintScroll);
  }
}
window.addEventListener("scroll", scheduleScroll, { passive: true });
window.addEventListener("resize", scheduleScroll, { passive: true });
motion.addEventListener("change", scheduleScroll);
paintScroll();

const motionToggle = document.querySelector(".motion-toggle");
motionToggle.addEventListener("click", () => {
  const paused = root.classList.toggle("motion-paused");
  motionToggle.setAttribute("aria-pressed", String(paused));
  const label = paused ? "Resume motion effects" : "Pause motion effects";
  motionToggle.setAttribute("aria-label", label);
  motionToggle.title = label;
  motionToggle.firstElementChild.textContent = paused ? "▷" : "Ⅱ";
  scheduleScroll();
});

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08 },
  );
  document
    .querySelectorAll(".reveal")
    .forEach((element) => observer.observe(element));
  root.classList.add("motion-ready");
}

const applyBody =
  "Name you work under:\n\nWhere fans find you (links):\n\nYour usual custom-video rates:\n\nWhat you would like on your menu:\n\nYour boundaries or unavailable options:\n\nBest way to reach you:\n";
document.querySelectorAll("[data-apply]").forEach((link) => {
  link.href = `mailto:info@studiolens.me?subject=${encodeURIComponent("Founding creator application")}&body=${encodeURIComponent(applyBody)}`;
});

const toggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#mobile-nav");
function closeMenu() {
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Open navigation");
  navigation.hidden = true;
}
toggle.addEventListener("click", () => {
  const expanded = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-expanded", String(!expanded));
  toggle.setAttribute(
    "aria-label",
    expanded ? "Open navigation" : "Close navigation",
  );
  navigation.hidden = expanded;
});
navigation
  .querySelectorAll("a")
  .forEach((link) => link.addEventListener("click", closeMenu));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !navigation.hidden) {
    closeMenu();
    toggle.focus();
  }
});
document.addEventListener("click", (event) => {
  if (!navigation.hidden && !event.target.closest(".site-header")) closeMenu();
});
window.matchMedia("(min-width: 851px)").addEventListener("change", (event) => {
  if (event.matches) closeMenu();
});

const form = document.querySelector("#request-builder");
const estimate = document.querySelector("#estimate");
const dialog = document.querySelector("#scene-dialog");
const money = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
function selections() {
  return [...form.querySelectorAll("input:checked")];
}
function total() {
  return selections().reduce((sum, input) => sum + Number(input.value), 0);
}
form.addEventListener("change", () => {
  estimate.value = money(total());
  estimate.classList.remove("amount-changed");
  requestAnimationFrame(() => estimate.classList.add("amount-changed"));
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const lines = document.querySelector("#dialog-lines");
  lines.replaceChildren();
  selections().forEach((input) => {
    const row = document.createElement("div");
    row.className = "scene-line";
    const label = document.createElement("span");
    label.textContent = input.dataset.label;
    const price = document.createElement("strong");
    price.textContent =
      Number(input.value) === 0 ? "Included" : money(Number(input.value));
    row.append(label, price);
    lines.append(row);
  });
  document.querySelector("#dialog-total").textContent = money(total());
  dialog.showModal();
});
dialog
  .querySelector(".dialog-close")
  .addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  const rect = dialog.getBoundingClientRect();
  if (
    event.target === dialog &&
    (event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom)
  )
    dialog.close();
});
