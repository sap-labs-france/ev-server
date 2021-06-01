import AuthenticatedApi from './AuthenticatedApi';
import { ServerRoute } from '../../../../src/types/Server';

export default class CentralServiceApi extends AuthenticatedApi {

  constructor(baseURL, username, password, tenant) {
    super(baseURL, username, password, tenant);
  }

  async getCompanies(params) {
    return await this.send({
      method: 'GET',
      url: '/client/api/Companies',
      params: params
    });
  }

  async getSites(params) {
    return await this.send({
      method: 'GET',
      url: '/client/api/Sites',
      params: params
    });
  }

  async getSiteAreas(params) {
    return await this.send({
      method: 'GET',
      url: '/client/api/SiteAreas',
      params: params
    });
  }

  async getChargingStations(params) {
    return await this.send({
      method: 'GET',
      url: '/client/api/ChargingStations',
      params: params
    });
  }

  async getTransactionsCompleted(params) {
    return await this.send({
      method: 'GET',
      url: '/client/api/TransactionsCompleted',
      params: params
    });
  }

  async getUsers(params) {
    return await this.send({
      method: 'GET',
      url: '/client/api/Users',
      params: params
    });
  }

  async getStatusNotifications(params) {
    return await this.send({
      method: 'GET',
      url: `/v1/api/${ServerRoute.REST_CHARGING_STATIONS_STATUS_NOTIFICATIONS}`,
      params: params
    });
  }

  async getBootNotifications(params) {
    return await this.send({
      method: 'GET',
      url: `/v1/api/${ServerRoute.REST_CHARGING_STATIONS_BOOT_NOTIFICATIONS}`,
      params: params
    });
  }

  async securePing() {
    return await this.send({
      method: 'GET',
      url: '/client/api/Ping'
    });
  }
}

