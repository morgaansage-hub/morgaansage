// =========================================================
// 1. Pixel field: draws the blue grid "clouds" behind .field sections.
//    Pure code, no images. Tweak CELL / THRESHOLD to change the look.
// =========================================================
const CELL = 9;            // size of each grid square in px
const THRESHOLD = 0.08;    // higher = fewer filled squares
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const BLUE = getComputedStyle(document.documentElement).getPropertyValue("--blue").trim() || "#3d6bf5";

// smooth pseudo-noise from layered sine waves
function noise(x, y, t) {
  return (
    Math.sin(x * 0.045 + t) * Math.cos(y * 0.05 - t * 0.7) +
    Math.sin((x + y) * 0.021 - t * 0.5) * 0.8 +
    Math.cos(x * 0.11 - y * 0.07 + t * 1.3) * 0.35 +
    // grainy texture so it reads as pixels, not smooth blobs
    (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1) * 0.28
  ) / 2.15;
}

document.querySelectorAll("[data-field]").forEach((section) => {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  section.prepend(canvas);
  section.classList.add("has-canvas");
  const ctx = canvas.getContext("2d");
  let w, h, cols, rows, dpr, t = Math.random() * 100, visible = true;
  const mouse = { x: -999, y: -999 };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = section.clientWidth; h = section.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / CELL); rows = Math.ceil(h / CELL);
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    // grid lines
    ctx.strokeStyle = BLUE; ctx.globalAlpha = 0.9; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= cols; c++) { ctx.moveTo(c * CELL + 0.5, 0); ctx.lineTo(c * CELL + 0.5, h); }
    for (let r = 0; r <= rows; r++) { ctx.moveTo(0, r * CELL + 0.5); ctx.lineTo(w, r * CELL + 0.5); }
    ctx.stroke();
    // filled "cloud" squares + cursor glow
    ctx.fillStyle = BLUE;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = c * CELL, y = r * CELL;
        let n = noise(c * 1.6, r * 1.6, t);
        const d = Math.hypot(x - mouse.x, y - mouse.y);
        if (d < 120) n += (1 - d / 120) * 0.6;
        if (n > THRESHOLD) {
          ctx.globalAlpha = Math.min(1, 0.35 + (n - THRESHOLD) * 1.6);
          ctx.fillRect(x + 2, y + 2, CELL - 3, CELL - 3);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  let last = 0;
  function loop(ts) {
    if (visible && ts - last > 90) { t += 0.035; draw(); last = ts; }
    requestAnimationFrame(loop);
  }

  section.addEventListener("pointermove", (e) => {
    const r = section.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    if (reduceMotion) draw();
  });
  section.addEventListener("pointerleave", () => { mouse.x = mouse.y = -999; if (reduceMotion) draw(); });

  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(section);
  new ResizeObserver(resize).observe(section);
  resize();
  if (!reduceMotion) requestAnimationFrame(loop);
});

// =========================================================
// 2. "your image here" stickers on placeholders
//    (they disappear automatically once you swap in an <img>)
// =========================================================
document.querySelectorAll(".sel > .ph").forEach((ph) => {
  const label = document.createElement("span");
  label.className = "sel-label";
  label.textContent = "your image here";
  ph.after(label);
});

// =========================================================
// 3. Project filters
// =========================================================
const grid = document.getElementById("grid");
const filters = document.querySelectorAll(".filter");
const cards = document.querySelectorAll(".card");
const count = document.getElementById("count");

function applyFilter(cat) {
  let shown = 0;
  cards.forEach((card) => {
    const match = cat === "all" || card.dataset.cat === cat;
    card.classList.toggle("is-hidden", !match);
    if (match) shown++;
  });
  grid?.classList.toggle("is-filtered", cat !== "all");
  filters.forEach((f) => {
    const on = f.dataset.filter === cat;
    f.classList.toggle("is-active", on);
    f.setAttribute("aria-pressed", on);
  });
  if (count) count.textContent = String(shown).padStart(2, "0");
}
filters.forEach((f) => f.addEventListener("click", () => applyFilter(f.dataset.filter)));
if (cards.length) applyFilter("all");
