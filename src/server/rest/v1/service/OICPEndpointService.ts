import { Action, Entity } from '../../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';
import { OICPEndpointPaths, OICPVersion } from '../../../../types/oicp/OICPGeneral';

import AppAuthError from '../../../../exception/AppAuthError';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import { HTTPAuthError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import OICPClientFactory from '../../../../client/oicp/OICPClientFactory';
import OICPEndpoint from '../../../../types/oicp/OICPEndpoint';
import OICPEndpointStorage from '../../../../storage/mongodb/OICPEndpointStorage';
import OICPEndpointValidatorRest from '../validator/OICPEndpointValidatorRest';
import { OICPRegistrationStatus } from '../../../../types/oicp/OICPRegistrationStatus';
import { OICPStatusCode } from '../../../../types/oicp/OICPStatusCode';
import { ServerAction } from '../../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import { TenantComponents } from '../../../../types/Tenant';
import UtilsService from './UtilsService';

const MODULE_NAME = 'OICPEndpointService';

export default class OICPEndpointService {
  public static async handleDeleteOicpEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OICP,
      Action.DELETE, Entity.OICP_ENDPOINT, MODULE_NAME, 'handleDeleteOicpEndpoint');
    // Filter
    const filteredRequest = OICPEndpointValidatorRest.getInstance().validateOICPEndpointDeleteReq(req.query);
    // Check auth
    if (!await Authorizations.canDeleteOicpEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.DELETE, entity: Entity.OICP_ENDPOINT,
        module: MODULE_NAME, method: 'handleDeleteOicpEndpoint',
        value: filteredRequest.ID
      });
    }
    // Get
    const oicpEndpoint = await OICPEndpointStorage.getOicpEndpoint(req.tenant, filteredRequest.ID);
    UtilsService.assertObjectExists(action, oicpEndpoint, `OICP Endpoint ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleDeleteOicpEndpoint', req.user);
    // Delete
    await OICPEndpointStorage.deleteOicpEndpoint(req.tenant, oicpEndpoint.id);
    // Log
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteOicpEndpoint',
      message: `Oicp Endpoint '${oicpEndpoint.name}' has been deleted successfully`,
      action: action,
      detailedMessages: { oicpEndpoint }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleCreateOicpEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OICP,
      Action.CREATE, Entity.OICP_ENDPOINT, MODULE_NAME, 'handleCreateOicpEndpoint');
    // Check auth
    if (!await Authorizations.canCreateOicpEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE,
        entity: Entity.OICP_ENDPOINT,
        module: MODULE_NAME,
        method: 'handleCreateOicpEndpoint'
      });
    }
    // Filter
    const filteredRequest = OICPEndpointValidatorRest.getInstance().validateOICPEndpointCreateReq(req.body);
    const oicpEndpoint: OICPEndpoint = {
      ...filteredRequest,
      createdBy: { id: req.user.id },
      createdOn: new Date(),
      status: OICPRegistrationStatus.NEW,
      version: OICPVersion.V230,
      availableEndpoints: {
        evses: OICPEndpointPaths.EVSE_DATA,
        statuses: OICPEndpointPaths.STATUSES,
        authorizeStart: OICPEndpointPaths.AUTHORIZE_START,
        authorizeStop: OICPEndpointPaths.AUTHORIZE_STOP,
        pricing: OICPEndpointPaths.PRICING,
        cdr: OICPEndpointPaths.CDR,
        pricingProducts: OICPEndpointPaths.PRICING_PRODUCTS,
        notifications: OICPEndpointPaths.NOTIFICATIONS
      }
    } as OICPEndpoint;
    const endpointID = await OICPEndpointStorage.saveOicpEndpoint(req.tenant, oicpEndpoint);
    // Log
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user, module: MODULE_NAME, method: 'handleCreateOicpEndpoint',
      message: `Oicp Endpoint '${filteredRequest.name}' has been created successfully`,
      action: action,
      detailedMessages: { endpoint: filteredRequest }
    });
    res.json(Object.assign({ id: endpointID }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateOicpEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OICP,
      Action.UPDATE, Entity.OICP_ENDPOINT, MODULE_NAME, 'handleUpdateOicpEndpoint');
    // Filter
    const filteredRequest = OICPEndpointValidatorRest.getInstance().validateOICPEndpointUpdateReq(req.body);
    // Check auth
    if (!await Authorizations.canUpdateOicpEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.OICP_ENDPOINT,
        module: MODULE_NAME, method: 'handleUpdateOicpEndpoint',
        value: filteredRequest.id
      });
    }
    // Get OicpEndpoint
    const oicpEndpoint = await OICPEndpointStorage.getOicpEndpoint(req.tenant, filteredRequest.id);
    UtilsService.assertObjectExists(action, oicpEndpoint, `OICP Endpoint ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUpdateOicpEndpoint', req.user);
    // Update timestamp
    oicpEndpoint.lastChangedBy = { 'id': req.user.id };
    oicpEndpoint.lastChangedOn = new Date();
    // Update OicpEndpoint
    await OICPEndpointStorage.saveOicpEndpoint(req.tenant, { ...oicpEndpoint, ...filteredRequest });
    // Log
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user, module: MODULE_NAME, method: 'handleUpdateOicpEndpoint',
      message: `Oicp Endpoint '${oicpEndpoint.name}' has been updated successfully`,
      action: action,
      detailedMessages: { endpoint: oicpEndpoint }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetOicpEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OICP,
      Action.READ, Entity.OICP_ENDPOINT, MODULE_NAME, 'handleGetOicpEndpoint');
    // Filter
    const endpointID = OICPEndpointValidatorRest.getInstance().validateOICPEndpointGetReq(req.query).ID;
    // Check auth
    if (!await Authorizations.canReadOicpEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.OICP_ENDPOINT,
        module: MODULE_NAME, method: 'handleGetOicpEndpoint',
        value: endpointID
      });
    }
    // Get it
    const oicpEndpoint = await OICPEndpointStorage.getOicpEndpoint(req.tenant, endpointID,
      [
        'id', 'name', 'role', 'baseUrl', 'countryCode', 'partyId', 'version', 'status', 'patchJobStatus', 'localToken', 'token',
        'patchJobResult.successNbr', 'patchJobResult.failureNbr', 'patchJobResult.totalNbr'
      ]);
    UtilsService.assertObjectExists(action, oicpEndpoint, `OICP Endpoint ID '${endpointID}' does not exist`,
      MODULE_NAME, 'handleGetOicpEndpoint', req.user);
    res.json(oicpEndpoint);
    next();
  }

  public static async handleGetOicpEndpoints(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OICP,
      Action.LIST, Entity.OICP_ENDPOINT, MODULE_NAME, 'handleGetOicpEndpoints');
    // Check auth
    if (!await Authorizations.canListOicpEndpoints(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST, entity: Entity.OICP_ENDPOINT,
        module: MODULE_NAME, method: 'handleGetOicpEndpoints'
      });
    }
    // Check User
    let userProject: string[] = [];
    if ((await Authorizations.canListUsers(req.user)).authorized) {
      userProject = [ 'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName' ];
    }
    // Filter
    const filteredRequest = OICPEndpointValidatorRest.getInstance().validateOICPEndpointsGetReq(req.query);
    // Get all oicpendpoints
    const oicpEndpoints = await OICPEndpointStorage.getOicpEndpoints(req.tenant,
      {
        'search': filteredRequest.Search
      }, {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      [
        'id', 'name', 'role', 'baseUrl', 'countryCode', 'partyId', 'version', 'status', 'lastChangedOn', 'lastPatchJobOn',
        'backgroundPatchJob', 'localToken', 'token',
        'lastPatchJobResult.successNbr', 'lastPatchJobResult.failureNbr', 'lastPatchJobResult.totalNbr',
        ...userProject
      ]);
    res.json(oicpEndpoints);
    next();
  }

  public static async handleSendEVSEStatusesOicpEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OICP,
      Action.READ, Entity.OICP_ENDPOINT, MODULE_NAME, 'handleSendEVSEStatusesOicpEndpoint');
    // Check auth
    if (!await Authorizations.canTriggerJobOicpEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.TRIGGER_JOB,
        entity: Entity.OICP_ENDPOINT,
        module: MODULE_NAME,
        method: 'handleSendEVSEStatusesOicpEndpoint'
      });
    }
    // Filter
    const filteredRequest = OICPEndpointValidatorRest.getInstance().validateOICPEndpointGetReq(req.params);
    // Get oicpEndpoint
    const oicpEndpoint = await OICPEndpointStorage.getOicpEndpoint(req.tenant, filteredRequest.ID);
    UtilsService.assertObjectExists(action, oicpEndpoint, `OICP Endpoint ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleSendEVSEStatusesOicpEndpoint', req.user);
    // Build OICP Client
    const oicpClient = await OICPClientFactory.getCpoOicpClient(req.tenant, oicpEndpoint);
    // Send EVSE statuses
    const sendResult = await oicpClient.sendEVSEStatuses();
    // Return result
    res.json(sendResult);
    next();
  }

  public static async handleSendEVSEsOicpEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OICP,
      Action.READ, Entity.OICP_ENDPOINT, MODULE_NAME, 'handleSendEVSEsOicpEndpoint');
    // Check auth
    if (!await Authorizations.canTriggerJobOicpEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.TRIGGER_JOB,
        entity: Entity.OICP_ENDPOINT,
        module: MODULE_NAME,
        method: 'handleSendEVSEsOicpEndpoint'
      });
    }
    // Filter
    const filteredRequest = OICPEndpointValidatorRest.getInstance().validateOICPEndpointGetReq(req.params);
    // Get oicpEndpoint
    const oicpEndpoint = await OICPEndpointStorage.getOicpEndpoint(req.tenant, filteredRequest.ID);
    UtilsService.assertObjectExists(action, oicpEndpoint, `OICP Endpoint ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleSendEVSEsOicpEndpoint', req.user);
    // Build OICP Client
    const oicpClient = await OICPClientFactory.getCpoOicpClient(req.tenant, oicpEndpoint);
    // Send EVSE statuses
    const sendResult = await oicpClient.sendEVSEs();
    // Return result
    res.json(sendResult);
    next();
  }

  public static async handlePingOicpEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OICP,
      Action.UPDATE, Entity.OICP_ENDPOINT, MODULE_NAME, 'handlePingOicpEndpoint');
    // Check auth
    if (!await Authorizations.canPingOicpEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.PING,
        entity: Entity.OICP_ENDPOINT,
        module: MODULE_NAME,
        method: 'handlePingOicpEndpoint'
      });
    }
    // Filter
    const filteredRequest = OICPEndpointValidatorRest.getInstance().validateOICPEndpointPingReq(req.params);
    // Get oicpEndpoint
    const oicpEndpoint = await OICPEndpointStorage.getOicpEndpoint(req.tenant, filteredRequest.id);
    // Build OICP Client
    const oicpClient = await OICPClientFactory.getOicpClient(req.tenant, oicpEndpoint);
    // Try to ping
    const pingResult = await oicpClient.ping();
    // Check ping result
    if (pingResult.statusCode === OICPStatusCode.Code000) {
      // Log
      await Logging.logInfo({
        tenantID: req.tenant.id,
        user: req.user, module: MODULE_NAME, method: 'handlePingOicpEndpoint',
        message: `Oicp Endpoint '${oicpEndpoint.name}' can be reached successfully`,
        action: action,
        detailedMessages: { pingResult }
      });
      res.json(Object.assign(pingResult, Constants.REST_RESPONSE_SUCCESS));
    } else {
      // Log
      await Logging.logError({
        tenantID: req.tenant.id,
        user: req.user, module: MODULE_NAME, method: 'handlePingOicpEndpoint',
        message: `Oicp Endpoint '${oicpEndpoint.name}' cannot be reached`,
        action: action,
        detailedMessages: { pingResult }
      });
      res.json(pingResult);
    }
    next();
  }

  public static async handleUnregisterOicpEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OICP,
      Action.UPDATE, Entity.OICP_ENDPOINT, MODULE_NAME, 'handleUnregisterOicpEndpoint');
    // Check auth
    if (!await Authorizations.canRegisterOicpEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.REGISTER, entity: Entity.OICP_ENDPOINT,
        module: MODULE_NAME, method: 'handleUnregisterOicpEndpoint'
      });
    }
    // Filter
    const filteredRequest = OICPEndpointValidatorRest.getInstance().validateOICPEndpointGetReq(req.params);
    // Get OicpEndpoint
    const oicpEndpoint = await OICPEndpointStorage.getOicpEndpoint(req.tenant, filteredRequest.ID);
    UtilsService.assertObjectExists(action, oicpEndpoint, `OICP Endpoint ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleUnregisterOicpEndpoint', req.user);
    // Build OICP Client
    const oicpClient = await OICPClientFactory.getOicpClient(req.tenant, oicpEndpoint);
    // Try to unregister
    const result = await oicpClient.unregister();
    // Check ping result
    if (result.statusCode === StatusCodes.OK) {
      // Log
      await Logging.logInfo({
        tenantID: req.tenant.id,
        user: req.user, module: MODULE_NAME, method: 'handleUnregisterOicpEndpoint',
        message: `Oicp Endpoint '${oicpEndpoint.name}' can be reached successfully`,
        action: action,
        detailedMessages: { result }
      });
      res.json(Object.assign(result, Constants.REST_RESPONSE_SUCCESS));
    } else {
      // Log
      await Logging.logError({
        tenantID: req.tenant.id,
        user: req.user, module: MODULE_NAME, method: 'handleUnregisterOicpEndpoint',
        message: `Oicp Endpoint '${oicpEndpoint.name}' cannot be reached`,
        action: action,
        detailedMessages: { result }
      });
      res.json(result);
    }
    next();
  }

  public static async handleRegisterOicpEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OICP,
      Action.UPDATE, Entity.OICP_ENDPOINT, MODULE_NAME, 'handleRegisterOicpEndpoint');
    // Check auth
    if (!await Authorizations.canRegisterOicpEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.REGISTER, entity: Entity.OICP_ENDPOINT,
        module: MODULE_NAME, method: 'handleRegisterOicpEndpoint'
      });
    }
    // Filter
    const filteredRequest = OICPEndpointValidatorRest.getInstance().validateOICPEndpointGetReq(req.params);
    // Get OicpEndpoint
    const oicpEndpoint = await OICPEndpointStorage.getOicpEndpoint(req.tenant, filteredRequest.ID);
    UtilsService.assertObjectExists(action, oicpEndpoint, `OICP Endpoint ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleRegisterOicpEndpoint', req.user);
    // Build OICP Client
    const oicpClient = await OICPClientFactory.getOicpClient(req.tenant, oicpEndpoint);
    // Try to register
    const result = await oicpClient.register();
    // Check ping result
    if (result.statusCode === StatusCodes.OK) {
      // Log
      await Logging.logInfo({
        tenantID: req.tenant.id,
        user: req.user, module: MODULE_NAME, method: 'handleRegisterOicpEndpoint',
        message: `Oicp Endpoint '${oicpEndpoint.name}' can be reached successfully`,
        action: action,
        detailedMessages: { result }
      });
      res.json(Object.assign(result, Constants.REST_RESPONSE_SUCCESS));
    } else {
      // Log
      await Logging.logError({
        tenantID: req.tenant.id,
        user: req.user, module: MODULE_NAME, method: 'handleRegisterOicpEndpoint',
        message: `Oicp Endpoint '${oicpEndpoint.name}' cannot be reached`,
        action: action,
        detailedMessages: { result }
      });
      res.json(result);
    }
    next();
  }
}
