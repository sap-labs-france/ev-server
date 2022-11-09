/* eslint-disable max-len */
import { AccountVerificationNotification, AdminAccountVerificationNotification, BillingAccountActivationNotification, BillingAccountCreationLinkNotification, BillingInvoiceSynchronizationFailedNotification, BillingNewInvoiceNotification, BillingUserSynchronizationFailedNotification, CarCatalogSynchronizationFailedNotification, ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, ComputeAndApplyChargingProfilesFailedNotification, EmailNotificationMessage, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, EndUserErrorNotification, NewRegisteredUserNotification, NotificationResult, NotificationSeverity, OCPIPatchChargingStationsStatusesErrorNotification, OICPPatchChargingStationsErrorNotification, OICPPatchChargingStationsStatusesErrorNotification, OfflineChargingStationNotification, OptimalChargeReachedNotification, PreparingSessionNotStartedNotification, RequestPasswordNotification, SessionNotStartedNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountInactivityNotification, UserAccountStatusChangedNotification, UserCreatePassword, VerificationEmailNotification } from '../../types/UserNotifications';
import EmailComponentManager, { EmailComponent } from './EmailComponentManager';
import { Message, SMTPClient, SMTPError } from 'emailjs';

import BackendError from '../../exception/BackendError';
import BrandingConstants from '../../utils/BrandingConstants';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import EmailConfiguration from '../../types/configuration/EmailConfiguration';
import I18nManager from '../../utils/I18nManager';
import Logging from '../../utils/Logging';
import LoggingHelper from '../../utils/LoggingHelper';
import NotificationTask from '../NotificationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import User from '../../types/User';
import Utils from '../../utils/Utils';
import mjmlBuilder from './EmailMjmlBuilder';
import rfc2047 from 'rfc2047';

const MODULE_NAME = 'EMailNotificationTask';

export default class EMailNotificationTask implements NotificationTask {
  private emailConfig: EmailConfiguration = Configuration.getEmailConfig();
  private smtpMainClientInstance: SMTPClient;
  private smtpBackupClientInstance: SMTPClient;

  public constructor() {
    // Connect to the SMTP servers
    if (!Utils.isUndefined(this.emailConfig.smtp)) {
      this.smtpMainClientInstance = new SMTPClient({
        user: this.emailConfig.smtp.user,
        password: this.emailConfig.smtp.password,
        host: this.emailConfig.smtp.host,
        port: this.emailConfig.smtp.port,
        tls: this.emailConfig.smtp.requireTLS,
        ssl: this.emailConfig.smtp.secure
      });
    }
    if (!this.emailConfig.disableBackup && !Utils.isUndefined(this.emailConfig.smtpBackup)) {
      this.smtpBackupClientInstance = new SMTPClient({
        user: this.emailConfig.smtpBackup.user,
        password: this.emailConfig.smtpBackup.password,
        host: this.emailConfig.smtpBackup.host,
        port: this.emailConfig.smtpBackup.port,
        tls: this.emailConfig.smtpBackup.requireTLS,
        ssl: this.emailConfig.smtpBackup.secure
      });
    }
  }

  public async sendNewRegisteredUser(data: NewRegisteredUserNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardVerifyEmailURL;
    return await this.prepareAndSendEmail('new-registered-user', data, user, tenant, severity);
  }

  public async sendRequestPassword(data: RequestPasswordNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardResetPassURL;
    return await this.prepareAndSendEmail('request-password', data, user, tenant, severity);
  }

  public async sendOptimalChargeReached(data: OptimalChargeReachedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardChargingStationURL;
    const optionalComponents = [await EmailComponentManager.getComponent(EmailComponent.MJML_TABLE)];
    return await this.prepareAndSendEmail('optimal-charge-reached', data, user, tenant, severity, optionalComponents);
  }

  public async sendEndOfCharge(data: EndOfChargeNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardChargingStationURL;
    const optionalComponents = [await EmailComponentManager.getComponent(EmailComponent.MJML_TABLE)];
    return await this.prepareAndSendEmail('end-of-charge', data, user, tenant, severity, optionalComponents);
  }

