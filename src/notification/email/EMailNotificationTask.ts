import ejs from 'ejs';
import email from 'emailjs';
import fs from 'fs';
import BackendError from '../../exception/BackendError';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';
import { UserInactivityLimitReachedNotification, ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, NewRegisteredUserNotification, OCPIPatchChargingStationsStatusesErrorNotification, OptimalChargeReachedNotification, RequestPasswordNotification, SmtpAuthErrorNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountStatusChangedNotification, VerificationEmailNotification } from '../../types/UserNotifications';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import NotificationHandler from '../NotificationHandler';
import NotificationTask from '../NotificationTask';

export default class EMailNotificationTask implements NotificationTask {
  private server: any;
  private serverBackup: any;
  private emailConfig = Configuration.getEmailConfig();

  constructor() {
    // Connect the SMTP server
    this.server = email.server.connect({
      user: this.emailConfig.smtp.user,
      password: this.emailConfig.smtp.password,
      host: this.emailConfig.smtp.host,
      port: this.emailConfig.smtp.port,
      tls: this.emailConfig.smtp.requireTLS,
      ssl: this.emailConfig.smtp.secure
    });
    // Connect the SMTP Backup server
    if (this.emailConfig.smtpBackup) {
      this.serverBackup = email.server.connect({
        user: this.emailConfig.smtpBackup.user,
        password: this.emailConfig.smtpBackup.password,
        host: this.emailConfig.smtpBackup.host,
        port: this.emailConfig.smtpBackup.port,
        tls: this.emailConfig.smtpBackup.requireTLS,
        ssl: this.emailConfig.smtpBackup.secure
      });
    }
  }

  sendNewRegisteredUser(data: NewRegisteredUserNotification, locale: string, tenantID: string): Promise<void> {
    return this._prepareAndSendEmail('new-registered-user', data, locale, tenantID);
  }

  sendRequestPassword(data: RequestPasswordNotification, locale: string, tenantID: string): Promise<void> {
    return this._prepareAndSendEmail('request-password', data, locale, tenantID);
  }

  sendOptimalChargeReached(data: OptimalChargeReachedNotification, locale: string, tenantID: string): Promise<void> {
    return this._prepareAndSendEmail('optimal-charge-reached', data, locale, tenantID);
  }

  sendEndOfCharge(data: EndOfChargeNotification, locale: string, tenantID: string): Promise<void> {
    return this._prepareAndSendEmail('end-of-charge', data, locale, tenantID);
  }

  sendEndOfSession(data: EndOfSessionNotification, locale: string, tenantID: string): Promise<void> {
    return this._prepareAndSendEmail('end-of-session', data, locale, tenantID);
  }

  sendEndOfSignedSession(data: EndOfSignedSessionNotification, locale: string, tenantID: string): Promise<void> {
    return this._prepareAndSendEmail('end-of-signed-session', data, locale, tenantID);
  }

  sendChargingStationStatusError(data: ChargingStationStatusErrorNotification, locale: string, tenantID: string): Promise<void> {
    return this._prepareAndSendEmail('charging-station-status-error', data, locale, tenantID);
  }

  sendChargingStationRegistered(data: ChargingStationRegisteredNotification, locale: string, tenantID: string): Promise<void> {
    return this._prepareAndSendEmail('charging-station-registered', data, locale, tenantID);
  }

  sendUserAccountStatusChanged(data: UserAccountStatusChangedNotification, locale: string, tenantID: string): Promise<void> {
    return this._prepareAndSendEmail('user-account-status-changed', data, locale, tenantID);
  }

  sendUnknownUserBadged(data: UnknownUserBadgedNotification, locale: string, tenantID: string): Promise<void> {
    return this._prepareAndSendEmail('unknown-user-badged', data, locale, tenantID);
  }

  sendSessionStarted(data: TransactionStartedNotification, locale: string, tenantID: string): Promise<void> {
    return this._prepareAndSendEmail('session-started', data, locale, tenantID);
  }

  sendVerificationEmail(data: VerificationEmailNotification, locale: string, tenantID: string): Promise<void> {
    return this._prepareAndSendEmail('verification-email', data, locale, tenantID);
  }

  sendSmtpAuthError(data: SmtpAuthErrorNotification, locale: string, tenantID: string): Promise<void> {
    return this._prepareAndSendEmail('smtp-auth-error', data, locale, tenantID, true);
  }

  sendOCPIPatchChargingStationsStatusesError(data: OCPIPatchChargingStationsStatusesErrorNotification, locale: string, tenantID: string): Promise<void> {
  return this._prepareAndSendEmail('ocpi-patch-status-error', data, locale, tenantID);
  }

