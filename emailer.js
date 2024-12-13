import "dotenv/config.js";
import nodemailer from "nodemailer";
import hbs from "nodemailer-express-handlebars";
import logger from "./logger.js";
import config from "./server.config.js";

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

// async..await is not allowed in global scope, must use a wrapper

const emailer = {
   /**
   *A wrapper function
   * @param {string} email
   * @param {string} subject
   * @param {string} template
   * @param {object} context
   */
  sendEmailTo: async (email, subject, template, context = {}) => {
    const from = `"${config.email.fromName}" <${config.email.fromEmail}>`,
      mailOptions = {
        from: from, // sender address
        to: email, // list of receivers
        subject: subject, // Subject line
        template: template,
        context: { subject: subject, email: email, ...context },
      };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err)
        logger.error(
          { template: template, error: err },
          "Sending email failed!"
        );
      logger.trace(info);
    });
  },
  /**
   *
   * @param {string} name
   * @param {string} email
   * @param {string} reset_link
   */
  sendPasswordResetMail: async function (name, email, reset_link) {
    this.sendEmailTo(email, "Password Reset Requested", "reset_password", {
      link: reset_link,
      name: name,
    });
  },
  /**
   *
   * @param {string} name
   * @param {string} email
   */
  sendResetNotifMail: async function (name, email) {
    this.sendEmailTo(
      email,
      "Security notification: Password reset!",
      "password_change_notif",
      {
        name: name,
      }
    );
  },
  /**
   *
   * @param {string} email
   */
  sendEmailNotFoundMail: async function (email) {
    this.sendEmailTo(email, "Password Reset requested", "password_wrong_email");
  },
  /**
   *
   * @param {string} email
   * @param {string} name
   * @param {string} activation_link
   */
  sendEmailVerifyMail: async function (email, name, activation_link) {
    this.sendEmailTo(
      email,
      "Welcome! Please activate your account!",
      "verify_new_user",
      {
        name: name,
        link: activation_link,
      }
    );
  },
  /**
   *
   */
  checkConnection: function () {
    // verify connection configuration
    transporter.verify(function (error, success) {
      if (error)
        logger.error(
          { ...error },
          "Connection to smtp server failed not able to send email!"
        );
      if (success) {
        logger.info("SMTP server responded, ready to send email!");
        return succes;
      }
    });
  },
};

export default emailer;
