module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const webhookUrl = "https://hook.eu1.make.com/98kbubs4hurutduklfgx878daa7tgcb4";

  let url;
  try {
    url = new URL(webhookUrl);
  } catch (error) {
    res.status(500).json({ error: "Invalid Make webhook URL" });
    return;
  }
  if (url.protocol !== "https:") {
    res.status(500).json({ error: "Make webhook URL must use HTTPS" });
    return;
  }

  const { name, email, message } = req.body || {};
  if (
    typeof name !== "string" || !name.trim() || name.length > 200 ||
    typeof email !== "string" || !email.trim() || email.length > 320 ||
    typeof message !== "string" || !message.trim() || message.length > 5000
  ) {
    res.status(400).json({ error: "Invalid form data" });
    return;
  }

  try {
    const webhookResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
      }),
    });

    if (!webhookResponse.ok) {
      res.status(502).json({ error: "Make webhook request failed" });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(502).json({ error: "Make webhook request failed" });
  }
};
