import nodemailer from "nodemailer";
import hbs from "nodemailer-express-handlebars";
import "dotenv/config.js";
import config from "./server.config.js";
import logger from "./logger.js";

// create reusable transporter object using the default SMTP transport
let transporter = nodemailer.createTransport({
  host: config.email.smtpServer,
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: config.email.smtpUser, // generated ethereal user
    pass: config.email.smtpPass, // generated ethereal password
  },
});

const options = {
  viewEngine: {
    layoutsDir: "email_views/layouts/",
    partialsDir: "email_views/partials/",
  },
  viewPath: "email_views",
  helpers: {
    supportEmail() {
      return config.email.supportEmail;
    },
  },
};

transporter.use("compile", hbs(options));

// verify connection configuration
transporter.verify(function (error, success) {
  if (error)
    logger.error(
      { ...error },
      "Connection to smtp server failed not able to send email!"
    );
  if (success) logger.info("SMTP server responded, ready to send email!");
});

// async..await is not allowed in global scope, must use a wrapper

const emailer = {
  /**
   *
   * @param {string} name
   * @param {string} email
   * @param {string} reset_link
   */
  sendPasswordResetMail: async (name, email, reset_link) => {
    sendEmailTo(email, "Password Reset Requested", "reset_password", {
      link: reset_link,
      name: name,
    });
  },
  /**
   *
   * @param {string} name
   * @param {email} email
   */
  sendResetNotifMail: async (name, email) => {
    sendEmailTo(email, "password_change_notif", {
      subject: "Security notification: Password reset!",
      email: email,
      context: {
        name: name,
      },
    });
  },
  /**
   *
   * @param {string} email
   */
  sendEmailNotFoundMail: async (email) => {
    sendEmailTo(email, "Password Reset requested", "password_wrong_email");
  },
};

const from = `"${config.email.fromName}" <${config.email.fromEmail}>`;
/**
 *
 * @param {string} email
 * @param {string} subject
 * @param {string} template
 * @param {object} context
 */
const sendEmailTo = async (email, subject, template, context = {}) => {
  try {
    const info = await transporter.sendMail({
      from: from, // sender address
      to: email, // list of receivers
      subject: subject, // Subject line
      template: template,
      context: { subject: subject, email: email, ...context },
    });
    logger.trace(info);
  } catch (err) {
    logger.error({ template: template }, "Sending email failed!");
  }
};

export default emailer;
