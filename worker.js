export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    const isSpaPath = (pathname) => {
      const last = pathname.split("/").pop() || "";
      return !last.includes(".");
    };

    if (path === "/admin" || path === "/admin/" || (path.startsWith("/admin/") && isSpaPath(path))) {
      return env.ASSETS.fetch(new Request(new URL("/admin/index.html", request.url), request));
    }

    if (path === "/pickup" || path === "/pickup/" || (path.startsWith("/pickup/") && isSpaPath(path))) {
      return env.ASSETS.fetch(new Request(new URL("/pickup/index.html", request.url), request));
    }

    if (path === "/__mockup" || path === "/__mockup/" || (path.startsWith("/__mockup/") && isSpaPath(path))) {
      return env.ASSETS.fetch(new Request(new URL("/__mockup/index.html", request.url), request));
    }

    if (isSpaPath(path)) {
      return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
    }

    return new Response("Not Found", { status: 404 });
  },
};
