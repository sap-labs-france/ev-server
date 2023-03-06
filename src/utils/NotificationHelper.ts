/* eslint-disable @typescript-eslint/member-ordering */
import { ChargingStationRegisteredNotification, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, NotificationSeverity, NotificationSource, OptimalChargeReachedNotification, TransactionStartedNotification } from '../types/UserNotifications';
import User, { UserRole } from '../types/User';

import ChargingStation from '../types/ChargingStation';
import Configuration from './Configuration';
import Constants from './Constants';
import EMailNotificationTask from '../notification/email/EMailNotificationTask';
import I18nManager from './I18nManager';
import Logging from './Logging';
import RawNotificationStorage from '../storage/mongodb/RawNotificationStorage';
import RemotePushNotificationTask from '../notification/remote-push-notification/RemotePushNotificationTask';
import { ServerAction } from '../types/Server';
import Tenant from '../types/Tenant';
import Transaction from '../types/Transaction';
import UserStorage from '../storage/mongodb/UserStorage';
import Utils from './Utils';
import moment from 'moment';

// const MODULE_NAME = 'NotificationHelper';

export default class NotificationHelper {

  private static notificationConfig = Configuration.getNotificationConfig();
  protected tenant: Tenant;

  public constructor(tenant: Tenant) {
    this.tenant = tenant;
  }

  public static notifyStartTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, user: User) {
    if (user?.notificationsActive && user.notifications.sendSessionStarted) {
      setTimeout(() => {
        NotificationHelper.getSessionNotificationHelper(tenant, transaction, chargingStation, user).notifyStartTransaction();
      }, 500);
    }
  }

  public static notifyStopTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, user: User, alternateUser?: User) {
    if (user?.notificationsActive && user.notifications.sendEndOfSession) {
      setTimeout(() => {
        NotificationHelper.getSessionNotificationHelper(tenant, transaction, chargingStation, user).notifyStopTransaction(alternateUser);
      }, 500);
    }
  }

  public static notifyEndOfCharge(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, user: User) {
    if (user?.notificationsActive && user.notifications.sendEndOfCharge) {
      setTimeout(() => {
        NotificationHelper.getSessionNotificationHelper(tenant, transaction, chargingStation, user).notifyEndOfCharge();
      }, 500);
    }
  }

  public static notifyOptimalChargeReached(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, user: User) {
    if (user?.notificationsActive && user.notifications.sendOptimalChargeReached) {
      setTimeout(() => {
        NotificationHelper.getSessionNotificationHelper(tenant, transaction, chargingStation, user).notifyOptimalChargeReached();
      }, 500);
    }
  }

  public static sendChargingStationRegistered(tenant: Tenant, chargingStation: ChargingStation) {
    setTimeout(() => {
      NotificationHelper.getChargerNotificationHelper(tenant, chargingStation).notifyChargingStationRegistered();
    }, 500);
  }

  private static getSessionNotificationHelper(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, user: User): SessionNotificationHelper {
    return new SessionNotificationHelper(tenant, transaction, chargingStation, user);
  }

  private static getChargerNotificationHelper(tenant: Tenant, chargingStation: ChargingStation): ChargerNotificationHelper {
    return new ChargerNotificationHelper(tenant, chargingStation);
  }

  private static notificationChannels: NotificationSource[] = [
    {
      channel: 'email',
      notificationTask: new EMailNotificationTask(),
      enabled: !!NotificationHelper.notificationConfig.Email?.enabled
    },
    {
      channel: 'remote-push-notification',
      notificationTask: new RemotePushNotificationTask(),
      enabled: !!NotificationHelper.notificationConfig.RemotePushNotification?.enabled
    }
  ];

  public static notifySingleUser(doIt: (channel: NotificationSource) => void): void {
    for (const channel of NotificationHelper.notificationChannels.filter((_channel) => _channel.enabled)) {
      doIt(channel);
    }
  }

  public static notifyAdminUser(adminUser: User, doIt: (adminUser: User, channel: NotificationSource) => void): void {
    for (const channel of NotificationHelper.notificationChannels.filter((_channel) => _channel.enabled)) {
      doIt(adminUser, channel);
    }
  }

  protected notifyUserOnlyOnce(serverAction: ServerAction, discriminator: string, data: any, doIt: (channel: NotificationSource) => void): void {
    this.checkNotificationAlreadySent(serverAction, discriminator, data).then((done: boolean) => {
      if (!done) {
        NotificationHelper.notifySingleUser(doIt);
      }
    }).catch((error) => {
      Logging.logPromiseError(error, this.tenant?.id);
    });
  }

  private async checkNotificationAlreadySent(serverAction: ServerAction, discriminator: string, data: any): Promise<boolean> {
    let done = false ;
    try {
      // Get the Notification - the discriminator + serverAction should be unique!
      const notificationFound = await RawNotificationStorage.getRawNotification(
        this.tenant,
        {
          discriminator,
          serverAction
        }
      );
      if (notificationFound !== null) {
        done = true;
      } else {
        // Save it to prevent sending it again
        await RawNotificationStorage.saveRawNotification(this.tenant, {
          timestamp: new Date(),
          discriminator,
          serverAction,
          data
        });
      }
    } catch (error) {
      await Logging.logActionExceptionMessage(this.tenant.id, ServerAction.NOTIFICATION, error as Error);
    }
    return done;
  }

  protected notifyAllAdmins(notificationKey: string, doIt: (adminUser: User, channel: NotificationSource) => void): void {
    const tenantId = this.tenant.id;
    this._notifyAllAdmins(notificationKey, doIt).catch((error) => {
      Logging.logPromiseError(error, tenantId);
    });
  }

  protected async _notifyAllAdmins(notificationKey: string,doIt: (adminUser: User, channel: NotificationSource) => void) {
    const adminUsers = await ChargerNotificationHelper.getAdminUsers(this.tenant);
    const filteredAdmins = adminUsers.filter((adminUser) => adminUser.notifications[notificationKey] === true);
    filteredAdmins.forEach((adminUser) => {
      NotificationHelper.notifyAdminUser(adminUser, doIt);
    });
  }

  // eslint-disable-next-line @typescript-eslint/member-ordering
  protected static async getAdminUsers(tenant: Tenant): Promise<User[]> {
    // Get admin users
    // TODO - add here a cache
    const params = {
      roles: [ (tenant.id === Constants.DEFAULT_TENANT_ID) ? UserRole.SUPER_ADMIN : UserRole.ADMIN],
      notificationsActive: true,
    };
    const adminUsers = await UserStorage.getUsers(tenant, params, Constants.DB_PARAMS_MAX_LIMIT);
    // Found
    if (adminUsers.count > 0) {
      return adminUsers.result;
    }
    return [];
  }
}


