import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contentRouter from "./content";
import productsRouter from "./products";
import ordersRouter from "./orders";
import emailRouter from "./email";
import adminRouter from "./admin";
import devTestingRouter from "./dev-testing";
import renderLogsRouter from "./render-logs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contentRouter);
router.use(productsRouter);
router.use(ordersRouter);
router.use(emailRouter);
router.use(adminRouter);
router.use(devTestingRouter);
router.use(renderLogsRouter);

export default router;
