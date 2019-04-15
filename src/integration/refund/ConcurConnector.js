const AbstractConnector = require('../AbstractConnector');
const Logging = require('../../utils/Logging');
const axios = require('axios');
const querystring = require('querystring');
const moment = require('moment');
const ConnectionStorage = require('../../storage/mongodb/ConnectionStorage');
const TransactionStorage = require('../../storage/mongodb/TransactionStorage');
const ChargingStation = require("../../entity/ChargingStation");
const Constants = require('../../utils/Constants');
const AppError = require('../../exception/AppError');

const MODULE_NAME = 'ConcurConnector';
const CONNECTOR_ID = 'concur';

/**
 * A concur connector creates connection with the following data attributes
 * Instance_URL  string  -  Identifies the Concur datacenter where the user’s data resides. For example, if the Instance_Url is https://www.ea1.concursolutions.com, then all API calls for this user should use this URL as a prefix in subsequent API calls
 * Token  string  -  The access token value passed in the Authorization header when making API calls. It is a long-lived token which is currently set to expire after one year from creation. You should securely store the token and use it for all subsequent API requests until the token expires. Before it does, you should send a request to refresh the token prior to the expiration date.
 * Expiration_Date  string  -  The Universal Coordinated Time (UTC) date and time when the access token expires.
 * Refresh_Token  string  -  Token with a new expiration date of a year from the refresh date. You should securely store the refresh token for a user and use it for all subsequent API requests.
 */
class ConcurConnector extends AbstractConnector {
  constructor(tenantID, setting) {
    super(tenantID, 'concur', setting);
  }

  /**
   * Compute a valid until date from a date and a duration
   * @return Date the valid until date
   * @param result the data result returned by concur
   */
  static computeValidUntilAt(result) {
    return new Date(result.data.refresh_expires_in * 1000);
  }

  static isConnectionExpired(connection) {
    return moment(connection.data.refresh_expires_in).isBefore(moment.now());
  }

  static isTokenExpired(connection) {
    return moment(connection.getUpdatedAt()).add(connection.getData().expires_in, 'seconds').isBefore(moment.now());
  }

  getAuthenticationUrl() {
    return this.getSetting().authenticationUrl;
  }

  getApiUrl() {
    return this.getSetting().apiUrl;
  }

  getClientId() {
    return this.getSetting().clientId;
  }

  getClientSecret() {
    return this.getSetting().clientSecret;
  }

  getExpenseTypeCode() {
    return this.getSetting().expenseTypeCode;
  }

  getPolicyID() {
    return this.getSetting().policyId;
  }

  getReportName() {
    return this.getSetting().reportName;
  }

  getPaymentTypeID() {
    return this.getSetting().paymentTypeId;
  }

