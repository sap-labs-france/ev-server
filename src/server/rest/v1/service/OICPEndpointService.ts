import { Action, Entity } from '../../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import { HTTPAuthError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import OICPClientFactory from '../../../../client/oicp/OICPClientFactory';
import OICPEndpoint from '../../../../types/oicp/OICPEndpoint';
import OICPEndpointSecurity from './security/OICPEndpointSecurity';
import OICPEndpointStorage from '../../../../storage/mongodb/OICPEndpointStorage';
import { OICPRegistrationStatus } from '../../../../types/oicp/OICPRegistrationStatus';
import { OICPStatusCode } from '../../../../types/oicp/OICPStatusCode';
import { OICPVersion } from '../../../../types/oicp/OICPGeneral';
import { ServerAction } from '../../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import TenantComponents from '../../../../types/TenantComponents';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'OICPEndpointService';

export default class OICPEndpointService {
  static async handleDeleteOicpEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OICP,
      Action.DELETE, Entity.OICP_ENDPOINT, MODULE_NAME, 'handleDeleteOicpEndpoint');
    // Filter
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointDeleteRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleDeleteOicpEndpoint', req.user);
    // Check auth
    if (!Authorizations.canDeleteOicpEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE, entity: Entity.OICP_ENDPOINT,
        module: MODULE_NAME, method: 'handleDeleteOicpEndpoint',
        value: filteredRequest.ID
      });
    }
    // Get
    const oicpEndpoint = await OICPEndpointStorage.getOicpEndpoint(req.user.tenantID, filteredRequest.ID);
    UtilsService.assertObjectExists(action, oicpEndpoint, `OICPEndpoint with ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleDeleteOicpEndpoint', req.user);
    // Delete
    await OICPEndpointStorage.deleteOicpEndpoint(req.user.tenantID, oicpEndpoint.id);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteOicpEndpoint',
      message: `Oicp Endpoint '${oicpEndpoint.name}' has been deleted successfully`,
      action: action,
      detailedMessages: { oicpEndpoint }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  static async handleCreateOicpEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canCreateOicpEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE,
        entity: Entity.OICP_ENDPOINT,
        module: MODULE_NAME,
        method: 'handleCreateOicpEndpoint'
      });
    }
    // Filter
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointCreateRequest(req.body);
    // Check Mandatory fields
    UtilsService.checkIfOICPEndpointValid(filteredRequest, req);
    const oicpEndpoint: OICPEndpoint = {
      ...filteredRequest,
      createdBy: { id: req.user.id },
      createdOn: new Date(),
      status: OICPRegistrationStatus.NEW,
      version: OICPVersion.V230,
      availableEndpoints: {
        evses: '/api/oicp/evsepush/v23/operators/{operatorID}/data-records',
        statuses: '/api/oicp/evsepush/v21/operators/{operatorID}/status-records',
        authorizeStart: '/api/oicp/charging/v21/operators/{operatorID}/authorize/start',
        authorizeStop: '/api/oicp/charging/v21/operators/{operatorID}/authorize/stop',
        pricing: '/api/oicp/dynamicpricing/v10/operators/{operatorID}/evse-pricing',
        cdrs: '/api/oicp/cdrmgmt/v22/operators/{operatorID}/charge-detail-record',
        pricingProducts: '/api/oicp/dynamicpricing/v10/operators/{operatorID}/pricing-products',
        notifications: '/api/oicp/notificationmgmt/v11/charging-notifications'
      }
    } as OICPEndpoint;
    const endpointID = await OICPEndpointStorage.saveOicpEndpoint(req.user.tenantID, oicpEndpoint);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleCreateOicpEndpoint',
      message: `Oicp Endpoint '${filteredRequest.name}' has been created successfully`,
      action: action,
      detailedMessages: { endpoint: filteredRequest }
    });
    // Ok
    res.json(Object.assign({ id: endpointID }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  static async handleUpdateOicpEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OICP,
      Action.UPDATE, Entity.OICP_ENDPOINT, MODULE_NAME, 'handleUpdateOicpEndpoint');
    // Filter
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointUpdateRequest(req.body);
    // Check Mandatory fields
    UtilsService.checkIfOICPEndpointValid(filteredRequest, req);
    // Check auth
    if (!Authorizations.canUpdateOicpEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.OICP_ENDPOINT,
        module: MODULE_NAME, method: 'handleUpdateOicpEndpoint',
        value: filteredRequest.id
      });
    }
    // Get OicpEndpoint
    const oicpEndpoint = await OICPEndpointStorage.getOicpEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, oicpEndpoint, `OICPEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUpdateOicpEndpoint', req.user);
    // Update timestamp
    oicpEndpoint.lastChangedBy = { 'id': req.user.id };
    oicpEndpoint.lastChangedOn = new Date();
    // Update OicpEndpoint
    await OICPEndpointStorage.saveOicpEndpoint(req.user.tenantID, { ...oicpEndpoint, ...filteredRequest });
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleUpdateOicpEndpoint',
      message: `Oicp Endpoint '${oicpEndpoint.name}' has been updated successfully`,
      action: action,
      detailedMessages: { endpoint: oicpEndpoint }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  static async handleGetOicpEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OICP,
      Action.READ, Entity.OICP_ENDPOINT, MODULE_NAME, 'handleGetOicpEndpoint');
    // Filter
    const endpointID = OICPEndpointSecurity.filterOicpEndpointRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, endpointID, MODULE_NAME, 'handleGetOicpEndpoint', req.user);
    // Check auth
    if (!Authorizations.canReadOicpEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ, entity: Entity.OICP_ENDPOINT,
        module: MODULE_NAME, method: 'handleGetOicpEndpoint',
        value: endpointID
      });
    }
    // Get it
    const oicpEndpoint = await OICPEndpointStorage.getOicpEndpoint(req.user.tenantID, endpointID,
      [
        'id', 'name', 'role', 'baseUrl', 'countryCode', 'partyId', 'version', 'status', 'patchJobStatus', 'localToken', 'token',
        'patchJobResult.successNbr', 'patchJobResult.failureNbr', 'patchJobResult.totalNbr'
      ]);
    UtilsService.assertObjectExists(action, oicpEndpoint, `OICPEndpoint with ID '${endpointID}' does not exist`,
      MODULE_NAME, 'handleGetOicpEndpoint', req.user);
    res.json(oicpEndpoint);
    next();
  }

  static async handleGetOicpEndpoints(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OICP,
      Action.LIST, Entity.OICP_ENDPOINT, MODULE_NAME, 'handleGetOicpEndpoints');
    // Check auth
    if (!Authorizations.canListOicpEndpoints(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.OICP_ENDPOINTS,
        module: MODULE_NAME, method: 'handleGetOicpEndpoints'
      });
    }
    // Check User
    let userProject: string[] = [];
    if (Authorizations.canListUsers(req.user)) {
      userProject = [ 'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName' ];
    }
    // Filter
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointsRequest(req.query);
    // Get all oicpendpoints
    const oicpEndpoints = await OICPEndpointStorage.getOicpEndpoints(req.user.tenantID,
      {
        'search': filteredRequest.Search
      }, {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
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

  static async handleSendEVSEStatusesOicpEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canTriggerJobOicpEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.TRIGGER_JOB,
        entity: Entity.OICP_ENDPOINT,
        module: MODULE_NAME,
        method: 'handleSendEVSEStatusesOicpEndpoint'
      });
    }
    // Filter
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointSendEVSEStatusesRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleSendEVSEStatusesOicpEndpoint', req.user);
    // Get oicpEndpoint
    const oicpEndpoint = await OICPEndpointStorage.getOicpEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, oicpEndpoint, `OICPEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleSendEVSEStatusesOicpEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Build OICP Client
    const oicpClient = await OICPClientFactory.getCpoOicpClient(tenant, oicpEndpoint);
    // Send EVSE statuses
    const sendResult = await oicpClient.sendEVSEStatuses();
    // Return result
    res.json(sendResult);
    next();
  }

  static async handleSendEVSEsOicpEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canTriggerJobOicpEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.TRIGGER_JOB,
        entity: Entity.OICP_ENDPOINT,
        module: MODULE_NAME,
        method: 'handleSendEVSEsOicpEndpoint'
      });
    }
    // Filter
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointSendEVSEsRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleSendEVSEsOicpEndpoint', req.user);
    // Get oicpEndpoint
    const oicpEndpoint = await OICPEndpointStorage.getOicpEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, oicpEndpoint, `OICPEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleSendEVSEsOicpEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Build OICP Client
    const oicpClient = await OICPClientFactory.getCpoOicpClient(tenant, oicpEndpoint);
    // Send EVSE statuses
    const sendResult = await oicpClient.sendEVSEs();
    // Return result
    res.json(sendResult);
    next();
  }

  static async handleTriggerJobsEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canTriggerJobOicpEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.TRIGGER_JOB,
        entity: Entity.OICP_ENDPOINT,
        module: MODULE_NAME,
        method: 'handleTriggerJobsEndpoint'
      });
    }
    // Filter
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointTriggerJobRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleTriggerJobsEndpoint', req.user);
    // Get oicpEndpoint
    const oicpEndpoint = await OICPEndpointStorage.getOicpEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, oicpEndpoint, `OICPEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleTriggerJobsEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Build OICP Client
    const oicpClient = await OICPClientFactory.getOicpClient(tenant, oicpEndpoint);
    // Send EVSE statuses
    const result = await oicpClient.triggerJobs();
    // Return result
    res.json(result);
    next();
  }

  static async handlePingOicpEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canPingOicpEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.PING,
        entity: Entity.OICP_ENDPOINT,
        module: MODULE_NAME,
        method: 'handlePingOicpEndpoint'
      });
    }
    // Filter
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointPingRequest(req.body);
    // Check Mandatory fields
    UtilsService.checkIfOICPEndpointValid(filteredRequest, req);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Get oicpEndpoint
    const oicpEndpoint = await OICPEndpointStorage.getOicpEndpoint(req.user.tenantID, filteredRequest.id);
    // Build OICP Client
    const oicpClient = await OICPClientFactory.getOicpClient(tenant, oicpEndpoint);
    // Try to ping
    const pingResult = await oicpClient.ping();
    // Check ping result
    if (pingResult.statusCode === OICPStatusCode.Code000) {
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: MODULE_NAME, method: 'handlePingOicpEndpoint',
        message: `Oicp Endpoint '${filteredRequest.name}' can be reached successfully`,
        action: action,
        detailedMessages: { pingResult }
      });
      res.json(Object.assign(pingResult, Constants.REST_RESPONSE_SUCCESS));
    } else {
      // Log
      Logging.logSecurityError({
        tenantID: req.user.tenantID,
        user: req.user, module: MODULE_NAME, method: 'handlePingOicpEndpoint',
        message: `Oicp Endpoint '${filteredRequest.name}' cannot be reached`,
        action: action,
        detailedMessages: { pingResult }
      });
      res.json(pingResult);
    }
    next();
  }

  static async handleUnregisterOicpEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OICP,
      Action.READ, Entity.OICP_ENDPOINT, MODULE_NAME, 'handleUnregisterOicpEndpoint');
    // Check auth
    if (!Authorizations.canRegisterOicpEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.REGISTER, entity: Entity.OICP_ENDPOINT,
        module: MODULE_NAME, method: 'handleUnregisterOicpEndpoint'
      });
    }
    // Filter
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointRegisterRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleUnregisterOicpEndpoint', req.user);
    // Get OicpEndpoint
    const oicpEndpoint = await OICPEndpointStorage.getOicpEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, oicpEndpoint, `OICPEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUnregisterOicpEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Build OICP Client
    const oicpClient = await OICPClientFactory.getOicpClient(tenant, oicpEndpoint);
    // Try to register
    const result = await oicpClient.unregister();
    // Check ping result
    if (result.statusCode === StatusCodes.OK) {
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: MODULE_NAME, method: 'handleUnregisterOicpEndpoint',
        message: `Oicp Endpoint '${oicpEndpoint.name}' can be reached successfully`,
        action: action,
        detailedMessages: { result }
      });
      res.json(Object.assign(result, Constants.REST_RESPONSE_SUCCESS));
    } else {
      // Log
      Logging.logSecurityError({
        tenantID: req.user.tenantID,
        user: req.user, module: MODULE_NAME, method: 'handleUnregisterOicpEndpoint',
        message: `Oicp Endpoint '${oicpEndpoint.name}' cannot be reached`,
        action: action,
        detailedMessages: { result }
      });
      res.json(result);
    }
    next();
  }

  static async handleRegisterOicpEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OICP,
      Action.UPDATE, Entity.OICP_ENDPOINT, MODULE_NAME, 'handleRegisterOicpEndpoint');
    // Check auth
    if (!Authorizations.canRegisterOicpEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.REGISTER, entity: Entity.OICP_ENDPOINT,
        module: MODULE_NAME, method: 'handleRegisterOicpEndpoint'
      });
    }
    // Filter
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointRegisterRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleRegisterOicpEndpoint', req.user);
    // Get OicpEndpoint
    const oicpEndpoint = await OICPEndpointStorage.getOicpEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, oicpEndpoint, `OICPEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleRegisterOicpEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Build OICP Client
    const oicpClient = await OICPClientFactory.getOicpClient(tenant, oicpEndpoint);
    // Try to register
    const result = await oicpClient.register();
    // Check ping result
    if (result.statusCode === StatusCodes.OK) {
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: MODULE_NAME, method: 'handleRegisterOicpEndpoint',
        message: `Oicp Endpoint '${oicpEndpoint.name}' can be reached successfully`,
        action: action,
        detailedMessages: { result }
      });
      res.json(Object.assign(result, Constants.REST_RESPONSE_SUCCESS));
    } else {
      // Log
      Logging.logSecurityError({
        tenantID: req.user.tenantID,
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
