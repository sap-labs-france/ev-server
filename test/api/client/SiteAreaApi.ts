import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import CrudApi from './utils/CrudApi';
import { ServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class SiteAreaApi extends CrudApi {
  public constructor(authenticatedApi: AuthenticatedBaseApi) {
    super(authenticatedApi);
  }

  public async readById(id: string) {
    return super.readById(id, this.buildRestEndpointUrl(ServerRoute.REST_SITE_AREA, { id }));
  }

  public async readAll(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(ServerRoute.REST_SITE_AREAS));
  }

  public async create(data) {
    const siteArea = await super.create(data, this.buildRestEndpointUrl(ServerRoute.REST_SITE_AREAS));
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
    return super.update(data, this.buildRestEndpointUrl(ServerRoute.REST_SITE_AREA, { id: data.id }));
  }

  public async delete(id) {
    return super.delete(id, this.buildRestEndpointUrl(ServerRoute.REST_SITE_AREA, { id }));
  }

  public async readConsumption(SiteAreaId: string, StartDate: Date, EndDate: Date) {
    return super.read({
      StartDate: StartDate,
      EndDate: EndDate
    }, this.buildRestEndpointUrl(ServerRoute.REST_SITE_AREA_CONSUMPTION, { id: SiteAreaId }));
  }

  public async assignChargingStations(siteAreaId: string, ChargingStationIDs: string[]) {
    return super.update({
      chargingStationIDs: ChargingStationIDs
    }, this.buildRestEndpointUrl(ServerRoute.REST_SITE_AREA_ASSIGN_CHARGING_STATIONS, { id: siteAreaId }));
  }

  public async removeChargingStations(siteAreaId: string, ChargingStationIDs: string[]) {
    return super.update({
      chargingStationIDs: ChargingStationIDs
    }, this.buildRestEndpointUrl(ServerRoute.REST_SITE_AREA_REMOVE_CHARGING_STATIONS, { id: siteAreaId }));
  }

  public async assignAssets(SiteAreaId, ChargingStationIDs) {
    return super.create({
      siteAreaID: SiteAreaId,
      assetIDs: ChargingStationIDs
    }, '/client/api/AddAssetsToSiteArea');
  }

  public async removeAssets(SiteAreaId, ChargingStationIDs) {
    return super.create({
      siteAreaID: SiteAreaId,
      assetIDs: ChargingStationIDs
    }, '/client/api/RemoveAssetsFromSiteArea');
  }
}
