import { EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, NotificationSeverity, OptimalChargeReachedNotification, TransactionStartedNotification } from '../types/UserNotifications';

import ChargingStation from '../types/ChargingStation';
import Constants from './Constants';
import I18nManager from './I18nManager';
import Logging from './Logging';
import NotificationTask from '../notification/NotificationTask';
import Tenant from '../types/Tenant';
import Transaction from '../types/Transaction';
import User from '../types/User';
import UserNotificationFacilities from '../notification/NotificationFacilities';
import Utils from './Utils';
import moment from 'moment';

// const MODULE_NAME = 'NotificationHelper';

export default class NotificationHelper {
  public static notifyStartTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, user: User) {
    if (user) {
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
      if (user.notificationsActive && user.notifications.sendSessionStarted) {
        UserNotificationFacilities.notifyUser(user, (task: NotificationTask) => {
          task.sendSessionStarted(data, user, tenant, NotificationSeverity.INFO).catch((error) => {
            Logging.logPromiseError(error, tenant?.id);
          });
        });
      }
    }
  }

  public static notifyEndOfCharge(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction) {
    if (transaction.user) {
      // i18n
      const i18nManager = I18nManager.getInstanceForLocale(transaction.user.locale);
      // Notification data
      const data: EndOfChargeNotification = {
        user: transaction.user,
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
      const user = transaction.user;
      if (user.notificationsActive && user.notifications.sendEndOfCharge) {
        UserNotificationFacilities.notifyUser(user, (task: NotificationTask) => {
          task.sendEndOfCharge(data, user, tenant, NotificationSeverity.INFO).catch((error) => {
            Logging.logPromiseError(error, tenant?.id);
          });
        });
      }
    }
  }

  public static notifyOptimalChargeReached(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction) {
    if (transaction.user) {
      // i18n
      const i18nManager = I18nManager.getInstanceForLocale(transaction.user.locale);
      // Notification data
      const data: OptimalChargeReachedNotification = {
        user: transaction.user,
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
      const user = transaction.user;
      if (user.notificationsActive && user.notifications.sendOptimalChargeReached) {
        UserNotificationFacilities.notifyUser(user, (task: NotificationTask) => {
          task.sendOptimalChargeReached(data, user, tenant, NotificationSeverity.INFO).catch((error) => {
            Logging.logPromiseError(error, tenant?.id);
          });
        });
      }
    }
  }

  public static notifyStopTransaction(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction, user: User, alternateUser?: User) {
    // User provided?
    if (user && user.notificationsActive && user.notifications.sendEndOfSession) {
      // Get the i18n lib
      const i18nManager = I18nManager.getInstanceForLocale(user.locale);
      // Notification Data
      const data: EndOfSessionNotification = {
        user: user,
        alternateUser: alternateUser ?? null,
        transactionId: transaction.id,
        chargeBoxID: chargingStation.id,
        siteID: chargingStation.siteID,
        siteAreaID: chargingStation.siteAreaID,
        companyID: chargingStation.companyID,
        connectorId: Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
        totalConsumption: i18nManager.formatNumber(Math.round(transaction.stop.totalConsumptionWh / 10) / 100),
        totalDuration: Utils.transactionDurationToString(transaction),
        totalInactivity: NotificationHelper.transactionInactivityToString(transaction, user),
        stateOfCharge: transaction.stop.stateOfCharge,
        evseDashboardChargingStationURL: Utils.buildEvseTransactionURL(tenant.subdomain, transaction.id, '#history'),
        evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
      };
      // Do it
      UserNotificationFacilities.notifyUser(user, (task: NotificationTask) => {
        task.sendEndOfSession(data, user, tenant, NotificationSeverity.INFO).catch((error) => {
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
        UserNotificationFacilities.notifyUser(user, (task: NotificationTask) => {
          task.sendEndOfSignedSession(signedData, user, tenant, NotificationSeverity.INFO).catch((error) => {
            Logging.logPromiseError(error, tenant?.id);
          });
        });
      }
    }
  }

  private static transactionInactivityToString(transaction: Transaction, user: User, i18nHourShort = 'h') {
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
