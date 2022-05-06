import { Action, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { ActionsResponse, ImportStatus } from '../../../../types/GlobalType';
import { NextFunction, Request, Response } from 'express';
import Busboy, { FileInfo } from 'busboy';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import AuthorizationService from './AuthorizationService';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import LoggingHelper from '../../../../utils/LoggingHelper';
import LockingHelper from '../../../../locking/LockingHelper';
import LockingManager from '../../../../locking/LockingManager';
import { ChargingStationTemplateDataResult } from '../../../../types/DataResult';
import ChargingStationTemplateStorage from '../../../../storage/mongodb/ChargingStationTemplateStorage';
import ChargingStationTemplateValidator from '../validator/ChargingStationTemplateValidator';
import { ServerAction } from '../../../../types/Server';
import { TenantComponents } from '../../../../types/Tenant';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';
import moment from 'moment';
import Authorizations from '../../../../authorization/Authorizations';
import { Readable } from 'stream';
import JSONStream from 'JSONStream';
import ChargingStationTemplate from '../../../../types/ChargingStation';

const MODULE_NAME = 'ChargingStationTemplateService';

export default class ChargingStationTemplateService {
  public static async handleCreateChargingStationTemplate(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // const filteredRequest = ChargingStationTemplateValidator.getInstance().validateCarCreateReq(req.body);
    const filteredRequest = req.body;
    await AuthorizationService.checkAndGetChargingStationTemplateAuthorizations(
      req.tenant, req.user, {}, Action.CREATE, filteredRequest as ChargingStationTemplate);
    // Check auth
    if (!(await Authorizations.canCreateChargingStationTemplates(req.user))) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.IMPORT, entity: Entity.CHARGING_STATION_TEMPLATE,
        module: MODULE_NAME, method: 'handleCreateChargingStationTemplate'
      });
    }
    const newChargingStationTemplate: ChargingStationTemplate = {
      id: filteredRequest.id,
      templateHash: filteredRequest.hash,
      templateHashCapabilities: filteredRequest.hashCapabilities,
      templateHashTechnical: filteredRequest.hashTechnical,
      templateHashOcppStandard: filteredRequest.hashOcppStandard,
      templateHashOcppVendor: filteredRequest.hashOcppVendor,
      issuer: filteredRequest.issuer,
      public: filteredRequest.public,
      siteAreaID: filteredRequest.siteAreaID,
      siteID: filteredRequest.siteID,
      companyID: filteredRequest.companyID,
      chargePointSerialNumber: filteredRequest.chargePointSerialNumber,
      chargePointModel: filteredRequest.chargePointModel,
      chargeBoxSerialNumber: filteredRequest.chargeBoxSerialNumber,
      chargePointVendor: filteredRequest.chargePointVendor,
      iccid: filteredRequest.iccid,
      imsi: filteredRequest.imsi,
      meterType: filteredRequest.meterType,
      firmwareVersion: filteredRequest.firmwareVersion,
      firmwareUpdateStatus: filteredRequest.firmwareUpdateStatus,
      meterSerialNumber: filteredRequest.meterSerialNumber,
      endpoint: filteredRequest.endpoint,
      ocppVersion: filteredRequest.ocppVersion,
      ocppProtocol: filteredRequest.ocppProtocol,
      cloudHostIP: filteredRequest.cloudHostIP,
      cloudHostName: filteredRequest.cloudHostName,
      lastSeen: new Date(),
      deleted: filteredRequest.deleted,
      inactive: filteredRequest.inactive,
      tokenID: filteredRequest.tokenID,
      forceInactive: filteredRequest.forceInactive,
      manualConfiguration: filteredRequest.manualConfiguration,
      lastReboot: new Date(),
      chargingStationURL: filteredRequest.chargingStationURL,
      maximumPower: filteredRequest.maximumPower,
      masterSlave: filteredRequest.masterSlave,
      voltage: filteredRequest.voltage,
      excludeFromSmartCharging: filteredRequest.excludeFromSmartCharging,
      powerLimitUnit: filteredRequest.powerLimitUnit,
      coordinates: filteredRequest.coordinates,
      chargePoints: filteredRequest.chargePoints,
      connectors: filteredRequest.connectors,
      backupConnectors: filteredRequest.backupConnectors,
      remoteAuthorizations: filteredRequest.remoteAuthorizations,
      currentIPAddress: filteredRequest.currentIPAddress,
      siteArea: filteredRequest.siteArea,
      site: filteredRequest.site,
      capabilities: filteredRequest.capabilities,
      ocppStandardParameters: filteredRequest.ocppStandardParameters,
      ocppVendorParameters: filteredRequest.ocppVendorParameters,
      distanceMeters: filteredRequest.distanceMeters,
      ocpiData: filteredRequest.ocpiData,
      oicpData: filteredRequest.oicpData,
      tariffID: filteredRequest.tariffID,
      createdOn: new Date()
    };

    newChargingStationTemplate.id = await ChargingStationTemplateStorage.saveChargingStationTemplate(req.tenant, newChargingStationTemplate);
    await Logging.logInfo({
      tenantID: req.tenant.id,
      ...LoggingHelper.getChargingStationTemplateProperties(newChargingStationTemplate),
      user: req.user, module: MODULE_NAME, method: 'handleCreateChargingStationTemplate',
      message: `newChargingStationTemplate '${newChargingStationTemplate}' has been created successfully`,
      action: action,
      detailedMessages: { car: newChargingStationTemplate }
    });
    res.json(Object.assign({ id: newChargingStationTemplate.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }


  public static async handleGetChargingStationTemplates(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationTemplateValidator.getInstance().validateChargingStationTemplatesGetReq(req.query);
    // Check dynamic auth
    const authorizationChargingStationTemplateFilter = await AuthorizationService.checkAndGetChargingStationTemplatesAuthorizations(
      req.tenant, req.user, filteredRequest);
    if (!authorizationChargingStationTemplateFilter.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get the tokens
    const chargingStationTemplates = await ChargingStationTemplateStorage.getChargingStationTemplates(req.tenant,
      {
        search: filteredRequest.Search,
        ...authorizationChargingStationTemplateFilter.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationChargingStationTemplateFilter.projectFields
    );
    // Assign projected fields
    if (authorizationChargingStationTemplateFilter.projectFields) {
      chargingStationTemplates.projectFields = authorizationChargingStationTemplateFilter.projectFields;
    }
    // Add Auth flags
    await AuthorizationService.addChargingStationTemplatesAuthorizations(req.tenant, req.user, chargingStationTemplates as ChargingStationTemplateDataResult, authorizationChargingStationTemplateFilter);
    res.json(chargingStationTemplates);
    next();
  }

  public static async handleGetChargingStationTemplate(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationTemplateValidator.getInstance().validateChargingStationTemplateGetReq(req.query);
    // Check and Get Registration Token
    const chargingStationTemplate = await UtilsService.checkAndGetChargingStationTemplateAuthorization(
      req.tenant, req.user, filteredRequest.ID, Action.READ, action, null, {}, true);
    res.json(chargingStationTemplate);
    next();
  }
}

