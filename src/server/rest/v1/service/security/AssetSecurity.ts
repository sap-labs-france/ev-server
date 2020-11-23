import { HttpAssetConsumptionRequest, HttpAssetRequest, HttpAssetsRequest } from '../../../../../types/requests/HttpAssetRequest';

import Asset from '../../../../../types/Asset';
import Authorizations from '../../../../../authorization/Authorizations';
import Consumption from '../../../../../types/Consumption';
import { DataResult } from '../../../../../types/DataResult';
import SiteAreaSecurity from './SiteAreaSecurity';
import UserToken from '../../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class AssetSecurity {

  public static filterAssetRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterAssetRequest(request: any): HttpAssetRequest {
    return {
      ID: sanitize(request.ID),
      WithSiteArea: UtilsSecurity.filterBoolean(request.WithSiteArea)
    } as HttpAssetRequest;
  }

  public static filterAssetsRequest(request: any): HttpAssetsRequest {
    const filteredRequest: HttpAssetsRequest = {
      Search: sanitize(request.Search),
      SiteAreaID: sanitize(request.SiteAreaID),
      WithSiteArea: !request.WithSiteArea ? false : UtilsSecurity.filterBoolean(request.WithSiteArea),
      WithNoSiteArea: !request.WithNoSiteArea ? false : UtilsSecurity.filterBoolean(request.WithNoSiteArea),
      DynamicOnly: !request.DynamicOnly ? false : UtilsSecurity.filterBoolean(request.DynamicOnly),
      ErrorType: sanitize(request.ErrorType)
    } as HttpAssetsRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterAssetUpdateRequest(request: any): Partial<Asset> {
    const filteredRequest = AssetSecurity._filterAssetRequest(request);
    return {
      id: sanitize(request.id),
      ...filteredRequest
    };
  }

  public static filterAssetCreateRequest(request: any): Partial<Asset> {
    return AssetSecurity._filterAssetRequest(request);
  }

  public static filterAssetResponse(asset: Asset, loggedUser: UserToken): Asset {
    let filteredAsset: Asset;
    if (!asset) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadAsset(loggedUser)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser)) {
        // Yes: set all params
        filteredAsset = asset;
      } else {
        // Set only necessary info
        filteredAsset = {} as Asset;
        filteredAsset.id = asset.id;
        filteredAsset.name = asset.name;
        filteredAsset.siteAreaID = asset.siteAreaID;
        filteredAsset.assetType = asset.assetType;
        filteredAsset.coordinates = asset.coordinates;
        filteredAsset.image = asset.image;
        filteredAsset.dynamicAsset = asset.dynamicAsset;
        filteredAsset.connectionID = asset.connectionID;
        filteredAsset.meterID = asset.meterID;
        filteredAsset.currentInstantWatts = asset.currentInstantWatts;
        if (asset.siteArea) {
          filteredAsset.siteArea = SiteAreaSecurity.filterSiteAreaResponse(asset.siteArea, loggedUser);
        }
      }
      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredAsset, asset, loggedUser);
    }
    return filteredAsset;
  }

  public static filterAssetConsumptionRequest(request: any): HttpAssetConsumptionRequest {
    return {
      AssetID: sanitize(request.AssetID),
      StartDate: sanitize(request.StartDate),
      EndDate: sanitize(request.EndDate)
    };
  }

  public static filterAssetConsumptionResponse(asset: Asset, consumptions: Consumption[], loggedUser: UserToken): Asset {
    asset.values = [];
    if (!consumptions) {
      consumptions = [];
    }
    const filteredAsset = this.filterAssetResponse(asset, loggedUser);
    if (consumptions.length === 0) {
      filteredAsset.values = [];
      return filteredAsset;
    }
    // Clean
    filteredAsset.values = consumptions.map((consumption) => ({
      date: consumption.startedAt,
      instantWatts: consumption.instantWatts,
      instantAmps: consumption.instantAmps,
      limitWatts: consumption.limitWatts,
      limitAmps: consumption.limitAmps,
    }));
    // Add the last point (duration of the last consumption)
    if (consumptions.length > 0) {
      filteredAsset.values.push({
        ...filteredAsset.values[filteredAsset.values.length - 1],
        date: consumptions[consumptions.length - 1].endedAt,
      });
    }
    return filteredAsset;
  }

  public static filterAssetsResponse(assets: DataResult<Asset>, loggedUser: UserToken): void {
    const filteredAssets = [];
    if (!assets.result) {
      return null;
    }
    if (!Authorizations.canListAssets(loggedUser)) {
      return null;
    }
    for (const asset of assets.result) {
      // Add
      const filteredAsset = AssetSecurity.filterAssetResponse(asset, loggedUser);
      if (filteredAsset) {
        filteredAssets.push(filteredAsset);
      }
    }
    assets.result = filteredAssets;
  }

  private static _filterAssetRequest(request: any): Partial<Asset> {
    const filteredRequest: Partial<Asset> = {};
    filteredRequest.name = sanitize(request.name),
    filteredRequest.siteAreaID = sanitize(request.siteAreaID),
    filteredRequest.assetType = sanitize(request.assetType),
    filteredRequest.image = request.image;
    filteredRequest.dynamicAsset = UtilsSecurity.filterBoolean(request.dynamicAsset);
    if (request.coordinates && request.coordinates.length === 2) {
      filteredRequest.coordinates = [
        sanitize(request.coordinates[0]),
        sanitize(request.coordinates[1])
      ];
    }
    if (request.dynamicAsset) {
      filteredRequest.connectionID = sanitize(request.connectionID);
      filteredRequest.meterID = sanitize(request.meterID);
    }
    return filteredRequest;
  }
}
