// Vercel Serverless Function: step 2 of the GitHub OAuth flow for Decap CMS.
// GET /api/callback?code=...&state=... -> exchanges the code for an access token
// and hands it back to the Decap CMS popup window via postMessage, following the
// message protocol Decap/Netlify CMS's "github" backend expects.

module.exports = async (req, res) => {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const origin = `${proto}://${req.headers.host}`;
  const url = new URL(req.url, origin);
  const code = url.searchParams.get("code");

  if (!code) {
    res.status(400).send("Missing code");
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

    if (!tokenJson.access_token) {
      res.status(400).send("No access_token in GitHub response: " + JSON.stringify(tokenJson));
      return;
    }

    const content = { token: tokenJson.access_token, provider: "github" };

    const script = `
      <script>
        (function() {
          function receiveMessage(e) {
            window.opener.postMessage(
              'authorization:github:success:${JSON.stringify(content)}',
              e.origin
            );
            window.removeEventListener("message", receiveMessage, false);
          }
          window.addEventListener("message", receiveMessage, false);
          window.opener.postMessage("authorizing:github", "*");
        })();
      </script>
    `;

    res.setHeader("Content-Type", "text/html");
    res.status(200).send(`<html><body>${script}</body></html>`);
  } catch (err) {
    res.status(500).send("OAuth error: " + err.message);
  }
};
