const email = require("emailjs");
const ejs = require('ejs');
const fs = require('fs');
const BackendError = require('../../exception/BackendError');
const Configuration = require('../../utils/Configuration');
const Logging = require('../../utils/Logging');
const Utils = require('../../utils/Utils');
const NotificationTask = require('../NotificationTask');

require('source-map-support').install();

// Email
const _emailConfig = Configuration.getEmailConfig();

// https://nodemailer.com/smtp/
class EMailNotificationTask extends NotificationTask {
  constructor() {
    super();
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

  sendNewRegisteredUser(data, locale, tenantID) {
    // Send it
    return this._prepareAndSendEmail('new-registered-user', data, locale, tenantID);
  }

  sendRequestPassword(data, locale, tenantID) {
    // Send it
    return this._prepareAndSendEmail('request-password', data, locale, tenantID);
  }

  sendNewPassword(data, locale, tenantID) {
    // Send it
    return this._prepareAndSendEmail('new-password', data, locale, tenantID);
  }

  sendOptimalChargeReached(data, locale, tenantID) {
    // Send it
    return this._prepareAndSendEmail('optimal-charge-reached', data, locale, tenantID);
  }

  sendEndOfCharge(data, locale, tenantID) {
    // Send it
    return this._prepareAndSendEmail('end-of-charge', data, locale, tenantID);
  }

  sendEndOfSession(data, locale, tenantID) {
    // Send it
    return this._prepareAndSendEmail('end-of-session', data, locale, tenantID);
  }

  sendChargingStationStatusError(data, locale, tenantID) {
    // Send it
    return this._prepareAndSendEmail('charging-station-status-error', data, locale, tenantID);
  }

  sendChargingStationRegistered(data, locale, tenantID) {
    // Send it
    return this._prepareAndSendEmail('charging-station-registered', data, locale, tenantID);
  }

  sendUserAccountStatusChanged(data, locale, tenantID) {
    // Send it
    return this._prepareAndSendEmail('user-account-status-changed', data, locale, tenantID);
  }

  sendUnknownUserBadged(data, locale, tenantID) {
    // Send it
    return this._prepareAndSendEmail('unknown-user-badged', data, locale, tenantID);
  }

  sendTransactionStarted(data, locale, tenantID) {
    // Send it
    return this._prepareAndSendEmail('transaction-started', data, locale, tenantID);
  }

  sendVerificationEmail(data, locale, tenantID) {
    // Send it
    return this._prepareAndSendEmail('verification-email', data, locale, tenantID);
  }

  async _prepareAndSendEmail(templateName, data, locale, tenantID) {
    // Create email
    let emailTemplate;
    // Check users
    if (!data.user && !data.users && !data.adminUsers) {
      // Error
      throw new BackendError(null, `No User is provided for '${templateName}'`,
        "EMailNotificationTask", "_prepareAndSendEmail");
    }

    emailTemplate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/notification/email/${locale}/${templateName}.json`, 'utf8'));
    // Template found?
    if (!emailTemplate) {
      // Error
      throw new BackendError(null, `No Email template found for '${templateName}'`,
        "EMailNotificationTask", "_prepareAndSendEmail");
    }

    // Render the localized template ---------------------------------------
    // Render the subject
    emailTemplate.subject = ejs.render(emailTemplate.subject, data);
    // Render Base URL
    emailTemplate.baseURL = ejs.render(emailTemplate.baseURL, data);
    emailTemplate.body.template = templateName;
    // Render the title
    emailTemplate.body.header.title = ejs.render(emailTemplate.body.header.title, data);
    // Charge Angels Logo
    emailTemplate.body.header.image.left.url = ejs.render(emailTemplate.body.header.image.left.url, data);

    // Company Logo
    emailTemplate.body.header.image.right.url = ejs.render(emailTemplate.body.header.image.right.url, data);
    // Render Lines Before Action
    emailTemplate.body.beforeActionLines =
      emailTemplate.body.beforeActionLines.map((beforeActionLine) => {
        return ejs.render(beforeActionLine, data);
      });
    // Remove extra empty lines
    Utils.removeExtraEmptyLines(emailTemplate.body.beforeActionLines);
    // Render Stats
    if (emailTemplate.body.stats) {
      emailTemplate.body.stats =
        emailTemplate.body.stats.map((stat) => {
          stat.label = ejs.render(stat.label, data);
          stat.value = ejs.render(stat.value, data);
          return stat;
        });
    }
    // Render Action
    if (emailTemplate.body.action) {
      emailTemplate.body.action.title =
        ejs.render(emailTemplate.body.action.title, data);
      emailTemplate.body.action.url =
        ejs.render(emailTemplate.body.action.url, data);
    }
    // Render Lines After Action
    emailTemplate.body.afterActionLines =
      emailTemplate.body.afterActionLines.map((afterActionLine) => {
        return ejs.render(afterActionLine, data);
      });
    // Remove extra empty lines
    Utils.removeExtraEmptyLines(emailTemplate.body.afterActionLines);
    // Render the final HTML -----------------------------------------------
    const subject = ejs.render(fs.readFileSync(`${global.appRoot}/assets/server/notification/email/subject.mustache`, 'utf8'), emailTemplate);
    const html = ejs.render(fs.readFileSync(`${global.appRoot}/assets/server/notification/email/template.html`, 'utf8'), emailTemplate);
    // Add Admins in BCC from Configuration
    let adminEmails = null;
    if (data.adminUsers && data.adminUsers.length > 0) {
      // Add Admins
      adminEmails = data.adminUsers.map((adminUser) => adminUser.email).join(',');
    }
    // Send the email
    const message = await this.sendEmail({
      to: this.getUserEmailsFromData(data),
      bcc: adminEmails,
      subject: subject,
      text: html,
      html: html
    }, data, tenantID);
    // Ok
    return message;
  }

  getUserEmailsFromData(data) {
    // Check if user is provided
    if (data.user) {
      // Return one email
      return (data.user ? data.user.email : null);
    } else if (data.users) {
      // Return a list of emails
      return data.users.map((user) => user.email).join(',');
    }
  }

  async sendEmail(email, data, tenantID) {
    // Create the message
    const messageToSend = {
      from: (!email.from ? _emailConfig.from : email.from),
      to: email.to,
      cc: email.cc,
      bcc: email.bcc,
      subject: email.subject,
      // text: email.text,
      attachment: [
        {data: email.html, alternative: true}
      ]
    };
    // send the message and get a callback with an error or details of the message that was sent
    return await this.server.send(messageToSend, function(err, messageSent) {
      if (err) {
        // Error!
        try {
          Logging.logError({
            tenantID: tenantID, source: (data.hasOwnProperty("chargingBoxID") ? data.chargingBoxID : undefined),
            module: "EMailNotificationTask", method: "sendEmail",
            action: "SendEmail", message: err.toString(),
            detailedMessages: {
              email: {
                from: messageToSend.from,
                to: messageToSend.to,
                cc: messageToSend.cc,
                bcc: messageToSend.bcc,
                subject: messageToSend.subject
              },
              error: err.stack
            }
          });
        } catch (error) {
          // For Unit Tests only: Tenant is deleted and email is not know thus this Logging statement is always failing with an invalid Tenant
        }
      } else {
        // Email sent successfully
        Logging.logInfo({
          tenantID: tenantID,
          source: (data.hasOwnProperty("chargingBoxID") ? data.chargingBoxID : undefined),
          module: "EMailNotificationTask", method: "_prepareAndSendEmail",
          action: "SendEmail", actionOnUser: data.user,
          message: `Email has been sent successfully`,
          detailedMessages: {
            email: {
              from: messageToSend.from,
              to: messageToSend.to,
              cc: messageToSend.cc,
              bcc: messageToSend.bcc,
              subject: messageToSend.subject
            }
          }
        });
        // Return
        return messageSent;
      }
    });
  }
}

module.exports = EMailNotificationTask;
