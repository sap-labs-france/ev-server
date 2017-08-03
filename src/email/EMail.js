const Configuration = require('../utils/Configuration');
const nodemailer = require('nodemailer');
const path = require('path');
const email = require("emailjs");
const ejs = require('ejs');
const resetPasswordTemplate = require('./template/reset-password.js');
const registeredUserTemplate = require('./template/registered-user.js');
const notifyEndOfChargeTemplate = require('./template/notify-end-of-charge.js');
const notifyBeforeEndOfChargeTemplate = require('./template/notify-before-end-of-charge.js');

// Email
_emailConfig = Configuration.getEmailConfig();

// https://nodemailer.com/smtp/
class EMail {
  constructor() {
    // Connect to the server
    this.server = email.server.connect({
      user: _emailConfig.smtp.user,
      password: _emailConfig.smtp.password,
      host: _emailConfig.smtp.host,
      port: _emailConfig.smtp.port,
      tls: _emailConfig.smtp.requireTLS,
      ssl: _emailConfig.smtp.secure
    });
  }

  sendEmail(email) {
    // In promise
    return new Promise((fulfill, reject) => {
      // Create the message
      var message	= {
        from:  (!email.from?_emailConfig.from:email.from),
        to: email.to,
        cc: email.cc,
        bcc: (!email.bcc?_emailConfig.bcc:""),
        subject: email.subject,
        text: email.text,
        attachment: [
          { data: email.html, alternative:true }
        ]
      };

      // send the message and get a callback with an error or details of the message that was sent
      this.server.send(message, (err, message) => {
        // Error Handling
        if (err) {
          reject(err);
        } else {
          fulfill(message);
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

  static sendNotifyBeforeEndOfChargeEmail(data, locale) {
    // Create a promise
    return new Promise((fulfill, reject) => {
      // Send it
      EMail._sendEmail('notify-before-end-of-charge', data, locale, fulfill, reject);
    });
  }

  static sendNotifyEndOfChargeEmail(data, locale) {
    // Create a promise
    return new Promise((fulfill, reject) => {
      // Send it
      EMail._sendEmail('notify-end-of-charge', data, locale, fulfill, reject);
    });
  }

  static _sendEmail(templateName, data, locale, fulfill, reject) {
    // Create email
    let email = new EMail();
    let emailTemplate;
    // Get the template dir
    switch (templateName) {
      // Reset password
      case 'reset-password':
        emailTemplate = resetPasswordTemplate;
        break;
      // Registered user
      case 'registered-user':
        emailTemplate = registeredUserTemplate;
        break;
      // Before End of charge
      case 'notify-before-end-of-charge':
        emailTemplate = notifyBeforeEndOfChargeTemplate;
        break;
      // End of charge
      case 'notify-end-of-charge':
        emailTemplate = notifyEndOfChargeTemplate;
        break;
    }
    // Template found?
    if (!emailTemplate) {
      // No
      reject(new Error(`No template found for ${templateName}`));
      return;
    }
    // Check for localized template?
    if (emailTemplate[locale]) {
      // Set the localized template
      emailTemplate = emailTemplate[locale];
    }
    // Render the subject
    let subject = ejs.render(emailTemplate.subject, data);
    // Render the HTML
    let html = ejs.render(emailTemplate.html, data);
    // Send the email
    email.sendEmail({
      to: data.user.email,
      subject: subject,
      text: html,
      html: html
    }).then((message) => {
      // Ok
      fulfill(message);
    }, error => {
      reject(error);
    });
  }
}

module.exports = EMail;
