import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contentRouter from "./content";
import preordersRouter from "./preorders";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contentRouter);
router.use(preordersRouter);

export default router;
