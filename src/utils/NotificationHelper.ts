import { EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, NotificationSeverity, NotificationSource, OptimalChargeReachedNotification, TransactionStartedNotification } from '../types/UserNotifications';

import ChargingStation from '../types/ChargingStation';
import Constants from './Constants';
import I18nManager from './I18nManager';
import Logging from './Logging';
import RawNotificationStorage from '../storage/mongodb/RawNotificationStorage';
import { ServerAction } from '../types/Server';
import Tenant from '../types/Tenant';
import Transaction from '../types/Transaction';
import User from '../types/User';
import UserNotificationFacilities from '../notification/NotificationFacilities';
import Utils from './Utils';
import moment from 'moment';

// const MODULE_NAME = 'NotificationHelper';

export default class NotificationHelper {

  public static notifyStartTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, user: User) {
    if (user?.notificationsActive && user.notifications.sendSessionStarted) {
      setTimeout(() => {
        NotificationHelper.getInstance(tenant, transaction, chargingStation, user).notifyStartTransaction();
      }, 500);
    }
  }

  public static notifyStopTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, user: User, alternateUser?: User) {
    if (user?.notificationsActive && user.notifications.sendEndOfSession) {
      setTimeout(() => {
        NotificationHelper.getInstance(tenant, transaction, chargingStation, user).notifyStopTransaction(alternateUser);
      }, 500);
    }
  }

  public static notifyEndOfCharge(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, user: User) {
    if (user?.notificationsActive && user.notifications.sendEndOfCharge) {
      setTimeout(() => {
        NotificationHelper.getInstance(tenant, transaction, chargingStation, user).notifyEndOfCharge();
      }, 500);
    }
  }

  public static notifyOptimalChargeReached(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, user: User) {
    if (user?.notificationsActive && user.notifications.sendOptimalChargeReached) {
      setTimeout(() => {
        NotificationHelper.getInstance(tenant, transaction, chargingStation, user).notifyOptimalChargeReached();
      }, 500);
    }
  }

  private static getInstance(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, user: User): UserNotificationHelper {
    return new UserNotificationHelper(tenant, transaction, chargingStation, user);
  }
}

export class UserNotificationHelper {

  private tenant: Tenant;
  private transaction: Transaction;
  private chargingStation: ChargingStation;
  private user: User;

  public constructor(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, user: User) {
    this.tenant = tenant;
    this.transaction = transaction;
    this.chargingStation = chargingStation;
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
    this.notifyUser((channel: NotificationSource) => {
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
    this.notifyUserOnlyOnce(ServerAction.END_OF_SESSION, (channel: NotificationSource) => {
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
        meterStart: (transaction.meterStart / 1000).toLocaleString(locale, {
          minimumIntegerDigits: 1, minimumFractionDigits: 4, maximumFractionDigits: 4 }),
        meterStop: (transaction.stop.meterStop / 1000).toLocaleString(locale, {
          minimumIntegerDigits: 1, minimumFractionDigits: 4, maximumFractionDigits: 4 }),
        totalConsumption: (transaction.stop.totalConsumptionWh / 1000).toLocaleString(locale,{
          minimumIntegerDigits: 1, minimumFractionDigits: 4, maximumFractionDigits: 4 }),
        price: transaction.stop.price,
        relativeCost: (transaction.stop.price / (transaction.stop.totalConsumptionWh / 1000)),
        startSignedData: transaction.signedData,
        endSignedData: transaction.stop.signedData,
        evseDashboardChargingStationURL: Utils.buildEvseTransactionURL(tenant.subdomain, transaction.id, '#history'),
        evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
      };
        // Do it
      this.notifyUser((channel: NotificationSource) => {
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

  private notifyUser(doIt: (channel: NotificationSource) => void): void {
    UserNotificationFacilities.notifyUser(this.user, doIt);
  }

  private notifyUserOnlyOnce(serverAction: ServerAction, doIt: (channel: NotificationSource) => void): void {
    this.checkNotificationAlreadySent(serverAction).then((done: boolean) => {
      if (!done) {
        this.notifyUser(doIt);
      }
    }).catch((error) => {
      Logging.logPromiseError(error, this.tenant?.id);
    });
  }

  private async checkNotificationAlreadySent(serverAction: ServerAction): Promise<boolean> {
    let done = false ;
    try {
      const discriminator = `tx-${this.transaction.id}`;
      // Get the Notification
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
          data: {
            userID: this.user.id,
            transactionID: this.transaction.id,
            chargeBoxID: this.chargingStation.id,
          }
        });
      }
    } catch (error) {
      await Logging.logActionExceptionMessage(this.tenant.id, ServerAction.NOTIFICATION, error);
    }
    return done;
  }
}
