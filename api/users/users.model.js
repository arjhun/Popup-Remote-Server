import mongoose, { Schema } from "mongoose";

export const ROLES = { MOD: "mod", ADMIN: "admin" };
export const ROLES_VALUES = Object.values(ROLES);

const userSchema = new Schema(
  {
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },

    email: {
      type: String,
      unique: true,
      required: true,
    },
    username: {
      type: String,
      unique: true,
      required: true,
    },
    password: {
      required: true,
      type: String,
      select: false,
    },
    role: {
      type: String,
      required: true,
      enum: ROLES_VALUES,
      default: ROLES.MOD,
    },
    authInfo: {
      failedLogins: { type: Number, default: 0 },
      lastLoggin: Date,
      requireChange: { type: Boolean, default: true },
      isVerified: { type: Boolean, default: false },
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const User = mongoose.model("users", userSchema);

export default User;
