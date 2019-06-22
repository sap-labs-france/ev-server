import CrudApi from './utils/CrudApi';
import Constants from './utils/Constants';
export default class SiteAreaApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public readById(id) {
    return super.readById(id, '/client/api/SiteArea');
  }

  public readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/SiteAreas');
  }

  public async create(data) {
    const siteArea = await super.create(data, '/client/api/SiteAreaCreate');
    // Check User IDs
    if (data.chargeBoxIDs) {
      // Assign Chargers to Site
      await super.create({
        siteAreaID: siteArea.data.id,
        chargingStationIDs: data.chargeBoxIDs
      }, '/client/api/AddChargingStationsToSiteArea');
    }
    return siteArea;
  }

  public update(data) {
    return super.update(data, '/client/api/SiteAreaUpdate');
  }

  public delete(id) {
    return super.delete(id, '/client/api/SiteAreaDelete');
  }
}
