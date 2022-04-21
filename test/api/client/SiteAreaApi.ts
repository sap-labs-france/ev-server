import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import CrudApi from './utils/CrudApi';
import { RESTServerRoute } from '../../../src/types/Server';
import { Server } from 'http';
import TestConstants from './utils/TestConstants';

export default class SiteAreaApi extends CrudApi {
  public constructor(authenticatedApi: AuthenticatedBaseApi) {
    super(authenticatedApi);
  }

  public async readById(id: string) {
    return super.readById(id, this.buildRestEndpointUrl(RESTServerRoute.REST_SITE_AREA, { id }));
  }

  public async readAll(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(RESTServerRoute.REST_SITE_AREAS));
  }

  public async create(data) {
    const siteArea = await super.create(data, this.buildRestEndpointUrl(RESTServerRoute.REST_SITE_AREAS));
    // Check User IDs
    if (data.chargeBoxIDs) {
      // Assign Chargers to Site
      await super.create({
        chargingStationIDs: data.chargeBoxIDs
      }, this.buildRestEndpointUrl(RESTServerRoute.REST_SITE_AREA_ASSIGN_CHARGING_STATIONS, { id: siteArea.data.id }));
    }
    return siteArea;
  }

  public async update(data) {
    return super.update(data, this.buildRestEndpointUrl(RESTServerRoute.REST_SITE_AREA, { id: data.id }));
  }

  public async delete(id) {
    return super.delete(id, this.buildRestEndpointUrl(RESTServerRoute.REST_SITE_AREA, { id }));
  }

  public async readConsumption(SiteAreaID: string, StartDate: Date, EndDate: Date) {
    return super.read({
      StartDate: StartDate,
      EndDate: EndDate
    }, this.buildRestEndpointUrl(RESTServerRoute.REST_SITE_AREA_CONSUMPTION, { id: SiteAreaID }));
  }

  public async assignChargingStations(siteAreaID: string, chargingStationIDs: string[]) {
    return super.update({ chargingStationIDs }, this.buildRestEndpointUrl(RESTServerRoute.REST_SITE_AREA_ASSIGN_CHARGING_STATIONS, { id: siteAreaID }));
  }

  public async removeChargingStations(siteAreaID: string, chargingStationIDs: string[]) {
    return super.update({ chargingStationIDs }, this.buildRestEndpointUrl(RESTServerRoute.REST_SITE_AREA_REMOVE_CHARGING_STATIONS, { id: siteAreaID }));
  }

  public async assignAssets(siteAreaID: string, assetIDs: string[]) {
    return super.update({ assetIDs }, this.buildRestEndpointUrl(RESTServerRoute.REST_SITE_AREA_ASSIGN_ASSETS, { id: siteAreaID }));
  }

  public async removeAssets(siteAreaID: string, assetIDs: string[]) {
    return super.update({ assetIDs }, this.buildRestEndpointUrl(RESTServerRoute.REST_SITE_AREA_REMOVE_ASSETS, { id: siteAreaID }));
  }
}
