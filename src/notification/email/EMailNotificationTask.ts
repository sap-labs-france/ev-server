import ejs from 'ejs';
import email from 'emailjs';
import fs from 'fs';
import BackendError from '../../exception/BackendError';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import NotificationTask from '../NotificationTask';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';


// Email
const _emailConfig = Configuration.getEmailConfig();

export default class EMailNotificationTask extends NotificationTask {
  public server: any;
  public serverBackup: any;

  constructor() {
    super();
    // Connect the SMTP server
    this.server = email.server.connect({
      user: _emailConfig.smtp.user,
      password: _emailConfig.smtp.password,
      host: _emailConfig.smtp.host,
      port: _emailConfig.smtp.port,
      tls: _emailConfig.smtp.requireTLS,
      ssl: _emailConfig.smtp.secure
    });
    // Connect the SMTP Backup server
    if (_emailConfig.smtpBackup) {
      this.serverBackup = email.server.connect({
        user: _emailConfig.smtpBackup.user,
        password: _emailConfig.smtpBackup.password,
        host: _emailConfig.smtpBackup.host,
        port: _emailConfig.smtpBackup.port,
        tls: _emailConfig.smtpBackup.requireTLS,
        ssl: _emailConfig.smtpBackup.secure
      });
    }
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

  sendEndOfSignedSession(data, locale, tenantID) {
    return this._prepareAndSendEmail('end-of-signed-session', data, locale, tenantID);
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
    // Check locale
    if (!locale) {
      // Default
      locale = Constants.DEFAULT_LOCALE;
    }
    // Check users
    if (!data.user && !data.users && !data.adminUsers) {
      // Error
      throw new BackendError(null, `No User is provided for '${templateName}'`,
        'EMailNotificationTask', '_prepareAndSendEmail');
    }
    // Create email
    const emailTemplate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/notification/email/${locale}/${templateName}.json`, 'utf8'));
    // Template found?
    if (!emailTemplate) {
      // Error
      throw new BackendError(null, `No Email template found for '${templateName}'`,
        'EMailNotificationTask', '_prepareAndSendEmail');
    }

    // Render the localized template ---------------------------------------
    // Render the subject
    emailTemplate.subject = ejs.render(emailTemplate.subject, data);
    // Render the tenant name
    if (tenantID !== Constants.DEFAULT_TENANT) {
      const tenant = await TenantStorage.getTenant(tenantID);
      emailTemplate.tenant = tenant.name;
    } else {
      emailTemplate.tenant = Constants.DEFAULT_TENANT;
    }
    // Render Base URL
    emailTemplate.baseURL = ejs.render(emailTemplate.baseURL, data);
    emailTemplate.body.template = templateName;
    if (emailTemplate.body.header) {
      // Render the title
      emailTemplate.body.header.title = ejs.render(emailTemplate.body.header.title, data);
      // Charge Angels Logo
      emailTemplate.body.header.image.left.url = ejs.render(emailTemplate.body.header.image.left.url, data);
      // Company Logo
      emailTemplate.body.header.image.right.url = ejs.render(emailTemplate.body.header.image.right.url, data);
    }
    if (emailTemplate.body.beforeActionLines) {
      // Render Lines Before Action
      emailTemplate.body.beforeActionLines =
        emailTemplate.body.beforeActionLines.map((beforeActionLine) => ejs.render(beforeActionLine, data));
      // Remove extra empty lines
      Utils.removeExtraEmptyLines(emailTemplate.body.beforeActionLines);
    }
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
    if (emailTemplate.body.afterActionLines) {
      // Render Lines After Action
      emailTemplate.body.afterActionLines =
        emailTemplate.body.afterActionLines.map((afterActionLine) => ejs.render(afterActionLine, data));
      // Remove extra empty lines
      Utils.removeExtraEmptyLines(emailTemplate.body.afterActionLines);
    }
    if (emailTemplate.body.startSignedData && emailTemplate.body.endSignedData) {
      emailTemplate.body.startSignedData = ejs.render(emailTemplate.body.startSignedData, data);
      emailTemplate.body.endSignedData = ejs.render(emailTemplate.body.endSignedData, data);
      emailTemplate.body.startSignedData = emailTemplate.body.startSignedData
        .replace(/</g, '&amp;lt;')
        .replace(/>/g, '&amp;gt;')
        .replace(/encoding="base64"/g, '<br> encoding="base64"')
        .replace(/\\/g, '');
      emailTemplate.body.endSignedData = emailTemplate.body.endSignedData
        .replace(/</g, '&amp;lt;')
        .replace(/>/g, '&amp;gt;')
        .replace(/encoding="base64"/g, '<br> encoding="base64"')
        .replace(/\\/g, '');
    }
    if (emailTemplate.body.transactionId) {
      emailTemplate.body.transactionId = ejs.render(emailTemplate.body.transactionId, data);
    }
    // Render the final HTML -----------------------------------------------
    const subject = ejs.render(fs.readFileSync(`${global.appRoot}/assets/server/notification/email/subject.template`, 'utf8'), emailTemplate);
    let htmlTemp;
    if (templateName === 'end-of-signed-session') {
      htmlTemp = ejs.render(fs.readFileSync(`${global.appRoot}/assets/server/notification/email/body-signed-transaction.template`, 'utf8'), emailTemplate);
    } else {
      htmlTemp = ejs.render(fs.readFileSync(`${global.appRoot}/assets/server/notification/email/body-html.template`, 'utf8'), emailTemplate);
    }
    const html = htmlTemp;
    // Add Admins in BCC from Configuration
    let adminEmails = null;
    if (data.adminUsers && data.adminUsers.length > 0) {
      // Add Admins
      adminEmails = data.adminUsers.map((adminUser) => adminUser.email).join(';');
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

  async sendEmail(email, data, tenantID, retry = false) {
    // Create the message
    const messageToSend = {
      from: (!retry ? _emailConfig.smtp.from : _emailConfig.smtpBackup.from),
      to: email.to,
      cc: email.cc,
      bcc: email.bcc,
      subject: email.subject,
      // pragma text: email.text,
      attachment: [
        { data: email.html, alternative: true }
      ]
    };
    // Send the message and get a callback with an error or details of the message that was sent
    return this[!retry ? 'server' : 'serverBackup'].send(messageToSend, (err, messageSent) => {
      if (err) {
        // Log
        try {
          Logging.logError({
            tenantID: tenantID, source: (data.hasOwnProperty('chargeBoxID') ? data.chargeBoxID : undefined),
            module: 'EMailNotificationTask', method: 'sendEmail',
            action: (!retry ? 'SendEmail' : 'SendEmailBackup'), message: err.toString(),
            detailedMessages: {
              email: {
                from: messageToSend.from,
                to: messageToSend.to,
                cc: messageToSend.cc,
                subject: messageToSend.subject
              },
              error: err.stack
            }
          });
        // For Unit Tests only: Tenant is deleted and email is not known thus this Logging statement is always failing with an invalid Tenant
        } catch (error) {
        }
        // Retry?
        if (!retry && this.serverBackup) {
          return this.sendEmail(email, data, tenantID, true);
        }
      } else {
        // Email sent successfully
        Logging.logInfo({
          tenantID: tenantID,
          source: (data.hasOwnProperty('chargeBoxID') ? data.chargeBoxID : undefined),
          module: 'EMailNotificationTask', method: '_prepareAndSendEmail',
          action: (!retry ? 'SendEmail' : 'SendEmailBackup'), actionOnUser: data.user,
          message: 'Email has been sent successfully',
          detailedMessages: {
            email: {
              from: messageToSend.from,
              to: messageToSend.to,
              cc: messageToSend.cc,
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
