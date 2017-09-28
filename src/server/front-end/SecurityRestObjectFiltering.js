const CentralRestServerAuthorization = require('./CentralRestServerAuthorization');
const Users = require('../../utils/Users');

require('source-map-support').install();

class SecurityRestObjectFiltering {
  // static filterChargingStationDeleteRequest(request, loggedUser) {
  //   let filteredRequest = {};
  //   // Set
  //   filteredRequest. = request.;
  //   filteredRequest. = request.;
  //   filteredRequest. = request.;
  //   return filteredRequest;
  // }

  static filterChargingStationDeleteRequest(request, loggedUser) {
    let filteredRequest = {};
    // Set
    filteredRequest.ID = request.ID;
    return filteredRequest;
  }

  static filterUserDeleteRequest(request, loggedUser) {
    let filteredRequest = {};
    // Set
    filteredRequest.ID = request.ID;
    return filteredRequest;
  }

  static filterPricingUpdateRequest(request, loggedUser) {
    let filteredRequest = {};
    // Set
    filteredRequest.priceKWH = request.priceKWH;
    filteredRequest.priceUnit = request.priceUnit;
    return filteredRequest;
  }

  static filterChargingStationConfigurationRequest(request, loggedUser) {
    let filteredRequest = {};
    // Set
    filteredRequest.ChargeBoxIdentity = request.ChargeBoxIdentity;
    return filteredRequest;
  }

  static filterChargingStationConsumptionFromTransactionRequest(request, loggedUser) {
    let filteredRequest = {};
    // Set
    filteredRequest.TransactionId = request.TransactionId;
    filteredRequest.StartDateTime = request.StartDateTime;
    filteredRequest.EndDateTime = request.EndDateTime;
    return filteredRequest;
  }

  static filterTransactionRequest(request, loggedUser) {
    let filteredRequest = {};
    // Set
    filteredRequest.TransactionId = request.TransactionId;
    return filteredRequest;
  }

  static filterChargingStationTransactionsRequest(request, loggedUser) {
    let filteredRequest = {};
    // Set
    filteredRequest.ChargeBoxIdentity = request.ChargeBoxIdentity;
    filteredRequest.ConnectorId = request.ConnectorId;
    filteredRequest.StartDateTime = request.StartDateTime;
    filteredRequest.EndDateTime = request.EndDateTime;
    return filteredRequest;
  }

  static filterWithPicture(filteredRequest, withPicture) {
    // Set
    filteredRequest.WithPicture = withPicture;
    // Check boolean
    if(filteredRequest.WithPicture) {
      filteredRequest.WithPicture = (filteredRequest.WithPicture === "true");
    } else {
      filteredRequest.WithPicture = false;
    }
  }

  static filterActiveTransactionsRequest(request, loggedUser) {
    let filteredRequest = {};
    // Handle picture
    SecurityRestObjectFiltering.filterWithPicture(filteredRequest, request.WithPicture);
    // Set
    // filteredRequest. = request.;
    // filteredRequest. = request.;
    // filteredRequest. = request.;
    return filteredRequest;
  }

  static filterUserStatisticsRequest(request, loggedUser) {
    let filteredRequest = {};
    // Set
    filteredRequest.Year = request.Year;
    return filteredRequest;
  }

  static filterChargingStationStatisticsRequest(request, loggedUser) {
    let filteredRequest = {};
    // Set
    filteredRequest.Year = request.Year;
    return filteredRequest;
  }

  static filterCompletedTransactionsRequest(request, loggedUser) {
    let filteredRequest = {};
    // Handle picture
    SecurityRestObjectFiltering.filterWithPicture(filteredRequest, request.WithPicture);
    filteredRequest.StartDateTime = request.StartDateTime;
    filteredRequest.EndDateTime = request.EndDateTime;
    filteredRequest.Search = request.Search;
    return filteredRequest;
  }

  static filterUserRequest(request, loggedUser) {
    let filteredRequest = {};
    // Set
    filteredRequest.ID = request.ID;
    return filteredRequest;
  }

  static filterUsersRequest(request, loggedUser) {
    let filteredRequest = {};
    // Handle picture
    SecurityRestObjectFiltering.filterWithPicture(filteredRequest, request.WithPicture);
    return filteredRequest;
  }

  static filterChargingStationRequest(request, loggedUser) {
    let filteredRequest = {};
    filteredRequest.ChargeBoxIdentity = request.ChargeBoxIdentity;
    return filteredRequest;
  }

  static filterChargingStationsRequest(request, loggedUser) {
    let filteredRequest = {};
    filteredRequest.Search = request.Search;
    filteredRequest.OnlyActive = request.OnlyActive;
    return filteredRequest;
  }

