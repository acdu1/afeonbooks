export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/debug-info") {
      const version = env.CF_VERSION_METADATA;
      return Response.json({
        build: version?.id ?? "unknown",
        ip: request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown",
        host: url.host,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    if (path.startsWith("/api/")) {
      const apiUrl = new URL(`https://afeonbooks-api.onrender.com${path}${url.search}`);
      return fetch(new Request(apiUrl, request));
    }

    const fetchAdminIndex = () =>
      env.ASSETS.fetch(new Request(new URL("/admin/index.html", request.url), request));

    if (path === "/admin/admin" || path === "/admin/admin/") {
      return Response.redirect(new URL("/admin/", request.url), 301);
    }
    if (path.startsWith("/admin/admin/")) {
      return Response.redirect(new URL(path.replace(/^\/admin\/admin/, "/admin"), request.url), 301);
    }

    // Serve the admin SPA directly at both POS URLs. Do not redirect /admin/pos
    // to /admin/pos/ because the client router handles both forms.
    if (path === "/admin/pos" || path === "/admin/pos/") {
      return fetchAdminIndex();
    }

    if (
      path === "/admin" ||
      path === "/admin/" ||
      (path.startsWith("/admin/") && !path.split("/").pop()?.includes("."))
    ) {
      return fetchAdminIndex();
    }

    const fetchPickupIndex = () =>
      env.ASSETS.fetch(new Request(new URL("/pickup/index.html", request.url), request));

    if (
      path === "/pickup" ||
      path === "/pickup/" ||
      (path.startsWith("/pickup/") && !path.split("/").pop()?.includes("."))
    ) {
      return fetchPickupIndex();
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    if (!path.split("/").pop()?.includes(".")) {
      return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
    }

    return new Response("Not Found", { status: 404 });
  },
};
