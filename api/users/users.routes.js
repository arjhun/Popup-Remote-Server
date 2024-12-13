import { Router } from "express";
import { z } from "zod";
import { processRequest, validateRequest } from "zod-express-middleware";
import {
  onlyAdmin,
  onlyAdminAndOwner,
  verifyPassword,
} from "../../middlewares/auth.mw.js";
import {
  activateUser,
  changeRole,
  createUser,
  deleteUser,
  getUser,
  getUsers,
  updateUser,
} from "./users.handlers.js";
import { ROLES_VALUES } from "./users.model.js";

const passwordSchema = {
  oldPassword: z.optional(z.string().or(z.literal(""))),
  password: z
    .string()
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,20}$/
    )
    .or(z.literal("")),
};

const userSchema = {
  username: z.string().min(4),
  firstName: z.string().min(2).or(z.literal("")).optional(),
  lastName: z.string().or(z.literal("")).optional(),
  email: z.string().email(),
};

const router = Router();

router.get("/", onlyAdmin, getUsers);

router.post(
  "/",
  processRequest({
    body: z.object({ ...userSchema, ...passwordSchema }),
  }),
  createUser
);

router.get(
  "/:id",
  validateRequest({
    params: z.object({
      id: z.string(),
    }),
  }),
  onlyAdminAndOwner,
  getUser
);

router.put(
  "/:id",
  processRequest({
    params: z.object({
      id: z.string(),
    }),
    body: z.object({ ...userSchema, ...passwordSchema }).partial(),
  }),
  onlyAdminAndOwner,
  verifyPassword,
  updateUser
);

router.put(
  "/:id/active",
  processRequest({
    params: z.object({
      id: z.string(),
    }),
    body: z.object({ active: z.boolean() }),
  }),
  onlyAdmin,
  activateUser
);

router.put(
  "/:id/active",
  processRequest({
    params: z.object({
      id: z.string(),
    }),
    body: z.object({ active: z.boolean() }),
  }),
  onlyAdmin,
  activateUser
);

router.put(
  "/:id/role",
  processRequest({
    params: z.object({
      id: z.string(),
    }),
    body: z.object({ role: z.enum(ROLES_VALUES) }),
  }),
  onlyAdmin,
  changeRole
);

router.delete(
  "/:id",
  validateRequest({
    params: z.object({
      id: z.string(),
    }),
  }),
  onlyAdmin,
  deleteUser
);

export default router;
