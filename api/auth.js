// Vercel Serverless Function: step 1 of the GitHub OAuth flow for Decap CMS.
// GET /api/auth -> redirects the browser to GitHub's authorize screen.
//
// Required env vars (set in Vercel project settings):
//   OAUTH_GITHUB_CLIENT_ID     - GitHub OAuth App client ID
//   OAUTH_GITHUB_CLIENT_SECRET - GitHub OAuth App client secret (used in /api/callback)

function getOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${req.headers.host}`;
}

function randomState() {
  return Array.from({ length: 20 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
}

module.exports = (req, res) => {
  const clientId = process.env.OAUTH_GITHUB_CLIENT_ID;
  if (!clientId) {
    res.status(500).send("Missing OAUTH_GITHUB_CLIENT_ID environment variable");
    return;
  }

  const state = randomState();
  const redirectUri = `${getOrigin(req)}/api/callback`;

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "repo,user");
  authorizeUrl.searchParams.set("state", state);

  // HttpOnly cookie used to validate the "state" param on /api/callback (CSRF protection).
  res.setHeader(
    "Set-Cookie",
    `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
  );
  res.writeHead(302, { Location: authorizeUrl.toString() });
  res.end();
};
