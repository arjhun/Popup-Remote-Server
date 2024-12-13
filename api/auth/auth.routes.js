import { Router } from "express";
import ExpressBruteFlexible from "rate-limiter-flexible/lib/ExpressBruteFlexible.js";
import z from "zod";
import { validateRequest } from "zod-express-middleware";
import {
  sendPasswordToken,
  updatePasswordByToken,
  verifyAccountByToken,
} from "../tokens/token.handlers.js";
import { authenticate, refresh } from "./auth.handlers.js";

var bruteForce = new ExpressBruteFlexible(
  ExpressBruteFlexible.LIMITER_TYPES.MEMORY,
  { freeRetries: 10 }
);

const router = Router();

router.get("/", (req, res) => {
  res.sendFile("index.html");
});

router.post(
  "/authenticate",
  bruteForce.prevent,
  validateRequest({
    body: z.object({
      username: z.string(),
      password: z.string(),
    }),
  }),
  authenticate
);

router.post(
  "/refresh",
  bruteForce.prevent,
  validateRequest({
    body: z.object({
      refreshToken: z.string().length(32),
    }),
  }),
  refresh
);

router.post(
  "/reset-password",
  bruteForce.prevent,
  validateRequest({
    body: z.object({
      email: z.string().email(),
    }),
  }),
  sendPasswordToken
);

router.put(
  "/reset-password",
  bruteForce.prevent,
  validateRequest({
    body: z.object({
      token: z.string(),
      tokenId: z.string(),
      password: z.string(),
    }),
  }),
  updatePasswordByToken
);

router.put(
  "/verify-account",
  bruteForce.prevent,
  validateRequest({
    body: z.object({
      token: z.string(),
      tokenId: z.string(),
    }),
  }),
  verifyAccountByToken
);

export default router;
