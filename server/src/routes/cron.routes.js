import { Router } from "express";
import { readme } from "../controllers/cron.controller.js";

const router = Router();

router.get("/readme", readme);
router.post("/readme", readme);

export default router;