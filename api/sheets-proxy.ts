const ALLOWED_URL_PATTERN = /^https:\/\/script\.google\.com\/macros\/s\/AKfy[a-zA-Z0-9_-]+\/exec(\?.*)?$/;

export default async function sheetsProxy(req: any, res: any) {
  // Hanya izinkan HTTP POST ke proxy endpoint
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method Not Allowed. Gunakan POST." });
    return;
  }

  const { url, method, body } = req.body ?? {};

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "URL is required and must be a string." });
    return;
  }

  // 1. SSRF Guard: Validasi protokol, domain, dan path Google Apps Script
  const trimmedUrl = url.trim();
  if (!ALLOWED_URL_PATTERN.test(trimmedUrl)) {
    res.status(403).json({
      error: "Akses Ditolak: URL tujuan tidak diizinkan. Hanya endpoint Google Apps Script resmi yang diperbolehkan.",
    });
    return;
  }

  // Ambil secret key dari Vercel Environment Variable (bukan hardcoded)
  const secretKey = (process.env.APP_SECRET_KEY || "").trim();
  const httpMethod = (method || "GET").toUpperCase();

  if (httpMethod !== "GET" && httpMethod !== "POST") {
    res.status(400).json({ error: "Target HTTP method harus GET atau POST." });
    return;
  }

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
        if (secretKey) {
          parsedBody.secret_key = secretKey;
        }
      }

      fetchOptions.body = JSON.stringify(parsedBody);
    } else if (httpMethod === "GET") {
      // Inject secret_key ke query params jika ada
      const urlObj = new URL(targetUrl);
      if (secretKey && !urlObj.searchParams.has("secret_key")) {
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
