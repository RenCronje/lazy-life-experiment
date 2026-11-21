const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { serializeContent, hasGitHubConfig, publishContent } = require("./lib/github");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 4173);

function loadEnvFile() {
  for (const filename of [".env.local", ".env"]) {
    const fullPath = path.join(ROOT, filename);
    if (!fs.existsSync(fullPath)) continue;
    const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || match[1].startsWith("#") || process.env[match[1]] !== undefined) continue;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  }
}
loadEnvFile();

// The sandbox preview renders the site inside an iframe on a different origin,
// so frame-ancestors must allow embedding. Everything else stays locked to
// 'self'. Override with CSP_FRAME_ANCESTORS to lock it down in production.
const CSP_FRAME_ANCESTORS = process.env.CSP_FRAME_ANCESTORS || "*";
const CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "font-src 'self' data:",
  "connect-src 'self'",
  `frame-ancestors ${CSP_FRAME_ANCESTORS}`,
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (_) {
    const error = new Error("Send a valid JSON request body.");
    error.statusCode = 400;
    throw error;
  }
}

function secretMatches(expected, supplied) {
  if (!expected) return true;
  if (!supplied) return false;
  const left = crypto.createHash("sha256").update(String(expected)).digest();
  const right = crypto.createHash("sha256").update(String(supplied)).digest();
  return crypto.timingSafeEqual(left, right);
}

function authorized(req, res) {
  const expected = process.env.EDITOR_PASSWORD;
  if (!secretMatches(expected, req.headers["x-editor-password"])) {
    sendJson(res, 401, { error: "Incorrect editor password." });
    return false;
  }
  return true;
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/status" && req.method === "GET") {
    return sendJson(res, 200, {
      mode: "local",
      githubConfigured: hasGitHubConfig(process.env),
      passwordConfigured: Boolean(process.env.EDITOR_PASSWORD),
      branch: process.env.GITHUB_BRANCH || "main"
    });
  }

  if (pathname === "/api/save" && req.method === "POST") {
    if (!authorized(req, res)) return;
    try {
      const body = await readJson(req);
      const serialized = serializeContent(body.content);
      const target = path.join(ROOT, "site-content.json");
      const temporary = `${target}.tmp`;
      await fsp.writeFile(temporary, serialized, "utf8");
      await fsp.rename(temporary, target);
      return sendJson(res, 200, { ok: true, saved: "site-content.json" });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message || "Could not save the content file." });
    }
  }

  if (pathname === "/api/publish" && req.method === "POST") {
    if (!authorized(req, res)) return;
    try {
      const body = await readJson(req);
      serializeContent(body.content);
      const commit = await publishContent(body.content, process.env);
      return sendJson(res, 200, { ok: true, commit });
    } catch (error) {
      return sendJson(res, error.statusCode || 400, { error: error.message || "Could not publish the content." });
    }
  }

  if (pathname.startsWith("/api/")) {
    return sendJson(res, 404, { error: "API route not found." });
  }
  return false;
}

async function serveFile(req, res, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (_) {
    res.writeHead(400);
    return res.end("Bad request");
  }
  if (decoded.split("/").some((part) => part.startsWith("."))) {
    res.writeHead(404);
    return res.end("Not found");
  }

  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  let fullPath = path.resolve(ROOT, relative);
  if (fullPath !== ROOT && !fullPath.startsWith(`${ROOT}${path.sep}`)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    const stat = await fsp.stat(fullPath);
    if (stat.isDirectory()) fullPath = path.join(fullPath, "index.html");
    const contents = await fsp.readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const noCache = [".html", ".json", ".js", ".css"].includes(ext);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Content-Length": contents.length,
      "Cache-Control": noCache ? "no-store, max-age=0" : "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy": CSP
    });
    if (req.method === "HEAD") return res.end();
    return res.end(contents);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Internal server error");
  }
}

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  } catch (_) {
    res.writeHead(400);
    return res.end("Bad request");
  }

  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST") {
    res.writeHead(405, { Allow: "GET, HEAD, POST" });
    return res.end("Method not allowed");
  }
  if (url.pathname.startsWith("/api/")) {
    if (req.method !== "GET" && req.method !== "POST") {
      res.writeHead(405, { Allow: "GET, POST" });
      return res.end("Method not allowed");
    }
    const handled = await handleApi(req, res, url.pathname);
    if (handled === false) return serveFile(req, res, url.pathname);
    return;
  }
  if (req.method === "POST") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end("Method not allowed");
  }
  return serveFile(req, res, url.pathname);
});

// Bind to all interfaces by default so the sandbox preview proxy can reach the
// server. Set HOST=127.0.0.1 to keep it loopback-only.
server.listen(PORT, process.env.HOST || "0.0.0.0", () => {
  const address = server.address();
  console.log(`Lazy Life Experiment site running at http://${address.address.includes(":") ? `[${address.address}]` : address.address}:${address.port}`);
  console.log(`Editor: http://${address.address.includes(":") ? `[${address.address}]` : address.address}:${address.port}/admin.html`);
});
