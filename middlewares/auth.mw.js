import bcrypt from "bcrypt";
import User, { ROLES } from "../api/users/users.model.js";
import logger from "../logger.js";

export const onlyAdmin = (req, res, next) => {
  if (req.auth.role !== ROLES.ADMIN) return res.sendStatus(403);
  next();
};

export const onlyAdminAndOwner = (req, res, next) => {
  if (req.auth.role !== ROLES.ADMIN && req.params.id !== req.auth.id)
    return res.sendStatus(403);
  next();
};

export const checkToken = function (err, req, res, next) {
  const date = new Date().toLocaleString();
  if (err.name === "UnauthorizedError") {
    logger.error(
      `${date}: error: UnauthorizedError, method: ${req.method}, url: ${req.url} ,ip: ${req.ip}`
    );
    return res
      .status(401)
      .send("invalid token...Refresh token or contact your admin!");
  }
  next(err);
};

export const verifyPassword = async (req, res, next) => {
  //when user changes password verify
  //Admin not owner can change passwords no matter what
  if (!req.body.password || req.auth.role == ROLES.ADMIN) return next();
  //if user did not provide previous password return unauthorized
  if (!req.body.oldPassword) {
    logger.debug("User did not provide old password");
    return res.sendStatus(403);
  }
  //check password
  await User.findById(req.params.id)
    .select("+password")
    .exec()
    .then(async (user) => {
      if (!user) return res.sendStatus(404);
      if (await bcrypt.compare(req.body.oldPassword, user.password)) {
        //passwords are correct we can continue
        return next();
      } else {
        logger.debug("Old password does not match");
        return res.sendStatus(401);
      }
    })
    .catch((err) => {
      logger.error(err);
      res.sendStatus(500);
    });
};
