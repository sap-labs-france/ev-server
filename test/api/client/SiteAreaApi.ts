import CrudApi from './utils/CrudApi';
import TestConstants from './utils/TestConstants';

export default class SiteAreaApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async readById(id) {
    return super.readById(id, '/client/api/SiteArea');
  }

  public async readAll(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
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

  public async update(data) {
    return super.update(data, '/client/api/SiteAreaUpdate');
  }

  public async delete(id) {
    return super.delete(id, '/client/api/SiteAreaDelete');
  }

  public async readConsumption(SiteAreaId, StartDate, EndDate) {
    return super.read({
      SiteAreaID: SiteAreaId,
      StartDate: StartDate,
      EndDate: EndDate
    }, '/client/api/SiteAreaConsumption');
  }

}
