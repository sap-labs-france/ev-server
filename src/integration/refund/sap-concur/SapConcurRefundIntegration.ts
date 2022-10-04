import { AxiosInstance, AxiosResponse } from 'axios';
import { ConcurLocation, RefundStatus } from '../../../types/Refund';
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry';

import AxiosFactory from '../../../utils/AxiosFactory';
import BackendError from '../../../exception/BackendError';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import Company from '../../../types/Company';
import CompanyStorage from '../../../storage/mongodb/CompanyStorage';
import { ConcurRefundSetting } from '../../../types/Setting';
import Connection from '../../../types/Connection';
import ConnectionStorage from '../../../storage/mongodb/ConnectionStorage';
import Cypher from '../../../utils/Cypher';
import I18nManager from '../../../utils/I18nManager';
import Logging from '../../../utils/Logging';
import { Promise } from 'bluebird';
import RefundIntegration from '../RefundIntegration';
import { ServerAction } from '../../../types/Server';
import Site from '../../../types/Site';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../../../types/Tenant';
import Transaction from '../../../types/Transaction';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import UserStorage from '../../../storage/mongodb/UserStorage';
import Utils from '../../../utils/Utils';
import jwt from 'jsonwebtoken';
import moment from 'moment-timezone';
import querystring from 'querystring';

const MODULE_NAME = 'ConcurRefundIntegration';
const CONNECTOR_ID = 'concur';

/**
 * A concur connector creates connection with the following data attributes
 * Instance_URL  string  -  Identifies the Concur datacenter where the user’s data resides. For example, if the Instance_Url is https://www.ea1.concursolutions.com, then all API calls for this user should use this URL as a prefix in subsequent API calls
 * Token  string  -  The access token value passed in the Authorization header when making API calls. It is a long-lived token which is currently set to expire after one year from creation. You should securely store the token and use it for all subsequent API requests until the token expires. Before it does, you should send a request to refresh the token prior to the expiration date.
 * Expiration_Date  string  -  The Universal Coordinated Time (UTC) date and time when the access token expires.
 * Refresh_Token  string  -  Token with a new expiration date of a year from the refresh date. You should securely store the refresh token for a user and use it for all subsequent API requests.
 */
export default class SapConcurRefundIntegration extends RefundIntegration<ConcurRefundSetting> {
  private axiosInstance: AxiosInstance;
  private readonly axiosRetryConfiguration: IAxiosRetryConfig = {
    retries: 3,
    retryCondition: (error) => error.response.status === StatusCodes.INTERNAL_SERVER_ERROR || axiosRetry.isNetworkError(error),
    retryDelay: (retryCount, error) => {
      try {
        if (error.config.method === 'post') {
          if (error.config.url.endsWith('/token')) {
            throw new BackendError({
              module: MODULE_NAME,
              method: 'retryDelay',
              message: `Unable to post token, response status ${error.response.status}, attempt ${retryCount}`,
              action: ServerAction.REFUND,
              detailedMessages: { response: error.response }
            });
          } else {
            const payload = {
              error: error.response.data,
              payload: JSON.parse(error.config.data)
            };
            throw new BackendError({
              module: MODULE_NAME,
              method: 'retryDelay',
              message: `Unable to post data on ${error.config.url}, response status ${error.response.status}, attempt ${retryCount}`,
              action: ServerAction.REFUND,
              detailedMessages: { payload }
            });
          }
        } else {
          throw new BackendError({
            module: MODULE_NAME,
            method: 'retryDelay',
            message: `Unable to make data request on ${error.config.url}, response status ${error.response.status}, attempt ${retryCount}`,
            action: ServerAction.REFUND,
            detailedMessages: { response: error.response.data }
          });
        }
      } catch (error) {
        void Logging.logException(error, ServerAction.REFUND, MODULE_NAME, 'anonymous', this.tenant.id);
      }
      return axiosRetry.exponentialDelay(retryCount);
    },
    shouldResetTimeout: true
  };

  public constructor(tenant: Tenant, setting: ConcurRefundSetting) {
    super(tenant, setting);
    // Get Axios
    this.axiosInstance = AxiosFactory.getAxiosInstance(this.tenant,
      {
        axiosRetryConfig: this.axiosRetryConfiguration,
      });
  }