  public async sendEndOfSession(data: EndOfSessionNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardChargingStationURL;
    const optionalComponents = [await EmailComponentManager.getComponent(EmailComponent.MJML_TABLE)];
    return await this.prepareAndSendEmail('end-of-session', data, user, tenant, severity, optionalComponents);
  }

  public async sendEndOfSignedSession(data: EndOfSignedSessionNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardChargingStationURL;
    const optionalComponents = [await EmailComponentManager.getComponent(EmailComponent.MJML_EICHRECHT_TABLE)];
    return await this.prepareAndSendEmail('end-of-signed-session', data, user, tenant, severity, optionalComponents);
  }

  public async sendChargingStationStatusError(data: ChargingStationStatusErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardChargingStationURL;
    return await this.prepareAndSendEmail('charging-station-status-error', data, user, tenant, severity);
  }

  public async sendChargingStationRegistered(data: ChargingStationRegisteredNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardChargingStationURL;
    return await this.prepareAndSendEmail('charging-station-registered', data, user, tenant, severity);
  }

  public async sendUserAccountStatusChanged(data: UserAccountStatusChangedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardURL;
    const i18nInstance = I18nManager.getInstanceForLocale(user.locale);
    const newStatus = data.user.status === 'A' ? 'activated' : 'suspended';
    data.accountStatus = i18nInstance.translate(`notifications.userAccountStatusChanged.${newStatus}`);
    return await this.prepareAndSendEmail('user-account-status-changed', data, user, tenant, severity);
  }

  public async sendUnknownUserBadged(data: UnknownUserBadgedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardURL;
    return await this.prepareAndSendEmail('unknown-user-badged', data, user, tenant, severity);
  }

  public async sendSessionStarted(data: TransactionStartedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardChargingStationURL;
    return await this.prepareAndSendEmail('session-started', data, user, tenant, severity);
  }

  public async sendVerificationEmail(data: VerificationEmailNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardVerifyEmailURL;
    return await this.prepareAndSendEmail('verification-email', data, user, tenant, severity);
  }

  public async sendVerificationEmailUserImport(data: VerificationEmailNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardVerifyEmailURL;
    return await this.prepareAndSendEmail('verification-email-user-import', data, user, tenant, severity);
  }

  public async sendOCPIPatchChargingStationsStatusesError(data: OCPIPatchChargingStationsStatusesErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardURL;
    return await this.prepareAndSendEmail('ocpi-patch-status-error', data, user, tenant, severity);
  }

  public async sendOICPPatchChargingStationsStatusesError(data: OICPPatchChargingStationsStatusesErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardURL;
    return await this.prepareAndSendEmail('oicp-patch-status-error', data, user, tenant, severity);
  }

  public async sendOICPPatchChargingStationsError(data: OICPPatchChargingStationsErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardURL;
    return await this.prepareAndSendEmail('oicp-patch-evses-error', data, user, tenant, severity);
  }

  public async sendUserAccountInactivity(data: UserAccountInactivityNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardURL;
    return await this.prepareAndSendEmail('user-account-inactivity', data, user, tenant, severity);
  }

  public async sendPreparingSessionNotStarted(data: PreparingSessionNotStartedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardChargingStationURL;
    return await this.prepareAndSendEmail('session-not-started', data, user, tenant, severity);
  }

  public async sendSessionNotStarted(data: SessionNotStartedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardChargingStationURL;
    return await this.prepareAndSendEmail('session-not-started-after-authorize', data, user, tenant, severity);
  }

  public async sendOfflineChargingStations(data: OfflineChargingStationNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // TODO - old stuff - to be removed asap
    data.chargeBoxIDs = data.chargingStationIDs.join(', ');
    // Populate the context to have a human-readable message
    data.nbChargingStationIDs = data.chargingStationIDs?.length || 0;
    // Show only the ten first charging stations
    data.tenFirstChargingStationIDs = data.chargingStationIDs.slice(0, 10).join(', ') + '...';
    data.buttonUrl = data.evseDashboardURL;
    return await this.prepareAndSendEmail('offline-charging-station', data, user, tenant, severity);
  }

  public async sendBillingSynchronizationFailed(data: BillingUserSynchronizationFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardBillingURL;
    return await this.prepareAndSendEmail('billing-user-synchronization-failed', data, user, tenant, severity);
  }

