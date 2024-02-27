import { z } from "zod";
import { ROLES_VALUES } from "./UserModel.js";

export const passwordSchema = {
  password: z
    .string()
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,20}$/
    )
    .or(z.literal("")),
};
export const userSchema = {
  username: z.string().min(4),
  firstName: z.string().min(2).or(z.literal("")),
  lastName: z.string().or(z.literal("")),
  email: z.string().email(),
  oldPassword: z.optional(z.string().or(z.literal(""))),
  ...passwordSchema,
};

export const roleSchema = {
  role: z.enum(ROLES_VALUES),
};
