const AbstractConnector = require('./AbstractConnector');
const Logging = require('../../utils/Logging');
const axios = require('axios');
const ConnectionStorage = require('../../storage/mongodb/ConnectionStorage');
const TransactionStorage = require('../../storage/mongodb/TransactionStorage');

const MODULE_NAME = 'ConcurConnector';
const CONNECTOR_ID = 'concur';

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
   * @param connection {Connection}
   */
  async refund(transaction, connection) {

  }
}

module.exports = ConcurConnector;