  sendUserInactivityLimitReached(data: UserInactivityLimitReachedNotification, locale: string, tenantID: string) {
    // Send it
    return this._prepareAndSendEmail('inactive-user-email', data, locale, tenantID);
  }

  async _prepareAndSendEmail(templateName: string, data: any, locale: string, tenantID: string, retry: boolean = false): Promise<void> {
    // Check locale
    if (!locale || !Constants.SUPPORTED_LOCALES.includes(locale)) {
      locale = Constants.DEFAULT_LOCALE;
    }
    // Check users
    if (!data.user && !data.users && !data.adminUsers) {
      // Error
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'EMailNotificationTask',
        method: '_prepareAndSendEmail',
        message: `No User is provided for '${templateName}'`
      });
    }
    // Create email
    const emailTemplate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/notification/email/${locale}/${templateName}.json`, 'utf8'));
    if (!emailTemplate) {
      // Error
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'EMailNotificationTask',
        method: '_prepareAndSendEmail',
        message: `No Email template found for '${templateName}'`
      });
    }

    // Render the localized template ---------------------------------------
    // Render the subject
    emailTemplate.subject = ejs.render(emailTemplate.subject, data);
    // Render the tenant name
    if (data.tenant) {
      emailTemplate.tenant = data.tenant;
    } else if (tenantID !== Constants.DEFAULT_TENANT) {
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
    // Filter out the notifications that don't need bcc to admins
    const emailTo = this.getUserEmailsFromData(data);
    // Send the email
    await this.sendEmail({
      to: emailTo ? emailTo : adminEmails,
      bcc: emailTo ? adminEmails : null,
      subject: subject,
      text: html,
      html: html
    }, data, tenantID, locale, retry);
  }

  getUserEmailsFromData(data): string {
    // Check if user is provided
    if (data.user) {
      // Return one email
      return (data.user ? data.user.email : null);
    } else if (data.users) {
      // Return a list of emails
      return data.users.map((user) => user.email).join(',');
    }
    return null;
  }

  async sendEmail(email, data, tenantID: string, locale: string, retry: boolean = false): Promise<void> {
    // Create the message
    const messageToSend = {
      from: (!retry ? this.emailConfig.smtp.from : this.emailConfig.smtpBackup.from),
      to: email.to,
      cc: email.cc,
      bcc: (email.bccNeeded ? email.bcc : null),
      subject: email.subject,
      // pragma text: email.text
      attachment: [
        { data: email.html, alternative: true }
      ]
    };
    // Send the message and get a callback with an error or details of the message that was sent
    return this[!retry ? 'server' : 'serverBackup'].send(messageToSend, (err, messageSent) => {
      if (err) {
        // If authentifcation error in the primary email server then notify admins using the backup server
        if (!retry && this.serverBackup && err.code === 3 && err.previous.code === 2) {
          NotificationHandler.sendSmtpAuthError(
            tenantID, locale,
            {
              'evseDashboardURL': data.evseDashboardURL
            }
          );
        }
        // Log
        try {
          Logging.logError({
            tenantID: tenantID, source: (data.hasOwnProperty('chargeBoxID') ? data.chargeBoxID : undefined),
            module: 'EMailNotificationTask', method: 'sendEmail',
            action: (!retry ? 'SendEmail' : 'SendEmailBackup'),
            message: `Error Sending Email (${messageToSend.from}): '${messageToSend.subject}'`,
            actionOnUser: data.user,
            detailedMessages: [
              {
                email: {
                  from: messageToSend.from,
                  to: messageToSend.to,
                  cc: messageToSend.cc,
                  subject: messageToSend.subject
                },
              }, {
                error: err.stack
              }, {
                content: email.html
              }
            ]
          });
        // For Unit Tests only: Tenant is deleted and email is not known thus this Logging statement is always failing with an invalid Tenant
        } catch (error) {
        }
        // Retry?
        if (!retry && this.serverBackup) {
          return this.sendEmail(email, data, tenantID, locale, true);
        }
      } else {
        // Email sent successfully
        Logging.logInfo({
          tenantID: tenantID,
          source: (data.hasOwnProperty('chargeBoxID') ? data.chargeBoxID : undefined),
          module: 'EMailNotificationTask', method: '_prepareAndSendEmail',
          action: (!retry ? 'SendEmail' : 'SendEmailBackup'),
          actionOnUser: data.user,
          message: `Email Sent: '${messageToSend.subject}'`,
          detailedMessages: [
            {
              email: {
                from: messageToSend.from,
                to: messageToSend.to,
                cc: messageToSend.cc,
                subject: messageToSend.subject
              },
            }, {
              content: email.html
            }
          ]
        });
      }
    });
  }
}
