import ChargingStation from '../types/ChargingStation';
import Constants from './Constants';
import I18nManager from './I18nManager';
import Logging from './Logging';
import NotificationHandler from '../notification/NotificationHandler';
import { ServerAction } from '../types/Server';
import Tenant from '../types/Tenant';
import Transaction from '../types/Transaction';
import User from '../types/User';
import Utils from './Utils';
import moment from 'moment';

const MODULE_NAME = 'NotificationHelper';

export default class NotificationHelper {
  public static notifyStartTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, user: User) {
    if (user) {
      NotificationHandler.sendTransactionStarted(
        tenant,
        transaction.id.toString(),
        user,
        chargingStation,
        {
          'user': user,
          'transactionId': transaction.id,
          'chargeBoxID': chargingStation.id,
          'siteID': chargingStation.siteID,
          'siteAreaID': chargingStation.siteAreaID,
          'companyID': chargingStation.companyID,
          'connectorId': Utils.getConnectorLetterFromConnectorID(transaction.connectorId),
          'evseDashboardURL': Utils.buildEvseURL(tenant.subdomain),
          'evseDashboardChargingStationURL': Utils.buildEvseTransactionURL(tenant.subdomain, transaction.id, '#inprogress')
        }
      ).catch((error) => {
        // TODO - This should be done everywhere!
        Logging.logError({
          tenantID: tenant.id,
          action: ServerAction.NOTIFICATION,
          module: MODULE_NAME, method: 'notificationHelper',
          message: 'Notification failed',
          detailedMessages: { error: error.stack }
        }).catch(() => { /* Intentional */ });
      });
    }
  }

  public static notifyEndOfCharge(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction) {
    if (transaction.user) {
      // Get the i18n lib
      const i18nManager = I18nManager.getInstanceForLocale(transaction.user.locale);
      // Notify (Async)
      NotificationHandler.sendEndOfCharge(
        tenant,
        transaction.id.toString() + '-EOC',
        transaction.user,
        chargingStation,
        {
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
        }
      ).catch((error) => {
        // TODO - This should be done everywhere!
        Logging.logError({
          tenantID: tenant.id,
          action: ServerAction.NOTIFICATION,
          module: MODULE_NAME, method: 'notificationHelper',
          message: 'Notification failed',
          detailedMessages: { error: error.stack }
        }).catch(() => { /* Intentional */ });
      });
    }
  }

  public static notifyOptimalChargeReached(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction) {
    if (transaction.user) {
      // Get the i18n lib
      const i18nManager = I18nManager.getInstanceForLocale(transaction.user.locale);
      // Notification Before End Of Charge (Async)
      NotificationHandler.sendOptimalChargeReached(
        tenant,
        transaction.id.toString() + '-OCR',
        transaction.user,
        chargingStation,
        {
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
        }
      ).catch((error) => {
        // TODO - This should be done everywhere!
        Logging.logError({
          tenantID: tenant.id,
          action: ServerAction.NOTIFICATION,
          module: MODULE_NAME, method: 'notificationHelper',
          message: 'Notification failed',
          detailedMessages: { error: error.stack }
        }).catch(() => { /* Intentional */ });
      });
    }
  }

  public static notifyStopTransaction(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction, user: User, alternateUser?: User) {
    // User provided?
    if (user) {
      // Get the i18n lib
      const i18nManager = I18nManager.getInstanceForLocale(user.locale);
      // Send Notification (Async)
      NotificationHandler.sendEndOfTransaction(
        tenant,
        transaction.id.toString() + '-EOS',
        user,
        chargingStation,
        {
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
        }
      ).catch((error) => {
        // TODO - This should be done everywhere!
        Logging.logError({
          tenantID: tenant.id,
          action: ServerAction.NOTIFICATION,
          module: MODULE_NAME, method: 'notificationHelper',
          message: 'Notification failed',
          detailedMessages: { error: error.stack }
        }).catch(() => { /* Intentional */ });
      });
      // Notify Signed Data
      if (transaction.stop.signedData !== '') {
        // Send Notification (Async)
        const locale = user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-');
        NotificationHandler.sendEndOfSignedTransaction(
          tenant,
          transaction.id.toString() + '-EOSS',
          user,
          chargingStation,
          {
            user: user,
            alternateUser: (alternateUser ? alternateUser : null),
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
          }
        ).catch((error) => {
          // TODO - This should be done everywhere!
          Logging.logError({
            tenantID: tenant.id,
            action: ServerAction.NOTIFICATION,
            module: MODULE_NAME, method: 'notificationHelper',
            message: 'Notification failed',
            detailedMessages: { error: error.stack }
          }).catch(() => { /* Intentional */ });
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
