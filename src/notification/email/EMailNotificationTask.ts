import { BillingInvoiceSynchronizationFailedNotification, BillingNewInvoiceNotification, BillingUserSynchronizationFailedNotification, CarCatalogSynchronizationFailedNotification, ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, ComputeAndApplyChargingProfilesFailedNotification, EmailNotificationMessage, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, EndUserErrorNotification, NewRegisteredUserNotification, NotificationSeverity, OCPIPatchChargingStationsStatusesErrorNotification, OfflineChargingStationNotification, OptimalChargeReachedNotification, PreparingSessionNotStartedNotification, RequestPasswordNotification, SessionNotStartedNotification, SmtpErrorNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountInactivityNotification, UserAccountStatusChangedNotification, VerificationEmailNotification } from '../../types/UserNotifications';
import { Message, SMTPClient, SMTPError } from 'emailjs';

import BackendError from '../../exception/BackendError';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import EmailConfiguration from '../../types/configuration/EmailConfiguration';
import Logging from '../../utils/Logging';
import NotificationHandler from '../NotificationHandler';
import NotificationTask from '../NotificationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import User from '../../types/User';
import Utils from '../../utils/Utils';
import ejs from 'ejs';
import fs from 'fs';
import global from '../../types/GlobalType';
import rfc2047 from 'rfc2047';

const MODULE_NAME = 'EMailNotificationTask';

export default class EMailNotificationTask implements NotificationTask {
  private static instance: EMailNotificationTask;
  private emailConfig: EmailConfiguration = Configuration.getEmailConfig();
  private SMTPMainClientInstance: SMTPClient;
  private SMTPBackupClientInstance: SMTPClient;
  private backupInUse: boolean;

  private constructor() {
    // Connect to the SMTP servers
    if (!Utils.isUndefined(this.emailConfig.smtp)) {
      this.SMTPMainClientInstance = new SMTPClient({
        user: this.emailConfig.smtp.user,
        password: this.emailConfig.smtp.password,
        host: this.emailConfig.smtp.host,
        port: this.emailConfig.smtp.port,
        tls: this.emailConfig.smtp.requireTLS,
        ssl: this.emailConfig.smtp.secure
      });
    }
    this.backupInUse = false;
  }

  public static getInstance(): EMailNotificationTask {
    if (!this.instance) {
      this.instance = new EMailNotificationTask();
    }
    return this.instance;
  }

  public async sendNewRegisteredUser(data: NewRegisteredUserNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('new-registered-user', data, user, tenant, severity);
  }

  public async sendRequestPassword(data: RequestPasswordNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('request-password', data, user, tenant, severity);
  }

  public async sendOptimalChargeReached(data: OptimalChargeReachedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('optimal-charge-reached', data, user, tenant, severity);
  }

  public async sendEndOfCharge(data: EndOfChargeNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('end-of-charge', data, user, tenant, severity);
  }

  public async sendEndOfSession(data: EndOfSessionNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('end-of-session', data, user, tenant, severity);
  }

  public async sendEndOfSignedSession(data: EndOfSignedSessionNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('end-of-signed-session', data, user, tenant, severity);
  }

  public async sendChargingStationStatusError(data: ChargingStationStatusErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('charging-station-status-error', data, user, tenant, severity);
  }

  public async sendChargingStationRegistered(data: ChargingStationRegisteredNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('charging-station-registered', data, user, tenant, severity);
  }

  public async sendUserAccountStatusChanged(data: UserAccountStatusChangedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('user-account-status-changed', data, user, tenant, severity);
  }

  public async sendUnknownUserBadged(data: UnknownUserBadgedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('unknown-user-badged', data, user, tenant, severity);
  }

  public async sendSessionStarted(data: TransactionStartedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('session-started', data, user, tenant, severity);
  }

  public async sendVerificationEmail(data: VerificationEmailNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('verification-email', data, user, tenant, severity);
  }

  public async sendSmtpError(data: SmtpErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('smtp-error', data, user, tenant, severity, true);
  }

  public async sendOCPIPatchChargingStationsStatusesError(data: OCPIPatchChargingStationsStatusesErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('ocpi-patch-status-error', data, user, tenant, severity);
  }

  public async sendUserAccountInactivity(data: UserAccountInactivityNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('user-account-inactivity', data, user, tenant, severity);
  }

  public async sendPreparingSessionNotStarted(data: PreparingSessionNotStartedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('session-not-started', data, user, tenant, severity);
  }

  public async sendSessionNotStarted(data: SessionNotStartedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('session-not-started-after-authorize', data, user, tenant, severity);
  }

