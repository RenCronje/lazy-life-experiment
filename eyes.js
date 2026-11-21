/* Cartoon eyes for the black band at the top of every page.
 *
 * Two eyes track the cursor, blink on their own, and every few seconds swap to
 * a new expression drawn from a shuffled bag so the full set always cycles
 * before anything repeats. Expression changes are tweened, not cut, so lids,
 * lashes and brows slide from one pose to the next.
 *
 * Geometry: each eye is drawn in a 130 x 150 box. The visible opening is the
 * band between the upper and lower lid lines, so a single `lid` value can
 * drive both the clip and the lid shape without them disagreeing.
 */
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const BAND = "#050505";
  const INK = "#fffdf7";
  const W = 130;
  const H = 150;
  const CX = W / 2;
  const CY = 84;
  const RX = 46;
  const RY = 52;

  /* One pose per eye. Values are interpolated between expressions.
   * lid    0 = wide open, 1 = shut
   * lidLow lower lid rise
   * tilt    upper-lid angle in degrees, mirrored per eye
   * browY   brow offset (negative lifts)
   * browTilt asymmetry of the brow arc
   * lash    eyelash opacity
   * pupil   pupil scale
   * look*     fixed gaze offset shared by both eyes, added on top of the
   *           (unmirrored) cursor tracking
   * eyeLook*  per-eye gaze offset, for poses that are deliberately
   *           asymmetric — e.g. the cross-eyed "derp" expression
   */
  const DEFAULT = {
    lid: 0.08,
    lidLow: 0.1,
    tilt: 0,
    browY: 0,
    browTilt: 0,
    lash: 0,
    pupil: 1,
    lookX: 0,
    lookY: 0,
    eyeLookX: 0,
    eyeLookY: 0,
  };

  const EXPRESSIONS = [
    { name: "neutral" },
    { name: "wide", lid: 0.01, lidLow: 0.04, browY: -12, pupil: 0.78 },
    { name: "sleepy", lid: 0.4, lidLow: 0.06, browY: 8, browTilt: -7, pupil: 0.96 },
    { name: "cross", lookX: 17, lookY: 3, pupil: 0.9 },
    { name: "wink", lid: 0.06, left: { lid: 1, browY: -9 }, right: { lid: 0.04, lash: 0.9 }, browTilt: -4 },
    { name: "angry", lid: 0.3, lidLow: 0.12, tilt: 19, browY: 7, browTilt: 20, pupil: 0.9 },
    { name: "sad", lid: 0.24, lidLow: 0.3, tilt: -15, browY: -2, browTilt: -20, pupil: 1.02 },
    { name: "suspicious", lid: 0.36, lidLow: 0.1, tilt: 10, browY: 4, browTilt: 9, lookX: 15, pupil: 0.86 },
    {
      name: "flirty",
      lid: 0.2,
      lidLow: 0.1,
      lash: 1,
      tilt: -8,
      browY: -9,
      right: { browY: -4, browTilt: 10 },
      lookX: 8,
      lookY: -4,
      pupil: 0.94,
    },
    {
      name: "derp",
      lid: 0.02,
      lidLow: 0.06,
      /* Deliberately cross-eyed: the one pose allowed asymmetric gaze. */
      left: { eyeLookX: 15, eyeLookY: 14 },
      right: { eyeLookX: -15, eyeLookY: -14 },
      pupil: 0.82,
    },
    { name: "shock", lid: 0, lidLow: 0, browY: -16, pupil: 0.6 },
    { name: "annoyed", lid: 0.36, lidLow: 0.08, tilt: 5, browY: 4, browTilt: 3, pupil: 0.9 },
    { name: "curious", lid: 0.12, lidLow: 0.08, browY: -10, right: { browY: -1, browTilt: 13 }, tilt: -5 },
    { name: "dozy", lid: 0.54, lidLow: 0.12, browY: 10, browTilt: -10, pupil: 0.9 },
    { name: "soft", lid: 0.2, lidLow: 0.08, lash: 0.75, browY: -5, browTilt: -7, pupil: 1.05 },
  ];

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const easeOutBack = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);

  function el(name, attrs) {
    const node = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach((key) => node.setAttribute(key, attrs[key]));
    return node;
  }

  function resolve(expr, side) {
    const pose = Object.assign({}, DEFAULT, expr);
    const override = expr[side] || {};
    delete pose.left;
    delete pose.right;
    return Object.assign(pose, override);
  }

  function buildEye(side) {
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: `cartoon-eye cartoon-eye--${side}` });
    svg.setAttribute("focusable", "false");

    const clipId = `eye-clip-${side}-${Math.random().toString(36).slice(2, 8)}`;
    const defs = el("defs");
    const clip = el("clipPath", { id: clipId });
    const aperture = el("ellipse", { cx: CX, cy: CY, rx: RX, ry: RY });
    clip.append(aperture);
    defs.append(clip);
    svg.append(defs);

    // Eyeball, revealed only inside the aperture.
    const ball = el("g", { "clip-path": `url(#${clipId})` });
    const sclera = el("ellipse", { cx: CX, cy: CY, rx: RX, ry: RY, fill: INK });
    const pupil = el("circle", { cx: CX, cy: CY, r: 26, fill: "#0b0b0b" });
    const glint = el("circle", { cx: CX - 9, cy: CY - 10, r: 7.5, fill: INK });
    const glintSmall = el("circle", { cx: CX + 10, cy: CY + 9, r: 3.2, fill: INK, opacity: ".72" });
    ball.append(sclera, pupil, glint, glintSmall);

    // Lids are band-coloured, so only their white edge shows.
    const upperLid = el("path", { fill: BAND });
    const upperEdge = el("path", { fill: "none", stroke: INK, "stroke-width": 6, "stroke-linecap": "round" });
    const lowerLid = el("path", { fill: BAND });
    const lowerEdge = el("path", { fill: "none", stroke: INK, "stroke-width": 5, "stroke-linecap": "round" });

    const outline = el("ellipse", {
      cx: CX,
      cy: CY,
      rx: RX,
      ry: RY,
      fill: "none",
      stroke: INK,
      "stroke-width": 5.5,
      opacity: ".9",
    });

    const lashes = el("g", { stroke: INK, "stroke-width": 3.6, "stroke-linecap": "round", fill: "none", opacity: 0 });
    ["M 40 -2 q 12 -9 19 -19", "M 43 8 q 15 -5 24 -13", "M 42 19 q 16 0 27 -6"].forEach((d) =>
      lashes.append(el("path", { d }))
    );

    const brow = el("path", { fill: "none", stroke: INK, "stroke-width": 8, "stroke-linecap": "round", opacity: ".95" });

    svg.append(ball, outline, upperLid, lowerLid, upperEdge, lowerEdge, lashes, brow);

    return {
      svg, side, aperture, sclera, pupil, glint, glintSmall, outline,
      upperLid, upperEdge, lowerLid, lowerEdge, lashes, brow,
    };
  }

  function buildBand(host) {
    host.classList.add("eye-band");
    host.setAttribute("aria-hidden", "true");
    const stage = document.createElement("div");
    stage.className = "eye-stage";
    const left = buildEye("left");
    const right = buildEye("right");
    stage.append(left.svg, right.svg);
    host.replaceChildren(stage);
    return { host, stage, eyes: [left, right] };
  }

  function createEyes(host) {
    const { eyes, stage } = buildBand(host);
    const state = {
      host, stage, eyes,
      pointer: { x: 0, y: 0 },
      hasPointer: false,
      glance: { x: 0, y: 0 },
      bag: [],
      lastName: "",
      nextExpression: performance.now() + 1400,
      blinkUntil: 0,
      nextBlink: performance.now() + 3000,
      current: eyes.map(() => Object.assign({}, DEFAULT)),
      target: eyes.map(() => Object.assign({}, DEFAULT)),
      tween: { start: 0, duration: 1 },
      running: true,
    };
    state.draw = () => draw(state, performance.now());

    const onMove = (event) => {
      const point = event.touches ? event.touches[0] : event;
      if (!point) return;
      state.pointer.x = point.clientX;
      state.pointer.y = point.clientY;
      state.hasPointer = true;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("pointerleave", () => { state.hasPointer = false; }, { passive: true });
    document.addEventListener("visibilitychange", () => {
      state.running = document.visibilityState !== "hidden";
      if (state.running) requestAnimationFrame(() => frame(state));
    });
    window.addEventListener("resize", () => draw(state, performance.now()), { passive: true });

    requestAnimationFrame(() => frame(state));
    return state;
  }

  function pickExpression(state) {
    if (!state.bag.length) {
      state.bag = EXPRESSIONS.map((_, index) => index);
      for (let i = state.bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.bag[i], state.bag[j]] = [state.bag[j], state.bag[i]];
      }
      // Never show the same expression twice in a row across bag refills.
      if (state.bag.length > 2 && state.lastName === state.bag[0]) {
        [state.bag[0], state.bag[1]] = [state.bag[1], state.bag[0]];
      }
    }
    const index = state.bag.shift();
    state.lastName = index;
    return EXPRESSIONS[index];
  }

  function frame(state) {
    if (!state.running) return;
    const now = performance.now();

    if (now >= state.nextExpression) {
      const expr = pickExpression(state);
      state.target = [resolve(expr, "left"), resolve(expr, "right")];
      state.tween = { start: now, duration: 520 };
      state.nextExpression = now + 2700 + Math.random() * 2300;
    }

    if (now >= state.nextBlink) {
      state.blinkUntil = now + 160;
      state.nextBlink = now + 3400 + Math.random() * 4200;
    }

    const raw = clamp((now - state.tween.start) / Math.max(1, state.tween.duration), 0, 1);
    const eased = easeOutBack(raw);
    state.eyes.forEach((eye, index) => {
      const from = state.current[index];
      const to = state.target[index];
      const next = {};
      Object.keys(DEFAULT).forEach((key) => {
        if (key === "lookX" || key === "lookY") next[key] = to[key];
        if (key === "eyeLookX" || key === "eyeLookY") next[key] = to[key];
        else next[key] = from[key] + (to[key] - from[key]) * eased;
      });
      if (now < state.blinkUntil) {
        const span = 160;
        const p = 1 - Math.abs((state.blinkUntil - now) / span - 0.5) * 2;
        next.lid = Math.max(next.lid, clamp(p, 0, 1));
      }
      state.current[index] = next;
    });

    draw(state, now);
    requestAnimationFrame(() => frame(state));
  }

  function draw(state, now) {
    const rect = state.stage.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const midY = rect.top + rect.height / 2;
    const radius = Math.max(300, window.innerHeight * 0.8);

    let gx = 0;
    let gy = 0;
    if (state.hasPointer) {
      const dx = state.pointer.x - midX;
      const dy = state.pointer.y - midY;
      gx = clamp(dx / radius, -1, 1) * 1.15;
      gy = clamp(dy / radius, -1, 1) * 1.15;
    } else if (now) {
      gx = Math.sin(now / 2100) * 0.3;
      gy = Math.cos(now / 2700) * 0.18;
    }
    state.glance.x += (gx - state.glance.x) * 0.18;
    state.glance.y += (gy - state.glance.y) * 0.18;

    state.eyes.forEach((eye, index) => {
      const pose = state.current[index];
      const mirror = eye.side === "left" ? 1 : -1;

      // Lid lines. The opening is the gap between them: one source of truth.
      const upperY = CY - RY + RY * 2 * clamp(pose.lid, 0, 1);
      const lowerY = CY + RY - RY * 2 * clamp(pose.lidLow, 0, 1);
      const rawHalf = (lowerY - upperY) / 2;
      const shut = rawHalf <= 5;
      const openY = Math.max(1.4, rawHalf);
      const openCY = shut ? CY + RY * 0.18 : (upperY + lowerY) / 2;

      eye.aperture.setAttribute("cy", openCY.toFixed(2));
      eye.aperture.setAttribute("ry", openY.toFixed(2));
      eye.outline.setAttribute("opacity", shut ? 0 : 0.9);
      eye.outline.setAttribute("ry", openY.toFixed(2));
      eye.outline.setAttribute("cy", openCY.toFixed(2));
      eye.lowerLid.setAttribute("opacity", shut ? 0 : 1);
      eye.upperLid.setAttribute("opacity", shut ? 0 : 1);

      const tilt = pose.tilt * mirror;
      // Upper lid: covers everything above the lid line, bulging in the middle.
      const upperCurve = Math.min(openY * 0.55, 15) + (shut ? 4 : 0);
      const upperPath =
        `M ${CX - RX - 3} ${upperY + 2} ` +
        `Q ${CX} ${upperY - upperCurve} ${CX + RX + 3} ${upperY + 2} ` +
        `L ${CX + RX + 3} ${upperY - 200} L ${CX - RX - 3} ${upperY - 200} Z`;
      eye.upperLid.setAttribute("d", upperPath);
      eye.upperEdge.setAttribute(
        "d",
        shut
          ? `M ${CX - RX - 4} ${openCY - 3} Q ${CX} ${openCY + 13} ${CX + RX + 4} ${openCY - 3}`
          : `M ${CX - RX - 3} ${upperY + 2} Q ${CX} ${upperY - upperCurve} ${CX + RX + 3} ${upperY + 2}`
      );
      eye.upperEdge.setAttribute("opacity", shut ? 1 : 1);

      const lowerCurve = Math.min(openY * 0.45, 12);
      const lowerPath =
        `M ${CX - RX - 3} ${lowerY - 1} ` +
        `Q ${CX} ${lowerY + lowerCurve} ${CX + RX + 3} ${lowerY - 1} ` +
        `L ${CX + RX + 3} ${lowerY + 200} L ${CX - RX - 3} ${lowerY + 200} Z`;
      eye.lowerLid.setAttribute("d", lowerPath);
      eye.lowerEdge.setAttribute(
        "d",
        `M ${CX - RX - 3} ${lowerY - 1} Q ${CX} ${lowerY + lowerCurve} ${CX + RX + 3} ${lowerY - 1}`
      );
      eye.lowerEdge.setAttribute("opacity", shut || pose.lidLow > 0.55 ? 0 : 0.9);

      [eye.upperLid, eye.upperEdge, eye.lowerLid, eye.lowerEdge].forEach((node) => {
        node.setAttribute("transform", `rotate(${tilt} ${CX} ${shut ? upperY : openCY})`);
      });

      // Pupil follows the cursor, clamped inside the eyeball.
      //
      // Cursor tracking is NOT mirrored. Both pupils must travel to the same
      // screen direction or the eyes read as working against each other.
      // `mirror` stays in use for anatomy only (lid tilt, brows, lashes),
      // which genuinely is symmetrical across the face.
      //
      // A pose may still set a per-eye gaze offset (`pose.eyeLookX`), which
      // is what the deliberately cross-eyed "derp" expression uses.
      const lookX = state.glance.x * 18 + pose.lookX + pose.eyeLookX;
      const lookY = state.glance.y * 16 + pose.lookY + pose.eyeLookY;
      const px = clamp(CX + lookX, CX - RX + 22, CX + RX - 22);
      const py = clamp(CY + lookY, CY - RY + 22, CY + RY - 22);
      const pr = 26 * pose.pupil;
      eye.pupil.setAttribute("cx", px.toFixed(2));
      eye.pupil.setAttribute("cy", py.toFixed(2));
      eye.pupil.setAttribute("r", pr.toFixed(2));
      eye.glint.setAttribute("cx", (px - pr * 0.34).toFixed(2));
      eye.glint.setAttribute("cy", (py - pr * 0.38).toFixed(2));
      eye.glint.setAttribute("r", (pr * 0.29).toFixed(2));
      eye.glintSmall.setAttribute("cx", (px + pr * 0.38).toFixed(2));
      eye.glintSmall.setAttribute("cy", (py + pr * 0.34).toFixed(2));

      eye.lashes.setAttribute("opacity", pose.lash.toFixed(2));
      eye.lashes.setAttribute(
        "transform",
        `translate(${CX} ${shut ? openCY - 4 : upperY - 2}) rotate(${tilt}) scale(${eye.side === "left" ? -1 : 1} 1)`
      );

      // Brow sits above the lid and follows it.
      const browBase = Math.max(13, CY - RY - 20 + pose.browY * 0.72 - pose.lid * 9);
      const inner = CX - 33 * mirror;
      const outer = CX + 33 * mirror;
      const arc = 8 + Math.max(0, -pose.browY) * 0.16;
      const tiltIn = pose.browTilt * 0.3;
      eye.brow.setAttribute(
        "d",
        `M ${inner} ${browBase + tiltIn * mirror} Q ${CX} ${browBase - arc} ${outer} ${browBase - tiltIn * mirror}`
      );
    });
  }

  // Debug hooks used by eyesheet.html to render every expression at once.
  window.cartoonEyesDebug = {
    exprs: EXPRESSIONS,
    resolve,
    states: [],
    freeze(state, expr) {
      const left = resolve(expr, "left");
      const right = resolve(expr, "right");
      state.target = [left, right];
      state.current = [Object.assign({}, left), Object.assign({}, right)];
      state.tween = { start: 0, duration: 0 };
      state.nextExpression = Infinity;
      state.nextBlink = Infinity;
      draw(state, performance.now());
    },
  };

  function init() {
    document.querySelectorAll("[data-eye-band]").forEach((host) => {
      if (host.dataset.eyeReady === "true") return;
      host.dataset.eyeReady = "true";
      const state = createEyes(host);
      window.cartoonEyesDebug.states.push(state);
    });
  }

  window.cartoonEyes = { init };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
