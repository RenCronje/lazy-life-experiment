/* =====================================================================
   Interactive content widgets for The Lazy Life Experiment deck.

   Design rules (locked):
   - Every widget holds a STABLE height. Expanding one thing collapses
     another, and inspectors reserve their space up front. A slide must
     never grow past the viewport when a visitor clicks something.
   - No inline handlers (CSP is script-src 'self').
   - Keyboard operable: real buttons, arrow keys on tab/segment groups.
   ===================================================================== */
(function () {
  "use strict";

  const W = (window.LazyWidgets = window.LazyWidgets || {});

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function clear(node) {
    if (node) node.replaceChildren();
  }

  /* -------------------------------------------------------------------
     01 — SCHEMATIC + INSPECTOR
     A row of numbered nodes joined by connectors. Selecting a node swaps
     the inspector below. Matches the models.html "watch its route" idea.
     ------------------------------------------------------------------- */
  W.schematic = function (host, options) {
    if (!host) return;
    const nodes = options.nodes || [];
    if (!nodes.length) return;
    clear(host);
    host.classList.add("ix-schematic");

    let active = 0;

    const track = el("div", "ix-track");
    track.setAttribute("role", "tablist");
    track.setAttribute("aria-label", options.label || "Choose a step");

    const buttons = nodes.map((node, index) => {
      if (index > 0) {
        const link = el("span", "ix-connector");
        link.setAttribute("aria-hidden", "true");
        track.append(link);
      }
      const button = el("button", "ix-node");
      button.type = "button";
      button.setAttribute("role", "tab");
      button.dataset.index = String(index);
      button.append(el("span", "ix-node-num", String(index + 1).padStart(2, "0")));
      button.append(el("span", "ix-node-title", node.title || ""));
      if (node.tag) button.append(el("span", "ix-node-tag", node.tag));
      button.addEventListener("click", () => select(index));
      track.append(button);
      return button;
    });

    const panel = el("div", "ix-inspector");
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-live", "polite");

    host.append(track, panel);

    function select(index) {
      active = index;
      buttons.forEach((button, i) => {
        const on = i === index;
        button.classList.toggle("is-active", on);
        button.setAttribute("aria-selected", String(on));
        button.tabIndex = on ? 0 : -1;
      });
      const node = nodes[index];
      clear(panel);
      panel.append(el("p", "ix-insp-label", node.tag || `Step ${index + 1}`));
      panel.append(el("h3", "ix-insp-title", node.title || ""));
      if (node.body) panel.append(el("p", "ix-insp-body", node.body));
      if (node.meta) panel.append(el("p", "ix-insp-meta", node.meta));
      panel.classList.remove("is-fresh");
      void panel.offsetWidth;
      panel.classList.add("is-fresh");
    }

    track.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = (active + step + nodes.length) % nodes.length;
      select(next);
      buttons[next].focus();
    });

    select(0);
  };

  /* -------------------------------------------------------------------
     02 — SEGMENTED INSPECTOR
     A pill control that swaps a detail card. Used for audience segments.
     ------------------------------------------------------------------- */
  W.segmented = function (host, options) {
    if (!host) return;
    const items = options.items || [];
    if (!items.length) return;
    clear(host);
    host.classList.add("ix-segmented");

    let active = 0;
    const bar = el("div", "ix-seg-bar");
    bar.setAttribute("role", "tablist");
    bar.setAttribute("aria-label", options.label || "Choose");

    const panel = el("div", "ix-seg-panel");
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-live", "polite");

    const buttons = items.map((item, index) => {
      const button = el("button", "ix-seg", item.title || "");
      button.type = "button";
      button.setAttribute("role", "tab");
      button.addEventListener("click", () => select(index));
      bar.append(button);
      return button;
    });

    host.append(bar, panel);

    function select(index) {
      active = index;
      buttons.forEach((button, i) => {
        const on = i === index;
        button.classList.toggle("is-active", on);
        button.setAttribute("aria-selected", String(on));
        button.tabIndex = on ? 0 : -1;
      });
      const item = items[index];
      clear(panel);
      const head = el("div", "ix-seg-head");
      head.append(el("span", "ix-seg-initials", initials(item.title)));
      const headCopy = el("div", "");
      headCopy.append(el("h3", "ix-seg-title", item.title || ""));
      if (item.tag) headCopy.append(el("p", "ix-seg-tag", item.tag));
      head.append(headCopy);
      const meter = el("div", "ix-meter");
      const value = Number.isFinite(item.fit) ? item.fit : 72;
      meter.append(el("span", "ix-meter-label", "Audience fit"));
      const barEl = el("span", "ix-meter-bar");
      const fill = el("i", "");
      fill.style.width = `${value}%`;
      barEl.append(fill);
      meter.append(barEl, el("span", "ix-meter-value", `${value}%`));
      head.append(meter);
      panel.append(head);
      if (item.body) panel.append(el("p", "ix-seg-body", item.body));
      panel.classList.remove("is-fresh");
      void panel.offsetWidth;
      panel.classList.add("is-fresh");
    }

    bar.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = (active + step + items.length) % items.length;
      select(next);
      buttons[next].focus();
    });

    select(0);
  };

  /* -------------------------------------------------------------------
     03 — ACCORDION
     Single-open list. Opening one row closes the rest, so the block's
     height stays inside its budget.
     ------------------------------------------------------------------- */
  W.accordion = function (host, options) {
    if (!host) return;
    const items = options.items || [];
    if (!items.length) return;
    clear(host);
    host.classList.add("ix-accordion");
    if (options.label) host.setAttribute("aria-label", options.label);

    let open = options.startOpen === undefined ? -1 : options.startOpen;

    const rows = items.map((item, index) => {
      const row = el("div", "ix-row");
      const button = el("button", "ix-row-btn");
      button.type = "button";
      const marker = el("span", "ix-row-mark", "+");
      marker.setAttribute("aria-hidden", "true");
      button.append(el("span", "ix-row-title", item.title || ""));
      if (item.tag) button.append(el("span", "ix-row-tag", item.tag));
      button.append(marker);

      const body = el("div", "ix-row-body");
      const inner = el("div", "ix-row-inner");
      if (item.body) inner.append(el("p", "", item.body));
      if (item.list && item.list.length) {
        const ul = el("ul", "ix-row-list");
        item.list.forEach((line) => ul.append(el("li", "", line)));
        inner.append(ul);
      }
      body.append(inner);

      button.addEventListener("click", () => toggle(index));
      row.append(button, body);
      host.append(row);
      return { row, button, body, marker };
    });

    function toggle(index) {
      open = open === index ? -1 : index;
      rows.forEach((entry, i) => {
        const on = i === open;
        entry.row.classList.toggle("is-open", on);
        entry.button.setAttribute("aria-expanded", String(on));
        entry.marker.textContent = on ? "−" : "+";
      });
    }

    rows.forEach((entry, i) => {
      entry.button.setAttribute("aria-expanded", String(i === open));
      entry.row.classList.toggle("is-open", i === open);
      entry.marker.textContent = i === open ? "−" : "+";
      entry.button.setAttribute("aria-controls", `ix-row-${i}`);
      entry.body.id = `ix-row-${i}`;
    });
  };

  /* -------------------------------------------------------------------
     04 — FLOW / LOOP
     Steps joined by arrows. Horizontal on wide screens, vertical on
     phones. Used for the Idea Generator pipeline.
     ------------------------------------------------------------------- */
  W.flow = function (host, options) {
    if (!host) return;
    const steps = options.steps || [];
    if (!steps.length) return;
    clear(host);
    host.classList.add("ix-flow");

    steps.forEach((step, index) => {
      if (index > 0) host.append(el("span", "ix-flow-arrow", "↓"));
      const card = el("div", "ix-flow-step");
      card.append(el("span", "ix-flow-num", String(index + 1).padStart(2, "0")));
      card.append(el("p", "ix-flow-text", step.title || step));
      if (step.tag) card.append(el("span", "ix-flow-tag", step.tag));
      host.append(card);
    });

    if (options.note) host.append(el("p", "ix-flow-note", options.note));
  };

  /* -------------------------------------------------------------------
     05 — TIMELINE
     Clickable phases; the selected one expands in place.
     ------------------------------------------------------------------- */
  W.timeline = function (host, options) {
    if (!host) return;
    const phases = options.phases || [];
    if (!phases.length) return;
    clear(host);
    host.classList.add("ix-timeline");

    let active = 0;
    const rail = el("div", "ix-rail");
    rail.setAttribute("role", "tablist");
    rail.setAttribute("aria-label", options.label || "Project phases");

    const detail = el("div", "ix-tl-detail");
    detail.setAttribute("role", "tabpanel");
    detail.setAttribute("aria-live", "polite");

    const buttons = phases.map((phase, index) => {
      const button = el("button", "ix-phase");
      button.type = "button";
      button.setAttribute("role", "tab");
      button.append(el("span", "ix-phase-dot", ""));
      button.append(el("span", "ix-phase-title", phase.title || ""));
      if (phase.tag) button.append(el("span", "ix-phase-tag", phase.tag));
      button.addEventListener("click", () => select(index));
      rail.append(button);
      return button;
    });

    host.append(rail, detail);

    function select(index) {
      active = index;
      buttons.forEach((button, i) => {
        const on = i === index;
        button.classList.toggle("is-active", on);
        button.setAttribute("aria-selected", String(on));
        button.tabIndex = on ? 0 : -1;
      });
      const phase = phases[index];
      clear(detail);
      detail.append(el("p", "ix-tl-label", phase.tag || `Phase ${index + 1}`));
      detail.append(el("p", "ix-tl-body", phase.body || ""));
      detail.classList.remove("is-fresh");
      void detail.offsetWidth;
      detail.classList.add("is-fresh");
    }

    rail.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = (active + step + phases.length) % phases.length;
      select(next);
      buttons[next].focus();
    });

    select(0);
  };

  /* -------------------------------------------------------------------
     06 — TABS (dossier)
     Fixed-height tab panels; each panel scrolls internally only if its
     own copy overruns.
     ------------------------------------------------------------------- */
  W.tabs = function (host, options) {
    if (!host) return;
    const panels = options.panels || [];
    if (!panels.length) return;
    clear(host);
    host.classList.add("ix-tabs");

    let active = 0;
    const bar = el("div", "ix-tab-bar");
    bar.setAttribute("role", "tablist");
    bar.setAttribute("aria-label", options.label || "Sections");

    const body = el("div", "ix-tab-body");
    body.setAttribute("role", "tabpanel");
    body.setAttribute("aria-live", "polite");

    const buttons = panels.map((panel, index) => {
      const button = el("button", "ix-tab", panel.label || "");
      button.type = "button";
      button.setAttribute("role", "tab");
      button.addEventListener("click", () => select(index));
      bar.append(button);
      return button;
    });

    host.append(bar, body);

    function select(index) {
      active = index;
      buttons.forEach((button, i) => {
        const on = i === index;
        button.classList.toggle("is-active", on);
        button.setAttribute("aria-selected", String(on));
        button.tabIndex = on ? 0 : -1;
      });
      clear(body);
      const panel = panels[index];
      panel.build(body);
      body.scrollTop = 0;
      body.classList.remove("is-fresh");
      void body.offsetWidth;
      body.classList.add("is-fresh");
    }

    bar.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = (active + step + panels.length) % panels.length;
      select(next);
      buttons[next].focus();
    });

    select(0);
  };

  function initials(value) {
    return String(value || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }
})();
