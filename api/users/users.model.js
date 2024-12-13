import bcrypt from "bcrypt";
import mongoose, { Schema } from "mongoose";
import logger from "../../logger.js";

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

userSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (!update?.password) return next();
  console.log(update.password);
  // Example transformation: lowercase the email
  bcrypt.hash(update.password, 10, async function (err, hash) {
    if (err) {
      logger.error(err);
      throw new Error("Something went wrong with bCrypt");
    }
    update.password = hash;
    next();
  });
});

userSchema.pre("save", function (next) {
  if (!this.password) return next();
  // Example transformation: lowercase the email
  bcrypt.hash(this.password, 10, (err, hash) => {
    if (err) {
      logger.error(err);
      throw new Error("Something went wrong with bCrypt");
    }
    this.password = hash;
    next();
  });
});

const User = mongoose.model("users", userSchema);

export default User;