  public async checkConnection(userID: string): Promise<void> {
    const connection = await this.getRefreshedConnection(userID);
    if (!connection) {
      throw new BackendError({
        module: MODULE_NAME,
        user: userID,
        method: 'checkConnection', action: ServerAction.REFUND,
        message: `The user with ID '${userID}' does not have a valid connection`,
      });
    }
  }

  public async createConnection(userID: string, data: any): Promise<Connection> {
    try {
      await Logging.logDebug({
        tenantID: this.tenant.id,
        module: MODULE_NAME, method: 'createConnection',
        action: ServerAction.REFUND, message: `Request Concur access token for User ID '${userID}'`
      });
      const concurURL = `${this.setting.authenticationUrl}/oauth2/v0/token`;
      const response = await this.axiosInstance.post(concurURL,
        querystring.stringify({
          code: data.code,
          client_id: this.setting.clientId,
          client_secret: await Cypher.decrypt(this.tenant, this.setting.clientSecret),
          redirect_uri: data.redirectUri,
          grant_type: 'authorization_code'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
      await Logging.logDebug({
        tenantID: this.tenant.id,
        module: MODULE_NAME, method: 'createConnection',
        action: ServerAction.REFUND, message: `Concur access token granted for User ID '${userID}'`
      });
      // Check first
      let connection = await ConnectionStorage.getConnectionByConnectorIdAndUserId(this.tenant, CONNECTOR_ID, userID);
      if (connection) {
        // Update
        connection.data = response.data;
        connection.updatedAt = new Date();
        connection.validUntil = this.computeValidUntilAt(response);
      } else {
        // Create new
        connection = {
          data: response.data,
          userId: userID,
          connectorId: CONNECTOR_ID,
          createdAt: new Date(),
          validUntil: this.computeValidUntilAt(response)
        };
      }
      // Save
      connection.id = await ConnectionStorage.saveConnection(this.tenant, connection);
      return connection;
    } catch (error) {
      throw new BackendError({
        message: `Concur access token not granted for User ID '${userID}'`,
        module: MODULE_NAME,
        method: 'GetAccessToken',
        user: userID,
        action: ServerAction.REFUND,
        detailedMessages: { error: error.stack }
      });
    }
  }

  public async refund(userID: string, transactions: Transaction[], quickRefund = false): Promise<Transaction[]> {
    const startDate = moment();
    const refundedTransactions: Transaction[] = [];
    const connection = await this.getRefreshedConnection(userID);
    let expenseReportId;
    if (!quickRefund) {
      expenseReportId = await this.createExpenseReport(connection, transactions[0].timezone, userID);
    }
    await Promise.map(transactions,
      async (transaction: Transaction) => {
        try {
          const chargingStation = await ChargingStationStorage.getChargingStation(this.tenant, transaction.chargeBoxID, { withSite: true });
          const location = await this.getLocation(this.tenant, connection, chargingStation.site);
          if (quickRefund) {
            const entryId = await this.createQuickExpense(connection, transaction, location, userID);
            transaction.refundData = {
              refundId: entryId,
              refundedAt: new Date()
            };
          } else {
            const entryId = await this.createExpenseReportEntry(connection, expenseReportId, transaction, location, userID);
            transaction.refundData = {
              refundId: entryId,
              status: RefundStatus.SUBMITTED,
              reportId: expenseReportId,
              refundedAt: new Date()
            };
          }
          await TransactionStorage.saveTransactionRefundData(this.tenant, transaction.id, transaction.refundData);
          refundedTransactions.push(transaction);
        } catch (error) {
          await Logging.logException(error, ServerAction.REFUND, MODULE_NAME, 'refund', this.tenant.id, userID);
        }
      },
      { concurrency: 10 });
    await Logging.logInfo({
      tenantID: this.tenant.id,
      user: userID,
      action: ServerAction.REFUND,
      module: MODULE_NAME, method: 'Refund',
      message: `${refundedTransactions.length} transactions have been transferred to Concur in ${moment().diff(startDate, 'milliseconds')} ms`
    });
    return refundedTransactions;
  }

  public async updateRefundStatus(tenant: Tenant, transaction: Transaction): Promise<RefundStatus> {
    if (transaction.refundData) {
      const connection = await this.getRefreshedConnection(transaction.userID);
      const report = await this.getExpenseReport(connection, transaction.refundData.reportId);
      if (report) {
        // Approved
        if (report.ApprovalStatusCode === 'A_APPR') {
          transaction.refundData.status = RefundStatus.APPROVED;
          await TransactionStorage.saveTransactionRefundData(tenant, transaction.id, transaction.refundData);
          await Logging.logDebug({
            tenantID: tenant.id,
            action: ServerAction.SYNCHRONIZE_REFUND,
            module: MODULE_NAME, method: 'updateRefundStatus',
            message: `The Transaction ID '${transaction.id}' has been marked 'Approved'`,
            user: transaction.userID
          });
          return RefundStatus.APPROVED;
        }
        await Logging.logDebug({
          tenantID: tenant.id,
          action: ServerAction.SYNCHRONIZE_REFUND,
          module: MODULE_NAME, method: 'updateRefundStatus',
          message: `The Transaction ID '${transaction.id}' has not been updated`,
          user: transaction.userID
        });
      } else {
        // Cancelled
        transaction.refundData.status = RefundStatus.CANCELLED;
        await TransactionStorage.saveTransactionRefundData(tenant, transaction.id, transaction.refundData);
        await Logging.logDebug({
          tenantID: tenant.id,
          action: ServerAction.SYNCHRONIZE_REFUND,
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

  private computeValidUntilAt(response: AxiosResponse) {
    return new Date(response.data.refresh_expires_in * 1000);
  }

  private isTokenExpired(connection: Connection) {
    const referenceDate = connection.updatedAt ? connection.updatedAt : connection.createdAt;
    if (!referenceDate || !connection.data.expires_in) {
      return true;
    }
    return moment(referenceDate).add(connection.data.expires_in, 'seconds').isBefore(moment.now());
  }

  private async getLocation(tenant: Tenant, connection: Connection, site: Site): Promise<ConcurLocation> {
    let concurURL = `${this.setting.apiUrl}/api/v3.0/common/locations?city=${site.address.city}`;
    let response = await this.axiosInstance.get(concurURL, {
      headers: {
        Accept: 'application/json',
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        Authorization: `Bearer ${connection.data.access_token}`
      }
    });
    if (response.data && !Utils.isEmptyArray(response.data.Items)) {
      return response.data.Items[0];
    }
    // Get the company
    const company: Company = await CompanyStorage.getCompany(tenant, site.companyID);
    concurURL = `${this.setting.apiUrl}/api/v3.0/common/locations?city=${company.address.city}`;
    response = await this.axiosInstance.get(concurURL, {
      headers: {
        Accept: 'application/json',
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        Authorization: `Bearer ${connection.data.access_token}`
      }
    });
    if (response.data && !Utils.isEmptyArray(response.data.Items)) {
      return response.data.Items[0];
    }
    throw new BackendError({
      message: `The city '${site.address.city}' of the station is unknown to Concur`,
      module: MODULE_NAME,
      method: 'getLocation',
      action: ServerAction.REFUND
    });
  }

  private async createQuickExpense(connection: Connection, transaction: Transaction, location: ConcurLocation, userID: string) {
    try {
      // Get the user
      const user = await UserStorage.getUser(this.tenant, userID);
      // Get the i18n lib
      const i18nManager = I18nManager.getInstanceForLocale(user.locale);
      const startDate = moment();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const concurURL = `${this.setting.authenticationUrl}/quickexpense/v4/users/${jwt.decode(connection.data.access_token).sub}/context/TRAVELER/quickexpenses`;
      const response = await this.axiosInstance.post(concurURL, {
        'comment': `Session started on ${i18nManager.formatDateTime(moment.tz(transaction.timestamp, transaction.timezone).toDate())} during ${moment.duration(transaction.stop.totalDurationSecs, 'seconds').format('h[h]mm', { trim: false })} and consumed ${i18nManager.formatNumber(Math.trunc(transaction.stop.totalConsumptionWh / 10) / 100)} kW.h`,
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
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          Authorization: `Bearer ${connection.data.access_token}`
        }
      });
      await Logging.logDebug({
        tenantID: this.tenant.id,
        user: userID,
        action: ServerAction.REFUND,
        module: MODULE_NAME, method: 'createQuickExpense',
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        message: `Transaction ${transaction.id} has been successfully transferred in ${moment().diff(startDate, 'milliseconds')} ms with ${this.getRetryCount(response)} retries`
      });
      return response.data.quickExpenseIdUri;
    } catch (error) {
      throw new BackendError({
        message: 'Unable to create Quick Expense',
        module: MODULE_NAME,
        method: 'createQuickExpense',
        user: userID,
        action: ServerAction.REFUND,
        detailedMessages: { error: error.stack }
      });
    }
  }

  private async createExpenseReportEntry(connection: Connection, expenseReportID: string, transaction: Transaction, location: ConcurLocation, userID: string) {
    try {
      // Get the user
      const user = await UserStorage.getUser(this.tenant, userID);
      // Get the i18n lib
      const i18nManager = I18nManager.getInstanceForLocale(user.locale);
      const startDate = moment();
      const concurURL = `${this.setting.apiUrl}/api/v3.0/expense/entries`;
      const response = await this.axiosInstance.post(concurURL, {
        'Description': `E-Mobility reimbursement ${moment.tz(transaction.timestamp, transaction.timezone).format('YYYY-MM-DD')}`,
        'Comment': `Session started on ${i18nManager.formatDateTime(moment.tz(transaction.timestamp, transaction.timezone).toDate())} during ${moment.duration(transaction.stop.totalDurationSecs, 'seconds').format('h[h]mm', { trim: false })} and consumed ${i18nManager.formatNumber(Math.trunc(transaction.stop.totalConsumptionWh / 10) / 100)} kW.h`,
        'VendorDescription': 'E-Mobility',
        'Custom1': transaction.id,
        'ExpenseTypeCode': this.setting.expenseTypeCode,
        'IsBillable': true,
        'IsPersonal': false,
        'PaymentTypeID': this.setting.paymentTypeId,
        'ReportID': expenseReportID,
        'TaxReceiptType': 'N',
        'TransactionAmount': transaction.stop.price,
        'TransactionCurrencyCode': transaction.stop.priceUnit,
        'TransactionDate': moment.tz(transaction.timestamp, transaction.timezone).format('YYYY-MM-DD'),
        'SpendCategoryCode': 'COCAR',
        'LocationID': location.ID
      }, {
        headers: {
          Accept: 'application/json',
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          Authorization: `Bearer ${connection.data.access_token}`
        }
      });
      await Logging.logDebug({
        tenantID: this.tenant.id,
        user: userID,
        action: ServerAction.REFUND,
        module: MODULE_NAME, method: 'createExpenseReportEntry',
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        message: `Transaction ${transaction.id} has been successfully transferred in ${moment().diff(startDate, 'milliseconds')} ms with ${this.getRetryCount(response)} retries`
      });
      return response.data.ID;
    } catch (error) {
      throw new BackendError({
        message: 'Unable to create an Expense Report',
        module: MODULE_NAME,
        method: 'createExpenseReport',
        user: userID,
        action: ServerAction.REFUND,
        detailedMessages: { error: error.stack }
      });
    }
  }

  private async createExpenseReport(connection: Connection, timezone: string, userID: string) {
    try {
      const startDate = moment();
      const concurURL = `${this.setting.apiUrl}/api/v3.0/expense/reports`;
      const response = await this.axiosInstance.post(concurURL, {
        'Name': `${this.setting.reportName} - ${moment.tz(timezone).format('DD/MM/YY HH:mm')}`,
        'PolicyID': this.setting.policyId
      }, {
        headers: {
          Accept: 'application/json',
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          Authorization: `Bearer ${connection.data.access_token}`
        }
      });
      await Logging.logDebug({
        tenantID: this.tenant.id,
        user: userID,
        action: ServerAction.REFUND,
        module: MODULE_NAME, method: 'createExpenseReport',
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        message: `Report has been successfully created in ${moment().diff(startDate, 'milliseconds')} ms with ${this.getRetryCount(response)} retries`
      });
      return response.data.ID;
    } catch (error) {
      throw new BackendError({
        message: 'Unable to create an Expense Report',
        module: MODULE_NAME, method: 'createExpenseReport',
        user: userID,
        action: ServerAction.REFUND,
        detailedMessages: { error: error.stack }
      });
    }
  }

  private getRetryCount(response) {
    if (response && response.config) {
      return response.config['axios-retry'].retryCount;
    }
    return 0;
  }

  private async getExpenseReport(connection: Connection, reportID: string) {
    try {
      const concurURL = `${this.setting.apiUrl}/api/v3.0/expense/reports/${reportID}`;
      const response = await this.axiosInstance.get(concurURL, {
        headers: {
          Accept: 'application/json',
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          Authorization: `Bearer ${connection.data.access_token}`
        }
      });
      return response.data;
    } catch (error) {
      if (error.response.status === StatusCodes.NOT_FOUND) {
        return null;
      }
      throw new BackendError({
        message: `Unable to get Report details with ID '${reportID}'`,
        module: MODULE_NAME,
        method: 'getExpenseReport',
        action: ServerAction.REFUND,
        detailedMessages: { error: error.stack }
      });
    }
  }

  private async getExpenseReports(connection: Connection) {
    try {
      const concurURL = `${this.setting.apiUrl}/api/v3.0/expense/reports?approvalStatusCode=A_NOTF`;
      const response = await this.axiosInstance.get(concurURL, {
        headers: {
          Accept: 'application/json',
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          Authorization: `Bearer ${connection.data.access_token}`
        }
      });
      return response.data.Items;
    } catch (error) {
      throw new BackendError({
        message: 'Unable to get expense Reports',
        module: MODULE_NAME,
        method: 'getExpenseReports',
        action: ServerAction.REFUND,
        detailedMessages: { error: error.stack }
      });
    }
  }

  private async refreshToken(userID: string, connection: Connection): Promise<Connection> {
    try {
      const startDate = moment();
      const concurURL = `${this.setting.authenticationUrl}/oauth2/v0/token`;
      const response = await this.axiosInstance.post(concurURL,
        querystring.stringify({
          client_id: this.setting.clientId,
          client_secret: await Cypher.decrypt(this.tenant, this.setting.clientSecret),
          refresh_token: connection.data.refresh_token,
          scope: connection.data.scope,
          grant_type: 'refresh_token'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
      await Logging.logDebug({
        tenantID: this.tenant.id,
        user: userID,
        action: ServerAction.REFUND,
        module: MODULE_NAME, method: 'refreshToken',
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        message: `Concur access token has been successfully generated in ${moment().diff(startDate, 'milliseconds')} ms with ${this.getRetryCount(response)} retries`
      });
      connection.data = response.data;
      connection.updatedAt = new Date();
      connection.validUntil = this.computeValidUntilAt(response);
      connection.id = await ConnectionStorage.saveConnection(this.tenant, connection);
      return connection;
    } catch (error) {
      throw new BackendError({
        message: `Concur access token not refreshed (ID: '${userID}')`,
        module: MODULE_NAME,
        method: 'refreshToken',
        action: ServerAction.REFUND,
        user: userID,
        detailedMessages: { error: error.stack }
      });
    }
  }

  private async getRefreshedConnection(userID: string): Promise<Connection> {
    let connection = await ConnectionStorage.getConnectionByConnectorIdAndUserId(this.tenant, CONNECTOR_ID, userID);
    if (!connection) {
      throw new BackendError({
        message: `The user with ID '${userID}' does not have a connection to connector '${CONNECTOR_ID}'`,
        module: MODULE_NAME,
        method: 'getRefreshedConnection',
        action: ServerAction.REFUND,
        user: userID
      });
    }
    if (this.isTokenExpired(connection)) {
      connection = await this.refreshToken(userID, connection);
    }
    return connection;
  }
}
