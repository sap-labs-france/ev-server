import ejs from 'ejs';
import email from 'emailjs';
import fs from 'fs';
import BackendError from '../../exception/BackendError';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';
import User from '../../types/User';
import { ForgetChargeNotification, UserInactivityLimitReachedNotification, ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, NewRegisteredUserNotification, OCPIPatchChargingStationsStatusesErrorNotification, OptimalChargeReachedNotification, RequestPasswordNotification, SmtpAuthErrorNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountStatusChangedNotification, VerificationEmailNotification } from '../../types/UserNotifications';
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

  public sendNewRegisteredUser(data: NewRegisteredUserNotification, user: User, tenantID: string): Promise<void> {
    return this.prepareAndSendEmail('new-registered-user', data, user, tenantID);
  }

  public sendRequestPassword(data: RequestPasswordNotification, user: User, tenantID: string): Promise<void> {
    return this.prepareAndSendEmail('request-password', data, user, tenantID);
  }

  public sendOptimalChargeReached(data: OptimalChargeReachedNotification, user: User, tenantID: string): Promise<void> {
    return this.prepareAndSendEmail('optimal-charge-reached', data, user, tenantID);
  }

  public sendEndOfCharge(data: EndOfChargeNotification, user: User, tenantID: string): Promise<void> {
    return this.prepareAndSendEmail('end-of-charge', data, user, tenantID);
  }

  public sendEndOfSession(data: EndOfSessionNotification, user: User, tenantID: string): Promise<void> {
    return this.prepareAndSendEmail('end-of-session', data, user, tenantID);
  }

  public sendEndOfSignedSession(data: EndOfSignedSessionNotification, user: User, tenantID: string): Promise<void> {
    return this.prepareAndSendEmail('end-of-signed-session', data, user, tenantID);
  }

  public sendChargingStationStatusError(data: ChargingStationStatusErrorNotification, user: User, tenantID: string): Promise<void> {
    return this.prepareAndSendEmail('charging-station-status-error', data, user, tenantID);
  }

  public sendChargingStationRegistered(data: ChargingStationRegisteredNotification, user: User, tenantID: string): Promise<void> {
    return this.prepareAndSendEmail('charging-station-registered', data, user, tenantID);
  }

  public sendUserAccountStatusChanged(data: UserAccountStatusChangedNotification, user: User, tenantID: string): Promise<void> {
    return this.prepareAndSendEmail('user-account-status-changed', data, user, tenantID);
  }

  public sendUnknownUserBadged(data: UnknownUserBadgedNotification, user: User, tenantID: string): Promise<void> {
    return this.prepareAndSendEmail('unknown-user-badged', data, user, tenantID);
  }

  public sendSessionStarted(data: TransactionStartedNotification, user: User, tenantID: string): Promise<void> {
    return this.prepareAndSendEmail('session-started', data, user, tenantID);
  }

  public sendVerificationEmail(data: VerificationEmailNotification, user: User, tenantID: string): Promise<void> {
    return this.prepareAndSendEmail('verification-email', data, user, tenantID);
  }

  public sendSmtpAuthError(data: SmtpAuthErrorNotification, user: User, tenantID: string): Promise<void> {
    return this.prepareAndSendEmail('smtp-auth-error', data, user, tenantID, true);
  }

  public sendOCPIPatchChargingStationsStatusesError(data: OCPIPatchChargingStationsStatusesErrorNotification,
      user: User, tenantID: string): Promise<void> {
    return this.prepareAndSendEmail('ocpi-patch-status-error', data, user, tenantID);
  }

  sendUserInactivityLimitReached(data: UserInactivityLimitReachedNotification, user: User, tenantID: string): Promise<void>  {
    return this.prepareAndSendEmail('inactive-user-email', data, user, tenantID);
  }

  sendForgetCharge(data: ForgetChargeNotification, user: User, tenantID: string): Promise<void>  {
    // Send it
    return this.prepareAndSendEmail('forget-charge-email', data, user, tenantID);
  }

  private async prepareAndSendEmail(templateName: string, data: any, user: User, tenantID: string, retry = false): Promise<void> {
    try {
      // Check locale
      if (!user.locale || !Constants.SUPPORTED_LOCALES.includes(user.locale)) {
        user.locale = Constants.DEFAULT_LOCALE;
      }
      // Check users
      if (!user) {
        // Error
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: 'EMailNotificationTask',
          method: 'prepareAndSendEmail',
          message: `No User is provided for '${templateName}'`
        });
      }
      // Check email
      if (!user.email) {
        // Error
        throw new BackendError({
          actionOnUser: user,
          source: Constants.CENTRAL_SERVER,
          module: 'EMailNotificationTask',
          method: 'prepareAndSendEmail',
          message: `No email is provided for User for '${templateName}'`
        });
      }
      // Create email
      const emailTemplate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/notification/email/${user.locale}/${templateName}.json`, 'utf8'));
      if (!emailTemplate) {
        // Error
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: 'EMailNotificationTask',
          method: 'prepareAndSendEmail',
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
      // Send the email
      await this.sendEmail({
        to: user.email,
        subject: subject,
        text: html,
        html: html
      }, data, tenantID, user, retry);
    } catch (error) {
      Logging.logError({
        tenantID: tenantID, source: (data.hasOwnProperty('chargeBoxID') ? data.chargeBoxID : undefined),
        module: 'EMailNotificationTask', method: 'prepareAndSendEmail',
        action: 'SendEmail',
        message: `Error in preparing email for user`,
        actionOnUser: user,
        detailedMessages: error
      });
    }
  }

  async sendEmail(email, data, tenantID: string, user: User, retry = false): Promise<void> {
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
            tenantID,
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
          return this.sendEmail(email, data, tenantID, user, true);
        }
      } else {
        // Email sent successfully
        Logging.logInfo({
          tenantID: tenantID,
          source: (data.hasOwnProperty('chargeBoxID') ? data.chargeBoxID : undefined),
          module: 'EMailNotificationTask', method: 'prepareAndSendEmail',
          action: (!retry ? 'SendEmail' : 'SendEmailBackup'),
          actionOnUser: data.user,
          message: `Email Sent: '${messageToSend.subject}'`,
          detailedMessages: [
            {
              email: {
                from: messageToSend.from,
                to: messageToSend.to,
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
