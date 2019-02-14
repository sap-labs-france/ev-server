const ODataTransactions = require('./odata-entities/ODataTransactions');
const oDataBootNotifications = require('./odata-entities/ODataBootNotifications');
const oDataCompanies = require('./odata-entities/ODataCompanies');
const oDataSites = require('./odata-entities/ODataSites');
const oDataSiteAreas = require('./odata-entities/ODataSiteAreas');
const oDataChargingStations = require('./odata-entities/ODataChargingStations');
const oDataUsers = require('./odata-entities/ODataUsers');
const oDataModel = require('./odata-model/ODataModel');
const auth = require('basic-auth');
const CentralServiceApi = require('./client/CentralServiceApi');

class ODataDatabaseAdapter {
  static async query(collection, query, req, cb) {
    // get tenant from url
    const requestedHost = req.host;

    // split 
    const split = requestedHost.split('.');

    // get tenant at first place
    let tenant = split[0];

    // get user/password
    const authentication = auth(req);

    // TODO: for testing at home
    if (tenant === '109') {
      tenant = 'slf';
    }

    // build AuthenticatedApi
    const centralServiceApi = new CentralServiceApi(this.restServerUrl, authentication.name, authentication.pass, tenant);

    // handle error
    try {
      switch (collection) {
        case 'Transactions':
          // get tenant TODO: test
          req.user = {};
          req.user.tenantID = '5be7fb271014d90008992f06';

          ODataTransactions.query(query, req, cb);
          break;
        case 'BootNotifications':
          // get tenant TODO: test
          req.user = {};
          req.user.tenantID = '5be7fb271014d90008992f06';

          oDataBootNotifications.query(query, req, cb);
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
        case 'Users':
          oDataUsers.getUsers(centralServiceApi, query, req, cb);
          break;
        default:
          cb('Invalid Entity');
      }
    } catch (error) {
      cb(error);
    }
  }

  // register adapter on ODataServer
  static registerAdapter(oDataServer) {
    if (!oDataServer) { return }
    // oDataServer.model(ODataDatabaseAdapter.getModel()).query(ODataDatabaseAdapter.query);
    oDataServer.model(oDataModel).query(ODataDatabaseAdapter.query);
  }
}


module.exports = ODataDatabaseAdapter;