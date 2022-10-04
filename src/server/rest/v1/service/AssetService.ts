import { Action, Entity } from '../../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';

import AppError from '../../../../exception/AppError';
import Asset from '../../../../types/Asset';
import { AssetDataResult } from '../../../../types/DataResult';
import AssetFactory from '../../../../integration/asset/AssetFactory';
import { AssetInErrorType } from '../../../../types/InError';
import AssetStorage from '../../../../storage/mongodb/AssetStorage';
import AssetValidatorRest from '../validator/AssetValidatorRest';
import AuthorizationService from './AuthorizationService';
import Constants from '../../../../utils/Constants';
import Consumption from '../../../../types/Consumption';
import ConsumptionStorage from '../../../../storage/mongodb/ConsumptionStorage';
import { HTTPError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import LoggingHelper from '../../../../utils/LoggingHelper';
import OCPPUtils from '../../../../server/ocpp/utils/OCPPUtils';
import { ServerAction } from '../../../../types/Server';
import SiteArea from '../../../../types/SiteArea';
import { StatusCodes } from 'http-status-codes';
import { TenantComponents } from '../../../../types/Tenant';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';
import moment from 'moment';

const MODULE_NAME = 'AssetService';

export default class AssetService {

  public static async handleGetAssetConsumption(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.READ_CONSUMPTION, Entity.ASSET, MODULE_NAME, 'handleGetAssetConsumption');
    // Filter
    const filteredRequest = AssetValidatorRest.getInstance().validateAssetGetConsumptionsReq(req.query);
    // Check and get Asset
    const asset = await UtilsService.checkAndGetAssetAuthorization(req.tenant, req.user, filteredRequest.AssetID, Action.READ_CONSUMPTION, action, null, {}, true);
    // Check dates
    if (!filteredRequest.StartDate || !filteredRequest.EndDate) {
      throw new AppError({
        ...LoggingHelper.getAssetProperties(asset),
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Start date and end date must be provided',
        module: MODULE_NAME, method: 'handleGetAssetConsumption',
        user: req.user,
        action: action
      });
    }
    // Check dates order
    AssetService.checkDateOrder(filteredRequest.StartDate, filteredRequest.EndDate, req.user, action, 'handleGetAssetConsumption');
    // Get the ConsumptionValues
    const consumptions = await ConsumptionStorage.getAssetConsumptions(req.tenant, {
      assetID: filteredRequest.AssetID,
      startDate: filteredRequest.StartDate,
      endDate: filteredRequest.EndDate
    }, asset.projectFields);
    // Assign
    asset.values = consumptions;
    res.json(asset);
    next();
  }

  public static async handleCreateAssetConsumption(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET, Action.CREATE_CONSUMPTION, Entity.ASSET, MODULE_NAME, 'handleCreateAssetConsumption');
    // Validate request
    const filteredRequest = AssetValidatorRest.getInstance().validateAssetConsumptionCreateReq({ ...req.query, ...req.body });
    // Check and get Asset
    const asset = await UtilsService.checkAndGetAssetAuthorization(
      req.tenant, req.user, filteredRequest.assetID, Action.CREATE_CONSUMPTION, action, null, { withSiteArea: true });
    // Check if connection ID exists
    if (!Utils.isNullOrUndefined(asset.connectionID)) {
      throw new AppError({
        ...LoggingHelper.getAssetProperties(asset),
        errorCode: HTTPError.GENERAL_ERROR,
        message: `The asset '${asset.name}' has a defined connection. The push API can not be used`,
        module: MODULE_NAME, method: 'handleCreateAssetConsumption',
        user: req.user,
        action: action
      });
    }
    // Check dates order
    AssetService.checkDateOrder(filteredRequest.startedAt, filteredRequest.endedAt, req.user, action, 'handleCreateAssetConsumption');
    // Get latest consumption and check dates
    const lastConsumption = await ConsumptionStorage.getLastAssetConsumption(req.tenant, { assetID: filteredRequest.assetID });
    if (!Utils.isNullOrUndefined(lastConsumption)) {
      if (moment(filteredRequest.startedAt).isBefore(moment(lastConsumption.endedAt))) {
        throw new AppError({
          ...LoggingHelper.getAssetProperties(asset),
          errorCode: HTTPError.GENERAL_ERROR,
          message: `The start date '${moment(filteredRequest.startedAt).toISOString()}' of the pushed consumption is before the end date '${moment(lastConsumption.endedAt).toISOString()}' of the latest asset consumption`,
          module: MODULE_NAME, method: 'handleCreateAssetConsumption',
          user: req.user,
          action: action
        });
      }
    }
    // Add site area
    const consumptionToSave: Consumption = {
      ...filteredRequest,
      siteAreaID: asset.siteAreaID,
      siteID: asset.siteArea.siteID,
    };
    // Check consumption
    if (Utils.isNullOrUndefined(consumptionToSave.consumptionWh)) {
      const timePeriod = moment(consumptionToSave.endedAt).diff(moment(consumptionToSave.startedAt), 'minutes');
      consumptionToSave.consumptionWh = Utils.createDecimal(consumptionToSave.instantWatts).mul(Utils.createDecimal(timePeriod).div(60)).toNumber();
    }
    // Add Amps
    if (Utils.isNullOrUndefined(consumptionToSave.instantAmps)) {
      consumptionToSave.instantAmps = Utils.createDecimal(consumptionToSave.instantWatts).div(asset.siteArea.voltage).toNumber();
    }
    // Add site limitation
    await OCPPUtils.addSiteLimitationToConsumption(req.tenant, asset.siteArea, consumptionToSave);
    // Save consumption
    await ConsumptionStorage.saveConsumption(req.tenant, consumptionToSave);
    // Assign to asset
    asset.currentConsumptionWh = filteredRequest.consumptionWh;
    asset.currentInstantAmps = filteredRequest.instantAmps;
    asset.currentInstantAmpsL1 = filteredRequest.instantAmpsL1;
    asset.currentInstantAmpsL2 = filteredRequest.instantAmpsL2;
    asset.currentInstantAmpsL3 = filteredRequest.instantAmpsL3;
    asset.currentInstantVolts = filteredRequest.instantVolts;
    asset.currentInstantVoltsL1 = filteredRequest.instantVoltsL1;
    asset.currentInstantVoltsL2 = filteredRequest.instantVoltsL2;
    asset.currentInstantVoltsL3 = filteredRequest.instantVoltsL3;
    asset.currentInstantWatts = filteredRequest.instantWatts;
    asset.currentInstantWattsL1 = filteredRequest.instantWattsL1;
    asset.currentInstantWattsL2 = filteredRequest.instantWattsL2;
    asset.currentInstantWattsL3 = filteredRequest.instantWattsL3;
    asset.currentStateOfCharge = filteredRequest.stateOfCharge;
    asset.lastConsumption = { timestamp: consumptionToSave.endedAt, value: consumptionToSave.consumptionWh };
    // Save Asset
    await AssetStorage.saveAsset(req.tenant, asset);
    // Create response
    res.status(StatusCodes.CREATED).json(Object.assign({ consumption: consumptionToSave }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleCheckAssetConnection(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.CHECK_CONNECTION, Entity.ASSET, MODULE_NAME, 'handleCheckAssetConnection');
    // Filter request, NOTE: ID in this request is a connection ID not an Asset ID
    const filteredRequest = AssetValidatorRest.getInstance().validateAssetCheckConnectionReq(req.query);
    // Check dynamic auth
    await AuthorizationService.checkAndGetAssetsAuthorizations(req.tenant, req.user, Action.CHECK_CONNECTION);
    // Get asset connection type
    const assetImpl = await AssetFactory.getAssetImpl(req.tenant, filteredRequest.ID);
    // Asset has unknown connection type
    if (!assetImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Asset service is not configured',
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
      await Logging.logError({
        tenantID: req.tenant.id,
        user: req.user,
        module: MODULE_NAME, method: 'handleCheckAssetConnection',
        message: 'Asset connection failed',
        action: action,
        detailedMessages: { error: error.stack }
      });
      // Create fail response
      res.json(Object.assign({ connectionIsValid: false }, Constants.REST_RESPONSE_SUCCESS));
    }
    next();
  }

  public static async handleRetrieveConsumption(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.RETRIEVE_CONSUMPTION, Entity.ASSET, MODULE_NAME, 'handleRetrieveConsumption');
    // Filter request
    const assetID = AssetValidatorRest.getInstance().validateAssetGetReq(req.query).ID;
    // Check and get Asset
    const asset = await UtilsService.checkAndGetAssetAuthorization(
      req.tenant, req.user, assetID, Action.RETRIEVE_CONSUMPTION, action, null, {}, true);
    // Get asset factory
    const assetImpl = await AssetFactory.getAssetImpl(req.tenant, asset.connectionID);
    if (!assetImpl) {
      throw new AppError({
        ...LoggingHelper.getAssetProperties(asset),
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Asset service is not configured',
        module: MODULE_NAME, method: 'handleRetrieveConsumption',
        action: ServerAction.RETRIEVE_ASSET_CONSUMPTION
      });
    }
    // Retrieve consumption
    const consumptions = await assetImpl.retrieveConsumptions(asset, true);
    if (!Utils.isEmptyArray(consumptions)) {
      const consumption = consumptions[0];
      // Assign
      if (consumption) {
        // Do not save last consumption on manual call to not disturb refresh interval (no consumption is created here)
        asset.currentConsumptionWh = consumption.currentConsumptionWh;
        asset.currentInstantAmps = consumption.currentInstantAmps;
        asset.currentInstantAmpsL1 = consumption.currentInstantAmpsL1;
        asset.currentInstantAmpsL2 = consumption.currentInstantAmpsL2;
        asset.currentInstantAmpsL3 = consumption.currentInstantAmpsL3;
        asset.currentInstantVolts = consumption.currentInstantVolts;
        asset.currentInstantVoltsL1 = consumption.currentInstantVoltsL1;
        asset.currentInstantVoltsL2 = consumption.currentInstantVoltsL2;
        asset.currentInstantVoltsL3 = consumption.currentInstantVoltsL3;
        asset.currentInstantWatts = consumption.currentInstantWatts;
        asset.currentInstantWattsL1 = consumption.currentInstantWattsL1;
        asset.currentInstantWattsL2 = consumption.currentInstantWattsL2;
        asset.currentInstantWattsL3 = consumption.currentInstantWattsL3;
        asset.currentStateOfCharge = consumption.currentStateOfCharge;
        // Save Asset
        await AssetStorage.saveAsset(req.tenant, asset);
      }
    } else {
      throw new AppError({
        ...LoggingHelper.getAssetProperties(asset),
        errorCode: HTTPError.CANNOT_RETRIEVE_CONSUMPTION,
        message: 'Consumption cannot be retrieved',
        user: req.user,
        module: MODULE_NAME, method: 'handleRetrieveConsumption'
      });
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetAssetsInError(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.LIST, Entity.ASSET, MODULE_NAME, 'handleGetAssetsInError');
    // Filter
    const filteredRequest = AssetValidatorRest.getInstance().validateAssetsInErrorGetReq(req.query);
    // Check dynamic auth
    const authorizations = await AuthorizationService.checkAndGetAssetsAuthorizations(
      req.tenant, req.user, Action.IN_ERROR, filteredRequest, false);
    if (!authorizations.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get the assets
    const assets = await AssetStorage.getAssetsInError(req.tenant,
      {
        issuer: filteredRequest.Issuer,
        search: filteredRequest.Search,
        siteAreaIDs: (filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null),
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        errorType: (filteredRequest.ErrorType ? filteredRequest.ErrorType.split('|') : [AssetInErrorType.MISSING_SITE_AREA]),
        ...authorizations.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizations.projectFields
    );
    // Assign projected fields
    if (authorizations.projectFields) {
      assets.projectFields = authorizations.projectFields;
    }
    // Add Auth flags
    if (filteredRequest.WithAuth) {
      await AuthorizationService.addAssetsAuthorizations(req.tenant, req.user, assets as AssetDataResult, authorizations);
    }
    res.json(assets);
    next();
  }

  public static async handleDeleteAsset(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.DELETE, Entity.ASSET, MODULE_NAME, 'handleDeleteAsset');
    // Filter
    const filteredRequest = AssetValidatorRest.getInstance().validateAssetDeleteReq(req.query);
    // Check and get Asset
    const asset = await UtilsService.checkAndGetAssetAuthorization(req.tenant, req.user, filteredRequest.ID,
      Action.DELETE, action);
    // Delete
    await AssetStorage.deleteAsset(req.tenant, asset.id);
    // Log
    await Logging.logInfo({
      ...LoggingHelper.getAssetProperties(asset),
      tenantID: req.tenant.id,
      user: req.user,
      module: MODULE_NAME, method: 'handleDeleteAsset',
      message: `Asset '${asset.name}' has been deleted successfully`,
      action: action,
      detailedMessages: { asset }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetAsset(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.READ, Entity.ASSET, MODULE_NAME, 'handleGetAsset');
    // Filter
    const filteredRequest = AssetValidatorRest.getInstance().validateAssetGetReq(req.query);
    // Check and get Asset
    const asset = await UtilsService.checkAndGetAssetAuthorization(req.tenant, req.user, filteredRequest.ID, Action.READ, action, null,
      { withSiteArea: filteredRequest.WithSiteArea }, true);
    res.json(asset);
    next();
  }

  public static async handleGetAssetImage(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check Tenant
    if (!req.tenant) {
      throw new AppError({
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Tenant must be provided',
        module: MODULE_NAME, method: 'handleGetAssetImage', action: action,
      });
    }
    // This endpoint is not protected, so no need to check user's access
    const filteredRequest = AssetValidatorRest.getInstance().validateAssetGetImageReq(req.query);
    // Get the image
    const assetImage = await AssetStorage.getAssetImage(req.tenant, filteredRequest.ID);
    let image = assetImage?.image;
    if (image) {
      // Header
      let header = 'image';
      let encoding: BufferEncoding = 'base64';
      if (image.startsWith('data:image/')) {
        header = image.substring(5, image.indexOf(';'));
        encoding = image.substring(image.indexOf(';') + 1, image.indexOf(',')) as BufferEncoding;
        image = image.substring(image.indexOf(',') + 1);
      }
      res.setHeader('Content-Type', header);
      res.send(Buffer.from(image, encoding));
    } else {
      res.status(StatusCodes.NOT_FOUND);
    }
    next();
  }

  public static async handleGetAssets(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.LIST, Entity.ASSET, MODULE_NAME, 'handleGetAssets');
    // Filter
    const filteredRequest = AssetValidatorRest.getInstance().validateAssetsGetReq(req.query);
    // Check dynamic auth
    const authorizations = await AuthorizationService.checkAndGetAssetsAuthorizations(
      req.tenant, req.user, Action.LIST, filteredRequest, false);
    if (!authorizations.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get the assets
    const assets = await AssetStorage.getAssets(req.tenant,
      {
        search: filteredRequest.Search,
        issuer: filteredRequest.Issuer,
        siteAreaIDs: (filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null),
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        withSiteArea: filteredRequest.WithSiteArea,
        withSite: filteredRequest.WithSite,
        withNoSiteArea: filteredRequest.WithNoSiteArea,
        dynamicOnly: filteredRequest.DynamicOnly,
        ...authorizations.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizations.projectFields
    );
    // Assign projected fields
    if (authorizations.projectFields) {
      assets.projectFields = authorizations.projectFields;
    }
    // Add Auth flags
    if (filteredRequest.WithAuth) {
      await AuthorizationService.addAssetsAuthorizations(req.tenant, req.user, assets as AssetDataResult, authorizations);
    }
    res.json(assets);
    next();
  }

  public static async handleCreateAsset(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.CREATE, Entity.ASSET, MODULE_NAME, 'handleCreateAsset');
    // Check request is valid
    const filteredAssetRequest = AssetValidatorRest.getInstance().validateAssetCreateReq(req.body);
    // Check authorizations for current action attempt
    await AuthorizationService.checkAndGetAssetAuthorizations(
      req.tenant, req.user, Action.CREATE, {}, filteredAssetRequest);
    // Check Site Area authorization
    let siteArea: SiteArea = null;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION) && filteredAssetRequest.siteAreaID) {
      siteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
        req.tenant, req.user, filteredAssetRequest.siteAreaID, Action.UPDATE, action, filteredAssetRequest, { withSite: true }, false);
    }
    // Create asset
    const newAsset: Asset = {
      ...filteredAssetRequest,
      companyID: siteArea?.site ? siteArea.site.companyID : null,
      siteID: siteArea ? siteArea.siteID : null,
      issuer: true,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as Asset;
    // Save
    newAsset.id = await AssetStorage.saveAsset(req.tenant, newAsset);
    // Log
    await Logging.logInfo({
      ...LoggingHelper.getAssetProperties(newAsset),
      tenantID: req.tenant.id,
      user: req.user,
      module: MODULE_NAME, method: 'handleCreateAsset',
      message: `Asset '${newAsset.id}' has been created successfully`,
      action: action,
      detailedMessages: { asset: newAsset }
    });
    res.json(Object.assign({ id: newAsset.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateAsset(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.UPDATE, Entity.ASSET, MODULE_NAME, 'handleUpdateAsset');
    // Filter
    const filteredRequest = AssetValidatorRest.getInstance().validateAssetUpdateReq(req.body);
    // Check Site Area authorization
    let siteArea: SiteArea = null;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION) && filteredRequest.siteAreaID) {
      siteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
        req.tenant, req.user, filteredRequest.siteAreaID, Action.UPDATE, action, filteredRequest, { withSite: true }, false);
    }
    // Check and get asset
    const asset = await UtilsService.checkAndGetAssetAuthorization(req.tenant, req.user, filteredRequest.id, Action.UPDATE, action, filteredRequest);
    // Update Asset values and persist
    asset.name = filteredRequest.name;
    asset.companyID = siteArea?.site ? siteArea.site.companyID : null;
    asset.siteID = siteArea ? siteArea.siteID : null;
    asset.siteAreaID = filteredRequest.siteAreaID;
    asset.assetType = filteredRequest.assetType;
    asset.excludeFromSmartCharging = filteredRequest.excludeFromSmartCharging;
    asset.variationThresholdPercent = filteredRequest.variationThresholdPercent;
    asset.fluctuationPercent = filteredRequest.fluctuationPercent;
    asset.staticValueWatt = filteredRequest.staticValueWatt;
    asset.coordinates = filteredRequest.coordinates;
    asset.image = filteredRequest.image;
    asset.dynamicAsset = filteredRequest.dynamicAsset;
    asset.usesPushAPI = filteredRequest.usesPushAPI;
    asset.connectionID = filteredRequest.connectionID;
    asset.meterID = filteredRequest.meterID;
    asset.lastChangedBy = { 'id': req.user.id };
    asset.lastChangedOn = new Date();
    await AssetStorage.saveAsset(req.tenant, asset);
    // Log
    await Logging.logInfo({
      ...LoggingHelper.getAssetProperties(asset),
      tenantID: req.tenant.id,
      user: req.user,
      module: MODULE_NAME, method: 'handleUpdateAsset',
      message: `Asset '${asset.name}' has been updated successfully`,
      action: action,
      detailedMessages: { asset }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  private static checkDateOrder(startSate: Date, endDate: Date, user: UserToken, action: ServerAction, methodName: string): void {
    // Check dates order
    if (startSate && endDate &&
      !moment(endDate).isAfter(moment(startSate))) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: `The requested start date '${moment(startSate).toISOString()}' is after the end date '${moment(endDate).toISOString()}' `,
        module: MODULE_NAME, method: methodName,
        user: user,
        action: action
      });
    }
  }
}
