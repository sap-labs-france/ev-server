/* eslint-disable max-len */
import { AccountVerificationNotification, AdminAccountVerificationNotification, BaseNotification, BillingAccountActivationNotification, BillingAccountCreationLinkNotification, BillingInvoiceSynchronizationFailedNotification, BillingNewInvoiceNotification, BillingUserSynchronizationFailedNotification, CarCatalogSynchronizationFailedNotification, ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, ComputeAndApplyChargingProfilesFailedNotification, EmailNotificationMessage, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, EndUserErrorNotification, NewRegisteredUserNotification, NotificationResult, NotificationSeverity, OCPIPatchChargingStationsStatusesErrorNotification, OICPPatchChargingStationsErrorNotification, OICPPatchChargingStationsStatusesErrorNotification, OfflineChargingStationNotification, OptimalChargeReachedNotification, PreparingSessionNotStartedNotification, RequestPasswordNotification, SessionNotStartedNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountInactivityNotification, UserAccountStatusChangedNotification, UserCreatePassword, VerificationEmailNotification } from '../../types/UserNotifications';
import EmailComponentManager, { EmailComponent } from './email-component-manager/EmailComponentManager';
import FeatureToggles, { Feature } from '../../utils/FeatureToggles';
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
import TemplateManager from '../../utils/TemplateManager';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import User from '../../types/User';
import Utils from '../../utils/Utils';
import ejs from 'ejs';
import fs from 'fs';
import global from '../../types/GlobalType';
import mjmlBuilder from './mjml-builder/MjmlBuilder';
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
    const optionalComponents = [await EmailComponentManager.getComponent(EmailComponent.TABLE)];
    return await this.prepareAndSendEmail('optimal-charge-reached', data, user, tenant, severity, optionalComponents);
  }

  public async sendEndOfCharge(data: EndOfChargeNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardChargingStationURL;
    const optionalComponents = [await EmailComponentManager.getComponent(EmailComponent.TABLE)];
    return await this.prepareAndSendEmail('end-of-charge', data, user, tenant, severity, optionalComponents);
  }

  public async sendEndOfSession(data: EndOfSessionNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    data.buttonUrl = data.evseDashboardChargingStationURL;
    const optionalComponents = [await EmailComponentManager.getComponent(EmailComponent.TABLE)];
    return await this.prepareAndSendEmail('end-of-session', data, user, tenant, severity, optionalComponents);
  }

  public async sendEndOfSignedSession(data: EndOfSignedSessionNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // TBC - This one is confusing and inconsistent - Users are getting data in German only!
    return Promise.resolve(null);
    // data.buttonUrl = data.evseDashboardURL;
    // return await this.prepareAndSendEmail('end-of-signed-session', data, user, tenant, severity);
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
    data.accountStatus = data.user.status === 'A' ? 'activated' : 'suspended';
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
    data.chargeBoxIDs = data.chargingStationIDs.join(", ");
    // Populate the context to have a human-readable message
    data.nbChargingStationIDs = data.chargingStationIDs?.length || 0;
    // Show only the ten first charging stations
    data.tenFirstChargingStationIDs = data.chargingStationIDs.slice(0, 10).join(", ") + "...";
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
    const optionalComponents = [await EmailComponentManager.getComponent(EmailComponent.TABLE)];
    let templateName: string;
    if (FeatureToggles.isFeatureActive(Feature.NEW_EMAIL_TEMPLATES)) {
      if (data.invoiceStatus === 'paid') {
        data.buttonUrl = data.invoiceDownloadUrl;
        templateName = 'billing-new-invoice-paid';
      } else {
        data.buttonUrl = data.payInvoiceUrl;
        templateName = 'billing-new-invoice-unpaid';
      }
    } else {
      templateName = 'billing-new-invoice';
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
    if (FeatureToggles.isFeatureActive(Feature.NEW_EMAIL_TEMPLATES)) {
      if (data.userStatus === 'A') {
        templateName = 'account-verification-notification-active';
      } else {
        templateName = 'account-verification-notification-inactive';
      }
    } else {
      templateName = 'account-verification-notification';
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
    } else {
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
  }

  private async sendSmartEmail(prefix: string, context: any, recipient: User, tenant: Tenant, severity: NotificationSeverity, optionalComponents: string[] = []): Promise<EmailNotificationMessage> {
    // Select the i18n source according to the recipient locale
    const i18nInstance = I18nManager.getInstanceForLocale(recipient.locale);
    // Aggregate the templates
    const template = (await mjmlBuilder.initialize())
      .addToBody(await EmailComponentManager.getComponent(EmailComponent.TITLE))
      .addToBody(await EmailComponentManager.getComponent(EmailComponent.TEXT1))
      .addToBody(optionalComponents.join())
      .addToBody(await EmailComponentManager.getComponent(EmailComponent.BUTTON))
      .buildTemplate();
    template.resolve(i18nInstance, context, prefix);
    // if (Utils.isDevelopmentEnv()) {
    //   fs.writeFileSync('./troubleshoot-email-framework.txt', template.getTemplate(), 'utf-8');
    // }
    const html = template.getHtml();
    const title = i18nInstance.translate(`email.${prefix}.title`, context as Record<string, unknown>);
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
      //----------------------------------------------------------------------------------------------------------
      //  ACHTUNG - to not alter the original sourceData object (the caller nay need to reuse the initial values)
      //----------------------------------------------------------------------------------------------------------
      const context = await this.populateNotificationContext(tenant, recipient, sourceData);
      // Send the email
      if (FeatureToggles.isFeatureActive(Feature.NEW_EMAIL_TEMPLATES)) {
        emailContent = await this.sendSmartEmail(templateName, context, recipient, tenant, severity, optionalComponents);
      } else {
        emailContent = await this.sendLegacyEmail(templateName, context, recipient, tenant, severity);
      }
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

  private async populateNotificationContext(tenant: Tenant, recipient: User, sourceData: any): Promise<any> {
    return {
      ...sourceData,
      // Tenant
      tenantName: (tenant.id === Constants.DEFAULT_TENANT_ID) ? Constants.DEFAULT_TENANT_ID : tenant.name,
      // Recipient
      recipientName: recipient.firstName || recipient.name,
      recipientEmail: recipient.email,
      // Tenant LOGO
      tenantLogoURL: await this.getTenantLogo(tenant),
      // Branding
      openEMobilityPoweredByLogo: BrandingConstants.OPEN_EMOBILITY_POWERED_BY,
      openEmobilityWebSiteURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL
    };
  }

  private async getTenantLogo(tenant: Tenant): Promise<string> {
    if (tenant.id === Constants.DEFAULT_TENANT_ID) {
      return BrandingConstants.TENANT_DEFAULT_LOGO_CONTENT;
    } else if (!tenant.logo) {
      tenant.logo = (await TenantStorage.getTenantLogo(tenant))?.logo;
    }
    return tenant.logo || BrandingConstants.TENANT_DEFAULT_LOGO_CONTENT;
  }

  private async sendLegacyEmail(templateName: string, data: any, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<EmailNotificationMessage> {
    // Fetch the template
    const emailTemplate = await TemplateManager.getInstanceForLocale(user.locale).getTemplate(templateName);
    if (!emailTemplate) {
      throw new BackendError({
        action: ServerAction.EMAIL_NOTIFICATION,
        module: MODULE_NAME, method: 'prepareAndSendEmail',
        message: `No Email template found for '${templateName}'`
      });
    }
    // Render the subject
    emailTemplate.subject = ejs.render(emailTemplate.subject, data);
    // Render the tenant name
    if (tenant.id === Constants.DEFAULT_TENANT_ID) {
      emailTemplate.tenant = Constants.DEFAULT_TENANT_ID;
    } else {
      emailTemplate.tenant = tenant.name;
    }
    // Render Base URL
    emailTemplate.baseURL = ejs.render(emailTemplate.baseURL, data);
    emailTemplate.body.template = templateName;
    if (emailTemplate.body.header) {
      // Render the title
      emailTemplate.body.header.title = ejs.render(emailTemplate.body.header.title, data);
      // Render the left Logo
      emailTemplate.body.header.image.left.url = ejs.render(emailTemplate.body.header.image.left.url, data);
      // Render the right Logo
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
    // Render after Action
    if (emailTemplate.body.afterActionLines) {
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
    } else if (templateName === 'billing-new-invoice') {
      htmlTemp = ejs.render(fs.readFileSync(`${global.appRoot}/assets/server/notification/email/body-invoice.template`, 'utf8'), emailTemplate);
    } else {
      htmlTemp = ejs.render(fs.readFileSync(`${global.appRoot}/assets/server/notification/email/body-html.template`, 'utf8'), emailTemplate);
    }
    const html = htmlTemp;
    const emailContent: EmailNotificationMessage = {
      to: user.email,
      subject: subject,
      html: html
    };
    // We may have a fallback - Not used anymore
    const useSmtpClientFallback = false;
    // Send the email
    await this.sendEmail(emailContent, data, tenant, user, severity, useSmtpClientFallback);
    return emailContent;
  }

  private getSMTPClient(useSmtpClientBackup: boolean): SMTPClient {
    if (useSmtpClientBackup) {
      return this.smtpBackupClientInstance;
    }
    return this.smtpMainClientInstance;
  }
}
