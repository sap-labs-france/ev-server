import { Action, Entity } from '../../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import { HTTPAuthError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import OICPClientFactory from '../../../../client/oicp/OICPClientFactory';
import { OICPCode } from '../../../../types/oicp/OICPStatusCode';
import OICPEndpoint from '../../../../types/oicp/OICPEndpoint';
import OICPEndpointSecurity from './security/OICPEndpointSecurity';
import OICPEndpointStorage from '../../../../storage/mongodb/OICPEndpointStorage';
import { OICPRegistrationStatus } from '../../../../types/oicp/OICPRegistrationStatus';
import { ServerAction } from '../../../../types/Server';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
import Utils from '../../../../utils/Utils';
import UtilsService from '../../../rest/v1/service/UtilsService';

const MODULE_NAME = 'OICPEndpointService';

export default class OICPEndpointService {
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
      status: OICPRegistrationStatus.NEW
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
    if (pingResult.statusCode === OICPCode.Code000) {
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
}
