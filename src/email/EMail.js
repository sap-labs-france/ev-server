var Configuration = require('../utils/Configuration');
var nodemailer = require('nodemailer');
var path = require('path');
var EmailTemplate = require('email-templates').EmailTemplate;

// https://nodemailer.com/smtp/
class EMail {
  constructor() {
    // Email
    this._emailConfig = Configuration.getEmailConfig();

    // Set
    let nodeMailerParams = {
      host: this._emailConfig.smtp.host,
      port: this._emailConfig.smtp.port,
      secure: this._emailConfig.smtp.secure,
      requireTLS: this._emailConfig.smtp.requireTLS,
      type: this._emailConfig.smtp.type,
      logger: this._emailConfig.smtp.debug,
      debug: this._emailConfig.smtp.debug
    };

    // Credentials provided?
    if (this._emailConfig.smtp.user) {
      // Add
      nodeMailerParams.auth = {
        user: this._emailConfig.smtp.user,
        pass: this._emailConfig.smtp.password
      };
    }

    // create reusable transporter object using the default SMTP transport
    this._transporter = nodemailer.createTransport(nodeMailerParams);
  }

  sendEmail(email) {
    // In promise
    return new Promise((fulfill, reject) => {
      // Call
      this._transporter.sendMail({
          from: (!email.from?this._emailConfig.from:email.from),
          to: email.to,
          cc: email.cc,
          bcc: (!email.bcc?this._emailConfig.bcc:""),
          subject: email.subject,
          text: email.text,
          html: email.html
        }, (err, info) => {
          // Error Handling
          if (err) {
            reject(err);
          } else {
            fulfill(info);
          }
      });
    });
  }

  static sendRegisteredUserEmail(data, locale) {
    // Create a promise
    return new Promise((fulfill, reject) => {
      // Send it
      EMail._sendEmail('registered-user', data, locale, fulfill, reject);
    });
  }

  static sendResetPasswordEmail(data, locale) {
    // Create a promise
    return new Promise((fulfill, reject) => {
      // Send it
      EMail._sendEmail('reset-password', data, locale, fulfill, reject);
    });
  }

  static _sendEmail(templateName, data, locale, fulfill, reject) {
    // Create email
    var email = new EMail();
    // Get the template dir
    var templateDir = path.join(__dirname, 'template', templateName);
    // Parse the email template
    var registeredUserTemplate = new EmailTemplate(templateDir);
    // Render the email
    registeredUserTemplate.render(data, locale,
      (error, templateParsedResult) => {
        // Error in parsing the template?
        if (error) {
          reject(error);
        } else {
          // Send the email
          email.sendEmail({
            to: data.user.email,
            subject: templateParsedResult.subject,
            text: `HTML content`,
            html: templateParsedResult.html
          }).then((message) => {
            // Ok
            fulfill(message);
          }, error => {
            reject(error);
          });
        }
      });
  }
}

module.exports = EMail;
