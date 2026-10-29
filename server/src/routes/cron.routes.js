
import { Router } from "express";
import { readme } from "../controllers/cron.controller.js";

const router = Router();

// GitHub Actions ejecuta GET /api/cron/reminders.
router.get("/reminders", readme);

// También permite ejecutar el cron mediante POST.
router.post("/reminders", readme);

export default router;
