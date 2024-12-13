import { createHash, randomBytes } from "crypto";
import Token from "./api/tokens/token.model.js";

/**
 *
 * @param {string} token
 * @param {number} expireInSeconds
 * @param {string} type
 * @param {string} userId
 * @returns
 */

export const createExpiringHashedToken = async (
  token,
  expireInSeconds,
  type,
  userId
) => {
  return await Token.create({
    hash: hashToken(token),
    userId: userId,
    expireAt: new Date(Date.now() + expireInSeconds),
    type: type,
  });
};

export const createToken = () => randomBytes(24).toString("hex");

export const hashToken = (token) => {
  return createHash("sha256").update(token).digest("hex");
};

export const compareHash = (data, hash) => {
  return hashToken(data) === hash;
};
