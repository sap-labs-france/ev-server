var Utils = require('../utils/Utils');
const nodemailer = require('nodemailer');

// https://nodemailer.com/smtp/
class EMail {
  constructor() {
    // Email
    this._emailConfig = Utils.getEmailConfig();

    // create reusable transporter object using the default SMTP transport
    this._transporter = nodemailer.createTransport({
      host: this._emailConfig.smtp.host,
      secure: this._emailConfig.smtp.secure,
      auth: {
        user: this._emailConfig.smtp.user,
        pass: this._emailConfig.smtp.password
      }
    });
  }

  sendEmail(email) {
    // In promise
    return new Promise((fulfill, reject) => {
      // Call
      this._transporter.sendMail({
         from: (!email.from?this._emailConfig.from:email.from),
         to: email.to,
         cc: email.cc,
         bcc: (!email.cc?this._emailConfig.bcc:email.cc),
         subject: email.subject,
         text: email.text,
         html: email.html
      }, (err, info) => {
        console.log(err);
        console.log(info);
        // Error Handling
        if (err) {
          reject(err);
        } else {
          fulfill(info);
        }
      });
    });
  }
}

module.exports = EMail;
