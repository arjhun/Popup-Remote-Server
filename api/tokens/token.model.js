import mongoose, { Schema } from "mongoose";

export const TOKEN_TYPES = {
  VERIFY_EMAIL: "verify_email",
  PASSWORD_RESET: "password_reset",
};
export const TOKEN_TYPES_VALUES = Object.values(TOKEN_TYPES);

const tokenSchema = new Schema(
  {
    hash: {
      type: String,
    },
    type: {
      type: String,
      enum: TOKEN_TYPES_VALUES,
      index: true,
    },
    expireAt: {
      type: Date,
      required: true,
      expires: 0,
    }, //seconds
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

const Token = mongoose.model("resetTokens", tokenSchema);

export default Token;
