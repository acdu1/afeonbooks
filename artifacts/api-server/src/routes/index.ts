import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contentRouter from "./content";
import productsRouter from "./products";
import ordersRouter from "./orders";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contentRouter);
router.use(productsRouter);
router.use(ordersRouter);

export default router;
