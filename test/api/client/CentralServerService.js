const BaseApi = require('./utils/BaseApi');
const AuthenticatedBaseApi = require('./utils/AuthenticatedBaseApi');
const config = require('../../config');

const CompanyApi = require('./CompanyApi');
// const SiteAreaApi = require('./SiteAreaApi');
// const SiteApi = require('./SiteApi');
// const UserApi = require('./UserApi');
// const ChargingStationApi = require('./ChargingStationApi');
// const TenantApi = require('./TenantApi');
// const TransactionApi = require('./TransactionApi');

class CentralServerService {

  constructor() {
    const baseURL = `${config.get('server.scheme')}://${config.get('server.host')}:${config.get('server.port')}`;
    // Create the Base API
    const baseApi = new BaseApi(baseURL);
    // Create the Authenticated API
    const authenticatedApi = new AuthenticatedBaseApi(baseURL, config.get('admin.username'), config.get('admin.password'));
    // Create the Company
    this.company = new CompanyApi(authenticatedApi);
    // this.siteArea = new SiteAreaApi(authenticatedBaseApi);
    // this.site = new SiteApi(authenticatedBaseApi);
    // this.user = new UserApi(authenticatedBaseApi);
    // this.chargingStation = new ChargingStationApi(authenticatedBaseApi);
    // this.transaction = new TransactionApi(authenticatedBaseApi);
    // this.tenant = new TenantApi(authenticatedBaseApi);
    // this.tenantNoAuth = new TenantApi(baseApi);
    // this.url = authenticatedBaseApi.url;
  }
}

module.exports = new CentralServerService();