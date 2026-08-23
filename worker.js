export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    const path = url.pathname;

    // Admin SPA: serve the admin entry point for /admin and client-side admin routes.
    if (path === "/admin" || path === "/admin/" || (path.startsWith("/admin/") && !path.split("/").pop().includes("."))) {
      const adminIndex = new URL("/admin/index.html", request.url);
      return env.ASSETS.fetch(new Request(adminIndex, request));
    }

    // Public storefront SPA: serve the storefront entry point for client-side routes.
    if (!path.split("/").pop().includes(".")) {
      const siteIndex = new URL("/index.html", request.url);
      return env.ASSETS.fetch(new Request(siteIndex, request));
    }

    return new Response("Not Found", { status: 404 });
  },
};
