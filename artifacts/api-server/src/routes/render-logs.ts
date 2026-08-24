import { Router, type IRouter } from "express";

const router: IRouter = Router();
const DEFAULT_SERVICE_ID = "srv-da57c6jbc2fs738388lg";

router.get("/render-logs", async (req, res): Promise<void> => {
  const apiKey = process.env.RENDER_API_KEY?.trim();
  const serviceId = process.env.RENDER_SERVICE_ID?.trim() || DEFAULT_SERVICE_ID;

  if (!apiKey) {
    res.status(503).json({
      configured: false,
      error: "RENDER_API_KEY is not configured on the API server.",
      logs: [],
    });
    return;
  }

  try {
    const serviceResponse = await fetch(`https://api.render.com/v1/services/${encodeURIComponent(serviceId)}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const servicePayload = await serviceResponse.json().catch(() => null) as { ownerId?: string; region?: string; name?: string } | null;
    if (!serviceResponse.ok || !servicePayload?.ownerId) {
      res.status(serviceResponse.status || 502).json({
        configured: true,
        error: (servicePayload as { message?: string } | null)?.message || "Unable to read Render service information.",
        logs: [],
      });
      return;
    }

    const limitRaw = Number(req.query.limit ?? 100);
    const limit = Number.isInteger(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 100;
    const params = new URLSearchParams();
    params.set("ownerId", servicePayload.ownerId);
    params.append("resource", serviceId);
    params.set("direction", "backward");
    params.set("limit", String(limit));

    const type = typeof req.query.type === "string" ? req.query.type : "";
    if (type === "app" || type === "request" || type === "build") params.set("type", type);

    const logsResponse = await fetch(`https://api.render.com/v1/logs?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const payload = await logsResponse.json().catch(() => null) as {
      logs?: Array<Record<string, unknown>>;
      hasMore?: boolean;
      nextStartTime?: string;
      nextEndTime?: string;
      message?: string;
    } | null;

    if (!logsResponse.ok) {
      res.status(logsResponse.status || 502).json({
        configured: true,
        error: payload?.message || "Render logs request failed.",
        logs: [],
      });
      return;
    }

    res.json({
      configured: true,
      serviceId,
      serviceName: servicePayload.name ?? null,
      region: servicePayload.region ?? null,
      logs: payload?.logs ?? [],
      hasMore: payload?.hasMore ?? false,
      nextStartTime: payload?.nextStartTime ?? null,
      nextEndTime: payload?.nextEndTime ?? null,
    });
  } catch (error) {
    res.status(502).json({
      configured: true,
      error: error instanceof Error ? error.message : "Unable to contact Render API.",
      logs: [],
    });
  }
});

export default router;
