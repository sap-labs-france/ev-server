const ODataTransactions = require('./odata-entities/ODataTransactions');
const oDataCompanies = require('./odata-entities/ODataCompanies');
const oDataSites = require('./odata-entities/ODataSites');
const oDataSiteAreas = require('./odata-entities/ODataSiteAreas');
const oDataChargingStations = require('./odata-entities/ODataChargingStations');
const oDataStatusNotifications = require('./odata-entities/ODataStatusNotifications');
const oDataUsers = require('./odata-entities/ODataUsers');
const oDataModel = require('./odata-model/ODataModel');
const auth = require('basic-auth');
const Constants = require('../../utils/Constants');
const CentralServiceApi = require('./client/CentralServiceApi');
const Tenant = require('../../entity/Tenant');
const Logging = require('../../utils/Logging');

const MODULE_NAME = "ODataServer";

class ODataRestAdapter {
  static async query(collection, query, req, cb) {
    // get tenant from url
    const requestedHost = req.host;

    // split 
    const split = requestedHost.split('.');

    // get tenant at first place
    let subdomain = split[0];

    // get user/password
    const authentication = auth(req);

    // TODO: for testing at home
    if (subdomain === '109') {
      subdomain = 'slf';
    }
    // handle error
    try {
      // get tenant
      const tenant = await Tenant.getTenantBySubdomain(subdomain);

      // check if tenant available
      if (!tenant) {
        cb(Error("Invalid tenant"));
        return;
      }

      // check if sac setting is active - TODO: to be re-introduced after UI PR
      // if (!tenant.isComponentActive(Constants.COMPONENTS.SAC)) {
      //   cb(Error("SAP Analytics Clound Interface not enabled"));
      //   return;
      // }

      // default timezone - TODO: change back to UTC
      req.timezone = 'UTC';

      // get settings
      const sacSetting = await tenant.getSetting(Constants.COMPONENTS.SAC);

      if (sacSetting) {
        const configuration = sacSetting.getContent();

        if (configuration && configuration.timezone) {
          req.timezone = configuration.timezone;
        }
      }

      // build AuthenticatedApi
      const centralServiceApi = new CentralServiceApi(this.restServerUrl, authentication.name, authentication.pass, subdomain);

      // set tenant
      req.tenant = subdomain;
      req.tenantID = tenant.getID();

      switch (collection) {
        case 'Transactions':
          // get tenant TODO: test
          req.user = {};
          req.user.tenantID = '5be7fb271014d90008992f06';

          ODataTransactions.query(query, req, cb);
          break;
        case 'TransactionsCompleted':
          ODataTransactions.getTransactionsCompleted(centralServiceApi, query, req, cb);
          break;
        case 'Companies':
          oDataCompanies.getCompanies(centralServiceApi, query, req, cb);
          break;
        case 'Sites':
          oDataSites.getSites(centralServiceApi, query, req, cb);
          break;
        case 'SiteAreas':
          oDataSiteAreas.getSiteAreas(centralServiceApi, query, req, cb);
          break;
        case 'ChargingStations':
          oDataChargingStations.getChargingStations(centralServiceApi, query, req, cb);
          break;
        case 'StatusNotifications':
          oDataStatusNotifications.getStatusNotifications(centralServiceApi, query, req, cb);
          break;
        case 'Users':
          oDataUsers.getUsers(centralServiceApi, query, req, cb);
          break;
        default:
          cb('Invalid Entity');
      }
    } catch (error) {
      // add logging
      Logging.logError({
        tenantID: req.tenantID,
        module: MODULE_NAME,
        source: MODULE_NAME,
        method: "query",
        action: "query",
        message: error.message,
        detailedMessages: error.stack
      });
      cb(error);
    }
  }

  // register adapter on ODataServer
  static registerAdapter(oDataServer) {
    if (!oDataServer) { return }
    oDataServer.model(oDataModel).query(ODataRestAdapter.query);
  }
}


module.exports = ODataRestAdapter;