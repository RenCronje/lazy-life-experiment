(() => {
  "use strict";

  const DRAFT_KEY = "lazy-life-experiment-draft-v1";
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const fieldHost = $("#field-sections");
  const preview = $("#site-preview");
  const toastNode = $("#editor-toast");
  const noticeNode = $("#editor-notice");
  const publishButton = $("#publish-github");
  const saveButton = $("#save-project");
  const passwordInput = $("#editor-password");
  let content = null;
  let originalContent = null;
  let serverStatus = { mode: "static", githubConfigured: false, passwordConfigured: false };
  let toastTimer;

  const text = (path, label, type = "text", hint = "") => ({ path, label, type, hint });
  const commonGroups = [
    {
      title: "Brand & site details",
      description: "The project name, browser title, and search preview.",
      fields: [
        text("brand", "Wordmark"),
        text("meta.siteTitle", "Browser title"),
        text("meta.description", "Search description", "textarea"),
        text("meta.language", "Language code", "text", "For example: en")
      ]
    },
    {
      title: "Colors & look",
      description: "Choose the page palette. Colors update in the preview as you change them.",
      fields: [
        text("theme.paper", "Warm page background", "color"),
        text("theme.ink", "Main text", "color"),
        text("theme.dark", "Dark sections", "color"),
        text("theme.onDark", "Text on dark sections", "color"),
        text("theme.muted", "Muted text", "color"),
        text("theme.accent", "Experiment accent", "color"),
        text("theme.lime", "Soft green accent", "color"),
        text("theme.spectrum", "Gradient CSS", "text", "Use a CSS linear-gradient(...).")
      ]
    },
    { title: "Navigation", description: "Edit the top and footer links. Home-page anchors jump to the matching scroll chapter.", array: "nav", fields: [], arrayFields: [text("label", "Link text"), text("href", "Destination")] },
    {
      title: "Hero",
      description: "The first screen visitors see.",
      fields: [
        text("hero.eyebrow", "Overline"),
        text("hero.heading", "Main headline"),
        text("hero.subtitle", "Supporting line", "textarea"),
        text("hero.ctaLabel", "Button label"),
        text("hero.downloadUrl", "Button destination", "text", "Use a URL or a home anchor such as #join."),
        text("hero.requirements", "Funding / phase note"),
        text("hero.scrollLabel", "Scroll prompt")
      ]
    },
    {
      title: "Experiment intro",
      description: "Small heading shown over the first three story chapters.",
      fields: [
        text("featureIntro.eyebrow", "Eyebrow"),
        text("featureIntro.title", "Section heading"),
        text("featureIntro.highlight", "Gradient word")
      ]
    },
    {
      title: "Founder profile",
      description: "The founder's background and the reason for running the experiment.",
      fields: [
        text("experiment.founder.eyebrow", "Eyebrow"),
        text("experiment.founder.title", "Section headline"),
        text("experiment.founder.intro", "Intro line", "textarea"),
        text("experiment.founder.name", "Name"),
        text("experiment.founder.role", "Professional title", "textarea"),
        text("experiment.founder.background", "Professional background", "textarea"),
        text("experiment.founder.whyTitle", "Why this founder"),
        text("experiment.founder.whyParagraphs", "Why this founder — paragraphs", "textarea", "Separate paragraphs with a blank line.")
      ]
    },
    {
      title: "Founder experience & skills",
      description: "Use one item per line. Social links use: label | https://address.",
      fields: [
        text("experiment.founder.career", "Career highlights", "textarea"),
        text("experiment.founder.marketingSkills", "Marketing skills", "textarea"),
        text("experiment.founder.businessSkills", "Business skills", "textarea"),
        text("experiment.founder.socialLinks", "Social profile links", "textarea")
      ]
    },
    {
      title: "Executive summary",
      description: "Four summary cards use: card title | card description. The quote appears below them.",
      fields: [
        text("experiment.summary.eyebrow", "Eyebrow"),
        text("experiment.summary.title", "Headline"),
        text("experiment.summary.intro", "Introduction", "textarea"),
        text("experiment.summary.pillars", "Summary cards", "textarea"),
        text("experiment.summary.quote", "Pull quote", "textarea")
      ]
    },
    {
      title: "Market analysis",
      description: "Enter trends and audiences one per line. Advantage and audience cards use: title | description.",
      fields: [
        text("experiment.market.eyebrow", "Eyebrow"),
        text("experiment.market.title", "Headline"),
        text("experiment.market.intro", "Introduction", "textarea"),
        text("experiment.market.trends", "Industry trends", "textarea"),
        text("experiment.market.opportunity", "Market opportunity", "textarea"),
        text("experiment.market.competitiveIntro", "Competitive advantage intro", "textarea"),
        text("experiment.market.advantages", "Competitive advantages", "textarea"),
        text("experiment.market.audiences", "Target market cards", "textarea")
      ]
    },
    {
      title: "Business model",
      description: "Pillar and revenue lines use: title | description. Platform steps use one item per line.",
      fields: [
        text("experiment.business.eyebrow", "Eyebrow"),
        text("experiment.business.title", "Headline"),
        text("experiment.business.intro", "Introduction", "textarea"),
        text("experiment.business.pillars", "Business model pillars", "textarea"),
        text("experiment.business.platformTitle", "Platform heading"),
        text("experiment.business.platformIntro", "Platform intro", "textarea"),
        text("experiment.business.platformSteps", "Idea Generator steps", "textarea"),
        text("experiment.business.platformClosing", "Platform closing line", "textarea"),
        text("experiment.business.revenueTitle", "Revenue heading"),
        text("experiment.business.revenueStreams", "Revenue streams", "textarea")
      ]
    },
    {
      title: "Financial projections",
      description: "Phases, funding uses, and exit routes use: title | description.",
      fields: [
        text("experiment.financials.eyebrow", "Eyebrow"),
        text("experiment.financials.title", "Headline"),
        text("experiment.financials.phases", "Funding phases", "textarea"),
        text("experiment.financials.breakEven", "Break-even estimate"),
        text("experiment.financials.breakEvenNote", "Break-even context", "textarea"),
        text("experiment.financials.fundingTitle", "Funding request heading"),
        text("experiment.financials.fundingIntro", "Funding request intro", "textarea"),
        text("experiment.financials.fundingUses", "Use of funds", "textarea"),
        text("experiment.financials.exitTitle", "Exit strategy heading"),
        text("experiment.financials.exitIntro", "Exit strategy intro", "textarea"),
        text("experiment.financials.exitRoutes", "Potential exit routes", "textarea")
      ]
    },
    {
      title: "Join the experiment",
      description: "Edit the backer benefits, milestones, and the interest-form copy. The preview form does not submit or store entries.",
      fields: [
        text("experiment.join.eyebrow", "Eyebrow"),
        text("experiment.join.title", "Headline"),
        text("experiment.join.whyTitle", "Why back this project?"),
        text("experiment.join.whyBody", "Why-back intro", "textarea"),
        text("experiment.join.benefits", "Backer benefits", "textarea", "Use one benefit per line."),
        text("experiment.join.closingLine", "Closing line"),
        text("experiment.join.fundingGoal", "Funding goal"),
        text("experiment.join.initialPhase", "Initial phase"),
        text("experiment.join.toBreakEven", "Break-even timeline"),
        text("experiment.join.earlyAccess", "Early access status"),
        text("experiment.join.formTitle", "Interest form heading"),
        text("experiment.join.formIntro", "Interest form intro", "textarea"),
        text("experiment.join.emailLabel", "Email field label"),
        text("experiment.join.amountLabel", "Amount field label"),
        text("experiment.join.buttonLabel", "Submit button label"),
        text("experiment.join.formNote", "Form notice", "textarea")
      ]
    },
    {
      title: "Closing call to action",
      description: "The final invitation and the link back to the interest form.",
      fields: [
        text("closing.eyebrow", "Eyebrow"),
        text("closing.title", "Closing headline", "textarea"),
        text("closing.highlight", "Gradient phrase"),
        text("closing.emphasis", "Bold phrase"),
        text("closing.ctaLabel", "Button label"),
        text("closing.requirements", "Funding / phase note")
      ]
    },
    {
      title: "Footer",
      description: "The footer note and the link to the editor.",
      fields: [text("footer.note", "Footer line"), text("footer.editorLabel", "Editor link label")]
    },
    {
      title: "Idea Generator page",
      description: "Copy for the linked platform page.",
      fields: [
        text("modelsPage.eyebrow", "Eyebrow"),
        text("modelsPage.title", "Page heading"),
        text("modelsPage.highlight", "Gradient phrase"),
        text("modelsPage.intro", "Introduction", "textarea"),
        text("modelsPage.modelName", "Platform label"),
        text("modelsPage.requirements", "Platform summary")
      ],
      array: "modelsPage.features",
      arrayFields: [text("title", "Platform step"), text("description", "Description", "textarea")]
    },
    {
      title: "Transparency page",
      description: "Summary of the source website's transparency and participation copy. Add approved legal/privacy terms before launch.",
      fields: [
        text("privacyPage.eyebrow", "Eyebrow"),
        text("privacyPage.title", "Page heading"),
        text("privacyPage.highlight", "Gradient word"),
        text("privacyPage.intro", "Introduction", "textarea"),
        text("privacyPage.body", "Transparency details", "textarea"),
        text("privacyPage.contactLabel", "Links label"),
        text("privacyPage.contactValue", "Links description")
      ]
    }
  ];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function getPath(object, path) {
    return String(path).split(".").reduce((cursor, part) => cursor == null ? undefined : cursor[part], object);
  }

  function setPath(object, path, value) {
    const parts = String(path).split(".");
    let cursor = object;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const key = parts[index];
      if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = /^\d+$/.test(parts[index + 1]) ? [] : {};
      cursor = cursor[key];
    }
    cursor[parts[parts.length - 1]] = value;
  }

  function showToast(message, kind = "") {
    if (!toastNode) return;
    toastNode.textContent = message;
    toastNode.className = `toast is-visible ${kind}`.trim();
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastNode.classList.remove("is-visible"), 4100);
  }

  function setNotice(message, commitUrl) {
    if (!noticeNode) return;
    noticeNode.replaceChildren(document.createTextNode(message));
    if (commitUrl && /^https:\/\//i.test(commitUrl)) {
      const link = document.createElement("a");
      link.href = commitUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = " View commit";
      noticeNode.append(link);
    }
  }

  function saveDraft() {
    if (!content) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(content));
      setNotice("Draft saved in this browser. Use Save to project or Publish to GitHub to make it permanent.");
    } catch (_) {
      setNotice("Your browser could not save this draft. Export the JSON file to keep a copy.");
    }
    syncPreview();
  }

  function syncPreview() {
    if (!content || !preview || !preview.contentWindow) return;
    try {
      preview.contentWindow.postMessage({ type: "pixie-preview-content", content }, window.location.origin);
    } catch (_) { /* The preview will pick up the saved draft when it reloads. */ }
  }

  function inputId(path) { return `field-${String(path).replace(/[^a-z0-9_-]/gi, "-")}`; }

  function renderField(field, basePath = "") {
    const path = basePath ? `${basePath}.${field.path}` : field.path;
    const value = getPath(content, path);
    const wrapper = document.createElement("div");
    wrapper.className = `edit-field ${field.type === "textarea" ? "is-wide" : ""}`;
    const id = inputId(path);
    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = field.label;
    wrapper.append(label);

    if (field.type === "textarea") {
      const control = document.createElement("textarea");
      control.id = id;
      control.rows = 3;
      control.value = value == null ? "" : String(value);
      control.dataset.path = path;
      control.dataset.valueType = "string";
      control.autocomplete = "off";
      wrapper.append(control);
    } else if (field.type === "color") {
      const row = document.createElement("div");
      row.className = "color-field-row";
      const color = document.createElement("input");
      color.type = "color";
      color.id = id;
      color.value = /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : "#faf9f6";
      color.dataset.path = path;
      color.dataset.valueType = "string";
      color.setAttribute("aria-label", `${field.label} color picker`);
      const raw = document.createElement("input");
      raw.type = "text";
      raw.value = value == null ? "" : String(value);
      raw.dataset.colorTextFor = path;
      raw.setAttribute("aria-label", `${field.label} hex value`);
      raw.autocomplete = "off";
      row.append(color, raw);
      wrapper.append(row);
    } else if (field.type === "select") {
      const select = document.createElement("select");
      select.id = id;
      select.dataset.path = path;
      select.dataset.valueType = "string";
      [["voice", "Voice / ask"], ["speed", "Quick actions"], ["apps", "App grid"]].forEach(([choice, labelText]) => {
        const option = document.createElement("option");
        option.value = choice;
        option.textContent = labelText;
        option.selected = String(value || "voice") === choice;
        select.append(option);
      });
      wrapper.append(select);
    } else {
      const control = document.createElement("input");
      control.type = "text";
      control.id = id;
      control.value = value == null ? "" : String(value);
      control.dataset.path = path;
      control.dataset.valueType = "string";
      control.autocomplete = "off";
      if (field.type === "url") control.inputMode = "url";
      wrapper.append(control);
    }
    if (field.hint) {
      const hint = document.createElement("small");
      hint.textContent = field.hint;
      wrapper.append(hint);
    }
    return wrapper;
  }

  function renderArraySection(group, groupElement) {
    const arrayPath = group.array;
    const values = getPath(content, arrayPath);
    const list = Array.isArray(values) ? values : [];
    const cards = document.createElement("div");
    cards.className = "array-cards";
    list.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "array-card";
      const cardHead = document.createElement("div");
      cardHead.className = "array-card-head";
      const cardTitle = document.createElement("strong");
      const headingText = item.title || item.label || `Item ${index + 1}`;
      cardTitle.textContent = `${String(index + 1).padStart(2, "0")}  ${headingText}`;
      cardHead.append(cardTitle);
      if (arrayPath === "nav" || arrayPath === "features" || arrayPath === "modelsPage.features") {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "remove-item";
        remove.dataset.editorAction = "remove-array-item";
        remove.dataset.arrayPath = arrayPath;
        remove.dataset.index = String(index);
        remove.textContent = "Remove";
        cardHead.append(remove);
      }
      card.append(cardHead);
      const fields = document.createElement("div");
      fields.className = "field-grid array-field-grid";
      const entries = group.arrayFields || group.fields;
      entries.forEach((field) => fields.append(renderField(field, `${arrayPath}.${index}`)));
      card.append(fields);
      cards.append(card);
    });
    groupElement.append(cards);

    const actions = document.createElement("div");
    actions.className = "array-actions";
    const add = document.createElement("button");
    add.type = "button";
    add.className = "add-item";
    add.dataset.editorAction = "add-array-item";
    add.dataset.arrayPath = arrayPath;
    add.textContent = arrayPath === "nav" ? "+ Add navigation link" : "+ Add item";
    actions.append(add);
    groupElement.append(actions);
  }

  function renderGroups() {
    if (!fieldHost || !content) return;
    fieldHost.replaceChildren();
    commonGroups.forEach((group, groupIndex) => {
      const section = document.createElement("section");
      section.className = "field-section";
      const heading = document.createElement("div");
      heading.className = "field-section-heading";
      const title = document.createElement("h2");
      title.textContent = group.title;
      heading.append(title);
      const badge = document.createElement("span");
      badge.textContent = String(groupIndex + 1).padStart(2, "0");
      heading.append(badge);
      section.append(heading);
      if (group.description) {
        const desc = document.createElement("p");
        desc.className = "field-section-description";
        desc.textContent = group.description;
        section.append(desc);
      }
      if (group.array) {
        if (group.fields && group.fields.length) {
          const fields = document.createElement("div");
          fields.className = "field-grid parent-field-grid";
          group.fields.forEach((field) => fields.append(renderField(field)));
          section.append(fields);
        }
        renderArraySection(group, section);
      } else {
        const fields = document.createElement("div");
        fields.className = "field-grid";
        group.fields.forEach((field) => fields.append(renderField(field)));
        section.append(fields);
      }
      fieldHost.append(section);
    });
  }

  function readStoredDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (_) { return null; }
  }

  function setConnection(message, state) {
    const node = $("#connection-state");
    if (!node) return;
    node.className = `connection-state ${state || ""}`.trim();
    const label = node.querySelector("span");
    if (label) label.textContent = message;
  }

  async function loadServerStatus() {
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (response.ok) serverStatus = await response.json();
    } catch (_) { serverStatus = { mode: "static", githubConfigured: false, passwordConfigured: false }; }

    if (serverStatus.mode === "local") {
      setConnection(serverStatus.githubConfigured ? "Local folder · GitHub configured" : "Local folder · ready to edit", "is-local");
      setNotice("Changes are saved as a browser draft. Save to project writes site-content.json in this folder.");
      if (!serverStatus.githubConfigured) $("#publish-help").textContent = "To publish directly from this local editor, add GitHub settings to .env.local. Otherwise, push the project to GitHub and configure the Vercel variables described in the README.";
    } else if (serverStatus.mode === "vercel") {
      if (serverStatus.githubConfigured && serverStatus.passwordConfigured) {
        setConnection(`GitHub publishing ready · ${serverStatus.branch || "main"}`, "is-ready");
        $("#publish-help").textContent = "Publishing commits site-content.json to the configured GitHub branch. Vercel will start a deployment if this repo is connected.";
      } else {
        setConnection("Vercel setup needed", "is-warning");
        const missing = [];
        if (!serverStatus.githubConfigured) missing.push("GitHub token/repository");
        if (!serverStatus.passwordConfigured) missing.push("editor password");
        $("#publish-help").textContent = `Set the ${missing.join(" and ")} in Vercel project environment variables, then redeploy. See README.md.`;
      }
    } else {
      setConnection("Static preview · export to save", "is-warning");
      $("#publish-help").textContent = "For GitHub publishing, run this project with npm run dev or deploy it to Vercel with the server environment variables from README.md.";
    }
  }

  async function loadContent() {
    try {
      const response = await fetch(`/site-content.json?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("The site content file could not be loaded.");
      originalContent = await response.json();
      content = readStoredDraft() || clone(originalContent);
      renderGroups();
      syncPreview();
    } catch (error) {
      fieldHost.innerHTML = "";
      const message = document.createElement("p");
      message.className = "loading-state is-error";
      message.textContent = `${error.message} Start the local server with npm run dev, or check the deployment.`;
      fieldHost.append(message);
    }
  }

  function updateField(target) {
    const path = target.dataset.path;
    if (!path || !content) return;
    const value = target.dataset.valueType === "number" ? Number(target.value) : target.value;
    setPath(content, path, value);
    if (target.type === "color") {
      const paired = $(`[data-color-text-for="${CSS.escape(path)}"]`);
      if (paired) paired.value = target.value;
    } else if (target.dataset.colorTextFor) {
      const paired = $(`[data-path="${CSS.escape(path)}"]`);
      if (/^#[0-9a-f]{6}$/i.test(target.value) && paired) paired.value = target.value;
    }
    saveDraft();
  }

  function addArrayItem(arrayPath) {
    const list = getPath(content, arrayPath);
    if (!Array.isArray(list)) return;
    if (arrayPath === "nav") list.push({ label: "New link", href: "#about" });
    else if (arrayPath === "features") list.push({ title: "New capability", highlight: "", description: "", visual: "voice", artLabel: "Listening", artNote: "", artLine1: "", artLine2: "", artLine3: "" });
    else if (arrayPath === "modelsPage.features") list.push({ title: "New feature", description: "" });
    saveDraft();
    renderGroups();
  }

  function removeArrayItem(arrayPath, index) {
    const list = getPath(content, arrayPath);
    if (!Array.isArray(list) || index < 0 || index >= list.length) return;
    if (arrayPath === "features" && list.length <= 1) return showToast("Keep at least one capability card.");
    list.splice(index, 1);
    saveDraft();
    renderGroups();
  }

  function downloadJson() {
    if (!content) return;
    const blob = new Blob([`${JSON.stringify(content, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "site-content.json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function saveToProject() {
    if (!content) return;
    if (serverStatus.mode === "vercel") {
      downloadJson();
      showToast("Vercel files are read-only. The updated site-content.json has been downloaded.");
      return;
    }
    saveButton.disabled = true;
    saveButton.classList.add("is-busy");
    try {
      const password = passwordInput.value || sessionStorage.getItem("pixie-editor-password") || "";
      const response = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(password ? { "x-editor-password": password } : {}) },
        body: JSON.stringify({ content })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 404 || response.status === 405) {
          downloadJson();
          showToast("No local save server found, so the JSON file was downloaded.");
        } else {
          showToast(result.error || "Could not save to the project folder.", "is-error");
        }
        return;
      }
      originalContent = clone(content);
      setNotice("Saved to site-content.json in this project folder.");
      showToast("Saved to the project folder.", "is-success");
    } catch (_) {
      downloadJson();
      showToast("Could not reach the local save server; downloaded site-content.json instead.");
    } finally {
      saveButton.disabled = false;
      saveButton.classList.remove("is-busy");
    }
  }

  async function publishToGitHub() {
    if (!content) return;
    const password = passwordInput.value || sessionStorage.getItem("pixie-editor-password") || "";
    const needsPassword = serverStatus.mode === "vercel" || serverStatus.passwordConfigured;
    if (needsPassword && !password) {
      $("#publish-settings").open = true;
      passwordInput.focus();
      showToast("Enter the editor password from the Vercel environment settings.", "is-error");
      return;
    }
    publishButton.disabled = true;
    publishButton.classList.add("is-busy");
    const label = publishButton.innerHTML;
    publishButton.textContent = "Publishing…";
    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(password ? { "x-editor-password": password } : {}) },
        body: JSON.stringify({ content })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          sessionStorage.removeItem("pixie-editor-password");
          showToast("That editor password was not accepted.", "is-error");
        } else {
          showToast(result.error || "GitHub publishing is not configured yet. See README.md.", "is-error");
        }
        return;
      }
      if (password) sessionStorage.setItem("pixie-editor-password", password);
      const commitUrl = result.commit && result.commit.commitUrl;
      const branch = result.commit && result.commit.branch;
      setNotice(`Committed site-content.json${branch ? ` to ${branch}` : ""}. Vercel will deploy the commit automatically if this repository is connected.${commitUrl ? "" : ""}`, commitUrl);
      showToast("Published to GitHub. Vercel is deploying the latest commit.", "is-success");
      originalContent = clone(content);
    } catch (_) {
      showToast("Could not reach the publishing endpoint. Check the deployment setup.", "is-error");
    } finally {
      publishButton.disabled = false;
      publishButton.classList.remove("is-busy");
      publishButton.innerHTML = label;
    }
  }

  if (fieldHost) {
    fieldHost.addEventListener("input", (event) => {
      if (event.target.matches("[data-path]")) updateField(event.target);
      else if (event.target.matches("[data-color-text-for]")) {
        const path = event.target.dataset.colorTextFor;
        setPath(content, path, event.target.value);
        saveDraft();
      }
    });
    fieldHost.addEventListener("change", (event) => {
      if (event.target.matches("[data-path]")) updateField(event.target);
    });
    fieldHost.addEventListener("click", (event) => {
      const action = event.target.closest("[data-editor-action]");
      if (!action) return;
      if (action.dataset.editorAction === "add-array-item") addArrayItem(action.dataset.arrayPath);
      if (action.dataset.editorAction === "remove-array-item") removeArrayItem(action.dataset.arrayPath, Number(action.dataset.index));
    });
  }

  if (preview) preview.addEventListener("load", syncPreview);
  if (publishButton) publishButton.addEventListener("click", publishToGitHub);
  if (saveButton) saveButton.addEventListener("click", saveToProject);
  $("#export-json")?.addEventListener("click", () => { downloadJson(); showToast("Downloaded site-content.json.", "is-success"); });
  $("#reset-content")?.addEventListener("click", () => {
    if (!originalContent || !window.confirm("Reset this browser draft to the content currently saved in the project?")) return;
    content = clone(originalContent);
    localStorage.removeItem(DRAFT_KEY);
    renderGroups();
    syncPreview();
    setNotice("Draft reset to the content currently saved in the project.");
    showToast("Draft reset.", "is-success");
  });
  $("#refresh-preview")?.addEventListener("click", () => {
    if (preview) preview.src = `/?preview=1&refresh=${Date.now()}`;
  });
  $("#remember-password")?.addEventListener("click", () => {
    if (!passwordInput.value) return showToast("Enter the editor password first.", "is-error");
    sessionStorage.setItem("pixie-editor-password", passwordInput.value);
    showToast("Password remembered for this browser tab only.", "is-success");
  });

  loadServerStatus();
  loadContent();
})();
