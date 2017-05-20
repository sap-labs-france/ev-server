var email = require("emailjs/email");
var Utils = require('../utils/Utils');

//  https://www.npmjs.com/package/emailjs
class EMail {
  constructor() {
    // Email
    var emailConfig = Utils.getEmailConfig();

    // Create the server
    this._server 	= email.server.connect({
      user:     emailConfig.smtp.user,
      password: emailConfig.smtp.password,
      host:     emailConfig.smtp.host,
      ssl:      emailConfig.smtp.ssl
    });
  }

  sendTextEmail(emailData) {
    // In promise
    return new Promise((fulfill, reject) => {
      // Call
      this._server.send({
         text:    emailData.text,
         from:    emailData.from,
         to:      emailData.to,
         cc:      emailData.cc,
         subject: emailData.subject
      }, (err, message) => {
        console.log(err);
        console.log(message);
        // Error Handling
        if (err) {
          reject(err);
        } else {
          fulfill(message);
        }
      });
    });
  }

  sendHTMLEmail(emailData) {
    // In promise
    return new Promise((fulfill, reject) => {
      // Call
      this._server.send({
         text:    emailData.text,
         from:    emailData.from,
         to:      emailData.to,
         cc:      emailData.cc,
         subject: emailData.subject,
         attachment: emailData.attachment
      }, (err, message) => {
        // Error Handling
        if (err) {
          reject(err);
        } else {
          fulfill(message);
        }
      });
    });
  }
}

module.exports = EMail;
