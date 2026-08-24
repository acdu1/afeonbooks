export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Proxy all application API requests to the Render backend.
    if (path.startsWith("/api/")) {
      const apiUrl = new URL(`https://afeonbooks-api.onrender.com${path}${url.search}`);
      return fetch(new Request(apiUrl, request));
    }

    const fetchAdminIndex = () =>
      env.ASSETS.fetch(new Request(new URL("/admin/index.html", request.url), request));

    // Admin SPA routes must always resolve to the admin entry point.
    // Normalize /admin/pos to /admin/pos/ so the browser and Wouter use the
    // same base URL and client-side routing does not fall back to /admin.
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

    // Let actual static files through normally.
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    // Public storefront SPA fallback.
    if (!path.split("/").pop()?.includes(".")) {
      return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
    }

    return new Response("Not Found", { status: 404 });
  },
};
