import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import { randomBytes, createHash } from "crypto";
import emailer from "../emailer.js";
import User from "./UserModel.js";
import config from "../server.config.js";

const tokenSchema = new Schema({
  hash: {
    type: String,
  },
  expireAt: {
    type: Date,
    default: Date.now,
    expires: 3600,
  }, //seconds
  userId: {
    type: mongoose.ObjectId,
    required: true,
  },
});

const Token = mongoose.model("resetTokens", tokenSchema);

export const sendPasswordToken = async (req, res) => {
  //always take the same time to respond even if the user does not exist
  new Promise((resolve) => setTimeout(resolve, 200)).then(() => {
    res.sendStatus(202);
  });

  try {
    const user = await User.findOne({ email: req.body.email }).exec();
    if (!user)
      //TODO: send email to unknown user
      return emailer.sendEmailNotFoundMail(req.body.email);

    const token = randomBytes(24).toString("hex");
    //unsalted hash for storing short lived token
    const createdToken = await Token.create({
      hash: hashToken(token),
      userId: user._id,
    });

    // send mail with defined transport object
    const base_url = config.server.corsUrls[0];
    const reset_link =
      base_url +
      `/login/password-reset?token=${token}&tokenId=${createdToken._id}`;

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
    await User.findById(token.userId)
      .exec()
      .then(async (user) => {
        if (!user) return res.sendStatus(401);
        //compare hash
        if (!compareHash(req.body.token, token.hash))
          return res.sendStatus(401);
        //authorized so update passwordreq.body.token,
        user.password = await bcrypt.hash(req.body.password, 10);
        await user.save();
        Token.findByIdAndDelete(token._id)
          .exec()
          .then((result) => {
            res.sendStatus(200);
          });
        //send the user a notification email
        emailer.sendResetNotifMail(user.firstName || user.username, user.email);
      });
  } catch (err) {
    logger.error(err);
    res.sendStatus(500);
  }

  //reset password
};

const hashToken = (token) => {
  return createHash("sha256").update(token).digest("hex");
};

const compareHash = (data, hash) => {
  return hashToken(data) === hash;
};

export default Token;
