import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import User from '../../../../types/User';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';

export default class TransactionSecurity {
  // eslint-disable-next-line no-unused-vars
  static filterTransactionsRefund(request, loggedUser: UserToken) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.transactionIds = request.transactionIds.map((id) => {
      return sanitize(id);
    });
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterTransactionDelete(request, loggedUser: UserToken) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterTransactionSoftStop(request, loggedUser: UserToken) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.transactionId = sanitize(request.transactionId);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterTransactionRequest(request, loggedUser: UserToken) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterTransactionsActiveRequest(request, loggedUser: UserToken) {
    const filteredRequest: any = {};
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.ConnectorId = sanitize(request.ConnectorId);
    filteredRequest.SiteAreaID = sanitize(request.SiteAreaID);
    filteredRequest.SiteID = sanitize(request.SiteID);
    if (request.UserID) {
      filteredRequest.UserID = sanitize(request.UserID);
    }
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterTransactionsCompletedRequest(request, loggedUser: UserToken) {
    const filteredRequest: any = {};
    // Handle picture
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.SiteAreaID = sanitize(request.SiteAreaID);
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.Type = sanitize(request.Type);
    filteredRequest.MinimalPrice = sanitize(request.MinimalPrice);
    if (request.Statistics) {
      filteredRequest.Statistics = sanitize(request.Statistics);
    }
    if (request.UserID) {
      filteredRequest.UserID = sanitize(request.UserID);
    }
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterTransactionsInErrorRequest(request) {
    const filteredRequest: any = {};
    // Handle picture
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.SiteAreaID = sanitize(request.SiteAreaID);
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.ErrorType = sanitize(request.ErrorType);
    if (request.UserID) {
      filteredRequest.UserID = sanitize(request.UserID);
    }
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterTransactionResponse(transaction, loggedUser: UserToken) {
    let filteredTransaction;

    if (!transaction) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadTransaction(loggedUser, transaction)) {
      // Set only necessary info
      filteredTransaction = {};
      filteredTransaction.id = transaction.getID();
      if (transaction.getModel().errorCode) {
        filteredTransaction.uniqueId = transaction.getModel().uniqueId;
        filteredTransaction.errorCode = transaction.getModel().errorCode;
      }
      filteredTransaction.chargeBoxID = transaction.getChargeBoxID();
      filteredTransaction.siteID = transaction.getSiteID();
      filteredTransaction.siteAreaID = transaction.getSiteAreaID();
      filteredTransaction.connectorId = transaction.getConnectorId();
      filteredTransaction.meterStart = transaction.getMeterStart();
      filteredTransaction.timestamp = transaction.getStartDate();
      filteredTransaction.timezone = transaction.getTimezone();
      if (transaction.hasStartPrice()) {
        filteredTransaction.price = transaction.getStartPrice();
        filteredTransaction.roundedPrice = transaction.getStartRoundedPrice();
        filteredTransaction.priceUnit = transaction.getStartPriceUnit();
        filteredTransaction.pricingSource = transaction.getStartPricingSource();
      }
      if (transaction.isActive()) {
        filteredTransaction.currentConsumption = transaction.getCurrentConsumption();
        filteredTransaction.currentTotalConsumption = transaction.getCurrentTotalConsumption();
        filteredTransaction.currentTotalInactivitySecs = transaction.getCurrentTotalInactivitySecs();
        filteredTransaction.currentTotalDurationSecs = transaction.getCurrentTotalDurationSecs();
        filteredTransaction.currentCumulatedPrice = transaction.getCurrentCumulatedPrice();
        filteredTransaction.currentStateOfCharge = transaction.getCurrentStateOfCharge();
        filteredTransaction.currentSignedData = transaction.getCurrentSignedData();
      }
      filteredTransaction.status = transaction.getChargerStatus();
      filteredTransaction.isLoading = transaction.isLoading();
      filteredTransaction.stateOfCharge = transaction.getStateOfCharge();
      filteredTransaction.signedData = transaction.getSignedData();
      filteredTransaction.refundData = transaction.getRefundData();
      // Demo user?
      if (Authorizations.isDemo(loggedUser.role)) {
        filteredTransaction.tagID = Constants.ANONYMIZED_VALUE;
      } else {
        filteredTransaction.tagID = transaction.getTagID();
      }
      // Filter user
      filteredTransaction.user = TransactionSecurity._filterUserInTransactionResponse(
        transaction.getUserJson(), loggedUser);
      // Transaction Stop
      if (transaction.isFinished()) {
        filteredTransaction.stop = {};
        filteredTransaction.stop.meterStop = transaction.getStopMeter();
        filteredTransaction.stop.timestamp = transaction.getStopDate();
        filteredTransaction.stop.totalConsumption = transaction.getStopTotalConsumption();
        filteredTransaction.stop.totalInactivitySecs = transaction.getStopTotalInactivitySecs() + transaction.getStopExtraInactivitySecs();
        filteredTransaction.stop.totalDurationSecs = transaction.getStopTotalDurationSecs();
        filteredTransaction.stop.stateOfCharge = transaction.getStopStateOfCharge();
        filteredTransaction.stop.signedData = transaction.getEndSignedData();
        // pragma if (Authorizations.isAdmin(loggedUser) && transaction.hasStopPrice()) {
        if (transaction.hasStopPrice()) {
          filteredTransaction.stop.price = transaction.getStopPrice();
          filteredTransaction.stop.roundedPrice = transaction.getStopRoundedPrice();
          filteredTransaction.stop.priceUnit = transaction.getStopPriceUnit();
          filteredTransaction.stop.pricingSource = transaction.getStopPricingSource();
        }
        // Demo user?
        if (Authorizations.isDemo(loggedUser.role)) {
          filteredTransaction.stop.tagID = Constants.ANONYMIZED_VALUE;
        } else {
          filteredTransaction.stop.tagID = transaction.getStopTagID();
        }
        // Stop User
        if (transaction.getStopUserJson()) {
          // Filter user
          filteredTransaction.stop.user = TransactionSecurity._filterUserInTransactionResponse(
            transaction.getStopUserJson(), loggedUser);
        }
      }
    }
    return filteredTransaction;
  }

  static filterTransactionsResponse(transactions, loggedUser: UserToken) {
    const filteredTransactions = [];
    if (!transactions.result) {
      return null;
    }
    // Filter result
    for (const transaction of transactions.result) {
      // Filter
      const filteredTransaction = TransactionSecurity.filterTransactionResponse(transaction, loggedUser);
      // Ok?
      if (filteredTransaction) {
        filteredTransactions.push(filteredTransaction);
      }
    }
    transactions.result = filteredTransactions;
  }

  static _filterUserInTransactionResponse(user: User, loggedUser: UserToken) {
    const filteredUser: any = {};

    if (!user) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadUser(loggedUser, user.id)) {
      // Demo user?
      if (Authorizations.isDemo(loggedUser.role)) {
        filteredUser.id = null;
        filteredUser.name = Constants.ANONYMIZED_VALUE;
        filteredUser.firstName = Constants.ANONYMIZED_VALUE;
      } else {
        filteredUser.id = user.id;
        filteredUser.name = user.name;
        filteredUser.firstName = user.firstName;
      }
    }
    return filteredUser;
  }

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationConsumptionFromTransactionRequest(request, loggedUser: UserToken) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.TransactionId = sanitize(request.TransactionId);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationTransactionsRequest(request, loggedUser: UserToken) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.ConnectorId = sanitize(request.ConnectorId);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  /**
   *
   * @param transaction {Transaction}
   * @param consumptions {Consumption[]}
   * @param loggedUser
   * @returns {*}
   */
  static filterConsumptionsFromTransactionResponse(transaction, consumptions, loggedUser: UserToken) {
    if (!consumptions) {
      consumptions = [];
    }
    // Check Authorisation
    if (transaction.getUserJson()) {
      if (!Authorizations.canReadUser(loggedUser, transaction.getUserJson().id)) {
        return null;
      }
    } else if (!transaction.getUserJson() && !Authorizations.isAdmin(loggedUser.role)) {
      return null;
    }
    const filteredTransaction = TransactionSecurity.filterTransactionResponse(transaction, loggedUser);
    if (consumptions.length === 0) {
      filteredTransaction.values = [];
      return filteredTransaction;
    }

    // Admin?
    if (Authorizations.isAdmin(loggedUser.role)) {
      // Set them all
      filteredTransaction.values = consumptions.map((consumption) => {
        return consumption.getModel();
      }).map((consumption) => {
        return {
          ...consumption,
          date: consumption.endedAt,
          value: consumption.instantPower,
          cumulated: consumption.cumulatedConsumption
        };
      });
    } else {
      // Clean
      filteredTransaction.values = consumptions.map((consumption) => {
        return consumption.getModel();
      }).map((consumption) => {
        return {
          endedAt: consumption.endedAt,
          instantPower: consumption.instantPower,
          cumulatedConsumption: consumption.cumulatedConsumption,
          stateOfCharge: consumption.stateOfCharge,
          date: consumption.endedAt,
          value: consumption.instantPower,
          cumulated: consumption.cumulatedConsumption
        };
      });
    }
    for (let i = 1; i < filteredTransaction.values.length; i++) {
      if (filteredTransaction.values[i].instantPower === 0 && filteredTransaction.values[i - 1] !== 0) {
        const addedValue = JSON.parse(JSON.stringify(filteredTransaction.values[i]));
        const newDate = new Date(filteredTransaction.values[i - 1].endedAt.getTime() + 60000);
        addedValue.endedAt = newDate;
        addedValue.date = newDate;
        filteredTransaction.values.splice(i, 0, addedValue);
        i++;
      }
    }
    const initialValue = JSON.parse(JSON.stringify(filteredTransaction.values[0]));
    const initialDate = new Date(filteredTransaction.values[0].endedAt.getTime() - 60000);
    initialValue.endedAt = initialDate;
    initialValue.date = initialDate;
    initialValue.value = 0;
    initialValue.cumulated = 0;
    initialValue.instantPower = 0;
    initialValue.cumulatedConsumption = 0;
    if (Authorizations.isAdmin(loggedUser.role)) {
      initialValue.startedAt = new Date(initialDate.getTime() - 60000);
      initialValue.consumption = 0;
      initialValue.amount = 0;
      initialValue.cumulatedAmount = 0;
      initialValue.roundedAmount = 0;
    }
    filteredTransaction.values.splice(0, 0, initialValue);
    return filteredTransaction;
  }
}

