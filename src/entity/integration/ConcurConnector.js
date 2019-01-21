const AbstractConnector = require('./AbstractConnector');
const Logging = require('../../utils/Logging');
const axios = require('axios');
const querystring = require('querystring');
const moment = require('moment');
const ConnectionStorage = require('../../storage/mongodb/ConnectionStorage');
const TransactionStorage = require('../../storage/mongodb/TransactionStorage');
const ChargingStation = require("../ChargingStation");
const Constants = require('../../utils/Constants');
const AppError = require('../../exception/AppError');

const MODULE_NAME = 'ConcurConnector';
const CONNECTOR_ID = 'concur';
const REPORT_NAME = 'Charge At Home';

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

  getUrl() {
    return this.getSetting().url;
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
      const result = await axios.post(`${this.getUrl()}/oauth2/v0/token`,
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
        module: MODULE_NAME, method: 'createConnection',
        action: 'getAccessToken', message: `Concur access token not granted for ${userId}`
      });
      throw e;
    }
  }

  async refreshToken(userId, connection) {
    try {
      Logging.logDebug({
        tenantID: this.getTenantID(),
        module: MODULE_NAME, method: 'refreshToken',
        action: 'refreshAccessToken', message: `request concur refresh token for ${userId}`
      });
      const result = await axios.post(`${this.getUrl()}/oauth2/v0/token`,
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
      throw e;
    }
  }

  /**
   *
   * @param user {User}
   * @param transaction {Transaction}
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
      connection = await this.refreshToken(user.getID(), connection)
    }
    const expenseReports = await this.getExpenseReports(connection);
    const expenseReport = expenseReports.find(report => report.Name === REPORT_NAME);
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
          module: 'TransactionService', method: 'handleRefundTransactions',
          message: e.message,
        });
      }
    }
    return refundedTransactions;
  }


  async getExpenseReports(connection) {
    const response = await axios.get(`${this.getUrl()}/api/v3.0/expense/reports?approvalStatusCode=A_NOTF`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${connection.getData().access_token}`
      }
    });
    return response.data.Items;
  }

  async getLocationId(connection, site) {
    const response = await axios.get(`${this.getUrl()}/api/v3.0/common/locations?city=${site.getAddress().city}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${connection.getData().access_token}`
      }
    });
    return response.data.Items[0].ID;
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

      const response = await axios.post(`${this.getUrl()}/api/v3.0/expense/entries`, {
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
    const response = await axios.post(`${this.getUrl()}/api/v3.0/expense/reports`, {
      'Name': REPORT_NAME,
    }, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${connection.getData().access_token}`
      }
    });
    return response.data.ID;
  }

//https://www-us.api.concursolutions.com/oauth2/v0/authorize?client_id=c524d36b-823f-4574-8c99-4b28dbb8f42c&redirect_uri=https://slfcah.cfapps.eu10.hana.ondemand.com&scope=EXPRPT&response_type=code
}

module.exports = ConcurConnector;
