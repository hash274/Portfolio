// Vercel Serverless Function: step 1 of the GitHub OAuth flow for Decap CMS.
// GET /api/auth -> redirects the browser to GitHub's authorize screen.
//
// Required env vars (set in Vercel project settings):
//   OAUTH_GITHUB_CLIENT_ID     - GitHub OAuth App client ID
//   OAUTH_GITHUB_CLIENT_SECRET - GitHub OAuth App client secret (used in /api/callback)

module.exports = (req, res) => {
  const clientId = process.env.OAUTH_GITHUB_CLIENT_ID;
  if (!clientId) {
    res.status(500).send("Missing OAUTH_GITHUB_CLIENT_ID environment variable");
    return;
  }

  const proto = req.headers["x-forwarded-proto"] || "https";
  const origin = `${proto}://${req.headers.host}`;
  const redirectUri = `${origin}/api/callback`;

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "repo,user");

  res.writeHead(302, { Location: authorizeUrl.toString() });
  res.end();
};
