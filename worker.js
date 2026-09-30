function pdfEscape(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

function makePdf(lines) {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 54;
  const lineHeight = 16;
  const maxLinesPerPage = 43;
  const pages = [];

  for (let i = 0; i < lines.length; i += maxLinesPerPage) pages.push(lines.slice(i, i + maxLinesPerPage));
  if (pages.length === 0) pages.push([""]);

  const objects = [];
  const pageObjectIds = [];
  const contentObjectIds = [];
  let nextId = 3;
  for (const _pageLines of pages) {
    pageObjectIds.push(nextId++);
    contentObjectIds.push(nextId++);
  }
  const fontObjectId = nextId++;
  const encoder = new TextEncoder();

  const makeContent = (pageLines) => {
    const commands = ["BT", "/F1 11 Tf", `${margin} ${pageHeight - margin} Td`];
    pageLines.forEach((line, index) => {
      if (index > 0) commands.push(`0 -${lineHeight} Td`);
      commands.push(`(${pdfEscape(line)}) Tj`);
    });
    commands.push("ET");
    return commands.join("\n");
  };

  const pageKids = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[2] = `<< /Type /Pages /Kids [${pageKids}] /Count ${pages.length} >>`;
  pages.forEach((pageLines, index) => {
    const pageId = pageObjectIds[index];
    const contentId = contentObjectIds[index];
    const content = makeContent(pageLines);
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`;
  });
  objects[fontObjectId] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

  const chunks = ["%PDF-1.4\n"];
  const offsets = new Array(objects.length).fill(0);
  let byteLength = encoder.encode(chunks[0]).length;
  for (let id = 1; id < objects.length; id++) {
    if (!objects[id]) continue;
    const objectText = `${id} 0 obj\n${objects[id]}\nendobj\n`;
    offsets[id] = byteLength;
    chunks.push(objectText);
    byteLength += encoder.encode(objectText).length;
  }
  const xrefOffset = byteLength;
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  chunks.push(xref);
  chunks.push(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return encoder.encode(chunks.join(""));
}

async function orderPdfResponse(request, orderId) {
  const apiUrl = new URL(`https://api.afeonbooks.com/api/orders/${encodeURIComponent(orderId)}`);
  const apiResponse = await fetch(new Request(apiUrl, { method: "GET", headers: { Accept: "application/json" } }));

  if (!apiResponse.ok) {
    return new Response(apiResponse.status === 404 ? "Order not found" : "Unable to load order", {
      status: apiResponse.status === 404 ? 404 : 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const order = await apiResponse.json();
  const money = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;
  const lines = [
    "AFEON BOOKS",
    "Customer Order Receipt",
    "",
    `Order #${order.id}`,
    `Status: ${order.status || "pending"}`,
    `Placed: ${order.createdAt ? new Date(order.createdAt).toLocaleString("en-US") : ""}`,
    "",
    "CUSTOMER",
    `Name: ${order.customerName || ""}`,
    `Email: ${order.customerEmail || ""}`,
    `Phone: ${order.customerPhone || ""}`,
    "",
    "DELIVERY",
    order.classroom ? `Classroom: ${order.classroom}` : null,
    `Address: ${order.shippingAddress || ""}`,
    `${order.city || ""}, ${order.postalCode || ""}`,
    `Country: ${order.country || ""}`,
    "",
    "ITEMS",
    ...(Array.isArray(order.items) && order.items.length
      ? order.items.map((item) => `${item.quantity} x ${item.productName}  ${money(Number(item.unitPriceCents || 0) * Number(item.quantity || 0))}`)
      : ["No items"]),
    "",
    `Subtotal: ${money(order.subtotalCents)}`,
    `Shipping: ${money(order.shippingCents)}`,
    `TOTAL: ${money(order.totalCents)} ${order.currency || "USD"}`,
    `Payment: ${order.paymentMethod || ""}`,
    order.notes ? `Notes: ${order.notes}` : null,
  ].filter((line) => line !== null);

  return new Response(makePdf(lines), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="afeonbooks-order-${order.id}.pdf"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

async function maintenanceResponse(request, env) {
  const assetResponse = await env.ASSETS.fetch(new Request(new URL("/totec-maintenance.svg", request.url), request));
  return new Response(assetResponse.body, {
    status: 503,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Retry-After": "3600",
      "Cache-Control": "no-store",
    },
  });
}

function directoryKeyMatches(url, env) {
  return typeof env.DIRECTORY_KEY === "string" && env.DIRECTORY_KEY.length > 0 && url.searchParams.get("key") === env.DIRECTORY_KEY;
}

function directoryResponse(status = 404, body = "Not Found") {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

function directoryHtml(files, key, selectedFile = "") {
  const folders = new Map();
  for (const file of files) {
    const parts = file.split("/");
    const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
    if (!folders.has(folder)) folders.set(folder, []);
    folders.get(folder).push(file);
  }
  const link = (file) => `/directory/file/${file.split("/").map(encodeURIComponent).join("/")}?key=${encodeURIComponent(key)}`;
  const tree = [...folders.entries()].map(([folder, folderFiles]) => `<section><h2>${folder === "." ? "Root" : folder}</h2><ul>${folderFiles.map((file) => `<li><a href="${link(file)}">${file.split("/").at(-1)}</a></li>`).join("")}</ul></section>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AFEON Books Files</title><style>body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;background:#f8f5ef;color:#171717}section{background:#fff;border:1px solid #ddd;margin:16px 0;padding:16px}h1{margin-bottom:28px}h2{font-size:16px;margin-top:0}ul{list-style:none;padding:0;margin-bottom:0}li{padding:6px 0}a{color:#17624a;text-decoration:none}a:hover{text-decoration:underline}</style></head><body><h1>AFEON Books deployed files</h1>${selectedFile ? `<p>Viewing <strong>${selectedFile}</strong></p>` : ""}${tree}</body></html>`;
}

async function directoryResponseFor(request, env) {
  const url = new URL(request.url);
  if (!directoryKeyMatches(url, env)) return directoryResponse(404);
  const manifestResponse = await env.ASSETS.fetch(new Request(new URL("/directory-manifest.json", request.url), request));
  if (!manifestResponse.ok) return directoryResponse(503, "Directory manifest is not available. Rebuild the site first.");
  const files = await manifestResponse.json();
  if (!Array.isArray(files) || files.some((file) => typeof file !== "string")) return directoryResponse(503, "Invalid directory manifest");
  const fileMatch = url.pathname.match(/^\/directory\/file\/(.+)$/);
  if (fileMatch) {
    let file;
    try {
      file = decodeURIComponent(fileMatch[1]).replace(/^\/+/, "");
    } catch {
      return directoryResponse(404);
    }
    if (!files.includes(file) || file.includes("..")) return directoryResponse(404);
    const assetResponse = await env.ASSETS.fetch(new Request(new URL(`/${file}`, request.url), request));
    if (!assetResponse.ok) return directoryResponse(404);
    return new Response(assetResponse.body, { status: 200, headers: { ...Object.fromEntries(assetResponse.headers), "Cache-Control": "no-store" } });
  }
  if (url.pathname === "/directory" || url.pathname === "/directory/") return new Response(directoryHtml(files, url.searchParams.get("key")), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  return directoryResponse(404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/directory" || path === "/directory/" || path.startsWith("/directory/file/") || path === "/directory-manifest.json") return directoryResponseFor(request, env);

    if (url.hostname === "authn.afeonbooks.com") {
      if (path.startsWith("/api/")) {
        const apiUrl = new URL(`https://api.afeonbooks.com${path}${url.search}`);
        return fetch(new Request(apiUrl, request));
      }

      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) return assetResponse;

      return env.ASSETS.fetch(new Request(new URL("/authn.html", request.url), request));
    }

    if (url.hostname === "click.afeonbooks.com") {
      const match =
        path.match(/^\/cloudflare\/(?:order|orders)\/([^/]+)\/?$/) ||
        path.match(/^\/(?:order|orders)\/([^/]+)\/?$/);
      if (match) {
        const destination = new URL(`https://afeonbooks.com/order/${encodeURIComponent(match[1])}`);
        destination.searchParams.set("utm-source", "mail.cloudflare");
        return Response.redirect(destination.toString(), 302);
      }
      return new Response("Not Found", { status: 404 });
    }

    const isAdminPath = path === "/admin" || path.startsWith("/admin/");
    const isApiPath = path.startsWith("/api/");
    if (!isAdminPath && !isApiPath && path !== "/totec-maintenance.svg") {
      const maintenanceStatus = await fetch("https://api.afeonbooks.com/api/maintenance/status", { headers: { Accept: "application/json" } });
      if (maintenanceStatus.ok) {
        const status = await maintenanceStatus.json();
        if (status.enabled === true) return maintenanceResponse(request, env);
      }
    }

    if (path.startsWith("/api/")) {
      const apiUrl = new URL(`https://api.afeonbooks.com${path}${url.search}`);
      return fetch(new Request(apiUrl, request));
    }

    if (path === "/api/debug-info") {
      const version = env.CF_VERSION_METADATA;
      return Response.json(
        { build: version?.id ?? "unknown", ip: request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown", host: url.host },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const orderPdfMatch = path.match(/^\/order\/([^/]+)\/pdf\/?$/);
    if (orderPdfMatch) return orderPdfResponse(request, orderPdfMatch[1]);

    const fetchAdminIndex = () => env.ASSETS.fetch(new Request(new URL("/admin/index.html", request.url), request));
    const fetchAdminPos = () => env.ASSETS.fetch(new Request(new URL("/admin/pos.html", request.url), request));

    if (path === "/admin/admin" || path === "/admin/admin/") return Response.redirect(new URL("/admin/", request.url), 301);
    if (path.startsWith("/admin/admin/")) return Response.redirect(new URL(path.replace(/^\/admin\/admin/, "/admin"), request.url), 301);
    if (path === "/admin/pos" || path === "/admin/pos/") return fetchAdminPos();
    if (path === "/admin/zoho-mail" || path === "/admin/zoho-mail/") return fetchAdminIndex();
    if (path === "/admin" || path === "/admin/" || (path.startsWith("/admin/") && !path.split("/").pop()?.includes("."))) return fetchAdminIndex();

    const fetchPickupIndex = () => env.ASSETS.fetch(new Request(new URL("/pickup/index.html", request.url), request));
    if (path === "/pickup" || path === "/pickup/" || (path.startsWith("/pickup/") && !path.split("/").pop()?.includes("."))) return fetchPickupIndex();

    if (/^\/order\/[^/]+\/?$/.test(path)) {
      return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) return assetResponse;
    if (!path.split("/").pop()?.includes(".")) {
      const notFoundPage = await env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
      return new Response(notFoundPage.body, {
        status: 404,
        headers: notFoundPage.headers,
      });
    }
    return new Response("Not Found", { status: 404 });
  },
};