  public async sendBillingInvoiceSynchronizationFailed(data: BillingInvoiceSynchronizationFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardBillingURL;
    return await this.prepareAndSendEmail('billing-invoice-synchronization-failed', data, user, tenant, severity);
  }

  public async sendBillingPeriodicOperationFailed(data: BillingInvoiceSynchronizationFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardBillingURL;
    return await this.prepareAndSendEmail('billing-periodic-operation-failed', data, user, tenant, severity);
  }

  public async sendBillingAccountCreationLink(data: BillingAccountCreationLinkNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.onboardingLink;
    return await this.prepareAndSendEmail('billing-account-created', data, user, tenant, severity);
  }

  public async sendBillingAccountActivationNotification(data: BillingAccountActivationNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardURL;
    return await this.prepareAndSendEmail('billing-account-activated', data, user, tenant, severity);
  }

  public async sendBillingNewInvoice(data: BillingNewInvoiceNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    const optionalComponents = [await EmailComponentManager.getComponent(EmailComponent.MJML_TABLE)];
    let templateName: string;
    if (data.invoiceStatus === 'paid') {
      data.buttonUrl = data.invoiceDownloadUrl;
      templateName = 'billing-new-invoice-paid';
    } else {
      data.buttonUrl = data.payInvoiceUrl;
      templateName = 'billing-new-invoice-unpaid';
    }
    return await this.prepareAndSendEmail(templateName, data, user, tenant, severity, optionalComponents);
  }

  public async sendCarCatalogSynchronizationFailed(data: CarCatalogSynchronizationFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardURL;
    return await this.prepareAndSendEmail('car-synchronization-failed', data, user, tenant, severity);
  }

  public async sendComputeAndApplyChargingProfilesFailed(data: ComputeAndApplyChargingProfilesFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardURL;
    return await this.prepareAndSendEmail('compute-and-apply-charging-profiles-failed', data, user, tenant, severity);
  }

  public async sendEndUserErrorNotification(data: EndUserErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardURL;
    return await this.prepareAndSendEmail('end-user-error-notification', data, user, tenant, severity);
  }

  public async sendAccountVerificationNotification(data: AccountVerificationNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardURL;
    let templateName: string;
    if (data.userStatus === 'A') {
      templateName = 'account-verification-notification-active';
    } else {
      templateName = 'account-verification-notification-inactive';
    }
    return await this.prepareAndSendEmail(templateName, data, user, tenant, severity);
  }

  public async sendAdminAccountVerificationNotification(data: AdminAccountVerificationNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseUserToVerifyURL;
    data.email = data.user.email;
    return await this.prepareAndSendEmail('admin-account-verification-notification', data, user, tenant, severity);
  }

  public async sendUserCreatePassword(data: UserCreatePassword, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardCreatePasswordURL;
    return await this.prepareAndSendEmail('user-create-password', data, user, tenant, severity);
  }