  static filterLoggingsRequest(request, loggedUser) {
    let filteredRequest = {};
    // Get logs
    filteredRequest.DateFrom = request.DateFrom;
    filteredRequest.Level = request.Level;
    filteredRequest.ChargingStation = request.ChargingStation;
    filteredRequest.Search = request.Search;
    filteredRequest.NumberOfLogs = request.NumberOfLogs;
    filteredRequest.SortDate = request.SortDate;
    return filteredRequest;
  }

  static filterUserCreateRequest(request, loggedUser) {
    let filteredRequest = {};
    filteredRequest.costCenter = request.costCenter;
    filteredRequest.email = request.email;
    filteredRequest.firstName = request.firstName;
    filteredRequest.iNumber = request.iNumber;
    filteredRequest.id = request.id;
    filteredRequest.image = request.image;
    filteredRequest.mobile = request.mobile;
    filteredRequest.name = request.name;
    if (request.passwords) {
      filteredRequest.password = request.passwords.password;
    }
    filteredRequest.phone = request.phone;
    // Admin?
    if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
      // Ok to set the role
      filteredRequest.role = request.role;
      filteredRequest.status = request.status;
    } else {
      // Ko to set the role
      filteredRequest.role = Users.USER_ROLE_BASIC;
      filteredRequest.status = Users.USER_STATUS_INACTIVE;
    }
    filteredRequest.tagIDs = request.tagIDs;
    return filteredRequest;
  }

  static filterChargingStationActionRequest(request, action, loggedUser) {
    let filteredRequest = {};
    // Check
    filteredRequest.chargeBoxIdentity = request.chargeBoxIdentity;
    // Do not check action?
    filteredRequest.args =  request.args;
    return filteredRequest;
  }

  static filterChargingStationSetMaxIntensitySocketRequest(request, loggedUser) {
    let filteredRequest = {};
    // Check
    filteredRequest.chargeBoxIdentity = request.chargeBoxIdentity;
    filteredRequest.maxIntensity =  request.args.maxIntensity;
    return filteredRequest;
  }

  static filterConsumptionsFromTransactionResponse(consumption, loggedUser, withPicture) {
    let filteredConsumption = {};

    // Set
    filteredConsumption.chargeBoxIdentity = consumption.chargeBoxIdentity;
    filteredConsumption.connectorId = consumption.connectorId;
    // Admin?
    if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
      filteredConsumption.priceUnit = consumption.priceUnit;
      filteredConsumption.totalPrice = consumption.totalPrice;
    }
    filteredConsumption.totalConsumption = consumption.totalConsumption;
    filteredConsumption.transactionId = consumption.transactionId;
    filteredConsumption.userID =
      SecurityRestObjectFiltering.filterUserInTransactionResponse(
        consumption.userID, loggedUser, withPicture);
    // Admin?
    if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
      // Set them all
      filteredConsumption.values = consumption.values;
    } else {
      // Clean
      filteredConsumption.values = [];
      consumption.values.forEach((value) => {
        // Set
        filteredConsumption.values.push({
          date: value.date,
          value: value.value,
          cumulated: value.cumulated });
      });
    }

    return filteredConsumption;
  }

  // Pricing
  static filterPricingResponse(pricing, loggedUser) {
    let filteredPricing = {};
    // Set
    filteredPricing.timestamp = pricing.timestamp;
    filteredPricing.priceKWH = pricing.priceKWH;
    filteredPricing.priceUnit = pricing.priceUnit;
    // Return
    return filteredPricing;
  }

  // User
  static filterUserResponse(user, loggedUser, withPicture=false) {
    let filteredUser={};
    // Check auth
    if (CentralRestServerAuthorization.canReadUser(loggedUser, user)) {
      // Admin?
      if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
        filteredUser.id = user.id;
        filteredUser.name = user.name;
        filteredUser.firstName = user.firstName;
        filteredUser.locale = user.locale;
        filteredUser.email = user.email;
        filteredUser.phone = user.phone;
        filteredUser.mobile = user.mobile;
        filteredUser.iNumber = user.iNumber;
        filteredUser.costCenter = user.costCenter;
        filteredUser.status = user.status;
        filteredUser.createdBy = user.createdBy;
        filteredUser.createdOn = user.createdOn;
        filteredUser.tagIDs = user.tagIDs;
        filteredUser.role = user.role;
        if (withPicture) {
          filteredUser.image = user.image;
        }
      } else {
        // Set only necessary info
        filteredUser.id = user.id;
        filteredUser.name = user.name;
        filteredUser.firstName = user.firstName;
        filteredUser.email = user.email;
        filteredUser.locale = user.locale;
        if (withPicture) {
          filteredUser.image = user.image;
        }
      }
    }

    return filteredUser;
  }

  static filterUsersResponse(users, loggedUser, withPicture=false) {
    let filteredUsers = [];
    users.forEach(user => {
      // Filter
      let filteredUser = this.filterUserResponse(user, loggedUser, withPicture);
      // Ok?
      if (filteredUser) {
        // Add
        filteredUsers.push(filteredUser);
      }
    });
    return filteredUsers;
  }

  // Charging Station
  static filterChargingStationResponse(chargingStation, loggedUser) {
    let filteredChargingStation;

    // Check auth
    if (CentralRestServerAuthorization.canReadChargingStation(loggedUser, chargingStation)) {
      // Admin?
      if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
        // Yes: set all params
        filteredChargingStation = chargingStation;
      } else {
        // Set only necessary info
        filteredChargingStation = {};
        filteredChargingStation.id = chargingStation.id;
        filteredChargingStation.chargeBoxIdentity = chargingStation.chargeBoxIdentity;
        filteredChargingStation.connectors = chargingStation.connectors;
        filteredChargingStation.lastHeartBeat = chargingStation.lastHeartBeat;
      }
    }

    return filteredChargingStation;
  }

  static filterChargingStationsResponse(chargingStations, loggedUser) {
    let filteredChargingStations = [];
    chargingStations.forEach(chargingStation => {
      // Filter
      let filteredChargingStation = this.filterChargingStationResponse(chargingStation, loggedUser);
      // Ok?
      if (filteredChargingStation) {
        // Add
        filteredChargingStations.push(filteredChargingStation);
      }
    });
    return filteredChargingStations;
  }

  // Transaction
  static filterTransactionResponse(transaction, loggedUser, withPicture=false, withConnector=false) {
    let filteredTransaction;

    // Check auth
    if (CentralRestServerAuthorization.canReadUser(loggedUser, transaction.userID) &&
        CentralRestServerAuthorization.canReadChargingStation(loggedUser, transaction.chargeBoxID)) {
      // Set only necessary info
      filteredTransaction = {};
      filteredTransaction.id = transaction.id;
      filteredTransaction.transactionId = transaction.transactionId;
      filteredTransaction.connectorId = transaction.connectorId;
      filteredTransaction.timestamp = transaction.timestamp;
      // Filter user
      filteredTransaction.userID =
        SecurityRestObjectFiltering.filterUserInTransactionResponse(
          transaction.userID, loggedUser, withPicture);
      // Transaction Stop
      if (transaction.stop) {
        filteredTransaction.stop = {};
        filteredTransaction.stop.timestamp = transaction.stop.timestamp;
        filteredTransaction.stop.totalConsumption = transaction.stop.totalConsumption;
        // Admin?
        if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
          filteredTransaction.stop.price = transaction.stop.price;
          filteredTransaction.stop.priceUnit = transaction.stop.priceUnit;
        }
        // Stop User
        if (transaction.stop.userID) {
          // Filter user
          filteredTransaction.stop.userID =
            SecurityRestObjectFiltering.filterUserInTransactionResponse(
              transaction.stop.userID, loggedUser, withPicture);
        }
      }
      // Charging Station
      filteredTransaction.chargeBoxID = {};
      filteredTransaction.chargeBoxID.id = transaction.chargeBoxID.id;
      filteredTransaction.chargeBoxID.chargeBoxIdentity = transaction.chargeBoxID.chargeBoxIdentity;
      if (withConnector) {
        filteredTransaction.chargeBoxID.connectors = [];
        filteredTransaction.chargeBoxID.connectors[transaction.connectorId-1] = transaction.chargeBoxID.connectors[transaction.connectorId-1];
      }
    }

    return filteredTransaction;
  }

  static filterUserInTransactionResponse(user, loggedUser, withPicture) {
    let userID = {};
    // Check auth
    if (CentralRestServerAuthorization.canReadUser(loggedUser, user)) {
      // Demo user?
      if (CentralRestServerAuthorization.isDemo(loggedUser)) {
        userID.name = "####";
        userID.firstName = "####";
      } else {
        userID.name = user.name;
        userID.firstName = user.firstName;
        if (withPicture) {
          userID.image = user.image;
        }
      }
    }
    return userID;
  }

  static filterTransactionsResponse(transactions, loggedUser, withPicture=false, withConnector=false) {
    let filteredTransactions = [];
    transactions.forEach(transaction => {
      // Filter
      let filteredTransaction = this.filterTransactionResponse(transaction, loggedUser, withPicture, withConnector);
      // Ok?
      if (filteredTransaction) {
        // Add
        filteredTransactions.push(filteredTransaction);
      }
    });
    return filteredTransactions;
  }
}

module.exports = SecurityRestObjectFiltering;
