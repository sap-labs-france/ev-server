import AbstractConnector from '../AbstractConnector';
import Logging from '../../utils/Logging';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import querystring from 'querystring';
import moment from 'moment-timezone';
import ConnectionStorage from '../../storage/mongodb/ConnectionStorage';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import ChargingStation from "../../entity/ChargingStation";
import Constants from '../../utils/Constants';
import AppError from '../../exception/AppError';
import InternalError from '../../exception/InternalError';
import jwt from 'jsonwebtoken';
import BBPromise from "bluebird";
import Transaction from '../../entity/Transaction';
import Cypher from '../../utils/Cypher';
import Site from '../../entity/Site';

const MODULE_NAME = 'ConcurConnector';
const CONNECTOR_ID = 'concur';

/**
 * A concur connector creates connection with the following data attributes
 * Instance_URL  string  -  Identifies the Concur datacenter where the user’s data resides. For example, if the Instance_Url is https://www.ea1.concursolutions.com, then all API calls for this user should use this URL as a prefix in subsequent API calls
 * Token  string  -  The access token value passed in the Authorization header when making API calls. It is a long-lived token which is currently set to expire after one year from creation. You should securely store the token and use it for all subsequent API requests until the token expires. Before it does, you should send a request to refresh the token prior to the expiration date.
 * Expiration_Date  string  -  The Universal Coordinated Time (UTC) date and time when the access token expires.
 * Refresh_Token  string  -  Token with a new expiration date of a year from the refresh date. You should securely store the refresh token for a user and use it for all subsequent API requests.
 */export default class ConcurConnector extends AbstractConnector {
  public getSetting: any;
  public getTenantID: any;
  public getConnectionByUserId: any;

  constructor(tenantID, setting) {
    super(tenantID, 'concur', setting);
    axiosRetry(axios,
      {
        retries: 3,
        retryCondition: (error) => {
          return error.response.status === 500;
        },
        retryDelay: (retryCount, error) => {
          if (error.config.method === 'post') {
            if (error.config.url.endsWith('/token')) {
              Logging.logException(new InternalError(`Unable to request token, response status ${error.response.status}, attempt ${retryCount}`, error.response.data), "Refund", MODULE_NAME, MODULE_NAME, "AxiosRetry", tenantID);
            } else {
              const payload = {
                error: error.response.data,
                payload: JSON.parse(error.config.data)
              };
              Logging.logException(new InternalError(`Unable to post data on ${error.config.url}, response status ${error.response.status}, attempt ${retryCount}`, payload), "Refund", MODULE_NAME, MODULE_NAME, "AxiosRetry", tenantID);
            }
          } else {
            Logging.logException(new InternalError(`Unable to ${error.config.url} data on ${error.config.url}, response status ${error.response.status}, attempt ${retryCount}`, error.response.data), "Refund", MODULE_NAME, MODULE_NAME, "AxiosRetry", tenantID);
          }
          return retryCount * 200;
        },
        shouldResetTimeout: true
      });
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

  getClientSecretDecrypted() {
    return Cypher.decrypt(this.getSetting().clientSecret);
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
        action: 'GetAccessToken', message: `request concur access token for ${userId}`
      });
      const result = await axios.post(`${this.getAuthenticationUrl()}/oauth2/v0/token`,
        querystring.stringify({
          code: data.code,
          client_id: this.getClientId(),
          client_secret: this.getClientSecretDecrypted(),
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
        action: 'GetAccessToken', message: `Concur access token granted for ${userId}`
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
        action: 'GetAccessToken',
        message: `Concur access token not granted for ${userId} ${JSON.stringify(e.response.data)}`,
        error: e
      });
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Concur access token not granted for ${userId}`, 500,
        MODULE_NAME, 'GetAccessToken', userId);
    }
  }

  async refreshToken(userId, connection) {
    try {
      const startDate = moment();
      const response = await axios.post(`${this.getAuthenticationUrl()}/oauth2/v0/token`,
        querystring.stringify({
          client_id: this.getClientId(),
          client_secret: this.getClientSecretDecrypted(),
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
        user: userId,
        source: MODULE_NAME, action: "Refund",
        module: MODULE_NAME, method: "createQuickExpense",
        message: `Concur access token has been successfully generated in ${moment().diff(startDate, 'milliseconds')} ms with ${this.getRetryCount(response)} retries`
      });
      connection.updateData(response.data, new Date(), ConcurConnector.computeValidUntilAt(response));
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
        MODULE_NAME, 'refreshToken', userId);
    }
  }

  /**
   *
   * @param user {User}
   * @param transactions {Transaction}
   * @param quickRefund
   * @returns {Promise<Transaction[]>}
   */
  async refund(user, transactions, quickRefund = false) {
    const startDate = moment();
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
    let expenseReportId;

    if (!quickRefund) {
      expenseReportId = await this.createExpenseReport(connection, transactions[0].getTimezone(), user);
    }

    await BBPromise.map(transactions,
      async (transaction: Transaction) => {
        try {
          const chargingStation = await ChargingStation.getChargingStation(transaction.getTenantID(), transaction.getChargeBoxID());
          const locationId = await this.getLocation(connection, await chargingStation.getSite());
          if (quickRefund) {
            const entryId = await this.createQuickExpense(connection, transaction, locationId, user);
            transaction.setRefundData({refundId: entryId, type: 'quick', refundedAt: new Date()});
          } else {
            const entryId = await this.createExpenseReportEntry(connection, expenseReportId, transaction, locationId, user);
            transaction.setRefundData({
              refundId: entryId,
              type: 'report',
              reportId: expenseReportId,
              refundedAt: new Date()
            });
          }
          await TransactionStorage.saveTransaction(transaction.getTenantID(), transaction.getModel());
          refundedTransactions.push(transaction);
        } catch (exception) {
          Logging.logException(exception, "Refund", MODULE_NAME, MODULE_NAME, "refund", this.getTenantID(), user);
        }
      },
      {concurrency: 10});

    Logging.logInfo({
      tenantID: this.getTenantID(),
      user: user.getID(),
      source: MODULE_NAME, action: "Refund",
      module: MODULE_NAME, method: "Refund",
      message: `${refundedTransactions.length} transactions have been transferred to Concur in ${moment().diff(startDate, 'milliseconds')} ms`
    });

    return refundedTransactions;
  }

  async getReportDetails(connection, reportId) {
    try {

      const response = await axios.get(`${this.getApiUrl()}/api/expense/expensereport/v2.0/report/${reportId}`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${connection.getData().access_token}`
        }
      });
      return response.data;
    } catch (e) {
      throw new InternalError(`Unable to get report details, response status ${e.response.status}`, e.response.data);
    }
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
      throw new InternalError(`Unable to get expense reports, response status ${e.response.status}`, e.response.data);
    }
  }

  async getLocation(connection, site: Site) {
    let response = await axios.get(`${this.getApiUrl()}/api/v3.0/common/locations?city=${site.getAddress().city}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${connection.getData().access_token}`
      }
    });
    if (response.data && response.data.Items && response.data.Items.length > 0) {
      return response.data.Items[0];
    }
    const company = await site.getCompany();
    response = await axios.get(`${this.getApiUrl()}/api/v3.0/common/locations?city=${company.address.city}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${connection.getData().access_token}`
      }
    });
    if (response.data && response.data.Items && response.data.Items.length > 0) {
      return response.data.Items[0];
    }

    throw new AppError(
      MODULE_NAME,
      `The city '${site.getAddress().city}' of the station is unknown to Concur`, 553,
      MODULE_NAME, 'getLocation');
  }

  /**
   *
   * @param connection {Connection}
   * @param transaction {Transaction}
   * @param location
   * @param user
   * @returns {Promise<string>}
   */
  async createQuickExpense(connection, transaction, location, user) {
    try {
      const startDate = moment();
      const response = await axios.post(`${this.getAuthenticationUrl()}/quickexpense/v4/users/${jwt.decode(connection.getData().access_token).sub}/context/TRAVELER/quickexpenses`, {
        'comment': `Session started the ${moment.tz(transaction.getStartDate(), transaction.getTimezone()).format("YYYY-MM-DD HH:mm:ss")} during ${moment.duration(transaction.getStopTotalDurationSecs(), 'seconds').format(`h[h]mm`, {trim: false})}`,
        'vendor': this.getReportName(),
        'entryDetails': `Refund of transaction ${transaction.getID}`,
        'expenseTypeID': this.getExpenseTypeCode(),
        'location': {
          'name': location.Name
        },
        'transactionAmount': {
          'currencyCode': transaction.getStopPriceUnit(),
          'value': transaction.getStopPrice()
        },
        'transactionDate': moment.tz(transaction.getStartDate(), transaction.getTimezone()).format("YYYY-MM-DD")
      }, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${connection.getData().access_token}`
        }
      });
      Logging.logDebug({
        tenantID: this.getTenantID(),
        user: user.getID(),
        source: MODULE_NAME, action: "Refund",
        module: MODULE_NAME, method: "createQuickExpense",
        message: `Transaction ${transaction.getID()} has been successfully transferred in ${moment().diff(startDate, 'milliseconds')} ms with ${this.getRetryCount(response)} retries`
      });
      return response.data.quickExpenseIdUri;
    } catch (e) {
      if (e.response) {
        throw new InternalError(`Unable to create quickExpense, response status ${e.response.status}`, e.response.data);
      } else {
        throw new InternalError(`Unable to create expense report`, e);
      }
    }
  }

  /**
   *
   * @param connection {Connection}
   * @param expenseReportId {string}
   * @param transaction {Transaction}
   * @param location {Location}
   * @param user
   * @returns {Promise<string>}
   */
  async createExpenseReportEntry(connection, expenseReportId, transaction, location, user) {
    try {
      const startDate = moment();
      const response = await axios.post(`${this.getApiUrl()}/api/v3.0/expense/entries`, {
        'Description': `E-Mobility reimbursement ${moment.tz(transaction.getStartDate(), transaction.getTimezone()).format("YYYY-MM-DD")}`,
        'Comment': `Session started the ${moment.tz(transaction.getStartDate(), transaction.getTimezone()).format("YYYY-MM-DD HH:mm:ss")} during ${moment.duration(transaction.getStopTotalDurationSecs(), 'seconds').format(`h[h]mm`, {trim: false})}`,
        'VendorDescription': 'E-Mobility',
        'Custom1': transaction.getID(),
        'ExpenseTypeCode': this.getExpenseTypeCode(),
        'IsBillable': true,
        'IsPersonal': false,
        'PaymentTypeID': this.getPaymentTypeID(),
        'ReportID': expenseReportId,
        'TaxReceiptType': 'N',
        'TransactionAmount': transaction.getStopPrice(),
        'TransactionCurrencyCode': transaction.getStopPriceUnit(),
        'TransactionDate': moment.tz(transaction.getStartDate(), transaction.getTimezone()).format("YYYY-MM-DD"),
        'SpendCategoryCode': 'COCAR',
        'LocationID': location.ID

      }, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${connection.getData().access_token}`
        }
      });
      Logging.logDebug({
        tenantID: this.getTenantID(),
        user: user.getID(),
        source: MODULE_NAME, action: "Refund",
        module: MODULE_NAME, method: "createExpenseReportEntry",
        message: `Transaction ${transaction.getID()} has been successfully transferred in ${moment().diff(startDate, 'milliseconds')} ms with ${this.getRetryCount(response)} retries`
      });
      return response.data.ID;
    } catch (e) {
      if (e.response) {
        throw new InternalError(`Unable to create expense entry, response status ${e.response.status}`, e.response.data);
      } else {
        throw new InternalError(`Unable to create expense entry`, e);
      }
    }
  }

  /**
   *
   * @param connection
   * @param timezone
   * @returns {Promise<void>}
   */
  async createExpenseReport(connection, timezone, user) {
    try {
      const startDate = moment();
      const response = await axios.post(`${this.getApiUrl()}/api/v3.0/expense/reports`, {
        'Name': `${this.getReportName()} - ${moment.tz(timezone).format("DD/MM/YY HH:mm")}`,
        'PolicyID': this.getPolicyID()
      }, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${connection.getData().access_token}`
        }
      });
      Logging.logDebug({
        tenantID: this.getTenantID(),
        user: user.getID(),
        source: MODULE_NAME, action: "Refund",
        module: MODULE_NAME, method: "createExpenseReport",
        message: `Report has been successfully created in ${moment().diff(startDate, 'milliseconds')} ms with ${this.getRetryCount(response)} retries`
      });
      return response.data.ID;
    } catch (e) {
      if (e.response) {
        throw new InternalError(`Unable to create expense report, response status ${e.response.status}`, e.response.data);
      } else {
        throw new InternalError(`Unable to create expense report`, e);
      }
    }
  }

  getRetryCount(response) {
    if (response && response.config) {
      return response.config['axios-retry'].retryCount;
    }
    return 0;
  }

}


