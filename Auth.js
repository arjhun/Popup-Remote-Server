import logger from "./logger.js";
import config from "./server.config.js";
//auth
import jwt from "jsonwebtoken";
//passwords
import bcrypt from "bcrypt";
import { generate } from "generate-password";
//models
import User, { ROLES } from "./UserModel.js";

export const refreshTokenStore = new Set();

export const createDefaultAdmin = async () => {
  var password = generate({
    length: 16,
    numbers: true,
    symbols: "@$!%*?&",
    strict: true,
  });

  bcrypt.hash(password, 10, async function (err, hash) {
    if (err) {
      logger.error(err);
      return;
    }

    await User.findOneAndUpdate(
      { username: "admin" },
      {
        name: "administrator",
        email: "admin@example.org",
        password: hash,
        role: ROLES.ADMIN,
      },
      { upsert: true }
    )
      .then((user) => {
        logger.warn(
          {
            change_type: !user || user === null ? "created" : "reset",
            password: password,
          },
          `Admin reset requested, please change after first login!`
        );
      })
      .catch((error) => {
        logger.error(error);
      });
  });
};

const createTokens = (user) => {
  const refreshToken = jwt.sign(
    {
      id: user._id,
    },
    config.auth.secret,
    {
      expiresIn: config.auth.refreshTokenExpiration,
    }
  );

  // refreshTokenStore.add(refreshToken);

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
      },
      config.auth.secret,
      {
        expiresIn: config.auth.accessTokenExpiration,
      }
    ),
    refreshToken: refreshToken,
  };
};

export const authenticate = async (req, res) => {
  const { username, password } = req.body;
  User.findOne({ username: username })
    .select("+password +authInfo")
    .exec()
    .then((user) => {
      const logObj = { user_id: user._id, username: user.username, ip: req.ip };
      if (!user?.active) {
        logger.info(logObj, `Login attempt by deactivated user`);
        return res.sendStatus(401);
      }
      bcrypt.compare(password, user.password, function (err, result) {
        if (!result) {
          // user.authInfo.failedLogins += 1;
          logger.warn(logObj, `Failed login attempt`);
          return res.sendStatus(401);
        }
        //user.authInfo.failedLogins = 0;
        user.authInfo.lastLoggin = Date.now();
        logger.info(logObj, `Successfully authenticated`);
        const tokens = createTokens(user);
        return res.status(201).json(tokens);
      });
    })
    .catch((error) => {
      logger.warn({ username: username }, "User not found!");
      res.sendStatus(401);
    });
};

export const refresh = async (req, res) => {
  const token = req.body.refreshToken;

  try {
    const decoded = jwt.verify(token, config.auth.secret);

    // if (!refreshTokenStore.delete(token)) throw "RefreshToken does not exist";
    // else console.log("tokens in refreshtokenset: ", refreshTokenStore.size);

    User.findById(decoded.id)
      .exec()
      .then((user) => {
        if (!user.active) return res.sendStatus(401);
        logger.debug(
          {
            user_id: decoded.id,
            username: decoded.username,
          },
          `Successfully refreshed accesstoken!`
        );
        const tokens = createTokens(user);
        return res.status(201).json(tokens);
      })
      .catch((error) => {
        logger.warn(error, "Trying to refresh nonexisting user!");
        res.sendStatus("401");
      });
  } catch (err) {
    console.log(err);
    return res.sendStatus(401);
  }
};

export const verifyPassword = async (req, res, next) => {
  //when user changes password verify
  if (req.body.password) {
    //Admin not owner can change passwords no matter what
    if (req.auth.id !== req.params.id && req.auth.role == ROLES.ADMIN)
      return next();
    //if user did not provide previous password return unauthorized
    if (!req.body.oldPassword) return res.sendStatus(401);
    //check password
    await User.findById(req.params.id)
      .select("+password")
      .exec()
      .then(async (user) => {
        if (await bcrypt.compare(req.body.oldPassword, user.password)) {
          //passwords are correct we can continue
          return next();
        } else {
          return res.sendStatus(401);
        }
      })
      .catch((err) => {
        logger.error(err);
        res.sendStatus(500);
      });
  } else {
    next();
  }
};