export class ChargerNotificationHelper extends NotificationHelper {

  // TODO - rethink that part!
  // We should avoid keeping references to these big objects
  // Notification should be done by a dedicated services
  protected tenant: Tenant;
  protected chargingStation: ChargingStation;

  public constructor(tenant: Tenant, chargingStation: ChargingStation) {
    super(tenant);
    this.chargingStation = chargingStation;
  }

  public notifyChargingStationRegistered() {
    const tenant = this.tenant;
    const chargingStation = this.chargingStation;
    // Notification data - ACHTUNG - this data is common to all admin users
    const data: ChargingStationRegisteredNotification = {
      chargeBoxID: chargingStation.id,
      siteID: chargingStation.siteID,
      siteAreaID: chargingStation.siteAreaID,
      companyID: chargingStation.companyID,
      evseDashboardURL: Utils.buildEvseURL(tenant.subdomain),
      evseDashboardChargingStationURL: Utils.buildEvseChargingStationURL(tenant.subdomain, chargingStation, '#all'),
    };
    // Do it
    this.notifyAllAdmins('sendChargingStationRegistered', (adminUser: User, channel: NotificationSource) => {
      channel.notificationTask.sendChargingStationRegistered(data, adminUser, tenant, NotificationSeverity.INFO).catch((error) => {
        Logging.logPromiseError(error, tenant?.id);
      });
    });
  }

}

export class SessionNotificationHelper extends ChargerNotificationHelper {

