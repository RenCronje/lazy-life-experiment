(() => {
  "use strict";

  const DRAFT_KEY = "lazy-life-experiment-draft-v1";
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));
  let toastTimer;
  let revealObserver;

  function safeHref(value) {
    const href = String(value || "").trim();
    if (!href) return "#";
    if (/^(https?:\/\/|mailto:|tel:|#|\/(?!\/))/i.test(href)) return href;
    if (/^[a-z0-9._/-]+(?:[?#][a-z0-9._%?=&+-]*)?$/i.test(href) && !href.split("/").includes("..")) return href;
    return "#";
  }

  function colorValue(value, fallback) {
    const text = String(value || "").trim();
    return /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i.test(text) ? text : fallback;
  }

  function gradientValue(value, fallback) {
    const text = String(value || "").trim();
    return /^linear-gradient\([^;{}]*\)$/i.test(text) ? text : fallback;
  }

  function setText(selector, value, parent = document) {
    const element = $(selector, parent);
    if (element) element.textContent = value == null ? "" : String(value);
    return element;
  }

  function create(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = String(text);
    return element;
  }

  function renderHeading(element, text, highlight, emphasis) {
    if (!element) return;
    const source = String(text || "");
    const markers = [];
    if (highlight) markers.push({ value: String(highlight), className: "gradient-italic" });
    if (emphasis) markers.push({ value: String(emphasis), className: "word-emphasis" });
    const found = markers
      .map((marker) => ({ ...marker, index: source.toLocaleLowerCase().indexOf(marker.value.toLocaleLowerCase()) }))
      .filter((marker) => marker.index >= 0)
      .sort((a, b) => a.index - b.index || b.value.length - a.value.length);

    element.replaceChildren();
    let cursor = 0;
    for (const marker of found) {
      if (marker.index < cursor) continue;
      if (marker.index > cursor) element.append(document.createTextNode(source.slice(cursor, marker.index)));
      const span = create("span", marker.className, source.slice(marker.index, marker.index + marker.value.length));
      element.append(span);
      cursor = marker.index + marker.value.length;
    }
    if (cursor < source.length) element.append(document.createTextNode(source.slice(cursor)));
  }

  function makeNavLink(entry, currentPage) {
    const link = create("a", "", entry && entry.label ? entry.label : "Link");
    let href = safeHref(entry && entry.href);
    if (currentPage !== "home" && href.startsWith("#")) href = `/${href}`;
    link.href = href;
    if (/^https?:/i.test(href)) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    return link;
  }

  function renderNav(data, page) {
    const nav = $("#site-nav");
    const footerNav = $("#footer-nav");
    const entries = Array.isArray(data.nav) ? data.nav : [];
    for (const target of [nav, footerNav]) {
      if (!target) continue;
      target.replaceChildren();
      entries.forEach((entry) => target.append(makeNavLink(entry, page)));
    }
    const brandLink = $("#brand-link");
    const footerBrand = $("#footer-brand");
    if (brandLink) {
      brandLink.setAttribute("aria-label", `${data.brand || "The Lazy Life Experiment"} home`);
      brandLink.textContent = data.brand || "The Lazy Life Experiment";
    }
    if (footerBrand) footerBrand.textContent = data.brand || "The Lazy Life Experiment";
    setText("#footer-brand-copy", data.brand || "The Lazy Life Experiment");
    setText("#footer-note", data.footer && data.footer.note);
    setText("#footer-year", new Date().getFullYear());

    const editorLink = $("#footer-editor-link");
    if (editorLink) {
      const label = data.footer && data.footer.editorLabel ? data.footer.editorLabel : "Site editor";
      editorLink.replaceChildren(document.createTextNode(label), document.createTextNode(" "));
      const arrow = create("span", "", "↗");
      arrow.setAttribute("aria-hidden", "true");
      editorLink.append(arrow);
      editorLink.href = "/admin.html";
    }

    const menu = $("#mobile-menu");
    if (menu && nav) {
      menu.setAttribute("aria-controls", "site-nav");
      if (!menu.dataset.bound) {
        menu.dataset.bound = "true";
        menu.addEventListener("click", () => {
          const expanded = menu.getAttribute("aria-expanded") === "true";
          menu.setAttribute("aria-expanded", String(!expanded));
          menu.setAttribute("aria-label", expanded ? "Open navigation" : "Close navigation");
          nav.classList.toggle("is-open", !expanded);
        });
        nav.addEventListener("click", (event) => {
          if (event.target.closest("a")) {
            nav.classList.remove("is-open");
            menu.setAttribute("aria-expanded", "false");
            menu.setAttribute("aria-label", "Open navigation");
          }
        });
      }
    }
  }

  function configureDownload(anchor, label, url, requirements) {
    if (!anchor) return;
    const text = $("span", anchor);
    if (text) text.textContent = label || "Back This Project";
    const value = String(url || "").trim();
    anchor.dataset.downloadUrl = value;
    anchor.href = value ? safeHref(value) : "#join";
    anchor.setAttribute("aria-label", label || "Back This Project");
    if (/^https?:/i.test(value)) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    } else {
      anchor.removeAttribute("target");
      anchor.removeAttribute("rel");
    }
    if (requirements) requirements.textContent = String(requirements.textContent || "");
  }

  function textLines(value) {
    return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }

  function textParagraphs(value) {
    return String(value || "").split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  }

  function pairLines(value) {
    return textLines(value).map((line) => {
      const divider = line.indexOf("|");
      return divider < 0
        ? { title: "", body: line }
        : { title: line.slice(0, divider).trim(), body: line.slice(divider + 1).trim() };
    });
  }

  function fillTextList(target, value, className = "story-bullet-list") {
    if (!target) return;
    target.replaceChildren();
    const items = textLines(value);
    if (!items.length) return;
    target.className = className;
    items.forEach((text) => target.append(create("li", "", text)));
  }

  function fillParagraphs(target, value, className = "") {
    if (!target) return;
    target.replaceChildren();
    textParagraphs(value).forEach((paragraph) => target.append(create("p", className, paragraph)));
  }

  function fillPairCards(target, value, className = "story-card-grid") {
    if (!target) return;
    target.replaceChildren();
    target.className = className;
    pairLines(value).forEach(({ title, body }) => {
      const card = create("article", "story-info-card");
      if (title) card.append(create("h4", "", title));
      if (body) card.append(create("p", "", body));
      target.append(card);
    });
  }

  function fillPairList(target, value, className = "story-list") {
    if (!target) return;
    target.replaceChildren();
    target.className = className;
    pairLines(value).forEach(({ title, body }) => {
      const row = create("div", "story-list-row");
      if (title) row.append(create("strong", "", title));
      if (body) row.append(create("span", "", body));
      target.append(row);
    });
  }

  function defer(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      window.requestAnimationFrame(() => window.requestAnimationFrame(fn));
    }
  }

  function makeStorySlide(chapter, className, copy) {
    const card = create("article", `feature-card scene reveal story-card ${className}`);
    card.dataset.chapter = String(chapter);
    card.setAttribute("aria-labelledby", `story-slide-${chapter}-title`);
    const content = create("div", "story-card-inner");
    if (copy.eyebrow) content.append(create("p", "story-kicker", copy.eyebrow));
    const title = create("h2", "story-slide-title", copy.title || "");
    title.id = `story-slide-${chapter}-title`;
    content.append(title);
    if (copy.intro) content.append(create("p", "story-slide-intro", copy.intro));
    card.append(content);
    return { card, content };
  }

  function renderStorySlides(data) {
    const hosts = {
      founder: $("#founder-grid"),
      summary: $("#summary-grid"),
      market: $("#market-grid"),
    };
    if (!hosts.founder) return;
    Object.values(hosts).forEach((host) => host && host.replaceChildren());
    const experiment = data.experiment || {};

    const founder = experiment.founder || {};
    const founderSlide = makeStorySlide(0, "founder-story", founder);
    const founderGrid = create("div", "founder-story-grid ix-dossier-grid");

    /* --- Left: dossier with tabs (Profile / Background / Why me) --- */
    const dossier = create("section", "founder-profile story-subpanel ix-dossier");
    const identity = create("div", "founder-identity");
    const initials = String(founder.name || "LL").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    identity.append(create("span", "founder-avatar", initials || "LL"));
    const identityCopy = create("div", "founder-identity-copy");
    identityCopy.append(create("h3", "", founder.name || ""), create("p", "", founder.role || ""));
    identity.append(identityCopy);
    dossier.append(identity);

    const socials = create("div", "founder-social-links");
    pairLines(founder.socialLinks).forEach(({ title, body }) => {
      if (!title || !body) return;
      const link = create("a", "", title);
      link.href = safeHref(body);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      socials.append(link);
    });
    if (socials.children.length) dossier.append(socials);

    const tabHost = create("div", "ix-dossier-tabs");
    dossier.append(tabHost);
    founderGrid.append(dossier);

    /* --- Right: career + skills, always visible as a compact column --- */
    const founderExperience = create("section", "founder-experience story-subpanel");
    founderExperience.append(create("h3", "story-subheading", "Career Highlights"));
    const careerList = create("ul", "founder-career");
    fillTextList(careerList, founder.career, "founder-career");
    founderExperience.append(careerList);
    const skills = create("div", "founder-skills-grid");
    const marketing = create("section", "skill-list");
    marketing.append(create("h4", "", "Marketing"));
    const marketingList = create("ul", "");
    textLines(founder.marketingSkills).forEach((item) => marketingList.append(create("li", "", item)));
    marketing.append(marketingList);
    const business = create("section", "skill-list");
    business.append(create("h4", "", "Business"));
    const businessList = create("ul", "");
    textLines(founder.businessSkills).forEach((item) => businessList.append(create("li", "", item)));
    business.append(businessList);
    skills.append(marketing, business);
    founderExperience.append(skills);
    founderGrid.append(founderExperience);

    founderSlide.content.append(founderGrid);
    hosts.founder.append(founderSlide.card);

    /* --- Summary slide: pillar schematic + inspector --- */
    const summary = experiment.summary || {};
    const summarySlide = makeStorySlide(1, "summary-story", summary);
    const summarySchematic = create("div", "summary-schematic");
    summarySlide.content.append(summarySchematic);
    const summaryQuote = create("blockquote", "experiment-quote", summary.quote || "");
    summarySlide.content.append(summaryQuote);
    hosts.summary.append(summarySlide.card);

    /* --- Market slide: trends rail + advantage accordion + audience segments --- */
    const market = experiment.market || {};
    const marketSlide = makeStorySlide(2, "market-story", market);
    const marketGrid = create("div", "market-story-grid market-interactive");

    const trends = create("section", "market-column story-subpanel");
    trends.append(create("h3", "story-subheading", "Industry Trends"));
    const trendsSchematic = create("div", "market-trends-widget");
    trends.append(trendsSchematic);
    if (market.opportunity) trends.append(create("p", "market-opportunity", market.opportunity));

    const advantages = create("section", "market-column story-subpanel");
    advantages.append(create("h3", "story-subheading", "Competitive Advantage"));
    if (market.competitiveIntro) advantages.append(create("p", "market-column-intro", market.competitiveIntro));
    const advantageAccordion = create("div", "");
    advantages.append(advantageAccordion);

    const audiences = create("section", "market-column story-subpanel");
    audiences.append(create("h3", "story-subheading", "Target Market"));
    const audienceSegments = create("div", "");
    audiences.append(audienceSegments);

    marketGrid.append(trends, advantages, audiences);
    marketSlide.content.append(marketGrid);
    hosts.market.append(marketSlide.card);

    /* --- Wire widgets once the content is mounted --- */
    defer(function () {
      const widgets = window.LazyWidgets;
      if (!widgets) return;

      widgets.tabs(tabHost, {
        label: "Founder profile sections",
        panels: [
          { label: "Background", build: (host) => fillParagraphs(host, founder.background, "ix-dossier-bio") },
          { label: "Why me", build: (host) => fillParagraphs(host, founder.whyParagraphs, "ix-dossier-bio") },
          { label: "Skills", build: (host) => {
            const cols = create("div", "ix-skill-cols");
            [["Marketing", founder.marketingSkills], ["Business", founder.businessSkills]].forEach(([heading, value]) => {
              const column = create("div", "");
              column.append(create("h4", "", heading));
              const list = create("ul", "");
              textLines(value).forEach((item) => list.append(create("li", "", item)));
              column.append(list);
              cols.append(column);
            });
            host.append(cols);
          } },
        ],
      });

      const pillarItems = pairLines(summary.pillars);
      widgets.schematic(summarySchematic, {
        label: "What the experiment is",
        nodes: pillarItems.map((item, index) => ({
          title: item.title,
          tag: ["Commitment", "Measure", "Control", "Reference"][index] || "Commitment",
          body: item.body,
          meta: `0${index + 1} / 04 — pre-registered commitments`,
        })),
      });

      const trendLines = textLines(market.trends);
      widgets.schematic(trendsSchematic, {
        label: "Industry trends",
        nodes: trendLines.map((line, index) => ({
          title: ["Gig economy", "Passive income", "Flexible work", "New wealth"][index] || `Trend 0${index + 1}`,
          tag: `Trend 0${index + 1}`,
          body: line,
        })),
      });

      widgets.accordion(advantageAccordion, {
        label: "Competitive advantages",
        startOpen: 0,
        items: pairLines(market.advantages).map((item) => ({ title: item.title, body: item.body })),
      });

      const audienceItems = pairLines(market.audiences);
      const fits = [92, 78, 84, 71];
      widgets.segmented(audienceSegments, {
        label: "Audience segments",
        items: audienceItems.map((item, index) => ({
          title: item.title,
          tag: `Segment 0${index + 1}`,
          body: item.body,
          fit: fits[index] || 75,
        })),
      });
    });
  }

  function renderHome(data) {
    const hero = data.hero || {};
    setText("#hero-overline", hero.eyebrow || "Social Experiment Meets Business Incubator");
    setText("#hero-heading", hero.heading || "Fund My Lazy Life Experiment");
    setText("#hero-subtitle", hero.subtitle || "");
    setText("#hero-cta-label", hero.ctaLabel || "Back This Project");
    setText("#hero-requirements", hero.requirements || "");
    setText("#hero-scroll-label", hero.scrollLabel || "Scroll to explore");
    configureDownload($("#hero-download"), hero.ctaLabel, hero.downloadUrl, $("#hero-requirements"));
    const cue = $("#hero-scroll-cue");
    if (cue) {
      cue.type = "button";
      cue.setAttribute("aria-label", "Scroll down to meet the experimenter");
    }

    const featureIntro = data.featureIntro || {};
    setText("#feature-intro-eyebrow", featureIntro.eyebrow || "THE IDEA, THE PEOPLE, THE OPPORTUNITY");
    renderHeading($("#feature-intro-title"), featureIntro.title || "A radical challenge to traditional work culture.", featureIntro.highlight, "");
    renderStorySlides(data);

    const experiment = data.experiment || {};
    const business = experiment.business || {};
    setText("#business-eyebrow", business.eyebrow || "Business Model");
    renderHeading($("#business-title"), business.title || "", business.highlight, "");
    setText("#business-intro", business.intro || "");
    const bizSchematic = $("#business-pillars");
    if (bizSchematic) bizSchematic.className = "business-schematic-widget";
    setText("#platform-kicker", business.platformKicker || "SOLD AS A PRODUCT");
    setText("#revenue-kicker", business.revenueKicker || "WHAT PEOPLE PAY FOR");
    setText("#platform-title", business.platformTitle || "The Idea Generator Platform");
    setText("#platform-intro", business.platformIntro || "");
    setText("#revenue-title", business.revenueTitle || "Revenue Streams");

    defer(() => {
      const widgets = window.LazyWidgets;
      if (!widgets) return;
      widgets.schematic(bizSchematic, {
        label: "How the model works",
        nodes: pairLines(business.pillars).map((item, index) => ({
          title: item.title,
          tag: ["Engine 01", "Engine 02", "Engine 03", "Rule"][index] || "Engine",
          body: item.body,
        })),
      });
      widgets.flow($("#platform-steps"), {
        steps: textLines(business.platformSteps).map((line, index) => ({
          title: line,
          tag: index === 0 ? "Cohort" : index === 1 ? "Measure" : "Report",
        })),
        note: business.platformClosing || "",
      });
      widgets.accordion($("#revenue-streams"), {
        label: "Revenue streams",
        startOpen: 0,
        items: pairLines(business.revenueStreams).map((item) => ({ title: item.title, body: item.body })),
      });
    });

    const ledger = experiment.ledger || {};
    setText("#ledger-eyebrow", ledger.eyebrow || "The Ledger");
    renderHeading($("#ledger-title"), ledger.title || "", ledger.highlight, "");
    setText("#ledger-intro", ledger.intro || "");

    defer(() => {
      const widgets = window.LazyWidgets;
      if (!widgets) return;

      const stats = $("#ledger-stats");
      if (stats) {
        stats.replaceChildren();
        [[ledger.statIn || "$0 in", "In, cumulative"],
         [ledger.statOut || "$0 out", "Out, cumulative"],
         [ledger.statProduced || "Day 0", "Produced"]].forEach(([value, label]) => {
          const cell = create("div", "ix-stat");
          cell.append(create("span", "", label), create("strong", "", value));
          stats.append(cell);
        });
        if (ledger.statNote) {
          const note = create("p", "ledger-note", ledger.statNote);
          stats.append(note);
        }
      }

      const build = (target, value, label) => {
        if (!target) return;
        widgets.accordion(target, {
          label,
          startOpen: 0,
          items: pairLines(value).map((item) => ({ title: item.title, body: item.body })),
        });
      };
      build($("#ledger-in"), ledger.moneyIn, "Money in");
      build($("#ledger-out"), ledger.moneyOut, "Money out");
      build($("#ledger-produced"), ledger.produced, "What it produced");
    });

    const financials = experiment.financials || {};
    setText("#financial-eyebrow", financials.eyebrow || "Financial Projections");
    renderHeading($("#financial-title"), financials.title || "", financials.highlight, "");
    setText("#financial-breakeven", financials.breakEven || "");
    setText("#financial-metric-label", financials.metricLabel || "Revenue at maturity");
    setText("#financial-breakeven-note", financials.breakEvenNote || "");
    setText("#funding-title", financials.fundingTitle || "Funding Request");
    setText("#funding-intro", financials.fundingIntro || "");
    setText("#exit-title", financials.exitTitle || "Exit Strategy");
    setText("#exit-intro", financials.exitIntro || "");

    defer(() => {
      const widgets = window.LazyWidgets;
      if (!widgets) return;
      widgets.timeline($("#financial-phases"), {
        label: "Funding phases",
        phases: pairLines(financials.phases).map((item) => ({ title: item.title, body: item.body })),
      });
      widgets.accordion($("#funding-uses"), {
        label: "Where the funding goes",
        startOpen: 0,
        items: pairLines(financials.fundingUses).map((item) => ({ title: item.title, body: item.body })),
      });
      widgets.accordion($("#exit-routes"), {
        label: "Exit routes",
        startOpen: 0,
        items: pairLines(financials.exitRoutes).map((item) => ({ title: item.title, body: item.body })),
      });
    });

    const join = experiment.join || {};
    setText("#join-eyebrow", join.eyebrow || "Join the Experiment");
    renderHeading($("#join-title"), join.title || "Fund My Lazy Life Experiment Today", join.highlight, "");
    setText("#join-why-title", join.whyTitle || "Why Back This Project?");
    setText("#join-why-body", join.whyBody || "");
    fillTextList($("#join-benefits"), join.benefits, "join-benefits");
    setText("#join-closing-line", join.closingLine || "");
    setText("#join-goal", join.fundingGoal || "Reader · Free");
    setText("#join-phase", join.initialPhase || "Patron · $5/mo");
    setText("#join-timeline", join.toBreakEven || "Backer · $15/mo");
    setText("#join-access", join.earlyAccess || "Underwriter · $250");
    setText("#join-goal-label", join.goalLabel || "Tier 01");
    setText("#join-phase-label", join.phaseLabel || "Tier 02");
    setText("#join-timeline-label", join.timelineLabel || "Tier 03");
    setText("#join-access-label", join.accessLabel || "Tier 04");
    setText("#interest-title", join.formTitle || "Reserve Your Spot");
    setText("#interest-intro", join.formIntro || "");
    setText("#interest-email-label", join.emailLabel || "Email Address");
    setText("#interest-amount-label", join.amountLabel || "Investment Amount ($)");
    setText("#interest-submit", join.buttonLabel || "Register Interest");
    setText("#interest-note", join.formNote || "This preview form is not connected to a submission service.");
    const interestForm = $("#interest-form");
    const interestButton = $("#interest-submit");
    if (interestForm && interestButton && !interestForm.dataset.bound) {
      interestForm.dataset.bound = "true";
      interestButton.addEventListener("click", () => {
        setText("#interest-status", "This preview form isn't connected to a submission service, so your details were not sent or stored.");
      });
    }

    const closing = data.closing || {};
    setText("#closing-eyebrow", closing.eyebrow || "Ready to be part of it?");
    renderHeading($("#closing-title"), closing.title || "", closing.highlight, closing.emphasis);
    setText("#closing-cta-label", closing.ctaLabel || "Back This Project Now");
    setText("#closing-requirements", closing.requirements || "");
    configureDownload($("#closing-download"), closing.ctaLabel || hero.ctaLabel, hero.downloadUrl, $("#closing-requirements"));
  }

  function appendDownloadIcon(anchor) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M5 12h14m-6-6 6 6-6 6");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.8");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(path);
    const label = create("span", "", "Back This Project");
    anchor.replaceChildren(svg, label);
  }

  function renderModelsPage(data) {
    const model = data.modelsPage || {};
    const root = $("#subpage");
    if (!root) return;
    root.replaceChildren();
    const hero = create("section", "subpage-hero");
    hero.append(create("p", "section-eyebrow", model.eyebrow || "FUTURE DEVELOPMENT"));
    const title = create("h1");
    renderHeading(title, model.title || "", model.highlight, "");
    hero.append(title, create("p", "", model.intro || ""));

    const spec = create("section", "models-spec");
    const specCopy = create("div");
    specCopy.append(create("h2", "", model.modelName || "The Idea Generator Platform"), create("p", "", model.requirements || ""));
    const cta = create("a", "primary-button download-action");
    appendDownloadIcon(cta);
    spec.append(specCopy, cta);

    const cards = create("section", "models-list");
    const features = Array.isArray(model.features) ? model.features : [];
    features.forEach((item, index) => {
      const card = create("article");
      card.append(create("span", "", ["✧", "↗", "✎", "♫"][index % 4]), create("h3", "", item.title || ""), create("p", "", item.description || ""));
      cards.append(card);
    });

    /* An interactive schematic of the platform loop, mirroring the deck's
       content widgets so the subpage feels like the same product. */
    const loop = create("section", "subpage-loop");
    loop.append(create("p", "section-eyebrow", "THE FOUR MODULES"));
    const loopTitle = create("h2", "", "Four modules. Nothing else, yet.");
    loop.append(loopTitle);
    loop.append(create("p", "subpage-loop-intro", "Every extra feature is a reason not to publish. These four have to be used weekly before anything else is built."));
    const loopWidget = create("div", "subpage-loop-widget");
    loop.append(loopWidget);

    root.append(hero, spec, cards, loop);

    defer(() => {
      const widgets = window.LazyWidgets;
      if (!widgets || !widgets.schematic) return;
      widgets.schematic(loopWidget, {
        label: "The platform loop",
        nodes: [
          { title: "Log", tag: "Module 01", body: "One daily entry: what was attempted, what shipped, what was killed, and how long it took.", meta: "Public by default" },
          { title: "Signal", tag: "Module 02", body: "Readers vote on which ideas proceed, so attention becomes a funding signal.", meta: "Not a vanity metric" },
          { title: "Track", tag: "Module 03", body: "Every idea carries to shipped or killed, with the reason logged at decision time.", meta: "No idea quietly disappears" },
          { title: "Receipt", tag: "Module 04", body: "Money in, money out, and what it produced — categorised and public.", meta: "The accountability layer" },
        ],
      });
    });
    const downloadUrl = (data.hero && data.hero.downloadUrl) || "";
    const pageTarget = downloadUrl.startsWith("#") ? `/${downloadUrl}` : (downloadUrl || "/#join");
    configureDownload(cta, (data.hero && data.hero.ctaLabel) || "Back This Project", pageTarget, null);
  }

  function renderPrivacyPage(data) {
    const privacy = data.privacyPage || {};
    const root = $("#subpage");
    if (!root) return;
    root.replaceChildren();
    const hero = create("section", "subpage-hero");
    hero.append(create("p", "section-eyebrow", privacy.eyebrow || "A NOTE ON TRUST"));
    const title = create("h1");
    renderHeading(title, privacy.title || "", privacy.highlight, "");
    hero.append(title, create("p", "", privacy.intro || ""));
    const card = create("section", "privacy-card");
    const body = String(privacy.body || "");
    body.split(/\n\s*\n/).filter(Boolean).forEach((paragraph) => card.append(create("p", "", paragraph)));
    const contact = create("div", "privacy-contact");
    contact.append(create("small", "", privacy.contactLabel || "Contact"), create("p", "", privacy.contactValue || ""));
    card.append(contact);
    root.append(hero, card);
  }

  function applyTheme(data) {
    const theme = data.theme || {};
    const root = document.documentElement;
    root.style.setProperty("--paper", colorValue(theme.paper, "#faf9f6"));
    root.style.setProperty("--ink", colorValue(theme.ink, "#111110"));
    root.style.setProperty("--dark", colorValue(theme.dark, "#080908"));
    root.style.setProperty("--on-dark", colorValue(theme.onDark, "#fffefa"));
    root.style.setProperty("--muted", colorValue(theme.muted, "#77766f"));
    root.style.setProperty("--accent", colorValue(theme.accent, "#9560f5"));
    root.style.setProperty("--lime", colorValue(theme.lime, "#d1efb0"));
    root.style.setProperty("--spectrum", gradientValue(theme.spectrum, "linear-gradient(110deg, #79b83b, #efbd22, #ff9218, #ee403b, #a83c91, #238cd0)"));
  }

  function applyContent(data) {
    if (!data || typeof data !== "object") return;
    const page = document.body.dataset.page || "home";
    applyTheme(data);
    renderNav(data, page);
    const meta = data.meta || {};
    const description = $("meta[name=description]");
    if (description) description.content = meta.description || "";
    document.documentElement.lang = meta.language || "en";

    if (page === "home") {
      document.title = meta.siteTitle || "The Lazy Life Experiment";
      renderHome(data);
    } else if (page === "models") {
      document.title = `${(data.modelsPage && data.modelsPage.title) || "The Idea Generator Platform"} · ${data.brand || "The Lazy Life Experiment"}`;
      renderModelsPage(data);
    } else if (page === "privacy") {
      document.title = `${(data.privacyPage && data.privacyPage.title) || "Transparency"} · ${data.brand || "The Lazy Life Experiment"}`;
      renderPrivacyPage(data);
    }
    observeReveals();
  }

  function observeReveals() {
    if (revealObserver) revealObserver.disconnect();
    revealObserver = null;
    const items = $$(".reveal").filter((item) => !item.closest(".journey"));
    if (!items.length) return;
    if (!("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-visible"));
      return;
    }
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -3% 0px" });
    items.forEach((item) => {
      if (!item.classList.contains("is-visible")) revealObserver.observe(item);
    });
  }

  function showToast(message) {
    const toast = $("#site-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3500);
  }

  document.addEventListener("click", (event) => {
    const download = event.target.closest(".download-action");
    if (download && !download.dataset.downloadUrl) {
      event.preventDefault();
      showToast("Set a project or funding destination in the Site editor to activate this button.");
    }
  });

  window.addEventListener("message", (event) => {
    if (window.parent === window || event.source !== window.parent || event.origin !== window.location.origin) return;
    const message = event.data;
    if (message && message.type === "pixie-preview-content" && message.content) applyContent(message.content);
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== DRAFT_KEY || !event.newValue) return;
    try { applyContent(JSON.parse(event.newValue)); } catch (_) { /* Ignore invalid local drafts. */ }
  });


  /* Deck navigation.
   *
   * The page is a fixed stack of six slides. There is no scrolling: the eye
   * widget zooms open over the current slide, the slide swaps underneath it
   * while the screen is covered, then it shrinks back to the window at the
   * top and the new slide is readable. Wheel, keys, swipe and the arrows all
   * drive the same transition.
   */
  const DECK_IDS = ["hero", "about", "summary", "market", "business", "financials", "ledger", "join", "download"];

  function initDeck() {
    const main = $("#main");
    const journeyEl = main && main.querySelector(".journey");
    if (journeyEl) journeyEl.dataset.deck = "on";
    const notch = $("#hero-notch");
    const slides = DECK_IDS
      .map((id) => document.getElementById(id === "hero" ? "home-hero" : id))
      .filter(Boolean);
    if (!main || !notch || slides.length < 2) return;

    const progress = $("#deck-progress .deck-count");
    const prevButton = $("#deck-prev");
    const nextButton = $("#deck-next");

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = motionQuery.matches;
    motionQuery.addEventListener?.("change", (event) => { reduced = event.matches; });

    let index = 0;
    let animating = false;

    const chrome = () => [notch, ...document.querySelectorAll(".site-header")];

    // Scale dense slides down so they fit the viewport without scrolling.
    /* ---------------------------------------------------------------
       Measure the real chrome (floating header + eye window) and the deck
       nav, then publish them as CSS variables. Every slide's ::before and
       ::after spacers use these, so content can never sit under chrome.
       --------------------------------------------------------------- */
    const navEl = $(".deck-nav");
    const header = $(".site-header");

    const measureChrome = () => {
      const root = document.documentElement;
      /* Use the notch's RESTING size, never its live rect: during a
         transition it is animating to full-screen and would report the
         whole viewport as chrome. offsetHeight is layout height, which is
         also animated — so derive from the CSS clamp instead. */
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const mobile = vw <= 760;
      const tablet = vw > 760 && vw <= 1024;
      let notchRest = Math.max(84, Math.min(0.12 * vh, 124));
      if (mobile) notchRest = 96;
      else if (tablet) notchRest = 88;
      let notchTop = 0;
      if (mobile) notchTop = 62;
      else if (tablet) notchTop = Math.round(header ? header.getBoundingClientRect().bottom : 62) + 4;
      const notchBottom = notchTop + notchRest;

      let headerBottom = 0;
      if (header) headerBottom = header.getBoundingClientRect().bottom;

      const chromeH = Math.max(notchBottom, headerBottom);
      const navH = navEl ? navEl.getBoundingClientRect().height : 78;
      root.style.setProperty("--chrome-h", `${Math.round(chromeH)}px`);
      root.style.setProperty("--deck-nav-h", `${Math.round(navH)}px`);
      return chromeH;
    };

    /* On phones the eye window is centred and the wordmark sits to its
       left, so the two collide. Drop the window below the header there. */
    const placeNotch = () => {
      if (!notch) return;
      const vw = window.innerWidth;
      const narrow = vw <= 1024; /* phones + tablets: pill is wide or full-width */
      if (narrow) {
        /* Tuck the window under the header so it never covers the wordmark.
           Phones use a fixed 62px (the pill is 48px tall at top:12px);
           tablets measure, because the header is taller there. */
        const top = vw <= 760
          ? 62
          : Math.round((header ? header.getBoundingClientRect().bottom : 62) + 4);
        notch.style.setProperty("--notch-top", `${top}px`);
      } else {
        notch.style.removeProperty("--notch-top");
      }
    };

    /* Fit the content row into the space the spacers leave behind. */
    const fitSlide = (slide) => {
      if (!slide) return;
      const kids = [...slide.children].filter((k) => getComputedStyle(k).position !== "fixed");
      if (!kids.length) return;
      slide.style.removeProperty("--fit");
      slide.classList.remove("is-scaled");

      const styles = getComputedStyle(slide);
      const avail = slide.clientHeight
        - parseFloat(styles.paddingTop)
        - parseFloat(styles.paddingBottom)
        - parseFloat(getComputedStyle(slide, "::before").height || 0)
        - parseFloat(getComputedStyle(slide, "::after").height || 0);
      if (avail <= 0) return;

      /* Measure RENDERED height, not scrollHeight: scrollHeight counts
         hidden descendants (collapsed accordions, display:none rows), which
         inflated the estimate and made the deck shrink slides that fit. */
      const natural = kids.reduce((sum, k) => sum + k.getBoundingClientRect().height, 0);
      if (!natural) return;
      /* Short phones scroll internally rather than shrinking type. */
      const shortPhone = window.innerWidth <= 760 && window.innerHeight <= 720;
      if (shortPhone) {
        slide.style.removeProperty("--fit");
        slide.classList.remove("is-scaled");
        return;
      }
      const scale = Math.min(1, avail / natural);
      if (scale < 0.98) {
        slide.style.setProperty("--fit", scale.toFixed(3));
        slide.classList.add("is-scaled");
      }
    };

    const paint = () => {
      slides.forEach((slide, i) => {
        const on = i === index;
        slide.classList.toggle("is-active", on);
        slide.setAttribute("aria-hidden", String(!on));
        slide.inert = !on;
        // The story cards keep their own inert flag from the old carousel;
        // an inert ancestor pauses CSS animations, so sync it here.
        const card = slide.querySelector(".story-card");
        if (card) {
          card.inert = !on;
          card.setAttribute("aria-hidden", String(!on));
        }
      });
      if (progress) progress.textContent = `${index + 1} / ${slides.length}`;
      requestAnimationFrame(() => {
        placeNotch();
        measureChrome();
        fitSlide(slides[index]);
        // Second pass after the CSS transition settles.
        setTimeout(() => {
          measureChrome();
          fitSlide(slides[index]);
        }, 440);
      });
      if (prevButton) prevButton.disabled = index === 0;
      if (nextButton) nextButton.disabled = index === slides.length - 1;
      main.dataset.slide = String(index);
    };

    const go = (next, instant) => {
      const target = Math.max(0, Math.min(slides.length - 1, next));
      if (animating || target === index) return;
      if (instant || reduced) {
        index = target;
        paint();
        return;
      }
      animating = true;
      notch.classList.remove("is-settled");
      notch.classList.add("is-expanded");
      // Cover the screen, swap the slide underneath, then shrink back.
      window.setTimeout(() => {
        index = target;
        paint();
        notch.classList.add("is-settled");
        window.setTimeout(() => {
          notch.classList.remove("is-expanded", "is-settled");
          animating = false;
        }, 460);
      }, 520);
    };

    const step = (delta) => go(index + delta);

    // Wheel and trackpad: one gesture, one slide, with a short cooldown.
    let wheelLock = 0;
    window.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const now = performance.now();
        if (now < wheelLock) return;
        if (Math.abs(event.deltaY) < 8) return;
        wheelLock = now + 900;
        step(event.deltaY > 0 ? 1 : -1);
      },
      { passive: false }
    );

    // Touch: swipe up for next, down for previous.
    let touchY = 0;
    window.addEventListener("touchstart", (event) => {
      touchY = event.touches[0].clientY;
    }, { passive: true });
    window.addEventListener("touchend", (event) => {
      const endY = event.changedTouches[0].clientY;
      const delta = touchY - endY;
      if (Math.abs(delta) < 40) return;
      step(delta > 0 ? 1 : -1);
    }, { passive: true });

    // Keyboard.
    window.addEventListener("keydown", (event) => {
      if (event.target.closest("input, textarea, select")) return;
      const keys = ["ArrowDown", "ArrowRight", "PageDown", " "];
      const back = ["ArrowUp", "ArrowLeft", "PageUp"];
      if (keys.includes(event.key)) { event.preventDefault(); step(1); }
      else if (back.includes(event.key)) { event.preventDefault(); step(-1); }
      else if (event.key === "Home") { event.preventDefault(); go(0); }
      else if (event.key === "End") { event.preventDefault(); go(slides.length - 1); }
    });

    nextButton?.addEventListener("click", () => step(1));
    prevButton?.addEventListener("click", () => step(-1));

    // A click on the eye window also advances.
    notch.addEventListener("click", () => step(1));

    // Deep links (#join and friends) open straight onto that slide.
    const hashMap = { "#about": 1, "#summary": 2, "#market": 3, "#business": 4, "#financials": 5, "#ledger": 6, "#join": 7, "#download": 8 };
    const fromHash = hashMap[window.location.hash];
    if (fromHash != null) index = fromHash;

    // Nav links inside the deck jump slides instead of scrolling.
    document.addEventListener("click", (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;
      const target = hashMap[link.getAttribute("href")];
      if (target == null) return;
      event.preventDefault();
      go(target);
    });

    window.addEventListener("resize", () => {
      placeNotch();
      measureChrome();
      fitSlide(slides[index]);
    }, { passive: true });
    paint();
  }

  async function init() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (_) { saved = null; }
    try {
      const response = await fetch(`/site-content.json?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load site content");
      const published = await response.json();
      applyContent(saved || published);
    } catch (_) {
      applyContent(saved || {});
    }
  }

  init();
  initDeck();
})();
