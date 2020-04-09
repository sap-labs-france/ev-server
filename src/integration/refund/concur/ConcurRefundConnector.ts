import axios from 'axios';
import axiosRetry from 'axios-retry';
import jwt from 'jsonwebtoken';
import moment from 'moment-timezone';
import querystring from 'querystring';
import BackendError from '../../../exception/BackendError';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import CompanyStorage from '../../../storage/mongodb/CompanyStorage';
import ConnectionStorage from '../../../storage/mongodb/ConnectionStorage';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import UserStorage from '../../../storage/mongodb/UserStorage';
import { Action } from '../../../types/Authorization';
import Company from '../../../types/Company';
import Connection from '../../../types/Connection';
import { HTTPError } from '../../../types/HTTPError';
import { ConcurLocation, RefundStatus } from '../../../types/Refund';
import { ConcurRefundSetting } from '../../../types/Setting';
import Site from '../../../types/Site';
import Transaction from '../../../types/Transaction';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import I18nManager from '../../../utils/I18nManager';
import Logging from '../../../utils/Logging';
import RefundConnector from '../RefundConnector';

const MODULE_NAME = 'ConcurRefundConnector';
const CONNECTOR_ID = 'concur';

/**
 * A concur connector creates connection with the following data attributes
 * Instance_URL  string  -  Identifies the Concur datacenter where the user’s data resides. For example, if the Instance_Url is https://www.ea1.concursolutions.com, then all API calls for this user should use this URL as a prefix in subsequent API calls
 * Token  string  -  The access token value passed in the Authorization header when making API calls. It is a long-lived token which is currently set to expire after one year from creation. You should securely store the token and use it for all subsequent API requests until the token expires. Before it does, you should send a request to refresh the token prior to the expiration date.
 * Expiration_Date  string  -  The Universal Coordinated Time (UTC) date and time when the access token expires.
 * Refresh_Token  string  -  Token with a new expiration date of a year from the refresh date. You should securely store the refresh token for a user and use it for all subsequent API requests.
 */
export default class ConcurRefundConnector extends RefundConnector<ConcurRefundSetting> {

  constructor(tenantID: string, setting: ConcurRefundSetting) {
    super(tenantID, setting);
    axiosRetry(axios, {
      retries: 3,
      retryCondition: (error) => error.response.status === HTTPError.GENERAL_ERROR,
      retryDelay: (retryCount, error) => {
        try {
          if (error.config.method === 'post') {
            if (error.config.url.endsWith('/token')) {
              throw new BackendError({
                source: Constants.CENTRAL_SERVER,
                module: MODULE_NAME,
                method: 'retryDelay',
                message: `Unable to request token, response status ${error.response.status}, attempt ${retryCount}`,
                action: Action.REFUND,
                detailedMessages: { response: error.response }
              });
            } else {
              const payload = {
                error: error.response.data,
                payload: JSON.parse(error.config.data)
              };
              throw new BackendError({
                source: Constants.CENTRAL_SERVER,
                module: MODULE_NAME,
                method: 'retryDelay',
                message: `Unable to post data on ${error.config.url}, response status ${error.response.status}, attempt ${retryCount}`,
                action: Action.REFUND,
                detailedMessages: { payload }
              });
            }
          } else {
            throw new BackendError({
              source: Constants.CENTRAL_SERVER,
              module: MODULE_NAME,
              method: 'retryDelay',
              message: `Unable to ${error.config.url} data on ${error.config.url}, response status ${error.response.status}, attempt ${retryCount}`,
              action: Action.REFUND,
              detailedMessages: { response: error.response.data }
            });
          }
        } catch (err) {
          Logging.logException(err, Action.REFUND, Constants.CENTRAL_SERVER, MODULE_NAME, 'anonymous', tenantID, null);
        }
        return retryCount * 200;
      },
      shouldResetTimeout: true
    });
  }

  private computeValidUntilAt(result) {
    return new Date(result.data.refresh_expires_in * 1000);
  }

  private isTokenExpired(connection: Connection) {
    return moment(connection.updatedAt).add(connection.data.expires_in, 'seconds').isBefore(moment.now());
  }

