import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aegisaiRouter from "./aegisai";
import modelsRouter from "./models";
import agentsRouter from "./agents";
import promptsRouter from "./prompts";
import experimentsRouter from "./experiments";
import authRouter from "./auth";
import { requireAuth } from "../middleware/auth";
import { enforcePermissions } from "../middleware/authorization";
import settingsRouter from "./settings";
import proxyRouter from "./proxy";
import { recordAudit } from "../services/audit_service";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(requireAuth);
router.use(enforcePermissions);
router.use((req, res, next) => {
	res.on("finish", () => {
		if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && res.statusCode < 500 && !req.path.startsWith("/auth/")) {
			void recordAudit(req, req.method.toLowerCase(), req.path, res.statusCode < 400 ? "success" : "failed");
		}
	});
	next();
});
router.use(settingsRouter);
router.use(modelsRouter);
router.use(agentsRouter);
router.use(promptsRouter);
router.use(experimentsRouter);
router.use(aegisaiRouter);
router.use("/proxy", proxyRouter);

export default router;