  public async sendOfflineChargingStations(data: OfflineChargingStationNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('offline-charging-station', data, user, tenant, severity);
  }

  public async sendBillingSynchronizationFailed(data: BillingUserSynchronizationFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('billing-user-synchronization-failed', data, user, tenant, severity);
  }

  public async sendBillingInvoiceSynchronizationFailed(data: BillingInvoiceSynchronizationFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('billing-invoice-synchronization-failed', data, user, tenant, severity);
  }

  public async sendBillingNewInvoice(data: BillingNewInvoiceNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('billing-new-invoice', data, user, tenant, severity);
  }

  public async sendCarCatalogSynchronizationFailed(data: CarCatalogSynchronizationFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('car-synchronization-failed', data, user, tenant, severity);
  }

  public async sendComputeAndApplyChargingProfilesFailed(data: ComputeAndApplyChargingProfilesFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('compute-and-apply-charging-profiles-failed', data, user, tenant, severity);
  }

  public async sendEndUserErrorNotification(data: EndUserErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    return this.prepareAndSendEmail('end-user-error-notification', data, user, tenant, severity);
  }

  private async sendEmail(email: EmailNotificationMessage, data: any, tenant: Tenant, user: User, severity: NotificationSeverity, useBackup = false): Promise<void> {
    // Email configuration sanity checks
    if (!this.SMTPMainClientInstance) {
      // No suitable main SMTP server configuration found to send the email
      Logging.logError({
        tenantID: tenant.id,
        source: Utils.objectHasProperty(data, 'chargeBoxID') && data.chargeBoxID,
        action: ServerAction.EMAIL_NOTIFICATION,
        module: MODULE_NAME, method: 'sendEmail',
        message: 'No suitable main SMTP server configuration found to send email',
        actionOnUser: user
      });
      return;
    }
    // Toggle boolean attribute to switch SMTP server when necessary
    if (!useBackup && this.backupInUse) {
      this.backupInUse = useBackup;
    } else if (this.getSMTPBackupClientInstance() && useBackup && !this.backupInUse) {
      this.backupInUse = useBackup;
    }
    // Create the message
    const messageToSend = new Message({
      from: this.getSMTPBackupClientInstance() && useBackup ? this.emailConfig.smtpBackup.from : this.emailConfig.smtp.from,
      to: email.to,
      cc: email.cc,
      bcc: email.bccNeeded && email.bcc ? email.bcc : '',
      subject: email.subject,
      attachment: [
        { data: email.html, alternative: true }
      ]
    });
    try {
      // Send the message
      const messageSent: Message = await this.getSMTPClient().sendAsync(messageToSend);
      // Email sent successfully
      Logging.logDebug({
        tenantID: tenant.id ? tenant.id : Constants.DEFAULT_TENANT,
        source: Utils.objectHasProperty(data, 'chargeBoxID') && data.chargeBoxID,
        action: ServerAction.EMAIL_NOTIFICATION,
        module: MODULE_NAME, method: 'sendEmail',
        actionOnUser: user,
        message: `Email Sent: '${rfc2047.decode(messageSent.header.subject)}'`,
        detailedMessages: [
          {
            email: {
              from: rfc2047.decode(messageSent.header.from.toString()),
              to: rfc2047.decode(messageSent.header.to.toString()),
              subject: rfc2047.decode(messageSent.header.subject)
            },
          }, {
            content: email.html
          }
        ]
      });
    } catch (error) {
      // Log
      try {
        Logging.logError({
          tenantID: tenant.id ? tenant.id : Constants.DEFAULT_TENANT,
          source: Utils.objectHasProperty(data, 'chargeBoxID') && data.chargeBoxID,
          action: ServerAction.EMAIL_NOTIFICATION,
          module: MODULE_NAME, method: 'sendEmail',
          message: `Error Sending Email (${rfc2047.decode(messageToSend.header.from.toString())}): '${rfc2047.decode(messageToSend.header.subject)}'`,
          actionOnUser: user,
          detailedMessages: [
            {
              email: {
                from: rfc2047.decode(messageToSend.header.from.toString()),
                to: rfc2047.decode(messageToSend.header.to.toString()),
                subject: rfc2047.decode(messageToSend.header.subject)
              },
            }, {
              error: error.stack
            }, {
              content: email.html
            }
          ]
        });
      // For Unit Tests only: Tenant is deleted and email is not known thus this Logging statement is always failing with an invalid Tenant
      // eslint-disable-next-line no-empty
      } catch (err) { }
      let sendSmtpError = true;
      if (error instanceof SMTPError) {
        const err: SMTPError = error;
        switch (err.smtp) {
          // TODO: Add a fitting data structure to types to cope with SMTP returned codes
          case 510:
          case 511:
            sendSmtpError = false;
            break;
        }
      }
      // Notify on SMTP error
      if (sendSmtpError) {
        // TODO: Circular deps: src/notification/NotificationHandler.ts -> src/notification/email/EMailNotificationTask.ts -> src/notification/NotificationHandler.ts
        await NotificationHandler.sendSmtpError(
          tenant.id,
          {
            SMTPError: error,
            evseDashboardURL: data.evseDashboardURL
          }
        );
        if (this.getSMTPBackupClientInstance() && !useBackup) {
          await this.sendEmail(email, data, tenant, user, severity, true);
        } else {
          // No suitable backup SMTP server configuration found or activated to send the email
          Logging.logError({
            tenantID: tenant.id,
            source: Utils.objectHasProperty(data, 'chargeBoxID') && data.chargeBoxID,
            action: ServerAction.EMAIL_NOTIFICATION,
            module: MODULE_NAME, method: 'sendEmail',
            message: 'No suitable backup SMTP server configuration found or activated to send email after an error on the main SMTP server',
            actionOnUser: user
          });
        }
      }
    }
  }

