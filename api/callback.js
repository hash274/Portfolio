// Vercel Serverless Function: step 2 of the GitHub OAuth flow for Decap CMS.
// GET /api/callback?code=...&state=... -> exchanges the code for an access token
// and hands it back to the Decap CMS popup window via postMessage, following the
// message protocol Decap/Netlify CMS's "github" backend expects.

function getOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${req.headers.host}`;
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const idx = pair.indexOf("=");
        return [decodeURIComponent(pair.slice(0, idx)), decodeURIComponent(pair.slice(idx + 1))];
      })
  );
}

function renderPopup(status, payload, allowedOrigin) {
  // Escaping via JSON.stringify twice keeps the payload safe to embed as a JS string literal.
  const safePayload = JSON.stringify(JSON.stringify(payload));
  const safeOrigin = JSON.stringify(allowedOrigin);
  return `<!DOCTYPE html>
<html><body>
<script>
(function () {
  var allowedOrigin = ${safeOrigin};
  function receiveMessage(e) {
    if (e.origin !== allowedOrigin) return;
    window.opener.postMessage("authorization:github:${status}:" + ${safePayload}, e.origin);
    window.removeEventListener("message", receiveMessage, false);
  }
  window.addEventListener("message", receiveMessage, false);
  window.opener.postMessage("authorizing:github", allowedOrigin);
})();
</script>
</body></html>`;
}

module.exports = async (req, res) => {
  const url = new URL(req.url, getOrigin(req));
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookies = parseCookies(req.headers.cookie);
  const origin = getOrigin(req);

  if (!code || !state || state !== cookies.oauth_state) {
    res.status(400).send("Invalid or missing OAuth state/code.");
    return;
  }

  const clientId = process.env.OAUTH_GITHUB_CLIENT_ID;
  const clientSecret = process.env.OAUTH_GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.status(500).send("Missing OAUTH_GITHUB_CLIENT_ID / OAUTH_GITHUB_CLIENT_SECRET");
    return;
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${origin}/api/callback`,
      }),
    });
    const tokenJson = await tokenRes.json();

    res.setHeader("Set-Cookie", "oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
    res.setHeader("Content-Type", "text/html");

    if (tokenJson.error || !tokenJson.access_token) {
      res
        .status(400)
        .send(renderPopup("error", { message: tokenJson.error_description || "OAuth error" }, origin));
      return;
    }

    res.status(200).send(renderPopup("success", { token: tokenJson.access_token, provider: "github" }, origin));
  } catch (err) {
    res.status(500).send(renderPopup("error", { message: "OAuth token exchange failed" }, origin));
  }
};
