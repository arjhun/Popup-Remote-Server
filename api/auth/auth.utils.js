import logger from "../../logger.js";
import config from "../../server.config.js";
//auth
import jwt from "jsonwebtoken";
//passwords
import { generate } from "generate-password";
//models
import User, { ROLES } from "../users/users.model.js";

export const refreshTokenStore = new Set();

export const createDefaultAdmin = async () => {
  var password = generate({
    length: 16,
    numbers: true,
    symbols: "@$!%*?&",
    strict: true,
  });

   await User.findOneAndUpdate(
      { username: "admin" },
      {
        name: "administrator",
        email: "admin@example.org",
        password: password,
        role: ROLES.ADMIN,
        authInfo: {
          isVerified: true,
        },
      },
      { upsert: true }
    )
      .then((user) => {
        logger.warn(
          {
            change_type: !user || user === null ? "created" : "reset",
            result: password,
          },
          `Admin password reset requested, please change after first login!`
        );
      })
      .catch((error) => {
        logger.error(error);
      });
};

export const createTokens = (user) => {
  const tokenUUID = crypto.randomUUID();
  const refreshUUID = crypto.randomUUID();
  const refreshToken = jwt.sign(
    {
      id: user._id,
      tokenId: refreshUUID,
    },
    config.auth.secret,
    {
      expiresIn: config.auth.refreshTokenExpiration,
    }
  );

  refreshTokenStore.add(tokenUUID);

  return {
    id: user._id,
    firstName: user.firstName,
    username: user.username,
    role: user.role,
    token: jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        tokenId: tokenUUID,
      },
      config.auth.secret,
      {
        expiresIn: config.auth.accessTokenExpiration,
      }
    ),
    refreshToken: refreshToken,
  };
};