  // TODO - rethink that part!
  // We should avoid keeping references to these big objects
  // Notification should be done by a dedicated services
  private transaction: Transaction;
  private user: User;

  public constructor(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, user: User) {
    super(tenant, chargingStation);
    this.transaction = transaction;
    this.user = user;
  }

  public notifyStartTransaction() {
    const tenant = this.tenant;
    const transaction = this.transaction;
    const chargingStation = this.chargingStation;
    const user = this.user;
    // Notification data
    const data: TransactionStartedNotification = {
      user,
      transactionId: transaction.id,
      chargeBoxID: chargingStation.id,
      siteID: chargingStation.siteID,
      siteAreaID: chargingStation.siteAreaID,
      companyID: chargingStation.companyID,
      connectorId: Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
      evseDashboardURL: Utils.buildEvseURL(tenant.subdomain),
      evseDashboardChargingStationURL: Utils.buildEvseTransactionURL(tenant.subdomain, transaction.id, '#inprogress')
    };
    // Do it
    NotificationHelper.notifySingleUser((channel: NotificationSource) => {
      channel.notificationTask.sendSessionStarted(data, user, tenant, NotificationSeverity.INFO).catch((error) => {
        Logging.logPromiseError(error, tenant?.id);
      });
    });
  }

  public notifyEndOfCharge() {
    const tenant = this.tenant;
    const transaction = this.transaction;
    const chargingStation = this.chargingStation;
    const user = this.user;
    // i18n
    const i18nManager = I18nManager.getInstanceForLocale(transaction.user.locale);
    // Notification data
    const data: EndOfChargeNotification = {
      user,
      transactionId: transaction.id,
      chargeBoxID: chargingStation.id,
      siteID: chargingStation.siteID,
      siteAreaID: chargingStation.siteAreaID,
      companyID: chargingStation.companyID,
      connectorId: Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
      totalConsumption: i18nManager.formatNumber(Math.round(transaction.currentTotalConsumptionWh / 10) / 100),
      stateOfCharge: transaction.currentStateOfCharge,
      totalDuration: Utils.transactionDurationToString(transaction),
      evseDashboardChargingStationURL: Utils.buildEvseTransactionURL(tenant.subdomain, transaction.id, '#inprogress'),
      evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
    };
    // Do it
    this.notifyUserOnlyOnce(ServerAction.END_OF_CHARGE,
      `tx-${transaction.id}`,
      {
        userID: user.id,
        transactionID: transaction.id,
        chargeBoxID: chargingStation.id,
      },
      (channel: NotificationSource) => {
        channel.notificationTask.sendEndOfCharge(data, user, tenant, NotificationSeverity.INFO).catch((error) => {
          Logging.logPromiseError(error, tenant?.id);
        });
      }
    );
  }

  public notifyOptimalChargeReached() {
    const tenant = this.tenant;
    const transaction = this.transaction;
    const chargingStation = this.chargingStation;
    const user = this.user;
    // i18n
    const i18nManager = I18nManager.getInstanceForLocale(transaction.user.locale);
    // Notification data
    const data: OptimalChargeReachedNotification = {
      user,
      chargeBoxID: chargingStation.id,
      siteID: chargingStation.siteID,
      siteAreaID: chargingStation.siteAreaID,
      companyID: chargingStation.companyID,
      transactionId: transaction.id,
      connectorId: Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
      totalConsumption: i18nManager.formatNumber(Math.round(transaction.currentTotalConsumptionWh / 10) / 100),
      stateOfCharge: transaction.currentStateOfCharge,
      evseDashboardChargingStationURL: Utils.buildEvseTransactionURL(tenant.subdomain, transaction.id, '#inprogress'),
      evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
    };
      // Do it
    this.notifyUserOnlyOnce(ServerAction.OPTIMAL_CHARGE_REACHED,
      `tx-${transaction.id}`,
      {
        userID: user.id,
        transactionID: transaction.id,
        chargeBoxID: chargingStation.id,
      },
      (channel: NotificationSource) => {
        channel.notificationTask.sendOptimalChargeReached(data, user, tenant, NotificationSeverity.INFO).catch((error) => {
          Logging.logPromiseError(error, tenant?.id);
        });
      }
    );
  }

