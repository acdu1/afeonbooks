import { Router, type IRouter, type Request } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function clientIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  return typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() || "unknown" : req.socket.remoteAddress || "unknown";
}

router.post("/dev-events", (req: Request, res): void => {
  if (process.env.DEV_AUDIT_LOGS !== "true") {
    res.status(404).json({ error: "Dev audit logging is disabled" });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const event = typeof body.event === "string" ? body.event.slice(0, 40) : "unknown";
  const visitorId = typeof body.visitorId === "string" ? body.visitorId.slice(0, 80) : "unknown";
  const path = typeof body.path === "string" ? body.path.slice(0, 200) : "/";
  const target = typeof body.target === "string" ? body.target.slice(0, 100) : undefined;
  const field = typeof body.field === "string" ? body.field.slice(0, 100) : undefined;
  const valueLength = typeof body.valueLength === "number" && Number.isInteger(body.valueLength) ? Math.min(body.valueLength, 10000) : undefined;

  logger.info({
    audit: true,
    event,
    visitorId,
    path,
    target,
    field,
    valueLength,
    ip: clientIp(req),
    userAgent: req.get("user-agent")?.slice(0, 300),
  }, "dev_audit");
  res.status(204).send();
});

export default router;
