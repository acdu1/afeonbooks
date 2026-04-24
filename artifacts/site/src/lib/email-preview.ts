function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmt(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export interface EmailTemplateValues {
  brandName: string;
  emailFromName: string;
  emailSubject: string;
  emailHeading: string;
  emailIntro: string;
  emailButtonLabel: string;
  emailFooter: string;
  emailAccentColor: string;
  defaultShippingLabel: string;
  defaultShippingAddress: string;
  defaultShippingCity: string;
  defaultShippingPostalCode: string;
  defaultShippingCountry: string;
  footerNote: string;
}

const SAMPLE = {
  customerName: "Riley Anderson",
  orderId: "1042",
  total: fmt(1499),
  paymentMethod: "Cash on Delivery",
  classroom: "Room 204",
};

function applyVars(template: string): string {
  const map: Record<string, string> = SAMPLE;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const v = map[key];
    return v === undefined ? `{{${key}}}` : v;
  });
}

export function renderEmailPreview(v: EmailTemplateValues): string {
  const accent = v.emailAccentColor || "#E2553B";
  const heading = applyVars(v.emailHeading);
  const intro = applyVars(v.emailIntro);
  const footer = applyVars(v.emailFooter);
  const buttonLabel = applyVars(v.emailButtonLabel);
  const introHtml = escapeHtml(intro).replace(/\n/g, "<br>");
  const footerHtml = escapeHtml(footer).replace(/\n/g, "<br>");
  const useDefault = !!v.defaultShippingAddress;
  const shippingHtml = [
    useDefault ? `<strong>Classroom ${SAMPLE.classroom}</strong>` : "",
    useDefault ? escapeHtml(v.defaultShippingAddress) : "123 Sample St",
    useDefault
      ? `${escapeHtml(v.defaultShippingCity)}, ${escapeHtml(v.defaultShippingPostalCode)}`
      : "Sampletown, 00000",
    useDefault ? escapeHtml(v.defaultShippingCountry) : "USA",
  ]
    .filter(Boolean)
    .join("<br>");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Preview</title></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #eee;">
<tr><td style="padding:32px 32px 8px 32px;"><div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#888;font-weight:bold;">${escapeHtml(v.brandName)}</div></td></tr>
<tr><td style="padding:8px 32px 0 32px;"><h1 style="margin:0;font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-0.5px;">${escapeHtml(heading)}</h1></td></tr>
<tr><td style="padding:16px 32px 0 32px;font-size:15px;line-height:1.6;color:#333;">${introHtml}</td></tr>
<tr><td style="padding:24px 32px 0 32px;"><a href="#" style="display:inline-block;background:${escapeHtml(accent)};color:#fff;text-decoration:none;padding:14px 28px;font-weight:bold;font-size:13px;letter-spacing:2px;text-transform:uppercase;">${escapeHtml(buttonLabel)}</a></td></tr>
<tr><td style="padding:32px 32px 0 32px;">
<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#888;font-weight:bold;margin-bottom:12px;">Order Summary</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
<tr><td style="padding:12px 0;border-bottom:1px solid #eee;font-size:14px;"><strong>The Terror Of The Evil Capybara</strong><br><span style="color:#666;font-size:12px;">Qty 1 × ${fmt(1499)}</span></td><td style="padding:12px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right;font-weight:bold;">${fmt(1499)}</td></tr>
<tr><td style="padding:16px 0 0 0;font-size:14px;color:#666;">Subtotal</td><td style="padding:16px 0 0 0;font-size:14px;text-align:right;">${fmt(1499)}</td></tr>
<tr><td style="padding:6px 0;font-size:14px;color:#666;">Shipping</td><td style="padding:6px 0;font-size:14px;text-align:right;">Free</td></tr>
<tr><td style="padding:12px 0 0 0;font-size:16px;font-weight:bold;border-top:1px solid #eee;">Total</td><td style="padding:12px 0 0 0;font-size:16px;text-align:right;font-weight:bold;border-top:1px solid #eee;">${fmt(1499)}</td></tr>
</table>
</td></tr>
<tr><td style="padding:24px 32px 0 32px;"><div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#888;font-weight:bold;margin-bottom:12px;">Shipping To</div><div style="font-size:14px;line-height:1.6;color:#333;">${shippingHtml}</div></td></tr>
<tr><td style="padding:24px 32px 0 32px;"><div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#888;font-weight:bold;margin-bottom:12px;">Payment</div><div style="font-size:14px;color:#333;">${SAMPLE.paymentMethod}</div></td></tr>
<tr><td style="padding:32px;font-size:13px;line-height:1.6;color:#666;border-top:1px solid #eee;">${footerHtml}</td></tr>
</table>
<div style="max-width:600px;margin-top:16px;font-size:11px;color:#999;text-align:center;">${escapeHtml(v.footerNote)}</div>
</td></tr></table>
</body></html>`;
}
