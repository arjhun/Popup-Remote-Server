import emailer from "../../emailer.js";
import logger from "../../logger.js";
import config from "../../server.config.js";
import User from "../users/users.model.js";
import Token, { TOKEN_TYPES } from "./token.model.js";
import * as TokenUtils from "./token.utils.js";

export const sendPasswordToken = async (req, res) => {
  //always take the same time to respond even if the user does not exist
  new Promise((resolve) => setTimeout(resolve, 100)).then(() => {
    res.sendStatus(202);
  });

  try {
    const user = await User.findOne({ email: req.body.email }).exec();
    if (!user) {
      emailer.sendEmailNotFoundMail(req.body.email);
      throw new Error("User not found");
    }

    const token = TokenUtils.createToken();
    const hashedToken = await TokenUtils.createExpiringHashedToken(
      token,
      3600,
      TOKEN_TYPES.PASSWORD_RESET,
      user.id
    );

    // send mail with defined transport object
    const base_url = config.server.corsUrls[0];
    const reset_link =
      base_url +
      `/login/password-reset?token=${token}&tokenId=${hashedToken._id}`;

    await emailer.sendPasswordResetMail(
      user.firstName || user.username,
      user.email,
      reset_link
    );
  } catch (err) {
    logger.error(err);
  }
};

export const updatePasswordByToken = async (req, res) => {
  try {
    //get token
    const token = await Token.findById(req.body.tokenId).exec();
    if (!token) return res.sendStatus(404);
    if (!TokenUtils.compareHash(req.body.token, token.hash)) {
      logger.debug(
        { username: req.body.username },
        "User authenticated with wrong password"
      );
      return res.sendStatus(401);
    }
    //get user
    const user = await User.findByIdAndUpdate(token.userId, {
      password: req.body.password,
    })
      .exec()
      .then(async (user) => {
        if (!user) return res.sendStatus(404);
        //no error delete token
        Token.findByIdAndDelete(token._id)
          .exec()
          .then((result) => {
            res.sendStatus(204);
          });
        //after sending the status
        //send the user a notification email
        emailer.sendResetNotifMail(user.firstName || user.username, user.email);
      });
  } catch (err) {
    logger.error(err);
    res.sendStatus(500);
  }

  //reset password
};

export const verifyAccountByToken = async (req, res) => {
  //TODO: check token
  res.status(201).json(res.body);
};
