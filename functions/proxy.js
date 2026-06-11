import puppeteer from "puppeteer-core";

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

export async function onRequestOptions() {
  return new Response(null, {
    headers: corsHeaders()
  });
}

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const targetRaw = requestUrl.searchParams.get("url");

  if (!targetRaw) {
    return jsonResponse({ error: "Missing url parameter" }, 400);
  }

  let target;
  try {
    target = new URL(targetRaw);
  } catch {
    return jsonResponse({ error: "Invalid url parameter" }, 400);
  }

  if (target.protocol !== "https:" || !allowedProxyHosts.has(target.hostname)) {
    return jsonResponse({ error: "Proxy host is not allowed" }, 403);
  }

  if (target.hostname === "api.tokocrypto.com" || target.hostname === "www.tokocrypto.site") {
    const BROWSERLESS_TOKEN = "2UgSAmpChJzCm9Sfbc672c6f839acf97057ba6a4d1c104f62";
    
    let browser = null;
    try {
      // Menyambungkan Cloudflare Pages ke browser eksternal Browserless
      browser = await puppeteer.connect({
        browserWSEndpoint: `wss://chrome.browserless.io?token=${BROWSERLESS_TOKEN}`
      });

      const page = await browser.newPage();
      
      // Menyamarkan diri agar terdeteksi sebagai browser Chrome manusia asli
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

      // Buka API Tokocrypto asli dan tunggu response jaringannya stabil
      await page.goto(target.toString(), { waitUntil: "networkidle0", timeout: 15000 });
      
      // Mengambil text JSON murni yang dirender di layar Chrome gaib
      const plainText = await page.evaluate(() => document.body.innerText);
      
      let parsedData;
      try {
        parsedData = JSON.parse(plainText);
      } catch {
        parsedData = { error: "Gagal memparsing JSON dari layar browser simulasi", raw: plainText };
      }

      return jsonResponse(parsedData, 200);

    } catch (scrapeError) {
      return jsonResponse({ error: "Scraping gagal lewat browser simulasi: " + scrapeError.message }, 502);
    } finally {
      // Wajib selalu menutup browser agar batas menit gratisan Anda tidak hang/habis
      if (browser) await browser.close();
    }
  }

  // ========================================================
  // JALUR ORIGINAL: Bursa/Bank lainnya tetap menggunakan fetch bawaan Anda yang super cepat
  // ========================================================
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);

  try {
    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      headers: {
        "Accept": "application/json,text/html,application/xhtml+xml,*/*",
        "User-Agent": "TreasuryDashboard/1.0"
      }
    });
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...corsHeaders(),
        "Cache-Control": "no-store",
        "Content-Type": upstream.headers.get("content-type") || "text/plain; charset=utf-8"
      }
    });
  } catch (error) {
    return jsonResponse(
      { error: error.name === "AbortError" ? "Proxy timeout" : "Upstream fetch failed" },
      502
    );
  } finally {
    clearTimeout(timeout);
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept"
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
