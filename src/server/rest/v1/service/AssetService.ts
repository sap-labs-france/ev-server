import { Action, AuthorizationFilter, Entity } from '../../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';
import Tenant, { TenantComponents } from '../../../../types/Tenant';

import AppError from '../../../../exception/AppError';
import Asset from '../../../../types/Asset';
import { AssetDataResult } from '../../../../types/DataResult';
import AssetFactory from '../../../../integration/asset/AssetFactory';
import { AssetInErrorType } from '../../../../types/InError';
import AssetStorage from '../../../../storage/mongodb/AssetStorage';
import AssetValidator from '../validator/AssetValidator';
import AuthorizationService from './AuthorizationService';
import Constants from '../../../../utils/Constants';
import Consumption from '../../../../types/Consumption';
import ConsumptionStorage from '../../../../storage/mongodb/ConsumptionStorage';
import { HTTPError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import OCPPUtils from '../../../../server/ocpp/utils/OCPPUtils';
import { ServerAction } from '../../../../types/Server';
import SiteArea from '../../../../types/SiteArea';
import { StatusCodes } from 'http-status-codes';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
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
    const filteredRequest = AssetValidator.getInstance().validateAssetGetConsumptionsReq(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.AssetID, MODULE_NAME,
      'handleGetAssetConsumption', req.user);
    // Retrieve authorizations for current action attempt
    const actionOnAssetAuthorizationFilter = await AuthorizationService.checkAndGetAssetAuthorizations(req.tenant, req.user, Action.READ_CONSUMPTION, {});
    // Get asset
    const asset = await AssetService.getAssetFromStorage(req.tenant, filteredRequest.AssetID, { dynamicOnly: true }, actionOnAssetAuthorizationFilter);
    UtilsService.assertObjectExists(action, asset, `Asset ID '${filteredRequest.AssetID}' cannot be retrieved`,
      MODULE_NAME, 'handleGetAssetConsumption', req.user);
    // Check dynamic auth
    await AuthorizationService.checkAndGetAssetAuthorizations(req.tenant, req.user, Action.READ_CONSUMPTION, {}, asset);
    // Check dates
    if (!filteredRequest.StartDate || !filteredRequest.EndDate) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Start date and end date must be provided',
        module: MODULE_NAME, method: 'handleGetAssetConsumption',
        user: req.user,
        action: action
      });
    }
    // Check dates order
    if (filteredRequest.StartDate && filteredRequest.EndDate &&
      moment(filteredRequest.StartDate).isAfter(moment(filteredRequest.EndDate))) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: `The requested start date '${filteredRequest.StartDate.toISOString()}' is after the end date '${filteredRequest.EndDate.toISOString()}' `,
        module: MODULE_NAME, method: 'handleGetAssetConsumption',
        user: req.user,
        action: action
      });
    }
    // Get the ConsumptionValues
    const consumptions = await ConsumptionStorage.getAssetConsumptions(req.tenant, {
      assetID: filteredRequest.AssetID,
      startDate: filteredRequest.StartDate,
      endDate: filteredRequest.EndDate
    }, ['startedAt', 'instantWatts', 'instantAmps', 'limitWatts', 'limitAmps', 'endedAt', 'stateOfCharge']);
    // Assign
    asset.values = consumptions;
    res.json(asset);
    next();
  }

  public static async handleCreateAssetConsumption(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.CREATE_CONSUMPTION, Entity.ASSET, MODULE_NAME, 'handleCreateAssetConsumption');
    // Validate request
    const filteredRequest = AssetValidator.getInstance().validateAssetConsumptionCreateReq({ ...req.query, ...req.body });
    UtilsService.assertIdIsProvided(action, filteredRequest.assetID, MODULE_NAME,
      'handleCreateAssetConsumption', req.user);
    // Retrieve authorizations for current action attempt
    const actionOnAssetAuthorizationFilter = await AuthorizationService.checkAndGetAssetAuthorizations(req.tenant, req.user, Action.CREATE_CONSUMPTION, {});
    // Get Asset
    const asset = await AssetService.getAssetFromStorage(req.tenant, filteredRequest.assetID, { withSiteArea: true }, actionOnAssetAuthorizationFilter);
    UtilsService.assertObjectExists(action, asset, `Asset ID '${filteredRequest.assetID}' cannot be retrieved to create consumption`,
      MODULE_NAME, 'handleCreateAssetConsumption', req.user);
    // Check dynamic auth
    await AuthorizationService.checkAndGetAssetAuthorizations(req.tenant, req.user, Action.CREATE_CONSUMPTION, {}, asset);
    // Check if connection ID exists
    if (!Utils.isNullOrUndefined(asset.connectionID)) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: `The asset '${asset.name}' has a defined connection. The push API can not be used`,
        module: MODULE_NAME, method: 'handleCreateAssetConsumption',
        user: req.user,
        action: action
      });
    }
    // Check dates order
    if (filteredRequest.startedAt && filteredRequest.endedAt &&
      !moment(filteredRequest.endedAt).isAfter(moment(filteredRequest.startedAt))) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: `The requested start date '${moment(filteredRequest.startedAt).toISOString()}' is after the end date '${moment(filteredRequest.endedAt).toISOString()}' `,
        module: MODULE_NAME, method: 'handleCreateAssetConsumption',
        user: req.user,
        action: action
      });
    }
    // Get latest consumption and check dates
    const lastConsumption = await ConsumptionStorage.getLastAssetConsumption(req.tenant, { assetID: filteredRequest.assetID });
    if (!Utils.isNullOrUndefined(lastConsumption)) {
      if (moment(filteredRequest.startedAt).isBefore(moment(lastConsumption.endedAt))) {
        throw new AppError({
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
    // Filter request
    const filteredRequest = AssetValidator.getInstance().validateAssetCheckConnectionReq(req.query);
    // Check dynamic auth
    await AuthorizationService.checkAndGetAssetAuthorizations(req.tenant, req.user, Action.CHECK_CONNECTION, filteredRequest);
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
        tenantID: req.user.tenantID,
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
    const assetID = AssetValidator.getInstance().validateAssetGetReq(req.query).ID;
    UtilsService.assertIdIsProvided(action, assetID, MODULE_NAME, 'handleRetrieveConsumption', req.user);
    // Retrieve authorizations for current action attempt
    const actionOnAssetAuthorizationFilter = await AuthorizationService.checkAndGetAssetAuthorizations(
      req.tenant, req.user, Action.RETRIEVE_CONSUMPTION, {});
    // Get
    const asset = await AssetService.getAssetFromStorage(req.tenant, assetID, { dynamicOnly: true, usesPushAPI: false }, actionOnAssetAuthorizationFilter);
    UtilsService.assertObjectExists(action, asset, `Asset ID '${assetID}' consumption cannot be retrieved`,
      MODULE_NAME, 'handleRetrieveConsumption', req.user);
    // Dynamic auth
    await AuthorizationService.checkAndGetAssetAuthorizations(req.tenant, req.user, Action.RETRIEVE_CONSUMPTION, {}, asset);
    // Get asset factory
    const assetImpl = await AssetFactory.getAssetImpl(req.tenant, asset.connectionID);
    if (!assetImpl) {
      throw new AppError({
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
      // TODO: Return a specific HTTP code to tell the user that the consumption cannot be retrieved
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetAssetsInError(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.LIST, Entity.ASSET, MODULE_NAME, 'handleGetAssetsInError');
    // Filter
    const filteredRequest = AssetValidator.getInstance().validateAssetsGetReq(req.query);
    // Check dynamic auth
    const authorizationAssetsInErrorFilter = await AuthorizationService.checkAndGetAssetsAuthorizations(
      req.tenant, req.user, Action.IN_ERROR, filteredRequest);
    // Get the assets
    const assets = await AssetStorage.getAssetsInError(req.tenant,
      {
        issuer: filteredRequest.Issuer,
        search: filteredRequest.Search,
        siteAreaIDs: (filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null),
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        errorType: (filteredRequest.ErrorType ? filteredRequest.ErrorType.split('|') : [AssetInErrorType.MISSING_SITE_AREA]),
        ...authorizationAssetsInErrorFilter.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationAssetsInErrorFilter.projectFields
    );
    // Add Auth flags
    await AuthorizationService.addAssetsAuthorizations(
      req.tenant, req.user, assets as AssetDataResult, authorizationAssetsInErrorFilter);
    res.json(assets);
    next();
  }

  public static async handleDeleteAsset(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.DELETE, Entity.ASSET, MODULE_NAME, 'handleDeleteAsset');
    // Filter
    const filteredRequest = AssetValidator.getInstance().validateAssetGetReq(req.query);
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleDeleteAsset', req.user);
    // Retrieve authorizations for current action attempt
    const actionOnAssetAuthorizationFilter = await AuthorizationService.checkAndGetAssetAuthorizations(
      req.tenant, req.user, Action.DELETE, filteredRequest);
    // Get
    const asset = await AssetService.getAssetFromStorage(req.tenant, filteredRequest.ID, { withSiteArea: filteredRequest.WithSiteArea }, actionOnAssetAuthorizationFilter);
    UtilsService.assertObjectExists(action, asset, `Asset ID '${filteredRequest.ID}' cannot be deleted`,
      MODULE_NAME, 'handleDeleteAsset', req.user);
    // Dynamic auth
    await AuthorizationService.checkAndGetAssetAuthorizations(req.tenant, req.user, Action.DELETE, filteredRequest, asset);
    // Delete
    await AssetStorage.deleteAsset(req.tenant, asset.id);
    // Log
    await Logging.logInfo({
      tenantID: req.user.tenantID,
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
    const filteredRequest = AssetValidator.getInstance().validateAssetGetReq(req.query);
    // ID is mandatory
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetAsset', req.user);
    // Check action authorization before querying storage
    const actionOnAssetAuthorizationFilter = await AuthorizationService.checkAndGetAssetAuthorizations(
      req.tenant, req.user, Action.READ, filteredRequest);
    // Get it
    const asset = await AssetService.getAssetFromStorage(req.tenant, filteredRequest.ID, { withSiteArea: filteredRequest.WithSiteArea }, actionOnAssetAuthorizationFilter);
    UtilsService.assertObjectExists(action, asset, `Asset ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleGetAsset', req.user);
    // Dynamic auth
    const authorizationAssetsFilter = await AuthorizationService.checkAndGetAssetAuthorizations(req.tenant, req.user, Action.READ, filteredRequest, asset);
    // Add authorizations flags
    await AuthorizationService.addAssetAuthorizations(req.tenant, req.user, asset, authorizationAssetsFilter);
    res.json(asset);
    next();
  }

  public static async handleGetAssetImage(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = AssetValidator.getInstance().validateAssetGetImageReq(req.query);
    // Get the tenant
    const tenant = await TenantStorage.getTenant(filteredRequest.TenantID);
    UtilsService.assertObjectExists(action, tenant, 'Tenant does not exist', MODULE_NAME, 'handleGetAssetImage', req.user);
    // Get the image
    const assetImage = await AssetStorage.getAssetImage(tenant, filteredRequest.ID);
    if (assetImage?.image) {
      let header = 'image';
      let encoding: BufferEncoding = 'base64';
      // Remove encoding header
      if (assetImage.image.startsWith('data:image/')) {
        header = assetImage.image.substring(5, assetImage.image.indexOf(';'));
        encoding = assetImage.image.substring(assetImage.image.indexOf(';') + 1, assetImage.image.indexOf(',')) as BufferEncoding;
        assetImage.image = assetImage.image.substring(assetImage.image.indexOf(',') + 1);
      }
      res.setHeader('content-type', header);
      res.send(assetImage.image ? Buffer.from(assetImage.image, encoding) : null);
    } else {
      res.send(null);
    }
    next();
  }

  public static async handleGetAssets(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.LIST, Entity.ASSET, MODULE_NAME, 'handleGetAssets');
    // Filter
    const filteredRequest = AssetValidator.getInstance().validateAssetsGetReq(req.query);
    // Check dynamic auth
    const authorizationAssetsFilter = await AuthorizationService.checkAndGetAssetsAuthorizations(
      req.tenant, req.user, Action.LIST, filteredRequest);
    // Get the assets
    const assets = await AssetStorage.getAssets(req.tenant,
      {
        search: filteredRequest.Search,
        issuer: filteredRequest.Issuer,
        siteAreaIDs: (filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null),
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        withSiteArea: filteredRequest.WithSiteArea,
        withNoSiteArea: filteredRequest.WithNoSiteArea,
        dynamicOnly: filteredRequest.DynamicOnly,
        ...authorizationAssetsFilter.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationAssetsFilter.projectFields
    );
    // Add Auth flags
    await AuthorizationService.addAssetsAuthorizations(
      req.tenant, req.user, assets as AssetDataResult, authorizationAssetsFilter);
    res.json(assets);
    next();
  }

  public static async handleCreateAsset(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.CREATE, Entity.ASSET, MODULE_NAME, 'handleCreateAsset');
    // Check request is valid
    const filteredAssetRequest = AssetValidator.getInstance().validateAssetCreateReq(req.body);
    UtilsService.checkIfAssetValid(filteredAssetRequest, req);
    // Check authorizations for current action attempt
    await AuthorizationService.checkAndGetAssetAuthorizations(req.tenant, req.user, Action.CREATE, {}, filteredAssetRequest);
    // Check Site Area authorization
    let siteArea: SiteArea = null;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION) && filteredAssetRequest.siteAreaID) {
      siteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
        req.tenant, req.user, filteredAssetRequest.siteAreaID, Action.UPDATE, action, filteredAssetRequest, null, false);
    }
    // Create asset
    const newAsset: Asset = {
      ...filteredAssetRequest,
      siteID: siteArea ? siteArea.siteID : null,
      issuer: true,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as Asset;
    // Save
    newAsset.id = await AssetStorage.saveAsset(req.tenant, newAsset);
    // Log
    await Logging.logInfo({
      tenantID: req.user.tenantID,
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
    const filteredRequest = AssetValidator.getInstance().validateAssetUpdateReq(req.body);
    UtilsService.checkIfAssetValid(filteredRequest, req);
    // Retrieve authorizations for current action attempt
    const actionOnAssetAuthorizationFilter = await AuthorizationService.checkAndGetAssetAuthorizations(req.tenant, req.user, Action.UPDATE, {}, filteredRequest);
    // Check Site Area authorization
    let siteArea: SiteArea = null;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION) && filteredRequest.siteAreaID) {
      siteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
        req.tenant, req.user, filteredRequest.siteAreaID, Action.UPDATE, action, filteredRequest, null, false);
    }
    // Get asset
    const asset = await AssetService.getAssetFromStorage(req.tenant, filteredRequest.id, {}, actionOnAssetAuthorizationFilter);
    UtilsService.assertObjectExists(action, asset, `Asset ID '${filteredRequest.id}' cannot be modified`,
      MODULE_NAME, 'handleUpdateAsset', req.user);
    // Check dynamic auth
    await AuthorizationService.checkAndGetAssetAuthorizations(req.tenant, req.user, Action.UPDATE, {}, asset);
    // Update Asset values and persist
    asset.name = filteredRequest.name;
    asset.siteAreaID = filteredRequest.siteAreaID;
    asset.siteID = siteArea ? siteArea.siteID : null;
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
      tenantID: req.user.tenantID,
      user: req.user,
      module: MODULE_NAME, method: 'handleUpdateAsset',
      message: `Asset '${asset.name}' has been updated successfully`,
      action: action,
      detailedMessages: { asset }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  private static async getAssetFromStorage(tenant: Tenant, assetID: string, additionalFilters: Record<string, any> = {}, authorizationAssetFilter: AuthorizationFilter): Promise<Asset> {
    // Retrieve Asset from storage
    const asset = await AssetStorage.getAsset(tenant,
      assetID,
      {
        ...additionalFilters,
        ...authorizationAssetFilter.filters
      },
      authorizationAssetFilter.projectFields
    );
    return asset;
  }
}
