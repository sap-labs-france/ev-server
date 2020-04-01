import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import Asset from '../../../../types/Asset';
import { DataResult } from '../../../../types/DataResult';
import { HttpAssignAssetsToSiteAreaRequest, HttpAssetRequest, HttpAssetsRequest } from '../../../../types/requests/HttpAssetRequest';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';

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

  public static filterAssignAssetsToSiteAreaRequest(request: any): HttpAssignAssetsToSiteAreaRequest {
    return {
      siteAreaID: sanitize(request.siteAreaID),
      assetIDs: request.assetIDs.map(sanitize)
    };
  }

  public static filterAssetsRequest(request: any): HttpAssetsRequest {
    const filteredRequest: HttpAssetsRequest = {
      Search: sanitize(request.Search),
      SiteAreaID: sanitize(request.SiteAreaID),
      WithSiteArea: !request.WithSiteArea ? false : UtilsSecurity.filterBoolean(request.WithSiteArea),
      WithNoSiteArea: !request.WithNoSiteArea ? false : UtilsSecurity.filterBoolean(request.WithNoSiteArea)
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

  public static _filterAssetRequest(request: any): Partial<Asset> {
    return {
      name: sanitize(request.name),
      siteAreaID: sanitize(request.siteAreaID),
      address: UtilsSecurity.filterAddressRequest(request.address),
      image: request.image
    };
  }

  public static filterAssetResponse(asset: Asset, loggedUser: UserToken): Asset {
    let filteredAsset;

    if (!asset) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadAsset(loggedUser, asset.id)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser)) {
        // Yes: set all params
        filteredAsset = asset;
      } else {
        // Set only necessary info
        filteredAsset = {};
        filteredAsset.id = asset.id;
        filteredAsset.name = asset.name;
        filteredAsset.siteAreaID = asset.siteAreaID;
        filteredAsset.image = asset.image;
        filteredAsset.address = UtilsSecurity.filterAddressRequest(asset.address);
      }
      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredAsset, asset, loggedUser);
    }
    return filteredAsset;
  }

  public static filterAssetsResponse(assets: DataResult<Asset>, loggedUser: UserToken) {
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
}
