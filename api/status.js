const { hasGitHubConfig } = require("../lib/github");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  return res.status(200).json({
    mode: "vercel",
    githubConfigured: hasGitHubConfig(process.env),
    passwordConfigured: Boolean(process.env.EDITOR_PASSWORD),
    branch: process.env.GITHUB_BRANCH || "main"
  });
};