  private async prepareAndSendEmail(templateName: string, data: any, user: User, tenant: Tenant, severity: NotificationSeverity, useBackup = false): Promise<void> {
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
          action: ServerAction.EMAIL_NOTIFICATION,
          module: MODULE_NAME, method: 'prepareAndSendEmail',
          message: `No User is provided for '${templateName}'`
        });
      }
      // Check email
      if (!user.email) {
        // Error
        throw new BackendError({
          actionOnUser: user,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.EMAIL_NOTIFICATION,
          module: MODULE_NAME, method: 'prepareAndSendEmail',
          message: `No email is provided for User for '${templateName}'`
        });
      }
      // Create email
      const emailTemplate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/notification/email/${user.locale}/${templateName}.json`, 'utf8'));
      if (!emailTemplate) {
        // Error
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.EMAIL_NOTIFICATION,
          module: MODULE_NAME, method: 'prepareAndSendEmail',
          message: `No Email template found for '${templateName}'`
        });
      }
      // Render the localized template ---------------------------------------
      // Render the subject
      emailTemplate.subject = ejs.render(emailTemplate.subject, data);
      // Render the tenant name
      if (tenant.id === Constants.DEFAULT_TENANT) {
        emailTemplate.tenant = Constants.DEFAULT_TENANT;
      } else {
        emailTemplate.tenant = tenant.name;
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
      if (emailTemplate.body.actions) {
        for (const action of emailTemplate.body.actions) {
          action.title = ejs.render(action.title, data);
          action.url = ejs.render(action.url, data);
        }
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
      let htmlTemp: string;
      if (templateName === 'end-of-signed-session') {
        htmlTemp = ejs.render(fs.readFileSync(`${global.appRoot}/assets/server/notification/email/body-signed-transaction.template`, 'utf8'), emailTemplate);
      } else {
        htmlTemp = ejs.render(fs.readFileSync(`${global.appRoot}/assets/server/notification/email/body-html.template`, 'utf8'), emailTemplate);
      }
      const html = htmlTemp;
      // Send the email
      await this.sendEmail({
        to: user.email,
        subject: subject,
        text: html,
        html: html
      }, data, tenant, user, severity, useBackup);
    } catch (error) {
      Logging.logError({
        tenantID: tenant.id,
        source: Utils.objectHasProperty(data, 'chargeBoxID') && data.chargeBoxID,
        action: ServerAction.EMAIL_NOTIFICATION,
        module: MODULE_NAME, method: 'prepareAndSendEmail',
        message: 'Error in preparing email for user',
        actionOnUser: user,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
  }

  private getSMTPClient(): SMTPClient {
    if (this.backupInUse) {
      return this.getSMTPBackupClientInstance();
    }
    return this.SMTPMainClientInstance;
  }

  private getSMTPBackupClientInstance(): SMTPClient {
    if (!this.emailConfig.disableBackup && !Utils.isUndefined(this.emailConfig.smtpBackup && !this.SMTPBackupClientInstance)) {
      this.SMTPBackupClientInstance = new SMTPClient({
        user: this.emailConfig.smtpBackup.user,
        password: this.emailConfig.smtpBackup.password,
        host: this.emailConfig.smtpBackup.host,
        port: this.emailConfig.smtpBackup.port,
        tls: this.emailConfig.smtpBackup.requireTLS,
        ssl: this.emailConfig.smtpBackup.secure
      });
    }
    return this.SMTPBackupClientInstance;
  }
}