  private async sendEmail(email: EmailNotificationMessage, data: any, tenant: Tenant, user: User, severity: NotificationSeverity, useSmtpClientBackup = false): Promise<void> {
    // Email configuration sanity checks
    if (!this.smtpMainClientInstance) {
      // No suitable main SMTP server configuration found to send the email
      await Logging.logError({
        tenantID: tenant.id,
        siteID: data?.siteID,
        siteAreaID: data?.siteAreaID,
        companyID: data?.companyID,
        chargingStationID: data?.chargeBoxID,
        action: ServerAction.EMAIL_NOTIFICATION,
        module: MODULE_NAME, method: 'sendEmail',
        message: 'No suitable main SMTP server configuration found to send email',
        actionOnUser: user
      });
      return;
    }
    if (useSmtpClientBackup && !this.smtpBackupClientInstance) {
      // No suitable backup SMTP server configuration found or activated to send the email
      await Logging.logError({
        tenantID: tenant.id,
        siteID: data?.siteID,
        siteAreaID: data?.siteAreaID,
        companyID: data?.companyID,
        chargingStationID: data?.chargeBoxID,
        action: ServerAction.EMAIL_NOTIFICATION,
        module: MODULE_NAME, method: 'sendEmail',
        message: 'No suitable backup SMTP server configuration found or activated to send email after an error on the main SMTP server',
        actionOnUser: user
      });
      return;
    }
    // Create the message
    const messageToSend = new Message({
      from: !this.emailConfig.disableBackup && !Utils.isUndefined(this.emailConfig.smtpBackup) && useSmtpClientBackup ?
        this.emailConfig.smtpBackup.from : this.emailConfig.smtp.from,
      to: email.to,
      cc: email.cc,
      bcc: email.bccNeeded && email.bcc ? email.bcc : '',
      subject: email.subject,
      attachment: [
        { data: email.html, alternative: true }
      ]
    });
    if (Utils.isDevelopmentEnv()) {
      // Do not send mail in Dev mode
      await Logging.logDebug({
        tenantID: tenant.id ? tenant.id : Constants.DEFAULT_TENANT_ID,
        action: ServerAction.EMAIL_NOTIFICATION,
        module: MODULE_NAME, method: 'sendEmail',
        actionOnUser: user,
        message: `Email Sent: '${email.subject}'`,
        detailedMessages: {
          content: email.html // Only log the email content when running automated tests
        }
      });
      if (!this.emailConfig.troubleshootingMode) {
        // Do not send emails when in dev mode or while running automated tests
        return ;
      }
    }
    try {
      // Get the SMTP client
      const smtpClient = this.getSMTPClient(useSmtpClientBackup);
      // Send the message
      const messageSent: Message = await smtpClient.sendAsync(messageToSend);
      // Email sent successfully
      await Logging.logDebug({
        tenantID: tenant.id ? tenant.id : Constants.DEFAULT_TENANT_ID,
        siteID: data?.siteID,
        siteAreaID: data?.siteAreaID,
        companyID: data?.companyID,
        chargingStationID: data?.chargeBoxID,
        action: ServerAction.EMAIL_NOTIFICATION,
        module: MODULE_NAME, method: 'sendEmail',
        actionOnUser: user,
        message: `Email Sent: '${rfc2047.decode(messageSent.header.subject)}'`,
        detailedMessages: {
          from: rfc2047.decode(messageSent.header.from.toString()),
          to: rfc2047.decode(messageSent.header.to.toString()),
          subject: rfc2047.decode(messageSent.header.subject),
        }
      });
    } catch (error) {
      await Logging.logError({
        tenantID: tenant.id ? tenant.id : Constants.DEFAULT_TENANT_ID,
        siteID: data?.siteID,
        siteAreaID: data?.siteAreaID,
        companyID: data?.companyID,
        chargingStationID: data?.chargeBoxID,
        action: ServerAction.EMAIL_NOTIFICATION,
        module: MODULE_NAME, method: 'sendEmail',
        message: `Error Sending Email (${rfc2047.decode(messageToSend.header.from.toString())}): '${rfc2047.decode(messageToSend.header.subject)}'`,
        actionOnUser: user,
        detailedMessages: {
          from: rfc2047.decode(messageToSend.header.from.toString()),
          to: rfc2047.decode(messageToSend.header.to.toString()),
          subject: rfc2047.decode(messageToSend.header.subject),
          smtpError: error.smtp,
          error: error.stack,
        }
      });
      // Second try
      let smtpFailed = true;
      if (error instanceof SMTPError) {
        const err: SMTPError = error;
        switch (err.smtp) {
          case 421:
          case 432:
          case 450:
          case 451:
          case 452:
          case 454:
          case 455:
          case 510:
          case 511:
          case 550:
            smtpFailed = false;
            break;
        }
      }
      // Use email backup?
      if (smtpFailed && !useSmtpClientBackup) {
        await this.sendEmail(email, data, tenant, user, severity, true);
      }
    }
  }

