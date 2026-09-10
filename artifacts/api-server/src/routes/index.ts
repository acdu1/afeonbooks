import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contentRouter from "./content";
import productsRouter from "./products";
import ordersRouter from "./orders";
import emailRouter from "./email";
import resendEmailRouter from "./resend-email";
import adminRouter from "./admin";
import devTestingRouter from "./dev-testing";
import renderLogsRouter from "./render-logs";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contentRouter);
router.use(productsRouter);
router.use(ordersRouter);
router.use(emailRouter);
router.use(resendEmailRouter);
router.use(adminRouter);
router.use(devTestingRouter);
router.use(renderLogsRouter);
router.use(authRouter);

export default router;
