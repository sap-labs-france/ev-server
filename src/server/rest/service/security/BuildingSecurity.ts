import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import Building from '../../../../types/Building';
import { DataResult } from '../../../../types/DataResult';
import { HttpBuildingRequest, HttpBuildingsRequest } from '../../../../types/requests/HttpBuildingRequest';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';

export default class BuildingSecurity {

  public static filterBuildingRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterBuildingRequest(request: any): HttpBuildingRequest {
    return {
      ID: sanitize(request.ID),
      WithSiteArea: UtilsSecurity.filterBoolean(request.WithSiteArea)
    } as HttpBuildingRequest;
  }

  public static filterBuildingsRequest(request: any): HttpBuildingsRequest {
    const filteredRequest: HttpBuildingsRequest = {
      Search: sanitize(request.Search),
      WithSiteArea: !request.WithSiteArea ? false : UtilsSecurity.filterBoolean(request.WithSiteArea),
    } as HttpBuildingsRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterBuildingUpdateRequest(request: any): Partial<Building> {
    const filteredRequest = BuildingSecurity._filterBuildingRequest(request);
    return {
      id: sanitize(request.id),
      ...filteredRequest
    };
  }

  public static filterBuildingCreateRequest(request: any): Partial<Building> {
    return BuildingSecurity._filterBuildingRequest(request);
  }

  public static _filterBuildingRequest(request: any): Partial<Building> {
    return {
      name: sanitize(request.name),
      siteAreaID: sanitize(request.siteAreaID),
      address: UtilsSecurity.filterAddressRequest(request.address),
      image: request.image
    };
  }

  public static filterBuildingResponse(building: Building, loggedUser: UserToken): Building {
    let filteredBuilding;

    if (!building) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadBuilding(loggedUser, building.id)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser)) {
        // Yes: set all params
        filteredBuilding = building;
      } else {
        // Set only necessary info
        filteredBuilding = {};
        filteredBuilding.id = building.id;
        filteredBuilding.name = building.name;
        filteredBuilding.siteAreaID = building.siteAreaID;
        filteredBuilding.image = building.image;
        filteredBuilding.address = UtilsSecurity.filterAddressRequest(building.address);
      }
      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredBuilding, building, loggedUser);
    }
    return filteredBuilding;
  }

  public static filterBuildingsResponse(buildings: DataResult<Building>, loggedUser: UserToken) {
    const filteredBuildings = [];

    if (!buildings.result) {
      return null;
    }
    if (!Authorizations.canListBuildings(loggedUser)) {
      return null;
    }
    for (const building of buildings.result) {
      // Add
      const filteredBuilding = BuildingSecurity.filterBuildingResponse(building, loggedUser);
      if (filteredBuilding) {
        filteredBuildings.push(filteredBuilding);
      }
    }
    buildings.result = filteredBuildings;
  }
}
