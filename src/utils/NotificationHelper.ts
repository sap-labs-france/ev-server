import ChargingStation from '../types/ChargingStation';
import Constants from './Constants';
import I18nManager from './I18nManager';
import NotificationHandler from '../notification/NotificationHandler';
import Tenant from '../types/Tenant';
import Transaction from '../types/Transaction';
import User from '../types/User';
import Utils from './Utils';

export default class NotificationHelper {
  public static notifyStartTransaction(tenant: Tenant, transaction: Transaction, chargingStation: ChargingStation, user: User) {
    if (user) {
      void NotificationHandler.sendTransactionStarted(
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
      );
    }
  }

  public static notifyEndOfCharge(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction) {
    if (transaction.user) {
      // Get the i18n lib
      const i18nManager = I18nManager.getInstanceForLocale(transaction.user.locale);
      // Notify (Async)
      void NotificationHandler.sendEndOfCharge(
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
      );
    }
  }

  public static notifyOptimalChargeReached(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction) {
    if (transaction.user) {
      // Get the i18n lib
      const i18nManager = I18nManager.getInstanceForLocale(transaction.user.locale);
      // Notification Before End Of Charge (Async)
      void NotificationHandler.sendOptimalChargeReached(
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
      );
    }
  }

  public static notifyStopTransaction(tenant: Tenant, chargingStation: ChargingStation, transaction: Transaction, user: User, alternateUser?: User) {
    // User provided?
    if (user) {
      // Get the i18n lib
      const i18nManager = I18nManager.getInstanceForLocale(user.locale);
      // Send Notification (Async)
      void NotificationHandler.sendEndOfTransaction(
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
          totalInactivity: Utils.transactionInactivityToString(transaction, user),
          stateOfCharge: transaction.stop.stateOfCharge,
          evseDashboardChargingStationURL: Utils.buildEvseTransactionURL(tenant.subdomain, transaction.id, '#history'),
          evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
        }
      );
      // Notify Signed Data
      if (transaction.stop.signedData !== '') {
        // Send Notification (Async)
        void NotificationHandler.sendEndOfSignedTransaction(
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
            startDate: transaction.timestamp.toLocaleString(user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
            endDate: transaction.stop.timestamp.toLocaleString(user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
            meterStart: (transaction.meterStart / 1000).toLocaleString(
              (user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
              { minimumIntegerDigits: 1, minimumFractionDigits: 4, maximumFractionDigits: 4 }),
            meterStop: (transaction.stop.meterStop / 1000).toLocaleString(
              (user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
              { minimumIntegerDigits: 1, minimumFractionDigits: 4, maximumFractionDigits: 4 }),
            totalConsumption: (transaction.stop.totalConsumptionWh / 1000).toLocaleString(
              (user.locale ? user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
              { minimumIntegerDigits: 1, minimumFractionDigits: 4, maximumFractionDigits: 4 }),
            price: transaction.stop.price,
            relativeCost: (transaction.stop.price / (transaction.stop.totalConsumptionWh / 1000)),
            startSignedData: transaction.signedData,
            endSignedData: transaction.stop.signedData,
            evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
          }
        );
      }
    }
  }
}
