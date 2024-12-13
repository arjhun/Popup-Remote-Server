import { Router } from "express";
import z from "zod";
import { validateRequest } from "zod-express-middleware";
import { onlyAdmin } from "../../middlewares/auth.mw.js";
import {
  addSession,
  deleteSession,
  getSession,
  getSessions,
  orderPopups,
  updateSession,
} from "./session.handlers.js";

const router = Router();

router.get("/", getSessions);

router.post(
  "/",
  validateRequest({
    body: z.object({
      title: z.string(),
    }),
  }),
  onlyAdmin,
  addSession
);

router.get(
  "/:id",
  validateRequest({
    params: z.object({
      id: z.string(),
    }),
  }),
  getSession
);

router.put(
  "/:id",
  validateRequest({
    params: z.object({
      id: z.string(),
    }),
    body: z.object({
      title: z.string().min(1),
    }),
  }),
  onlyAdmin,
  updateSession
);

router.put(
  "/:id/order",
  validateRequest({
    params: z.object({
      id: z.string(),
    }),
    body: z.object({
      orderArray: z.object({ _id: z.string(), order: z.number() }).array(),
    }),
  }),
  orderPopups
);

router.delete(
  "/:id",
  validateRequest({
    params: z.object({
      id: z.string(),
    }),
  }),
  deleteSession
);

export default router;