  public notifyStopTransaction(alternateUser?: User) {
    const tenant = this.tenant;
    const transaction = this.transaction;
    const chargingStation = this.chargingStation;
    const user = this.user;
    // Get the i18n lib
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Notification Data
    const data: EndOfSessionNotification = {
      user,
      alternateUser: alternateUser || null,
      transactionId: transaction.id,
      chargeBoxID: chargingStation.id,
      siteID: chargingStation.siteID,
      siteAreaID: chargingStation.siteAreaID,
      companyID: chargingStation.companyID,
      connectorId: Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
      totalConsumption: i18nManager.formatNumber(Math.round(transaction.stop.totalConsumptionWh / 10) / 100),
      totalDuration: Utils.transactionDurationToString(transaction),
      totalInactivity: this.transactionInactivityToString(),
      stateOfCharge: transaction.stop.stateOfCharge,
      evseDashboardChargingStationURL: Utils.buildEvseTransactionURL(tenant.subdomain, transaction.id, '#history'),
      evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
    };
      // Do it
    this.notifyUserOnlyOnce(ServerAction.END_OF_SESSION,
      `tx-${transaction.id}`,
      {
        userID: user.id,
        transactionID: transaction.id,
        chargeBoxID: chargingStation.id,
      },
      (channel: NotificationSource) => {
        channel.notificationTask.sendEndOfSession(data, user, tenant, NotificationSeverity.INFO).catch((error) => {
          Logging.logPromiseError(error, tenant?.id);
        });
      });
    // Notify Signed Data
    if (transaction.stop.signedData !== '') {
      const locale = user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-');
      // Signed session data
      const signedData: EndOfSignedSessionNotification = {
        user,
        alternateUser: alternateUser || null,
        transactionId: transaction.id,
        chargeBoxID: chargingStation.id,
        connectorId: Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
        tagId: transaction.tagID,
        startDate: transaction.timestamp.toLocaleString(locale),
        endDate: transaction.stop.timestamp.toLocaleString(locale),
        meterStart: (transaction.meterStart / 1000).toLocaleString(locale, { minimumIntegerDigits: 1, minimumFractionDigits: 4, maximumFractionDigits: 4 }),
        meterStop: (transaction.stop.meterStop / 1000).toLocaleString(locale, { minimumIntegerDigits: 1, minimumFractionDigits: 4, maximumFractionDigits: 4 }),
        totalConsumption: (transaction.stop.totalConsumptionWh / 1000).toLocaleString(locale, { minimumIntegerDigits: 1, minimumFractionDigits: 4, maximumFractionDigits: 4 }),
        price: transaction.stop.price,
        relativeCost: (transaction.stop.price / (transaction.stop.totalConsumptionWh / 1000)),
        startSignedData: transaction.signedData,
        endSignedData: transaction.stop.signedData,
        evseDashboardChargingStationURL: Utils.buildEvseTransactionURL(tenant.subdomain, transaction.id, '#history'),
        evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
      };
      // Do it
      NotificationHelper.notifySingleUser((channel: NotificationSource) => {
        channel.notificationTask.sendEndOfSignedSession(signedData, user, tenant, NotificationSeverity.INFO).catch((error) => {
          Logging.logPromiseError(error, tenant?.id);
        });
      });
    }
  }

  private transactionInactivityToString(i18nHourShort = 'h') {
    const transaction = this.transaction;
    const user = this.user;
    const i18nManager = I18nManager.getInstanceForLocale(user ? user.locale : Constants.DEFAULT_LANGUAGE);
    // Get total
    const totalInactivitySecs = transaction.stop.totalInactivitySecs;
    // None?
    if (totalInactivitySecs === 0) {
      return `0${i18nHourShort}00 (${i18nManager.formatPercentage(0)})`;
    }
    // Build the inactivity percentage
    const totalInactivityPercent = i18nManager.formatPercentage(Math.round((totalInactivitySecs / transaction.stop.totalDurationSecs) * 100) / 100);
    return moment.duration(totalInactivitySecs, 's').format(`h[${i18nHourShort}]mm`, { trim: false }) + ` (${totalInactivityPercent})`;
  }
}

