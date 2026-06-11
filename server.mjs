import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const port = Number.parseInt(process.env.PORT || "8000", 10);
const host = "127.0.0.1";
const root = resolve(".");
const allowedProxyHosts = new Set([
  "api.reku.id",
  "www.tokocrypto.site",
  "cloudme-toko.2meta.app",
  "api.tokocrypto.com", // <-- Ditambahkan agar diizinkan oleh proxy
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
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden");
      return;
    }

    const content = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(content);
  } catch (error) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
});

async function proxyRequest(url, res) {
  const targetRaw = url.searchParams.get("url");
  if (!targetRaw) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Missing url parameter" }));
    return;
  }

  const target = new URL(targetRaw);
  if (target.protocol !== "https:" || !allowedProxyHosts.has(target.hostname)) {
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
        "Accept": "application/json,text/html,application/xhtml+xml,*/*",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const body = await response.text();
    res.writeHead(response.status, {
      "Content-Type": response.headers.get("content-type") || "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*"
    });
    res.end(body);
  } catch (error) {
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: error.name === "AbortError" ? "Proxy timeout" : "Upstream fetch failed" }));
  } finally {
    clearTimeout(timeout);
  }
}

server.listen(port, () => {
  console.log(`Server running at http://${host}:${port}/`);
});