  public async createConnection(userId: string, data: any): Promise<Connection> {
    try {
      Logging.logDebug({
        tenantID: this.tenantID,
        module: MODULE_NAME, method: 'createConnection',
        action: Action.REFUND, message: `request concur access token for ${userId}`
      });
      const result = await axios.post(`${this.setting.authenticationUrl}/oauth2/v0/token`,
        querystring.stringify({
          code: data.code,
          client_id: this.setting.clientId,
          client_secret: Cypher.decrypt(this.setting.clientSecret),
          redirect_uri: data.redirectUri,
          grant_type: 'authorization_code'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
      Logging.logDebug({
        tenantID: this.tenantID,
        module: MODULE_NAME, method: 'createConnection',
        action: Action.REFUND, message: `Concur access token granted for ${userId}`
      });
      const now = new Date();
      const connection: Connection = {
        data: result.data,
        userId: userId,
        connectorId: CONNECTOR_ID,
        createdAt: now,
        updatedAt: now,
        validUntil: this.computeValidUntilAt(result)
      };
      const newConnectionID = await ConnectionStorage.saveConnection(this.tenantID, connection);
      connection.id = newConnectionID;
      return connection;
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        message: `Concur access token not granted for ${userId}`,
        module: MODULE_NAME,
        method: 'GetAccessToken',
        user: userId,
        action: Action.REFUND,
        detailedMessages: { error }
      });
    }
  }

  public async refund(tenantID: string, userId: string, transactions: Transaction[], quickRefund = false): Promise<any> {
    const startDate = moment();
    const refundedTransactions = [];
    const connection = await this.getRefreshedConnection(userId);
    let expenseReportId;
    if (!quickRefund) {
      expenseReportId = await this.createExpenseReport(connection, transactions[0].timezone, userId);
    }
    await Promise.map(transactions,
      async (transaction: Transaction) => {
        try {
          const chargingStation = await ChargingStationStorage.getChargingStation(tenantID, transaction.chargeBoxID);
          let site;
          if (chargingStation.siteArea && chargingStation.siteArea.site) {
            site = chargingStation.siteArea.site;
          } else {
            site = (await SiteAreaStorage.getSiteArea(tenantID, chargingStation.siteAreaID, { withSite: true })).site;
          }
          const location = await this.getLocation(tenantID, connection, site);
          if (quickRefund) {
            const entryId = await this.createQuickExpense(connection, transaction, location, userId);
            transaction.refundData = { refundId: entryId, refundedAt: new Date() };
          } else {
            const entryId = await this.createExpenseReportEntry(connection, expenseReportId, transaction, location, userId);
            transaction.refundData = {
              refundId: entryId,
              status: RefundStatus.SUBMITTED,
              reportId: expenseReportId,
              refundedAt: new Date()
            };
          }
          await TransactionStorage.saveTransaction(tenantID, transaction);
          refundedTransactions.push(transaction);
        } catch (exception) {
          Logging.logException(exception, Action.REFUND, MODULE_NAME, MODULE_NAME, 'refund', this.tenantID, userId);
        }
      },
      { concurrency: 10 });
    Logging.logInfo({
      tenantID: this.tenantID,
      user: userId,
      action: Action.REFUND,
      module: MODULE_NAME, method: 'Refund',
      message: `${refundedTransactions.length} transactions have been transferred to Concur in ${moment().diff(startDate, 'milliseconds')} ms`
    });
    return refundedTransactions;
  }

  public async updateRefundStatus(tenantID: string, transaction: Transaction): Promise<string> {
    if (transaction.refundData) {
      const connection = await this.getRefreshedConnection(transaction.userID);
      const report = await this.getExpenseReport(connection, transaction.refundData.reportId);
      if (report) {
        // Approved
        if (report.ApprovalStatusCode === 'A_APPR') {
          transaction.refundData.status = RefundStatus.APPROVED;
          await TransactionStorage.saveTransaction(tenantID, transaction);
          Logging.logDebug({
            tenantID: tenantID,
            action: Action.SYNCHRONIZE_REFUND,
            module: MODULE_NAME, method: 'updateRefundStatus',
            message: `The Transaction ID '${transaction.id}' has been marked 'Approved'`,
            user: transaction.userID
          });
          return RefundStatus.APPROVED;
        }
        Logging.logDebug({
          tenantID: tenantID,
          action: Action.SYNCHRONIZE_REFUND,
          module: MODULE_NAME, method: 'updateRefundStatus',
          message: `The Transaction ID '${transaction.id}' has not been updated`,
          user: transaction.userID
        });
      } else {
        // Cancelled
        transaction.refundData.status = RefundStatus.CANCELLED;
        await TransactionStorage.saveTransaction(tenantID, transaction);
        Logging.logDebug({
          tenantID: tenantID,
          action: Action.SYNCHRONIZE_REFUND,
          module: MODULE_NAME, method: 'updateRefundStatus',
          message: `The Transaction ID '${transaction.id}' has been marked 'Cancelled'`,
          user: transaction.userID
        });
        return RefundStatus.CANCELLED;
      }
    }
  }

  public canBeDeleted(transaction: Transaction): boolean {
    if (transaction.refundData && transaction.refundData.status) {
      switch (transaction.refundData.status) {
        case RefundStatus.CANCELLED:
        case RefundStatus.NOT_SUBMITTED:
          return true;
        default:
          return false;
      }
    }
    return true;
  }

  private async getLocation(tenantID: string, connection: Connection, site: Site): Promise<ConcurLocation> {
    let response = await axios.get(`${this.setting.apiUrl}/api/v3.0/common/locations?city=${site.address.city}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${connection.data.access_token}`
      }
    });
    if (response.data && response.data.Items && response.data.Items.length > 0) {
      return response.data.Items[0];
    }
    // Get the company
    const company: Company = await CompanyStorage.getCompany(tenantID, site.companyID);
    response = await axios.get(`${this.setting.apiUrl}/api/v3.0/common/locations?city=${company.address.city}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${connection.data.access_token}`
      }
    });
    if (response.data && response.data.Items && response.data.Items.length > 0) {
      return response.data.Items[0];
    }
    throw new BackendError({
      source: Constants.CENTRAL_SERVER,
      message: `The city '${site.address.city}' of the station is unknown to Concur`,
      module: MODULE_NAME,
      method: 'getLocation',
      action: Action.REFUND
    });
  }

  private async createQuickExpense(connection: Connection, transaction: Transaction, location: ConcurLocation, userId: string) {
    try {
      // Get the user
      const user = await UserStorage.getUser(this.tenantID, userId);
      // Get the i18n lib
      const i18nManager = new I18nManager(user.locale);
      const startDate = moment();
      const response = await axios.post(`${this.setting.authenticationUrl}/quickexpense/v4/users/${jwt.decode(connection.data.access_token).sub}/context/TRAVELER/quickexpenses`, {
        'comment': `Session started on ${i18nManager.formatDateTime(moment.tz(transaction.timestamp, transaction.timezone).toDate())} during ${moment.duration(transaction.stop.totalDurationSecs, 'seconds').format('h[h]mm', { trim: false })} and consumed ${i18nManager.formatNumber(Math.trunc(transaction.stop.totalConsumption / 10) / 100)} kW.h`,
        'vendor': this.setting.reportName,
        'entryDetails': `Refund of transaction ${transaction.id}`,
        'expenseTypeID': this.setting.expenseTypeCode,
        'location': {
          'name': location.Name
        },
        'transactionAmount': {
          'currencyCode': transaction.stop.priceUnit,
          'value': transaction.stop.price
        },
        'transactionDate': moment.tz(transaction.timestamp, transaction.timezone).format('YYYY-MM-DD')
      }, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${connection.data.access_token}`
        }
      });
      Logging.logDebug({
        tenantID: this.tenantID,
        user: userId,
        action: Action.REFUND,
        module: MODULE_NAME, method: 'createQuickExpense',
        message: `Transaction ${transaction.id} has been successfully transferred in ${moment().diff(startDate, 'milliseconds')} ms with ${this.getRetryCount(response)} retries`
      });
      return response.data.quickExpenseIdUri;
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        message: 'Unable to create Quick Expense',
        module: MODULE_NAME,
        method: 'createQuickExpense',
        user: userId,
        action: Action.REFUND,
        detailedMessages: { error }
      });
    }
  }

  private async createExpenseReportEntry(connection: Connection, expenseReportId: string, transaction: Transaction, location: ConcurLocation, userId: string) {
    try {
      // Get the user
      const user = await UserStorage.getUser(this.tenantID, userId);
      // Get the i18n lib
      const i18nManager = new I18nManager(user.locale);
      const startDate = moment();
      const response = await axios.post(`${this.setting.apiUrl}/api/v3.0/expense/entries`, {
        'Description': `E-Mobility reimbursement ${moment.tz(transaction.timestamp, transaction.timezone).format('YYYY-MM-DD')}`,
        'Comment': `Session started on ${i18nManager.formatDateTime(moment.tz(transaction.timestamp, transaction.timezone).toDate())} during ${moment.duration(transaction.stop.totalDurationSecs, 'seconds').format('h[h]mm', { trim: false })} and consumed ${i18nManager.formatNumber(Math.trunc(transaction.stop.totalConsumption / 10) / 100)} kW.h`,
        'VendorDescription': 'E-Mobility',
        'Custom1': transaction.id,
        'ExpenseTypeCode': this.setting.expenseTypeCode,
        'IsBillable': true,
        'IsPersonal': false,
        'PaymentTypeID': this.setting.paymentTypeId,
        'ReportID': expenseReportId,
        'TaxReceiptType': 'N',
        'TransactionAmount': transaction.stop.price,
        'TransactionCurrencyCode': transaction.stop.priceUnit,
        'TransactionDate': moment.tz(transaction.timestamp, transaction.timezone).format('YYYY-MM-DD'),
        'SpendCategoryCode': 'COCAR',
        'LocationID': location.ID

      }, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${connection.data.access_token}`
        }
      });
      Logging.logDebug({
        tenantID: this.tenantID,
        user: userId,
        action: Action.REFUND,
        module: MODULE_NAME, method: 'createExpenseReportEntry',
        message: `Transaction ${transaction.id} has been successfully transferred in ${moment().diff(startDate, 'milliseconds')} ms with ${this.getRetryCount(response)} retries`
      });
      return response.data.ID;
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        message: 'Unable to create an Expense Report',
        module: MODULE_NAME,
        method: 'createExpenseReport',
        user: userId,
        action: Action.REFUND,
        detailedMessages: { error }
      });
    }
  }

  private async createExpenseReport(connection: Connection, timezone: string, userId: string) {
    try {
      const startDate = moment();
      const response = await axios.post(`${this.setting.apiUrl}/api/v3.0/expense/reports`, {
        'Name': `${this.setting.reportName} - ${moment.tz(timezone).format('DD/MM/YY HH:mm')}`,
        'PolicyID': this.setting.policyId
      }, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${connection.data.access_token}`
        }
      });
      Logging.logDebug({
        tenantID: this.tenantID,
        user: userId,
        action: Action.REFUND,
        module: MODULE_NAME, method: 'createExpenseReport',
        message: `Report has been successfully created in ${moment().diff(startDate, 'milliseconds')} ms with ${this.getRetryCount(response)} retries`
      });
      return response.data.ID;
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        message: 'Unable to create an Expense Report',
        module: MODULE_NAME, method: 'createExpenseReport',
        user: userId,
        action: Action.REFUND,
        detailedMessages: { error }
      });
    }
  }

  private getRetryCount(response) {
    if (response && response.config) {
      return response.config['axios-retry'].retryCount;
    }
    return 0;
  }

  private async getExpenseReport(connection: Connection, reportId: string) {
    try {
      const response = await axios.get(`${this.setting.apiUrl}/api/v3.0/expense/reports/${reportId}`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${connection.data.access_token}`
        }
      });
      return response.data;
    } catch (error) {
      if (error.response.status === 404) {
        return null;
      }
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        message: `Unable to get Report details with ID '${reportId}'`,
        module: MODULE_NAME,
        method: 'getExpenseReport',
        action: Action.REFUND,
        detailedMessages: { error }
      });
    }
  }

  private async getExpenseReports(connection: Connection) {
    try {
      const response = await axios.get(`${this.setting.apiUrl}/api/v3.0/expense/reports?approvalStatusCode=A_NOTF`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${connection.data.access_token}`
        }
      });
      return response.data.Items;
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        message: 'Unable to get expense Reports',
        module: MODULE_NAME,
        method: 'getExpenseReports',
        action: Action.REFUND,
        detailedMessages: { error }
      });
    }
  }

  private async refreshToken(userId: string, connection: Connection): Promise<Connection> {
    try {
      const startDate = moment();
      const response = await axios.post(`${this.setting.authenticationUrl}/oauth2/v0/token`,
        querystring.stringify({
          client_id: this.setting.clientId,
          client_secret: Cypher.decrypt(this.setting.clientSecret),
          refresh_token: connection.data.refresh_token,
          scope: connection.data.scope,
          grant_type: 'refresh_token'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
      Logging.logDebug({
        tenantID: this.tenantID,
        user: userId,
        action: Action.REFUND,
        module: MODULE_NAME, method: 'refreshToken',
        message: `Concur access token has been successfully generated in ${moment().diff(startDate, 'milliseconds')} ms with ${this.getRetryCount(response)} retries`
      });
      connection.data = response.data;
      connection.updatedAt = new Date();
      connection.validUntil = this.computeValidUntilAt(response);
      connection.id = await ConnectionStorage.saveConnection(this.tenantID, connection);
      return connection;
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        message: `Concur access token not refreshed (ID: '${userId}')`,
        module: MODULE_NAME,
        method: 'refreshToken',
        action: Action.REFUND,
        user: userId,
        detailedMessages: { error }
      });
    }
  }

  private async getRefreshedConnection(userId: string): Promise<Connection> {
    let connection = await ConnectionStorage.getConnectionByConnectorIdAndUserId(this.tenantID, CONNECTOR_ID, userId);
    if (!connection) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        message: `The user with ID '${userId}' does not have a connection to connector '${CONNECTOR_ID}'`,
        module: MODULE_NAME,
        method: 'getRefreshedConnection',
        action: Action.REFUND,
        user: userId
      });
    }
    if (this.isTokenExpired(connection)) {
      connection = await this.refreshToken(userId, connection);
    }
    return connection;
  }
}
