import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import crypto from "node:crypto"; // Modul bawaan Node.js untuk membuat signature pasar

const port = Number.parseInt(process.env.PORT || "8000", 10);
const host = "127.0.0.1";
const root = resolve(".");

const TOKO_API_KEY = "5a1030FC2b1E4F8ae184BAeBa447ccf9ffK6YOXNtYOeJuAhDuPqDSCx8t3V7Fth";
const TOKO_SECRET_KEY = "499c73CA81D8AFA886f4D6Dbeb7971C7fFdO8tKI55i6bIMXwfimeSxLwzFIlSKl";

const allowedProxyHosts = new Set([
  "api.reku.id",
  "www.tokocrypto.site",
  "cloudme-toko.2meta.app",
  "api.tokocrypto.com", 
  "indodax.com",
  "api.pintu.pro",
  "api.pintupro.com",
  "api.uat.pintupro.com",
  "www.bca.co.id"
]);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${host}:${port}`);

    if (url.pathname === "/proxy") {
      await proxyRequest(url, res);
      return;
    }

    const relativePath = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
    const filePath = resolve(join(root, relativePath));

    if (!filePath.startsWith(root)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    const ext = extname(filePath).toLowerCase();
    const contentType = types[ext] || "application/octet-stream";

    const content = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  }
});

server.listen(port, () => {
  console.log(`Server berjalan di http://${host}:${port}/`);
});

async function proxyRequest(url, res) {
  const targetRaw = url.searchParams.get("url");
  if (!targetRaw) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Missing url parameter" }));
    return;
  }

  let target = new URL(targetRaw);

  // LOGIKA UTAMA: Autentikasi Khusus untuk Request Tokocrypto resmi
  if (target.hostname === "api.tokocrypto.com") {
    const timestamp = Date.now();
    
    // API Resmi Tokocrypto mewajibkan pengiriman tanda tangan (signature) & timestamp data
    let queryParams = `symbol=USDTIDR&limit=100&timestamp=${timestamp}`;
    
    // Enkripsi tanda tangan menggunakan HMAC SHA256 berbasis Secret Key Anda
    const signature = crypto
      .createHmac("sha256", TOKO_SECRET_KEY)
      .update(queryParams)
      .digest("hex");
      
    // Pasang kembali parameter yang sudah valid secara sistem
    target = new URL(`https://api.tokocrypto.com/api/v3/depth?${queryParams}&signature=${signature}`);
  } else if (!allowedProxyHosts.has(target.hostname)) {
    // Validasi exchange lainnya tetap dibiarkan berjalan normal
    res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Proxy host is not allowed" }));
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);

  try {
    const response = await fetch(target, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        // Menyisipkan Kunci API ke dalam Header Request sesuai aturan Tokocrypto
        "X-MBX-APIKEY": TOKO_API_KEY
      }
    });
    
    const body = await response.text();
    res.writeHead(response.status, {
      "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*"
    });
    res.end(body);
  } catch (error) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.name === "AbortError" ? "Proxy timeout" : "Upstream fetch failed" }));
  } finally {
    clearTimeout(