  private async sendSmartEmail(prefix: string, context: Record<string, unknown>, recipient: User, tenant: Tenant, severity: NotificationSeverity, optionalComponents: string[] = []): Promise<EmailNotificationMessage> {
    // Select the i18n source according to the recipient locale
    const i18nInstance = I18nManager.getInstanceForLocale(recipient.locale);
    // Aggregate the templates
    const template = (await mjmlBuilder.initialize())
      .addToBody(await EmailComponentManager.getComponent(EmailComponent.MJML_TITLE))
      .addToBody(await EmailComponentManager.getComponent(EmailComponent.MJML_MAIN_MESSAGE))
      .addToBody(optionalComponents.join())
      .addToBody(await EmailComponentManager.getComponent(EmailComponent.MJML_MAIN_ACTION))
      .buildTemplate();
    template.resolve(i18nInstance, context, prefix);
    // if (Utils.isDevelopmentEnv()) {
    //   fs.writeFileSync('./troubleshoot-email-framework.txt', template.getTemplate(), 'utf-8');
    // }
    const html = template.getHtml();
    const title = i18nInstance.translate(`email.${prefix}.title`, context);
    const emailContent: EmailNotificationMessage = {
      to: recipient.email,
      subject: `e-Mobility - ${tenant.name} - ${title}`,
      html: html
    };
    // We may have a fallback - Not used anymore
    const useSmtpClientFallback = false;
    // Send the email
    await this.sendEmail(emailContent, context, tenant, recipient, severity, useSmtpClientFallback);
    return emailContent;
  }

  private async prepareAndSendEmail(templateName: string, sourceData: any, recipient: User, tenant: Tenant, severity: NotificationSeverity, optionalComponents?: string[]): Promise<NotificationResult> {
    let startTime: number;
    let emailContent: EmailNotificationMessage;
    try {
      startTime = Logging.traceNotificationStart();
      if (!recipient) {
        throw new BackendError({
          action: ServerAction.EMAIL_NOTIFICATION,
          module: MODULE_NAME, method: 'prepareAndSendEmail',
          message: `No User is provided for '${templateName}'`
        });
      }
      if (!recipient.email) {
        throw new BackendError({
          actionOnUser: recipient,
          action: ServerAction.EMAIL_NOTIFICATION,
          module: MODULE_NAME, method: 'prepareAndSendEmail',
          message: `No email is provided for User for '${templateName}'`
        });
      }
      // Enrich the sourceData with constant values
      this.enrichSourceData(tenant, sourceData);
      // Build the context with recipient data
      const context: Record<string, unknown> = this.populateNotificationContext(tenant, recipient, sourceData);
      // Send the email
      emailContent = await this.sendSmartEmail(templateName, context, recipient, tenant, severity, optionalComponents);
      return {
        html: emailContent.html,
      };
    } catch (error) {
      await Logging.logError({
        tenantID: tenant.id,
        ...LoggingHelper.getSourceDataProperties(sourceData),
        action: ServerAction.EMAIL_NOTIFICATION,
        module: MODULE_NAME, method: 'prepareAndSendEmail',
        message: 'Error in preparing email for user',
        actionOnUser: recipient,
        detailedMessages: { error: error.stack }
      });
      return {
        error,
      };
    } finally {
      await Logging.traceNotificationEnd(tenant, MODULE_NAME, 'prepareAndSendEmail', startTime, templateName, emailContent, recipient.id);
    }
  }

  private enrichSourceData(tenant: Tenant, sourceData: any): void {
    // Branding Information
    sourceData.openEmobilityWebSiteURL = BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL;
    // Tenant information
    if (tenant.id === Constants.DEFAULT_TENANT_ID) {
      sourceData.tenantName = 'Open e-Mobility'; // TBC - Not sure what to show in emails in that case
    } else {
      sourceData.tenantName = tenant.name;
    }
    // Tenant logo URL
    sourceData.tenantLogoURL = Utils.buildRestServerTenantEmailLogoURL(tenant.id);
    if (this.emailConfig.troubleshootingMode && sourceData.tenantLogoURL.startsWith('http://localhost')) {
      // Dev and test only - for security reasons te browser blocks content from localhost in emails!
      sourceData.tenantLogoURL = BrandingConstants.OPEN_EMOBILITY_WEBSITE_LOGO_URL;
    }
  }

  private populateNotificationContext(tenant: Tenant, recipient: User, sourceData: any): any {
    return {
      ...sourceData, // Do not alter the original sourceData object (the caller nay need to reuse the initial values)
      // Recipient
      recipientName: recipient.firstName || recipient.name,
      recipientEmail: recipient.email,
    };
  }

  private getSMTPClient(useSmtpClientBackup: boolean): SMTPClient {
    if (useSmtpClientBackup) {
      return this.smtpBackupClientInstance;
    }
    return this.smtpMainClientInstance;
  }
}
