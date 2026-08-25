const BUILD_ID = "2026.08.24.01";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/debug-info") {
      return Response.json({
        build: BUILD_ID,
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

    if (path === "/admin/pos") {
      return Response.redirect(new URL("/admin/pos/", request.url), 301);
    }

    if (
      path === "/admin" ||
      path === "/admin/" ||
      path === "/admin/pos/" ||
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
