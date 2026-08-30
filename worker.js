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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

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

    if (path === "/api/debug-info") {
      const version = env.CF_VERSION_METADATA;
      return Response.json(
        { build: version?.id ?? "unknown", ip: request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown", host: url.host },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (path.startsWith("/api/")) {
      const apiUrl = new URL(`https://api.afeonbooks.com${path}${url.search}`);
      return fetch(new Request(apiUrl, request));
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
    if (!path.split("/").pop()?.includes(".")) return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
    return new Response("Not Found", { status: 404 });
  },
};