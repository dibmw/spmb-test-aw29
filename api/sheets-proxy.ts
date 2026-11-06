const ALLOWED_URL_PATTERN = /^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec(\?.*)?$/;
const DEFAULT_SECRET_KEY = "aa84e8445d76e5a72a983e78826fdb87";

export default async function sheetsProxy(req: any, res: any) {
  const { url, method, body } = req.body ?? {};

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "URL is required and must be a string." });
    return;
  }

  // 1. SSRF Guard: Validate domain and path
  const trimmedUrl = url.trim();
  if (!ALLOWED_URL_PATTERN.test(trimmedUrl)) {
    res.status(403).json({
      error: "Akses Ditolak: URL tujuan tidak diizinkan. Hanya endpoint Google Apps Script resmi yang diperbolehkan.",
    });
    return;
  }

  const secretKey = process.env.APP_SECRET_KEY || DEFAULT_SECRET_KEY;
  const httpMethod = (method || "GET").toUpperCase();

  try {
    const fetchOptions: RequestInit = {
      method: httpMethod,
      headers: {
        "Content-Type": "application/json",
      },
    };

    let targetUrl = trimmedUrl;

    if (httpMethod === "POST") {
      let parsedBody: any = body;
      if (typeof body === "string") {
        try {
          parsedBody = JSON.parse(body);
        } catch {
          parsedBody = body;
        }
      }

      if (parsedBody && typeof parsedBody === "object") {
        parsedBody.secret_key = secretKey;
      }

      fetchOptions.body = JSON.stringify(parsedBody);
    } else if (httpMethod === "GET") {
      // Inject secret_key into query params if not present
      const urlObj = new URL(targetUrl);
      if (!urlObj.searchParams.has("secret_key")) {
        urlObj.searchParams.set("secret_key", secretKey);
      }
      targetUrl = urlObj.toString();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55s timeout
    fetchOptions.signal = controller.signal;

    const response = await fetch(targetUrl, fetchOptions);
    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else {
      const text = await response.text();
      try {
        res.status(response.status).json(JSON.parse(text));
      } catch {
        res.status(response.status).send(text);
      }
    }
  } catch (error: any) {
    console.error("Error proxying to Google Sheets Web App:", error);
    res.status(500).json({
      error: "Gagal menghubungkan ke Google Sheets Web App via Proxy.",
      details: error?.message,
    });
  }
}
