const allowedProxyHosts = new Set([
  "api.reku.id",
  "www.tokocrypto.site",
  "cloudme-toko.2meta.app",
  "api.tokocrypto.com",
  "api.allorigins.win",
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
