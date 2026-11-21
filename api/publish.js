const crypto = require("node:crypto");
const { publishContent, serializeContent } = require("../lib/github");

function secretMatches(expected, supplied) {
  if (!expected || !supplied) return false;
  const left = crypto.createHash("sha256").update(String(expected)).digest();
  const right = crypto.createHash("sha256").update(String(supplied)).digest();
  return crypto.timingSafeEqual(left, right);
}

function parseBody(body) {
  if (typeof body === "string") return JSON.parse(body);
  if (Buffer.isBuffer(body)) return JSON.parse(body.toString("utf8"));
  return body || {};
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const origin = req.headers.origin;
  const requestHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().toLowerCase();
  if (origin && requestHost) {
    try {
      if (new URL(origin).host.toLowerCase() !== requestHost) {
        return res.status(403).json({ error: "Cross-origin publishing requests are not allowed." });
      }
    } catch (_) {
      return res.status(403).json({ error: "Invalid request origin." });
    }
  }

  const expected = process.env.EDITOR_PASSWORD;
  if (!expected) {
    return res.status(503).json({ error: "Publishing is locked. Set EDITOR_PASSWORD in the Vercel project environment variables, then redeploy." });
  }
  if (!secretMatches(expected, req.headers["x-editor-password"])) {
    return res.status(401).json({ error: "Incorrect editor password." });
  }

  try {
    const body = parseBody(req.body);
    const content = body && body.content;
    serializeContent(content);
    const commit = await publishContent(content, process.env);
    return res.status(200).json({ ok: true, commit });
  } catch (error) {
    const status = Number.isInteger(error.statusCode) ? error.statusCode : 400;
    return res.status(status).json({ error: error.message || "Could not publish the content." });
  }
};
