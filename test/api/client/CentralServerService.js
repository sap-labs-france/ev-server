SiteAreaApi = require('./SiteAreaApi');
CompanyApi = require('./CompanyApi');
SiteApi = require('./SiteApi');
UserApi = require('./UserApi');
ChargingStationApi = require('./ChargingStationApi');
TenantApi = require('./TenantApi');
TransactionApi = require('./TransactionApi');
const BaseApi = require('./utils/BaseApi');
const AuthenticatedBaseApi = require('./utils/AuthenticatedBaseApi');
const config = require('../../config');

class CentralServerService {

  constructor() {
    const baseApi = new BaseApi(`${config.get('server.scheme')}://${config.get('server.host')}:${config.get('server.port')}`);
    const authenticatedBaseApi = new AuthenticatedBaseApi(config.get('admin.username'), config.get('admin.password'), baseApi);
    this.siteArea = new SiteAreaApi(authenticatedBaseApi);
    this.company = new CompanyApi(authenticatedBaseApi);
    this.site = new SiteApi(authenticatedBaseApi);
    this.user = new UserApi(authenticatedBaseApi);
    this.chargingStation = new ChargingStationApi(authenticatedBaseApi);
    this.transaction = new TransactionApi(authenticatedBaseApi);
    this.tenant = new TenantApi(authenticatedBaseApi);
    this.tenantNoAuth = new TenantApi(baseApi);
    this.url = authenticatedBaseApi.url;
  }
}

module.exports = new CentralServerService();