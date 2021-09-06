import CentralServiceApi from './client/CentralServiceApi';
import Logging from '../../utils/Logging';
import ODataBootNotifications from './odata-entities/ODataBootNotifications';
import ODataChargingStations from './odata-entities/ODataChargingStations';
import ODataCompanies from './odata-entities/ODataCompanies';
import ODataModel from './odata-model/ODataModel';
import ODataSiteAreas from './odata-entities/ODataSiteAreas';
import ODataSites from './odata-entities/ODataSites';
import ODataStatusNotifications from './odata-entities/ODataStatusNotifications';
import ODataTransactions from './odata-entities/ODataTransactions';
import ODataUsers from './odata-entities/ODataUsers';
import { ServerAction } from '../../types/Server';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import { TenantComponents } from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';
import auth from 'basic-auth';

const MODULE_NAME = 'ODataServer';

export default class ODataRestAdapter {
  public static restServerUrl: string;

  static async query(collection, query?, req?, cb?): Promise<void> {
    // Get tenant from url
    const requestedHost = req.host;
    // Split
    const split = requestedHost.split('.');
    // Get tenant at first place
    let subdomain = split[0];
    // Get user/password
    const authentication = auth(req);
    // For testing at home
    if (subdomain === '109') {
      subdomain = 'slf';
    }
    // Handle error
    try {
      // Get tenant
      const tenant = await TenantStorage.getTenantBySubdomain(subdomain);
      // Check if tenant available
      if (!tenant) {
        cb(Error('Invalid tenant'));
        return;
      }
      // Check if sac setting is active
      if (!Utils.isTenantComponentActive(tenant, TenantComponents.ANALYTICS)) {
        cb(Error('SAP Analytics Cloud Interface not enabled'));
        return;
      }
      // Default timezone
      req.timezone = 'UTC';
      // Get settings
      const sacSetting = await SettingStorage.getAnalyticsSettings(tenant);
      if (sacSetting && sacSetting.sac && sacSetting.sac.timezone) {
        req.timezone = sacSetting.sac.timezone;
      }

      // Build AuthenticatedApi
      const centralServiceApi = new CentralServiceApi(ODataRestAdapter.restServerUrl, authentication.name, authentication.pass, subdomain);
      // Set tenant
      req.tenant = subdomain;
      if (!req.user) {
        req.user = {};
      }
      req.user.tenantID = tenant.id;
      switch (collection) {
        case 'Transactions':
          await new ODataTransactions().getTransactionsCompleted(centralServiceApi, query, req, cb);
          break;
        case 'TransactionsCompleted':
          await new ODataTransactions().getTransactionsCompleted(centralServiceApi, query, req, cb);
          break;
        case 'Companies':
          await new ODataCompanies().getCompanies(centralServiceApi, query, req, cb);
          break;
        case 'Sites':
          await new ODataSites().getSites(centralServiceApi, query, req, cb);
          break;
        case 'SiteAreas':
          await new ODataSiteAreas().getSiteAreas(centralServiceApi, query, req, cb);
          break;
        case 'ChargingStations':
          await new ODataChargingStations().getChargingStations(centralServiceApi, query, req, cb);
          break;
        case 'StatusNotifications':
          await new ODataStatusNotifications().getStatusNotifications(centralServiceApi, query, req, cb);
          break;
        case 'BootNotifications':
          await new ODataBootNotifications().getBootNotifications(centralServiceApi, query, req, cb);
          break;
        case 'Users':
          await new ODataUsers().getUsers(centralServiceApi, query, req, cb);
          break;
        default:
          cb('Invalid Entity');
      }
    } catch (error) {
      // Add logging
      await Logging.logError({
        tenantID: req.user.tenantID,
        module: MODULE_NAME, method: 'query',
        action: ServerAction.ODATA_SERVER,
        message: error.message,
        detailedMessages: { error: error.stack }
      });
      cb(error);
    }
  }

  static registerAdapter(oDataServer): void {
    if (!oDataServer) {
      return;
    }
    oDataServer.model(ODataModel).query(ODataRestAdapter.query.bind(this));
  }
}

