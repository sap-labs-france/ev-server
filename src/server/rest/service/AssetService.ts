import { NextFunction, Request, Response } from 'express';
import Authorizations from '../../../authorization/Authorizations';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import AssetFactory from '../../../integration/asset/AssetFactory';
import AssetStorage from '../../../storage/mongodb/AssetStorage';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import Asset from '../../../types/Asset';
import { Action, Entity } from '../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import { AssetInErrorType } from '../../../types/InError';
import { ServerAction } from '../../../types/Server';
import TenantComponents from '../../../types/TenantComponents';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import AssetSecurity from './security/AssetSecurity';
import UtilsService from './UtilsService';


const MODULE_NAME = 'AssetService';

export default class AssetService {

  public static async handleCheckAssetConnection(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.CHECK_CONNECTION, Entity.ASSET, MODULE_NAME, 'handleCheckAssetConnection');
    // Filter request
    const filteredRequest = AssetSecurity.filterAssetRequestByID(req.query);
    // Get asset connection type
    const assetImpl = await AssetFactory.getAssetImpl(req.user.tenantID, filteredRequest);
    // Asset has unknown connection type
    if (!assetImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Asset service is not configured',
        module: MODULE_NAME, method: 'handleCheckAssetConnection',
        action: action,
        user: req.user
      });
    }
    // Is authorized to check connection ?
    if (!Authorizations.canCheckConnectionAsset(req.user)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Not authorized to check asset connections',
        module: MODULE_NAME, method: 'handleCheckAssetConnection',
        action: action,
        user: req.user
      });
    }
    try {
      // Check connection
      await assetImpl.checkConnection();
      // Success
      res.json(Object.assign({ connectionIsValid: true }, Constants.REST_RESPONSE_SUCCESS));
    } catch (error) {
      // KO
      Logging.logError({
        tenantID: req.user.tenantID,
        user: req.user,
        module: MODULE_NAME, method: 'handleCheckAssetConnection',
        message: 'Asset connection failed',
        action: action,
        detailedMessages: { error: error.message, stack: error.stack }
      });
      // Create fail response
      res.json(Object.assign({ connectionIsValid: false }, Constants.REST_RESPONSE_SUCCESS));
    }
    next();
  }

  public static async handleGetAssetsInError(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.LIST, Entity.ASSETS, MODULE_NAME, 'handleGetAssetsInError');
    // Check auth
    if (!Authorizations.canListAssets(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.ASSETS,
        module: MODULE_NAME,
        method: 'handleGetAssetsInError'
      });
    }
    // Filter
    const filteredRequest = AssetSecurity.filterAssetsRequest(req.query);
    // Build error type
    const errorType = (filteredRequest.ErrorType ? filteredRequest.ErrorType.split('|') : [AssetInErrorType.MISSING_SITE_AREA]);
    // Get the assets
    const assets = await AssetStorage.getAssetsInError(req.user.tenantID,
      {
        search: filteredRequest.Search,
        siteAreaIDs: (filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null),
        errorType
      },
      { limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
    );
    // Filter
    AssetSecurity.filterAssetsResponse(assets, req.user);
    // Return
    res.json(assets);
    next();
  }

  public static async handleDeleteAsset(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.DELETE, Entity.ASSET, MODULE_NAME, 'handleDeleteAsset');
    // Filter
    const filteredRequest = AssetSecurity.filterAssetRequest(req.query);
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleDeleteAsset', req.user);
    // Check auth
    if (!Authorizations.canDeleteAsset(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE,
        entity: Entity.ASSET,
        module: MODULE_NAME,
        method: 'handleDeleteAsset',
        value: filteredRequest.ID
      });
    }
    // Get
    const asset = await AssetStorage.getAsset(req.user.tenantID, filteredRequest.ID,
      { withSiteArea: filteredRequest.WithSiteArea });
    // Found?
    UtilsService.assertObjectExists(action, asset, `Asset with ID '${asset}' does not exist`,
      MODULE_NAME, 'handleDeleteAsset', req.user);
    // Delete
    await AssetStorage.deleteAsset(req.user.tenantID, asset.id);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user,
      module: MODULE_NAME, method: 'handleDeleteAsset',
      message: `Asset '${asset.name}' has been deleted successfully`,
      action: action,
      detailedMessages: { asset }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetAsset(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.READ, Entity.ASSET, MODULE_NAME, 'handleGetAsset');
    // Filter
    const filteredRequest = AssetSecurity.filterAssetRequest(req.query);
    // ID is mandatory
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetAsset', req.user);
    // Check auth
    if (!Authorizations.canReadAsset(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.ASSET,
        module: MODULE_NAME,
        method: 'handleGetAsset',
        value: filteredRequest.ID
      });
    }
    // Get it
    const asset = await AssetStorage.getAsset(req.user.tenantID, filteredRequest.ID,
      { withSiteArea: filteredRequest.WithSiteArea });
    UtilsService.assertObjectExists(action, asset, `Asset with ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleGetAsset', req.user);
    // Return
    res.json(
      // Filter
      AssetSecurity.filterAssetResponse(asset, req.user)
    );
    next();
  }

  public static async handleGetAssetImage(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.READ, Entity.ASSET, MODULE_NAME, 'handleGetAssetImage');
    // Filter
    const assetID = AssetSecurity.filterAssetRequestByID(req.query);
    // Charge Box is mandatory
    UtilsService.assertIdIsProvided(action, assetID, MODULE_NAME, 'handleGetAssetImage', req.user);
    // Check auth
    if (!Authorizations.canReadAsset(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.ASSET,
        module: MODULE_NAME,
        method: 'handleGetAssetImage',
        value: assetID
      });
    }
    // Get it
    const assetImage = await AssetStorage.getAssetImage(req.user.tenantID, assetID);
    // Check
    UtilsService.assertObjectExists(action, assetImage, `Asset with ID '${assetID}' does not exist`,
      MODULE_NAME, 'handleGetAssetImage', req.user);
    // Return
    res.json({ id: assetImage.id, image: assetImage.image });
    next();
  }

  public static async handleGetAssets(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.LIST, Entity.ASSETS, MODULE_NAME, 'handleGetAssets');
    // Check auth
    if (!Authorizations.canListAssets(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.ASSETS,
        module: MODULE_NAME,
        method: 'handleGetAssets'
      });
    }
    // Filter
    const filteredRequest = AssetSecurity.filterAssetsRequest(req.query);
    // Get the assets
    const assets = await AssetStorage.getAssets(req.user.tenantID,
      {
        search: filteredRequest.Search,
        siteAreaIDs: (filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null),
        withSiteArea: filteredRequest.WithSiteArea,
        withNoSiteArea: filteredRequest.WithNoSiteArea
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount },
      [ 'id', 'name', 'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.siteID', 'assetType', 'coordinates', 'dynamicAsset', 'assetConnectionID', 'meterID']
    );
    // Filter
    AssetSecurity.filterAssetsResponse(assets, req.user);
    // Return
    res.json(assets);
    next();
  }

  public static async handleCreateAsset(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.CREATE, Entity.ASSET, MODULE_NAME, 'handleCreateAsset');
    // Check auth
    if (!Authorizations.canCreateAsset(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE,
        entity: Entity.ASSET,
        module: MODULE_NAME,
        method: 'handleCreateAsset'
      });
    }
    // Filter
    const filteredRequest = AssetSecurity.filterAssetCreateRequest(req.body);
    // Check Asset
    Utils.checkIfAssetValid(filteredRequest, req);
    // Check Site Area
    if (filteredRequest.siteAreaID) {
      const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteAreaID);
      UtilsService.assertObjectExists(action, siteArea, `Site Area ID '${filteredRequest.siteAreaID}' does not exist`,
        MODULE_NAME, 'handleCreateAsset', req.user);
    }
    // Create asset
    const newAsset: Asset = {
      ...filteredRequest,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as Asset;
    // Save
    newAsset.id = await AssetStorage.saveAsset(req.user.tenantID, newAsset);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user,
      module: MODULE_NAME, method: 'handleCreateAsset',
      message: `Asset '${newAsset.id}' has been created successfully`,
      action: action,
      detailedMessages: { asset: newAsset }
    });
    // Ok
    res.json(Object.assign({ id: newAsset.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateAsset(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.UPDATE, Entity.ASSET, MODULE_NAME, 'handleUpdateAsset');
    // Filter
    const filteredRequest = AssetSecurity.filterAssetUpdateRequest(req.body);
    // Check auth
    if (!Authorizations.canUpdateAsset(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.ASSET,
        module: MODULE_NAME,
        method: 'handleUpdateAsset',
        value: filteredRequest.id
      });
    }
    // Check Site Area
    if (filteredRequest.siteAreaID) {
      const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteAreaID);
      UtilsService.assertObjectExists(action, siteArea, `Site Area ID '${filteredRequest.siteAreaID}' does not exist`,
        MODULE_NAME, 'handleUpdateAsset', req.user);
    }
    // Check email
    const asset = await AssetStorage.getAsset(req.user.tenantID, filteredRequest.id);
    // Check
    UtilsService.assertObjectExists(action, asset, `Site Area with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUpdateAsset', req.user);
    // Check Mandatory fields
    Utils.checkIfAssetValid(filteredRequest, req);
    // Update
    asset.name = filteredRequest.name;
    asset.siteAreaID = filteredRequest.siteAreaID;
    asset.assetType = filteredRequest.assetType;
    asset.coordinates = filteredRequest.coordinates;
    asset.image = filteredRequest.image;
    asset.dynamicAsset = filteredRequest.dynamicAsset;
    asset.connectionID = filteredRequest.connectionID;
    asset.meterID = filteredRequest.meterID;
    asset.lastChangedBy = { 'id': req.user.id };
    asset.lastChangedOn = new Date();
    // Update Asset
    await AssetStorage.saveAsset(req.user.tenantID, asset);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user,
      module: MODULE_NAME, method: 'handleUpdateAsset',
      message: `Asset '${asset.name}' has been updated successfully`,
      action: action,
      detailedMessages: { asset }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
