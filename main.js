// =========================================================
// 1. Pixel field: draws the blue grid "clouds" behind .field sections.
//    Pure code, no images. Tweak CELL / THRESHOLD to change the look.
// =========================================================
const CELL = 9;            // size of each grid square in px
const THRESHOLD = 0.08;    // higher = fewer filled squares
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Motion on/off (shared by every moving grid, remembered per visitor) ----------
// Default follows the visitor's OS "reduce motion" setting; the button overrides it.
let motionOn = !reduceMotion;
try { const saved = localStorage.getItem("motion"); if (saved !== null) motionOn = saved === "on"; } catch (e) {}
const motionButtons = [];
function setMotion(on) {
  motionOn = on;
  document.documentElement.classList.toggle("motion-off", !on);
  try { localStorage.setItem("motion", on ? "on" : "off"); } catch (e) {}
  motionButtons.forEach((b) => {
    b.setAttribute("aria-pressed", String(!on));
    b.innerHTML = on
      ? '<span class="motion-toggle__icon" aria-hidden="true">❚❚</span> Pause motion'
      : '<span class="motion-toggle__icon" aria-hidden="true">▶</span> Play motion';
  });
}
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

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

document.querySelectorAll("[data-field]").forEach((section) => {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  section.prepend(canvas);
  section.classList.add("has-canvas");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "motion-toggle";
  btn.title = "Pause or play the background animation";
  btn.addEventListener("click", () => setMotion(!motionOn));
  section.append(btn);
  motionButtons.push(btn);
  const ctx = canvas.getContext("2d");
  const gridLayer = document.createElement("canvas"); // grid lines drawn once, reused every frame
  const gctx = gridLayer.getContext("2d");
  let w, h, cols, rows, dpr, t = Math.random() * 100, visible = true, lastTs = 0;
  // Optional halftone image drawn INTO the grid: data-image, data-image-box="x,y,w,h" (0–1 of the section), data-image-align
  let weights = null, haloW = null, img = null;
  let maskImg = null;
  if (section.dataset.image) {
    img = new Image();
    maskImg = new Image();
    let loaded = 0;
    const done = () => { if (++loaded === 2) buildWeights(); };
    img.onload = done; maskImg.onload = done;
    img.src = section.dataset.image;                                     // blue halftone shown on the page
    maskImg.src = section.dataset.image.replace(/\.png$/, "-mask.png");  // grayscale copy used to calm the clouds behind it
  }
  function buildWeights() {
    if (!img || !maskImg || !maskImg.complete || !maskImg.naturalWidth || !cols) return;
    try {
      const [bx, by, bw, bh] = (section.dataset.imageBox || "0,0,1,1").split(",").map(Number);
      const off = document.createElement("canvas");
      off.width = cols; off.height = rows;
      const o = off.getContext("2d");
      // fit the image inside the box (in cell units), keeping its proportions
      const boxW = bw * cols, boxH = bh * rows;
      const scale = Math.min(boxW / maskImg.naturalWidth, boxH / maskImg.naturalHeight);
      const dw = maskImg.naturalWidth * scale, dh = maskImg.naturalHeight * scale;
      const align = section.dataset.imageAlign || "center";
      const dx = bx * cols + (align === "left" ? 0 : align === "right" ? boxW - dw : (boxW - dw) / 2);
      const dy = by * rows + (boxH - dh) / 2;
      // the crisp halftone itself sits on top of the grid, in the same spot
      Object.assign(img.style, { left: dx * CELL + "px", top: dy * CELL + "px", width: dw * CELL + "px", height: dh * CELL + "px" });
      if (!img.isConnected) { img.className = "halftone"; img.alt = ""; img.setAttribute("aria-hidden", "true"); section.append(img); }
      o.imageSmoothingQuality = "high";
      o.drawImage(maskImg, dx, dy, dw, dh);
      const data = o.getImageData(0, 0, cols, rows).data;
      weights = new Float32Array(cols * rows);
      for (let i = 0; i < weights.length; i++) weights[i] = data[i * 4] / 255; // white in the mask = ink
      // halo = soft, spread-out copy of the picture (via canvas blur)
      const off2 = document.createElement("canvas"); off2.width = cols; off2.height = rows;
      const o2 = off2.getContext("2d");
      o2.filter = "blur(4px)";
      o2.drawImage(off, 0, 0); o2.drawImage(off, 0, 0); o2.drawImage(off, 0, 0);
      const hd = o2.getImageData(0, 0, cols, rows).data;
      haloW = new Float32Array(cols * rows);
      for (let i = 0; i < haloW.length; i++) haloW[i] = Math.min(1, (hd[i * 4] / 255) * 2.2);
    } catch (e) { weights = null; haloW = null; } // e.g. opened from a local file: skip the image, keep the grid
  }
  const target = { x: -9999, y: -9999 };   // where the cursor is
  const mouse = { x: -9999, y: -9999 };    // eased position that follows it
  let glow = 0, glowTarget = 0;            // fades the cursor effect in/out

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = section.clientWidth; h = section.clientHeight;
    for (const c of [canvas, gridLayer]) { c.width = w * dpr; c.height = h * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / CELL); rows = Math.ceil(h / CELL);
    buildWeights();
    gctx.clearRect(0, 0, w, h);
    gctx.strokeStyle = BLUE; gctx.globalAlpha = 0.9; gctx.lineWidth = 1;
    gctx.beginPath();
    for (let c = 0; c <= cols; c++) { gctx.moveTo(c * CELL + 0.5, 0); gctx.lineTo(c * CELL + 0.5, h); }
    for (let r = 0; r <= rows; r++) { gctx.moveTo(0, r * CELL + 0.5); gctx.lineTo(w, r * CELL + 0.5); }
    gctx.stroke();
    draw();
  }

  const RADIUS = 150;
  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.drawImage(gridLayer, 0, 0, w, h);
    ctx.fillStyle = BLUE;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = c * CELL, y = r * CELL;
        let n = noise(c * 1.6, r * 1.6, t);
        if (weights) {
          const halo = haloW[r * cols + c];          // calm the clouds around the picture so it reads
          n = n * (1 - halo * 0.85) - halo * 0.25;

        }
        if (glow > 0.001) {
          const d = Math.hypot(x + CELL / 2 - mouse.x, y + CELL / 2 - mouse.y);
          if (d < RADIUS) n += smooth(RADIUS, 0, d) * 0.75 * glow;
        }
        // soft edge instead of on/off: squares fade in as the value rises
        const a = smooth(THRESHOLD - 0.12, THRESHOLD + 0.45, n);
        if (a > 0.02) {
          ctx.globalAlpha = a;
          ctx.fillRect(x + 2, y + 2, CELL - 3, CELL - 3);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function loop(ts) {
    const dt = Math.min(50, ts - (lastTs || ts)); lastTs = ts;
    if (visible) {
      if (motionOn) t += dt * 0.0006;                 // slow, continuous drift
      const k = 1 - Math.pow(0.001, dt / 1000);             // frame-rate independent easing
      mouse.x += (target.x - mouse.x) * Math.min(1, k * 6);
      mouse.y += (target.y - mouse.y) * Math.min(1, k * 6);
      glow += (glowTarget - glow) * Math.min(1, k * 3);
      if (img && img.isConnected) {
        const px = glow * ((mouse.x / (w || 1)) - 0.5) * -14;   // drifts slightly away from the cursor
        const py = glow * ((mouse.y / (h || 1)) - 0.5) * -10;
        const fy = motionOn ? Math.sin(t * 1.4) * 6 : 0;          // slow float
        img.style.transform = `translate(${px.toFixed(1)}px, ${(py + fy).toFixed(1)}px)`;
      }
      draw();
    }
    requestAnimationFrame(loop);
  }

  section.addEventListener("pointermove", (e) => {
    const r = section.getBoundingClientRect();
    target.x = e.clientX - r.left; target.y = e.clientY - r.top;
    if (glow < 0.01) { mouse.x = target.x; mouse.y = target.y; } // don't swoop in from a corner
    glowTarget = 1;
  });
  section.addEventListener("pointerleave", () => { glowTarget = 0; });

  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(section);
  new ResizeObserver(resize).observe(section);
  resize();
  requestAnimationFrame(loop);
});

setMotion(motionOn);

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
  const total = document.getElementById("total");
  if (total) total.textContent = "/" + String(cards.length).padStart(2, "0");
  if (count) scramble(count, String(shown).padStart(2, "0"));
}
// quick digit-scramble so the count visibly updates
let scrambleTimer;
function scramble(el, finalText) {
  clearInterval(scrambleTimer);
  if (reduceMotion) { el.textContent = finalText; return; }
  let n = 0;
  scrambleTimer = setInterval(() => {
    n++;
    el.textContent = n > 6 ? finalText
      : finalText.replace(/\d/g, () => Math.floor(Math.random() * 10));
    if (n > 6) clearInterval(scrambleTimer);
  }, 45);
}
filters.forEach((f) => f.addEventListener("click", () => applyFilter(f.dataset.filter)));
if (cards.length) applyFilter("all");
