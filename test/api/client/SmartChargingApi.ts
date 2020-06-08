import Constants from './utils/Constants';
import CrudApi from './utils/CrudApi';

export default class SmartChargingApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async testConnection(params?, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return await super.readAll(params, paging, ordering, '/client/api/CheckSmartChargingConnection');
  }

  public async getChargingProfiles(params?, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return await super.readAll(params, paging, ordering, '/client/api/ChargingProfiles');
  }

  public async triggerSmartCharging(params?, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return await super.readAll(params, paging, ordering, '/client/api/TriggerSmartCharging');
  }
}