  /**
   *
   * @param userId
   * @param data
   * @returns {Promise<Connection>}
   */
  async createConnection(userId, data) {
    try {
      Logging.logDebug({
        tenantID: this.getTenantID(),
        module: MODULE_NAME, method: 'createConnection',
        action: 'getAccessToken', message: `request concur access token for ${userId}`
      });
      const result = await axios.post(`${this.getAuthenticationUrl()}/oauth2/v0/token`,
        querystring.stringify({
          code: data.code,
          client_id: this.getClientId(),
          client_secret: this.getClientSecret(),
          redirect_uri: data.redirectUri,
          grant_type: 'authorization_code'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
      Logging.logDebug({
        tenantID: this.getTenantID(),
        module: MODULE_NAME, method: 'createConnection',
        action: 'getAccessToken', message: `Concur access token granted for ${userId}`
      });
      const now = new Date();
      return ConnectionStorage.saveConnection(this.getTenantID(), {
        data: result.data,
        userId: userId,
        connectorId: CONNECTOR_ID,
        createdAt: now,
        updatedAt: now,
        validUntil: ConcurConnector.computeValidUntilAt(result)
      });
    } catch (e) {
      Logging.logError({
        tenantID: this.getTenantID(),
        module: MODULE_NAME,
        method: 'createConnection',
        action: 'getAccessToken',
        message: `Concur access token not granted for ${userId} ${JSON.stringify(e.response.data)}`,
        error: e
      });
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Concur access token not granted for ${userId}`, 500,
        'ConcurConnector', 'getAccessToken', userId);
    }
  }

  async refreshToken(userId, connection) {
    try {
      Logging.logDebug({
        tenantID: this.getTenantID(),
        module: MODULE_NAME, method: 'refreshToken',
        action: 'refreshAccessToken', message: `request concur refresh token for ${userId}`
      });
      const result = await axios.post(`${this.getAuthenticationUrl()}/oauth2/v0/token`,
        querystring.stringify({
          client_id: this.getClientId(),
          client_secret: this.getClientSecret(),
          refresh_token: connection.getData().refresh_token,
          scope: connection.getData().scope,
          grant_type: 'refresh_token'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
      Logging.logDebug({
        tenantID: this.getTenantID(),
        module: MODULE_NAME, method: 'refreshToken',
        action: 'refreshAccessToken', message: `Concur access token refreshed for ${userId}`
      });
      const now = new Date();
      connection.updateData(result.data, now, ConcurConnector.computeValidUntilAt(result));

      return ConnectionStorage.saveConnection(this.getTenantID(), connection.getModel());
    } catch (e) {
      Logging.logError({
        tenantID: this.getTenantID(),
        module: MODULE_NAME, method: 'refreshToken',
        action: 'refreshAccessToken', message: `Concur access token not refreshed for ${userId}`
      });
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Concur access token not refreshed for ${userId}`, 500,
        'ConcurConnector', 'refreshToken', userId);
    }
  }

  /**
   *
   * @param user {User}
   * @param transactions {Transaction}
   * @returns {Promise<Transaction[]>}
   */
  async refund(user, transactions) {
    const refundedTransactions = [];
    let connection = await this.getConnectionByUserId(user.getID());
    if (connection === undefined) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The user with ID '${user.getID()}' does not have a connection to connector '${CONNECTOR_ID}'`, 552,
        'TransactionService', 'handleRefundTransactions', user);
    }

    if (ConcurConnector.isTokenExpired(connection)) {
      connection = await this.refreshToken(user.getID(), connection);
    }
    const expenseReports = await this.getExpenseReports(connection);
    const expenseReport = expenseReports.find(report => report.Name === this.getReportName());
    let expenseReportId;
    if (expenseReport) {
      expenseReportId = expenseReport.ID;
    } else {
      expenseReportId = await this.createExpenseReport(connection);
    }
    for (const transaction of transactions) {
      try {
        const chargingStation = await ChargingStation.getChargingStation(transaction.getTenantID(), transaction.getChargeBoxID());
        const locationId = await this.getLocationId(connection, await chargingStation.getSite());
        const entryId = await this.createExpenseReportEntry(connection, expenseReportId, transaction, locationId);
        transaction.setRefundData({refundId: entryId, refundedAt: new Date()});
        await TransactionStorage.saveTransaction(transaction.getTenantID(), transaction.getModel());
        refundedTransactions.push(transaction);
      } catch (e) {
        Logging.logError({
          tenantID: this.getTenantID(),
          user: user, actionOnUser: (transaction.getUser() ? transaction.getUser() : null),
          module: 'ConcurConnector', method: 'refund',
          message: e.message,
        });
      }
    }
    return refundedTransactions;
  }


  async getExpenseReports(connection) {
    try {

      const response = await axios.get(`${this.getApiUrl()}/api/v3.0/expense/reports?approvalStatusCode=A_NOTF`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${connection.getData().access_token}`
        }
      });
      return response.data.Items;
    } catch (e) {
      Logging.logError({
        tenantID: this.getTenantID(),
        module: MODULE_NAME, method: 'getExpenseReports',
        action: 'getExpenseReports', message: `Unable to get expense reports`
      });
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Unable to get expense reports`, 500,
        'ConcurConnector', 'getExpenseReports');
    }
  }

  async getLocationId(connection, site) {
    let response = await axios.get(`${this.getApiUrl()}/api/v3.0/common/locations?city=${site.getAddress().city}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${connection.getData().access_token}`
      }
    });
    if (response.data && response.data.Items && response.data.Items.length > 0) {
      return response.data.Items[0].ID;
    } else {
      const company = await site.getCompany();
      response = await axios.get(`${this.getApiUrl()}/api/v3.0/common/locations?city=${company.getAddress().city}`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${connection.getData().access_token}`
        }
      });
      if (response.data && response.data.Items && response.data.Items.length > 0) {
        return response.data.Items[0].ID;
      }
    }
    throw new AppError(
      Constants.CENTRAL_SERVER,
      `The city '${site.getAddress().city}' of the station is unknown to Concur`, 553,
      'ConcurConnector', 'getLocationId');
  }

  /**
   *
   * @param connection {Connection}
   * @param expenseReportId {string}
   * @param transaction {Transaction}
   * @param site {Site}
   * @returns {Promise<string>}
   */
  async createExpenseReportEntry(connection, expenseReportId, transaction, locationId) {
    try {

      const response = await axios.post(`${this.getApiUrl()}/api/v3.0/expense/entries`, {
        'Description': `Emobility reimbursement ${moment(transaction.getStartDate()).format("YYYY-MM-DD")}`,
        'Comment': `Session started the ${moment(transaction.getStartDate()).format("YYYY-MM-DDTHH:mm:ss")} during ${moment.duration(transaction.getTotalDurationSecs(), 'seconds').format(`h[h]mm`, {trim: false})}`,
        'VendorDescription': 'Charge At Home',
        'Custom1': `${transaction.getID}`,
        'ExpenseTypeCode': this.getExpenseTypeCode(),
        'IsBillable': true,
        'IsPersonal': false,
        'PaymentTypeID': this.getPaymentTypeID(),
        'ReportID': expenseReportId,
        'TaxReceiptType': 'N',
        'TransactionAmount': transaction.getPrice(),
        'TransactionCurrencyCode': transaction.getPriceUnit(),
        'TransactionDate': transaction.getStartDate(),
        'SpendCategoryCode': 'COCAR',
        'LocationID': locationId

      }, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${connection.getData().access_token}`
        }
      });
      return response.data.ID;
    } catch (e) {
      throw e;
    }
  }

  /**
   *
   * @param connection
   * @returns {Promise<void>}
   */
  async createExpenseReport(connection) {
    try {
      const response = await axios.post(`${this.getApiUrl()}/api/v3.0/expense/reports`, {
        'Name': this.getReportName(),
        'PolicyID': this.getPolicyID()
      }, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${connection.getData().access_token}`
        }
      });
      return response.data.ID;
    } catch (e) {
      Logging.logError({
        tenantID: this.getTenantID(),
        module: MODULE_NAME, method: 'createExpenseReport',
        action: 'createExpenseReport', message: `Unable to create expense report:  ${JSON.stringify(e.response.data)}`
      });
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Unable to create expense reports`, 554,
        'ConcurConnector', 'createExpenseReport');
    }
  }

}

module.exports = ConcurConnector;
