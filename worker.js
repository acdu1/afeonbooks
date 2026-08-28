export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Email click-tracking links. Accept the legacy singular and canonical
    // plural forms, plus the explicit /cloudflare/ form used by older emails.
    if (url.hostname === "click.afeonbooks.com") {
      const match =
        path.match(/^\/cloudflare\/(?:order|orders)\/([^/]+)\/?$/) ||
        path.match(/^\/(?:order|orders)\/([^/]+)\/?$/);

      if (match) {
        const destination = new URL(
          `https://afeonbooks.com/orders/${encodeURIComponent(match[1])}`,
        );
        destination.searchParams.set("utm-source", "mail.cloudflare");
        return Response.redirect(destination.toString(), 302);
      }

      return new Response("Not Found", { status: 404 });
    }

    if (path === "/api/debug-info") {
      const version = env.CF_VERSION_METADATA;
      return Response.json(
        {
          build: version?.id ?? "unknown",
          ip:
            request.headers.get("CF-Connecting-IP") ||
            request.headers.get("X-Forwarded-For") ||
            "unknown",
          host: url.host,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (path.startsWith("/api/")) {
      const apiUrl = new URL(`https://api.afeonbooks.com${path}${url.search}`);
      return fetch(new Request(apiUrl, request));
    }

    const fetchAdminIndex = () =>
      env.ASSETS.fetch(
        new Request(new URL("/admin/index.html", request.url), request),
      );

    const fetchAdminPos = () =>
      env.ASSETS.fetch(
        new Request(new URL("/admin/pos.html", request.url), request),
      );

    if (path === "/admin/admin" || path === "/admin/admin/") {
      return Response.redirect(new URL("/admin/", request.url), 301);
    }
    if (path.startsWith("/admin/admin/")) {
      return Response.redirect(
        new URL(path.replace(/^\/admin\/admin/, "/admin"), request.url),
        301,
      );
    }

    // POS has its own compiled HTML entry. Never redirect it to /admin.
    if (path === "/admin/pos" || path === "/admin/pos/") {
      return fetchAdminPos();
    }

    if (
      path === "/admin" ||
      path === "/admin/" ||
      (path.startsWith("/admin/") && !path.split("/").pop()?.includes("."))
    ) {
      return fetchAdminIndex();
    }

    const fetchPickupIndex = () =>
      env.ASSETS.fetch(
        new Request(new URL("/pickup/index.html", request.url), request),
      );

    if (
      path === "/pickup" ||
      path === "/pickup/" ||
      (path.startsWith("/pickup/") && !path.split("/").pop()?.includes("."))
    ) {
      return fetchPickupIndex();
    }

    // Customer order pages are client-side routes in the public site.
    // Both forms are served so old links remain valid; /orders/:id is canonical.
    if (/^\/(?:order|orders)\/[^/]+\/?$/.test(path)) {
      return env.ASSETS.fetch(
        new Request(new URL("/index.html", request.url), request),
      );
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    if (!path.split("/").pop()?.includes(".")) {
      return env.ASSETS.fetch(
        new Request(new URL("/index.html", request.url), request),
      );
    }

    return new Response("Not Found", { status: 404 });
  },
};
