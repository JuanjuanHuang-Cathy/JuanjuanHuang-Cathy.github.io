/* Native, element-sized rendering of Dr-XAS-Website/script.js (38cbe5f).
 * Wave projection, grid connectivity, magma palette and pointer parallax match the homepage. */
(() => {
"use strict";
function createDrXasField(canvas) {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return null;

  const host = canvas.parentElement || canvas;
  const magma = [
    "#000004", "#140e36", "#3b0f70", "#641a80", "#8c2981", "#b73779",
    "#de4968", "#f7705c", "#fe9f6d", "#fecf92", "#fcfdbf"
  ];
  const frameInterval = 1000 / 30;
  const opacitySteps = 64;
  const binCount = magma.length * opacitySteps;
  const lines = new Array(binCount);
  const dots = new Array(binCount);
  const particles = [];
  let count = 0;
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let fit = 1;
  let originY = 0;
  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;
  let phaseTime = 900;
  let frame = 0;
  let lastPaint = null;
  let requested = false;

  function makeGrid(resolution) {
    count = resolution;
    particles.length = 0;
    const spacing = 45;
    for (let column = 0; column < count; column++) {
      for (let row = 0; row < count; row++) {
        const x = (column - count / 2) * spacing;
        const z = (row - count / 2) * spacing;
        particles.push({
          x, z,
          noise: Math.sin(x * 0.05) * Math.cos(z * 0.05) * 0.2,
          radius: 0.5 + Math.random() * 5.5,
          u: 0, v: 0, scale: 0, color: 0, distance: 0
        });
      }
    }
  }

  // Group the native grid curves and particle discs by color to reduce canvas calls.
  function pathFor(bins, color, opacity) {
    const alpha = Math.round(Math.min(1, opacity * 1.55) * (opacitySteps - 1));
    if (alpha <= 0) return null;
    const stop = Math.floor(Math.min(1, Math.max(0, color)) * (magma.length - 1));
    const index = stop * opacitySteps + alpha;
    if (!bins[index]) bins[index] = new Path2D();
    return bins[index];
  }

  function connect(a, b) {
    if (a.scale <= 0 || b.scale <= 0) return;
    const du = a.u - b.u;
    const dv = a.v - b.v;
    if (du * du + dv * dv >= 45000) return;
    const color = (a.color + b.color) / 2;
    const scale = Math.min(a.scale, b.scale);
    const falloff = Math.max(0, 1 - Math.max(a.distance, b.distance) / 1200);
    const path = pathFor(lines, color * 0.9, color * 0.9 * scale * falloff);
    if (!path) return;
    path.moveTo(a.u, a.v);
    path.quadraticCurveTo((a.u + b.u) / 2, (a.v + b.v) / 2 + 35 * scale, b.u, b.v);
  }

  function drawPaths(bins, filled) {
    for (let i = 0; i < bins.length; i++) {
      const path = bins[i];
      if (!path) continue;
      const color = magma[Math.floor(i / opacitySteps)];
      context.globalAlpha = (i % opacitySteps) / (opacitySteps - 1);
      if (filled) {
        context.fillStyle = color;
        context.fill(path);
      } else {
        context.strokeStyle = color;
        context.stroke(path);
      }
      bins[i] = null;
    }
  }

  function paint() {
    if (!width || !height) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(pixelRatio * fit, 0, 0, pixelRatio * fit,
      pixelRatio * width / 2, pixelRatio * originY);

    const tilt = 1.05 + 0.2 * pointerY;
    const turn = 0.2 * pointerX;
    const cosTilt = Math.cos(tilt), sinTilt = Math.sin(tilt);
    const cosTurn = Math.cos(turn), sinTurn = Math.sin(turn);
    const centerX = pointerX * 500, centerZ = pointerY * 500;
    const timeOffset = phaseTime * 0.0015;
    const pointScale = Math.max(1, 1 / Math.sqrt(fit));
    for (const p of particles) {
      const distance = Math.hypot(p.x - centerX, p.z - centerZ);
      const decay = Math.max(0, 1 - Math.pow(distance / 1600, 1.5));
      const wave = Math.pow(distance, 0.93) * 1.5 * 0.0075;
      const y = Math.sin(wave - timeOffset + p.noise) * 300 * decay;
      const y1 = y * cosTilt - p.z * sinTilt;
      const z1 = y * sinTilt + p.z * cosTilt;
      p.scale = 400 / (1200 - p.x * sinTurn + z1 * cosTurn);
      p.u = (p.x * cosTurn + z1 * sinTurn) * p.scale;
      p.v = y1 * p.scale;
      p.distance = distance;
      p.color = ((y + 300) / 600) * (0.3 + 0.7 * decay);
      const path = pathFor(dots, p.color, Math.min(1, p.scale * 1.5) * decay);
      if (p.scale > 0 && path) {
        const radius = p.radius * p.scale * pointScale;
        path.moveTo(p.u + radius, p.v);
        path.arc(p.u, p.v, radius, 0, 2 * Math.PI);
      }
    }
    for (let column = 0; column < count; column++) {
      for (let row = 0; row < count; row++) {
        const index = column * count + row;
        if (column + 1 < count) connect(particles[index], particles[index + count]);
        if (row + 1 < count) connect(particles[index], particles[index + 1]);
      }
    }
    context.lineWidth = Math.max(1.2, 1.05 / fit);
    drawPaths(lines, false);
    drawPaths(dots, true);
    context.globalAlpha = 1;
  }

  function tick(timestamp) {
    frame = 0;
    if (!requested || document.hidden || !width || !height) return;
    if (lastPaint === null) {
      lastPaint = timestamp;
    } else if (timestamp - lastPaint >= frameInterval - 1) {
      const delta = Math.min(80, timestamp - lastPaint);
      phaseTime += delta;
      const ease = 1 - Math.exp(-delta / 135);
      pointerX += (targetX - pointerX) * ease;
      pointerY += (targetY - pointerY) * ease;
      paint();
      lastPaint = timestamp;
    }
    frame = requestAnimationFrame(tick);
  }

  function syncPlayback() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastPaint = null;
    if (requested && !document.hidden && width && height) {
      frame = requestAnimationFrame(tick);
    }
  }

  function setPlaying(on) {
    if (requested === Boolean(on)) return;
    requested = Boolean(on);
    syncPlayback();
  }

  function resize() {
    const nextWidth = canvas.clientWidth;
    const nextHeight = canvas.clientHeight;
    const nextRatio = Math.min(2, window.devicePixelRatio || 1);
    if (nextWidth === width && nextHeight === height && nextRatio === pixelRatio) return;
    width = nextWidth;
    height = nextHeight;
    pixelRatio = nextRatio;
    if (width && height) {
      canvas.width = Math.max(1, Math.round(width * pixelRatio));
      canvas.height = Math.max(1, Math.round(height * pixelRatio));
      const resolution = window.matchMedia("(max-width: 768px)").matches ? 35 : 55;
      if (resolution !== count) makeGrid(resolution);
      fit = Math.min(width / 800, height / 362);
      originY = height * 0.62;
      paint();
    }
    syncPlayback();
  }

  function pointerMove(event) {
    if (event.pointerType !== "mouse" || !requested) return;
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    targetX = Math.max(-1, Math.min(1, 2 * (event.clientX - box.left) / box.width - 1));
    targetY = Math.max(-1, Math.min(1, 1 - 2 * (event.clientY - box.top) / box.height));
  }
  function pointerLeave() { targetX = targetY = 0; }

  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(host);
  host.addEventListener("pointermove", pointerMove, { passive: true });
  host.addEventListener("pointerleave", pointerLeave, { passive: true });
  document.addEventListener("visibilitychange", syncPlayback);
  resize();

  return { setPlaying };
}

function initialize(root) {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const button = root.querySelector("[data-drxas-motion]");
  const canvas = root.querySelector(".rf-drxas__field");
  const field = typeof ResizeObserver === "function" && typeof Path2D === "function" ? createDrXasField(canvas) : null;
  let moving = !reduceMotion.matches && !navigator.connection?.saveData;
  let inView = false;
  let frame = 0;
  let previousTime = null;
  let previousScroll = window.scrollY;

  const rows = Array.from(root.querySelectorAll(".rf-drxas__lane"), (lane, index) => {
    const tiles = Array.from(lane.querySelectorAll(".rf-drxas__tile"), link => {
      const video = link.querySelector("video");
      video?.addEventListener("loadedmetadata", () => {
        if (Number.isFinite(video.duration)) {
          video.currentTime = Math.min(Number(video.dataset.start), Math.max(0, video.duration - .5));
        }
      });
      return { link, video, playing: false };
    });
    return { lane, tiles, direction: index === 0 ? 1 : -1, position: index === 0 ? -.12 : -1.24,
      viewport: 0, width: 0, step: 0, pointer: null, wasDragged: false, focus: null };
  });

  function playback(tile, on) {
    if (!tile.video || tile.playing === on) return;
    tile.playing = on;
    if (!on) {
      tile.video.pause();
      return;
    }
    if (!tile.video.hasAttribute("src")) tile.video.src = tile.link.href;
    tile.video.muted = true;
    tile.video.play().catch(() => {
      // Browsers with autoplay disabled retain the poster and the watch link.
    });
  }

  function paintRows() {
    const active = inView && moving && !document.hidden;
    for (const row of rows) {
      if (!row.step) continue;
      const count = row.tiles.length;
      row.tiles.forEach((tile, i) => {
        // Wrap outside the lane so links stay focusable and videos keep their playback positions.
        const x = ((((i + row.position + 1) % count) + count) % count - 1) * row.step;
        tile.link.style.transform = "translate3d(" + (x - i * row.step).toFixed(2) + "px,0,0)";
        playback(tile, active && x < row.viewport - 2 && x + row.width > 2);
      });
    }
  }

  function measure() {
    for (const row of rows) {
      row.viewport = row.lane.clientWidth;
      row.width = row.tiles[0].link.getBoundingClientRect().width;
      row.step = row.width + parseFloat(getComputedStyle(row.lane).columnGap);
    }
    paintRows();
  }

  function tick(now) {
    const delta = previousTime === null ? 0 : Math.min(80, now - previousTime);
    previousTime = now;
    for (const row of rows) {
      if (!row.focus && !row.pointer) {
        // The complete row traverses in 42 seconds, as on the original Dr.XAS wall.
        row.position += row.direction * delta * row.tiles.length / 42000;
      }
    }
    paintRows();
    frame = requestAnimationFrame(tick);
  }

  function synchronize() {
    const on = moving && inView && !document.hidden;
    field?.setPlaying(on);
    cancelAnimationFrame(frame);
    previousTime = null;
    previousScroll = window.scrollY;
    paintRows();
    if (on) frame = requestAnimationFrame(tick);
    button.firstElementChild.textContent = moving ? "Ⅱ" : "▶";
    button.querySelector("[data-drxas-motion-label]").textContent = moving ? "Pause motion" : "Play motion";
  }

  for (const row of rows) {
    const { lane } = row;
    lane.addEventListener("focusin", event => {
      const index = row.tiles.findIndex(tile => tile.link === event.target);
      if (index < 0 || !event.target.matches(":focus-visible")) return;
      row.focus = event.target;
      const tileBox = event.target.getBoundingClientRect();
      const laneBox = lane.getBoundingClientRect();
      if (tileBox.left < laneBox.left || tileBox.right > laneBox.right) {
        row.position = -index;
        paintRows();
      }
    });
    lane.addEventListener("focusout", () => { row.focus = null; });

    lane.addEventListener("pointerdown", event => {
      if (!event.isPrimary || event.button !== 0) return;
      row.wasDragged = false;
      row.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, position: row.position };
    });
    lane.addEventListener("pointermove", event => {
      const start = row.pointer;
      if (!start || start.id !== event.pointerId || !row.step) return;
      const dx = event.clientX - start.x;
      if (!row.wasDragged && (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(event.clientY - start.y))) return;
      if (!row.wasDragged) lane.setPointerCapture(event.pointerId);
      row.wasDragged = true;
      row.position = start.position + dx / row.step;
      paintRows();
    });
    for (const eventName of ["pointerup", "pointercancel"]) {
      lane.addEventListener(eventName, () => { row.pointer = null; });
    }
    lane.addEventListener("lostpointercapture", event => {
      if (event.target === lane) row.pointer = null;
    });
    lane.addEventListener("pointerleave", () => { if (!row.wasDragged) row.pointer = null; });
    lane.addEventListener("dragstart", event => event.preventDefault());
    lane.addEventListener("click", event => {
      if (row.wasDragged && event.detail) event.preventDefault();
      row.wasDragged = false;
    });
    lane.addEventListener("wheel", event => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || !row.step) return;
      event.preventDefault();
      const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? row.viewport : 1;
      row.position -= (event.deltaX * units) / row.step;
      paintRows();
    }, { passive: false });
  }

  button.hidden = false;
  button.addEventListener("click", () => { moving = !moving; synchronize(); });
  reduceMotion.addEventListener("change", () => { moving = !reduceMotion.matches && !navigator.connection?.saveData; synchronize(); });
  document.addEventListener("visibilitychange", synchronize);
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    const delta = y - previousScroll;
    previousScroll = y;
    if (!inView || !moving || document.hidden) return;
    for (const row of rows) {
      if (row.step && !row.focus && !row.pointer) row.position += row.direction * delta * .28 / row.step;
    }
    paintRows();
  }, { passive: true });
  root.setAttribute("data-drxas-ready", "true");
  measure();
  if (typeof ResizeObserver === "function") new ResizeObserver(measure).observe(root);
  else window.addEventListener("resize", measure);
  if (typeof IntersectionObserver === "function") {
    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; synchronize(); }).observe(root);
  } else {
    inView = true;
  }
  synchronize();
}

document.querySelectorAll("[data-rf-drxas]").forEach(initialize);
})();
