import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import logger from "../../logger.js";
import config from "../../server.config.js";
import User from "../users/users.model.js";
import { createTokens, refreshTokenStore } from "./auth.utils.js";

export const refresh = async (req, res) => {
  const refreshToken = req.body.refreshToken;
  try {
    const decoded = jwt.verify(refreshToken, config.auth.secret);
    if (refreshTokenStore.has(decoded.tokenId)) return res.sendStatus(401);

    User.findById(decoded.id)
      .exec()
      .then((user) => {
        //check if token pair belongs to a real activated user
        if (!user || !user.active) {
          logger.warn(
            {
              user_id: decoded.id,
              username: decoded.username,
            },
            "error refreshing non-existing or deactivated user"
          );
          return res.sendStatus(401);
        }
        //create new set of tokens for rotation
        const tokens = createTokens(user);
        logger.debug(
          {
            user_id: decoded.id,
            username: decoded.username,
          },
          `Successfully refreshed accesstoken!`
        );
        //remove old token id from store
        refreshTokenStore.delete(decoded.tokenId);
        return res.status(201).json(tokens);
      });
  } catch (error) {
    logger.warn(error, "error refreshing user");
    res.sendStatus("500");
  }
};

export const authenticate = async (req, res) => {
  const { username, password } = req.body;
  User.findOne({ username: username })
    .select("+password +authInfo")
    .exec()
    .then((user) => {
      const userInfo = { username: username, ip: req.ip };
      //check early login fail conditions
      const reason = !user
        ? "non-existing user"
        : !user.authInfo?.isVerified
        ? "non-verified user"
        : !user.active
        ? "deactivated user"
        : null;

      if (reason || !user) {
        failedLogin({ reason: reason, userInfo });
        return res.sendStatus(401);
      }

      bcrypt.compare(password, user.password, function (err, match) {
        //wrong password
        if (err) logger.error(err);
        if (match) {
          //succesfull login! Reset authInfo.
          user.authInfo.failedLogins = 0;
          user.authInfo.lastLoggin = Date.now();
          logger.info(userInfo, "Successfully authenticated!");
          const tokens = createTokens(user);
          return res.status(201).json(tokens);
        } else {
          user.authInfo.failedLogins += 1;
          failedLogin({ reason: "Wrong password!", userInfo });
          res.sendStatus(401);
        }
        user.save();
      });
    })
    .catch((error) => {
      logger.warn(
        { username: username, error: error },
        "Error retrieving user from db!"
      );
      res.sendStatus(401);
    });
};

const failedLogin = (obj) => {
  logger.warn(obj, "Failed login attempt!");
};
