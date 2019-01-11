const AbstractConnector = require('./AbstractConnector');
const Logging = require('../../utils/Logging');
const axios = require('axios');
const ConnectionStorage = require('../../storage/mongodb/ConnectionStorage');
const TransactionStorage = require('../../storage/mongodb/TransactionStorage');

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
    super(tenantID, setting);
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
      const result = await axios.get(`${this.getUrl()}/net2/oauth2/GetAccessToken.ashx?code=${data.code}&client_id=${this.getClientId()}&client_secret=${this.getClientSecret()}`, {
        headers: {
          Accept: 'application/json'
        }
      });
      Logging.logDebug({
        tenantID: this.getTenantID(),
        module: MODULE_NAME, method: 'createConnection',
        action: 'getAccessToken', message: `Concur access token granted for ${userId}`
      });
      const connection = ConnectionStorage.saveConnection(this.getTenantID(), {
        data: result.data.Access_Token,
        userId: userId,
        connectorId: CONNECTOR_ID,
        createdAt: new Date()
      });
      return connection;
    } catch (e) {
      Logging.logError({
        tenantID: this.getTenantID(),
        module: MODULE_NAME, method: 'createConnection',
        action: 'getAccessToken', message: `Concur access token not granted for ${userId}`
      });
      throw e;
    }
  }

  /**
   *
   * @param transaction {Transaction}
   * @returns {Promise<void>}
   */
  async refund(transaction) {
    const connection = this.getConnectionByUserId(transaction.getUserID());
    const response = await axios.post(`${this.getUrl()}/net2/oauth2/GetAccessToken.ashx?code=${data.code}&client_id=${this.getClientId()}&client_secret=${this.getClientSecret()}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `OAuth ${connection.getData().Token}`
      }
    });
  }

  async getExpenseReports(connection) {

  }

  async getExpenseReports(connection) {
    const response = await axios.get(`${this.getUrl()}/v3.0/expense/reports`, {
      headers: {
        Accept: 'application/json',
        Authorization: `OAuth ${connection.getData().Token}`
      }
    });
  }

  async createExpenseReport(transaction, connection) {
    const response = await axios.post(`${this.getUrl()}/v3.0/expense/reports`, {
      'Name': util.format("E-Mobility %s", sDate),
      'Total': oModel.txn.price,
      'CurrencyCode': oModel.global.price.currencyCode,
      'Country': oModel.txn.ev.country.code,
      'LedgerName': oModel.global.vendor
    }, {
      headers: {
        Accept: 'application/json',
        Authorization: `OAuth ${connection.getData().Token}`
      }
    });
  }


}

module.exports = ConcurConnector;
