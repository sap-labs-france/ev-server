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
    this._server.send({
       text:    emailData.text,
       from:    emailData.from,
       to:      emailData.to,
       cc:      emailData.cc,
       subject: emailData.subject
    }, (err, message) => {
      console.log("err: " + err);
      console.log("message: " + JSON.stringify(message));
    });
  }

  sendHTMLEmail(emailData) {
    this._server.send({
       text:    emailData.text,
       from:    emailData.from,
       to:      emailData.to,
       cc:      emailData.cc,
       subject: emailData.subject,
       attachment: emailData.attachment
    }, (err, message) => {
    });
  }
}

module.exports = EMail;
