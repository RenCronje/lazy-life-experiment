const MAX_CONTENT_BYTES = 700 * 1024;

function serializeContent(content) {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    const error = new Error("The site content must be a JSON object.");
    error.statusCode = 400;
    throw error;
  }
  const serialized = `${JSON.stringify(content, null, 2)}\n`;
  if (Buffer.byteLength(serialized, "utf8") > MAX_CONTENT_BYTES) {
    const error = new Error("The content file is too large (maximum 700 KB).");
    error.statusCode = 413;
    throw error;
  }
  return serialized;
}

function hasGitHubConfig(env = process.env) {
  return Boolean(env.GITHUB_TOKEN && env.GITHUB_OWNER && env.GITHUB_REPO);
}

function safeIdentifier(value) {
  return /^[A-Za-z0-9_.-]+$/.test(String(value || ""));
}

async function githubJson(url, options) {
  const response = await fetch(url, options);
  let payload = {};
  try {
    payload = await response.json();
  } catch (_) {
    payload = {};
  }
  return { response, payload };
}

async function publishContent(content, env = process.env) {
  const fileContent = serializeContent(content);
  const token = env.GITHUB_TOKEN;
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || "main";
  const filePath = env.GITHUB_CONTENT_PATH || "site-content.json";

  if (!hasGitHubConfig(env)) {
    const error = new Error("GitHub publishing is not configured. Add GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO to the server environment variables (Vercel settings or local .env.local).");
    error.statusCode = 503;
    throw error;
  }
  if (!safeIdentifier(owner) || !safeIdentifier(repo) || !/^[A-Za-z0-9_./-]+$/.test(branch) || filePath.startsWith("/") || filePath.split("/").some((part) => part === ".." || part === "")) {
    const error = new Error("The GitHub owner, repository, branch or content path contains an invalid value.");
    error.statusCode = 400;
    throw error;
  }

  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Lazy-Life-Experiment-Site-Editor",
    "Content-Type": "application/json"
  };

  const current = await githubJson(`${endpoint}?ref=${encodeURIComponent(branch)}`, { method: "GET", headers });
  let sha;
  if (current.response.ok) {
    sha = current.payload.sha;
  } else if (current.response.status !== 404) {
    const error = new Error(current.payload.message || `Could not read the GitHub content file (HTTP ${current.response.status}).`);
    error.statusCode = current.response.status === 401 || current.response.status === 403 ? 502 : 502;
    throw error;
  }

  const update = {
    message: "Update Lazy Life Experiment site content from the editor",
    content: Buffer.from(fileContent, "utf8").toString("base64"),
    branch
  };
  if (sha) update.sha = sha;

  const result = await githubJson(endpoint, { method: "PUT", headers, body: JSON.stringify(update) });
  if (!result.response.ok) {
    const detail = result.payload.message || `GitHub rejected the commit (HTTP ${result.response.status}).`;
    const error = new Error(detail);
    error.statusCode = result.response.status === 409 ? 409 : 502;
    throw error;
  }

  return {
    branch,
    path: filePath,
    commitSha: result.payload.commit && result.payload.commit.sha,
    commitUrl: result.payload.commit && result.payload.commit.html_url,
    contentUrl: result.payload.content && result.payload.content.html_url
  };
}

module.exports = { serializeContent, hasGitHubConfig, publishContent };
