import { Action, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import LockingHelper from '../../../../locking/LockingHelper';
import LockingManager from '../../../../locking/LockingManager';
import Logging from '../../../../utils/Logging';
import OCPIClientFactory from '../../../../client/ocpi/OCPIClientFactory';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import OCPIEndpointSecurity from './security/OCPIEndpointSecurity';
import OCPIEndpointStorage from '../../../../storage/mongodb/OCPIEndpointStorage';
import { OCPIRegistrationStatus } from '../../../../types/ocpi/OCPIRegistrationStatus';
import OCPIUtils from '../../../ocpi/OCPIUtils';
import { ServerAction } from '../../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import TenantComponents from '../../../../types/TenantComponents';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'OCPIEndpointService';

export default class OCPIEndpointService {
  static async handleDeleteOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.DELETE, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleDeleteOcpiEndpoint');
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointDeleteRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleDeleteOcpiEndpoint', req.user);
    // Check auth
    if (!Authorizations.canDeleteOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleDeleteOcpiEndpoint',
        value: filteredRequest.ID
      });
    }
    // Get
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.ID);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleDeleteOcpiEndpoint', req.user);
    // Delete
    await OCPIEndpointStorage.deleteOcpiEndpoint(req.user.tenantID, ocpiEndpoint.id);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteOcpiEndpoint',
      message: `Ocpi Endpoint '${ocpiEndpoint.name}' has been deleted successfully`,
      action: action,
      detailedMessages: { ocpiEndpoint }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  static async handleGetOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleGetOcpiEndpoint');
    // Filter
    const endpointID = OCPIEndpointSecurity.filterOcpiEndpointRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, endpointID, MODULE_NAME, 'handleGetOcpiEndpoint', req.user);
    // Check auth
    if (!Authorizations.canReadOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleGetOcpiEndpoint',
        value: endpointID
      });
    }
    // Get it
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, endpointID,
      [
        'id', 'name', 'role', 'baseUrl', 'countryCode', 'partyId', 'version', 'status', 'patchJobStatus', 'localToken', 'token',
        'patchJobResult.successNbr', 'patchJobResult.failureNbr', 'patchJobResult.totalNbr'
      ]);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${endpointID}' does not exist`,
      MODULE_NAME, 'handleGetOcpiEndpoint', req.user);
    res.json(ocpiEndpoint);
    next();
  }

  static async handleGetOcpiEndpoints(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.LIST, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleGetOcpiEndpoints');
    // Check auth
    if (!Authorizations.canListOcpiEndpoints(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.OCPI_ENDPOINTS,
        module: MODULE_NAME, method: 'handleGetOcpiEndpoints'
      });
    }
    // Check User
    let userProject: string[] = [];
    if (Authorizations.canListUsers(req.user)) {
      userProject = [ 'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName' ];
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointsRequest(req.query);
    // Get all ocpiendpoints
    const ocpiEndpoints = await OCPIEndpointStorage.getOcpiEndpoints(req.user.tenantID,
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
    res.json(ocpiEndpoints);
    next();
  }

  static async handleCreateOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.CREATE, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleCreateOcpiEndpoint');
    // Check auth
    if (!Authorizations.canCreateOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleCreateOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointCreateRequest(req.body);
    // Check Mandatory fields
    Utils.checkIfOCPIEndpointValid(filteredRequest, req);
    const ocpiEndpoint: OCPIEndpoint = {
      ...filteredRequest,
      createdBy: { id: req.user.id },
      createdOn: new Date(),
      status: OCPIRegistrationStatus.NEW
    } as OCPIEndpoint;
    const endpointID = await OCPIEndpointStorage.saveOcpiEndpoint(req.user.tenantID, ocpiEndpoint);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleCreateOcpiEndpoint',
      message: `Ocpi Endpoint '${filteredRequest.name}' has been created successfully`,
      action: action,
      detailedMessages: { endpoint: filteredRequest }
    });
    // Ok
    res.json(Object.assign({ id: endpointID }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  static async handleUpdateOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.UPDATE, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleUpdateOcpiEndpoint');
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointUpdateRequest(req.body);
    // Check Mandatory fields
    Utils.checkIfOCPIEndpointValid(filteredRequest, req);
    // Check auth
    if (!Authorizations.canUpdateOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleUpdateOcpiEndpoint',
        value: filteredRequest.id
      });
    }
    // Get OcpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUpdateOcpiEndpoint', req.user);
    // Update timestamp
    ocpiEndpoint.lastChangedBy = { 'id': req.user.id };
    ocpiEndpoint.lastChangedOn = new Date();
    // Update OcpiEndpoint
    await OCPIEndpointStorage.saveOcpiEndpoint(req.user.tenantID, { ...ocpiEndpoint, ...filteredRequest });
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleUpdateOcpiEndpoint',
      message: `Ocpi Endpoint '${ocpiEndpoint.name}' has been updated successfully`,
      action: action,
      detailedMessages: { endpoint: ocpiEndpoint }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  static async handlePingOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handlePingOcpiEndpoint');
    // Check auth
    if (!Authorizations.canPingOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.PING, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handlePingOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointPingRequest(req.body);
    // Check Mandatory fields
    Utils.checkIfOCPIEndpointValid(filteredRequest, req);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getOcpiClient(tenant, filteredRequest);
    // Try to ping
    const pingResult = await ocpiClient.ping();
    // Check ping result
    if (pingResult.statusCode === StatusCodes.OK) {
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: MODULE_NAME, method: 'handlePingOcpiEndpoint',
        message: `Ocpi Endpoint '${filteredRequest.name}' can be reached successfully`,
        action: action,
        detailedMessages: { pingResult }
      });
      res.json(Object.assign(pingResult, Constants.REST_RESPONSE_SUCCESS));
    } else {
      // Log
      Logging.logSecurityError({
        tenantID: req.user.tenantID,
        user: req.user, module: MODULE_NAME, method: 'handlePingOcpiEndpoint',
        message: `Ocpi Endpoint '${filteredRequest.name}' cannot be reached`,
        action: action,
        detailedMessages: { pingResult }
      });
      res.json(pingResult);
    }
    next();
  }

  static async handlePullLocationsEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handlePullLocationsEndpoint');
    // Check auth
    if (!Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.TRIGGER_JOB, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handlePullLocationsEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointTriggerJobRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handlePullLocationsEndpoint', req.user);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handlePullLocationsEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Get the lock
    const ocpiLock = await LockingHelper.createOCPIPullEmspLocationsLock(tenant.id, ocpiEndpoint);
    if (!ocpiLock) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.OCPI_PULL_LOCATIONS,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        message: 'Error in pulling the OCPI Locations: cannot acquire the lock',
        module: MODULE_NAME, method: 'handlePullLocationsEndpoint',
      });
    }
    try {
      // Build OCPI Client
      const ocpiClient = await OCPIClientFactory.getEmspOcpiClient(tenant, ocpiEndpoint);
      const result = await ocpiClient.pullLocations(false);
      // Return result
      res.json(result);
      next();
    } finally {
      await LockingManager.release(ocpiLock);
    }
  }

  static async handlePullSessionsEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handlePullSessionsEndpoint');
    // Check auth
    if (!Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.TRIGGER_JOB, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handlePullLocationsEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointTriggerJobRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handlePullSessionsEndpoint', req.user);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handlePullSessionsEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Get the lock
    const ocpiLock = await LockingHelper.createOCPIPullEmspSessionsLock(tenant.id, ocpiEndpoint);
    if (!ocpiLock) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.OCPI_PULL_SESSIONS,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        message: 'Error in pulling the OCPI Sessions: cannot acquire the lock',
        module: MODULE_NAME, method: 'handlePullSessionsEndpoint',
      });
    }
    try {
      // Build OCPI Client
      const ocpiClient = await OCPIClientFactory.getEmspOcpiClient(tenant, ocpiEndpoint);
      const result = await ocpiClient.pullSessions();
      // Return result
      res.json(result);
      next();
    } finally {
      await LockingManager.release(ocpiLock);
    }
  }

  static async handlePullTokensEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handlePullTokensEndpoint');
    // Check auth
    if (!Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.TRIGGER_JOB, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handlePullTokensEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointTriggerJobRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handlePullTokensEndpoint', req.user);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handlePullTokensEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Get the lock
    const ocpiLock = await LockingHelper.createOCPIPullEmspTokensLock(tenant.id, ocpiEndpoint);
    if (!ocpiLock) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.OCPI_PULL_TOKENS,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        message: 'Error in pulling the OCPI tokens: cannot acquire the lock',
        module: MODULE_NAME, method: 'handlePullTokensEndpoint',
      });
    }
    try {
      // Build OCPI Client
      const ocpiClient = await OCPIClientFactory.getCpoOcpiClient(tenant, ocpiEndpoint);
      const result = await ocpiClient.pullTokens(false);
      // Return result
      res.json(result);
      next();
    } finally {
      await LockingManager.release(ocpiLock);
    }
  }

  static async handlePullCdrsEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handlePullCdrsEndpoint');
    // Check auth
    if (!Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.TRIGGER_JOB, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handlePullCdrsEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointTriggerJobRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handlePullCdrsEndpoint', req.user);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handlePullCdrsEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Get the lock
    const ocpiLock = await LockingHelper.createOCPIPullEmspCdrsLock(tenant.id, ocpiEndpoint);
    if (!ocpiLock) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.OCPI_PULL_CDRS,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        message: 'Error in pulling the OCPI CDRs: cannot acquire the lock',
        module: MODULE_NAME, method: 'handlePullCdrsEndpoint',
      });
    }
    try {
      // Build OCPI Client
      const ocpiClient = await OCPIClientFactory.getEmspOcpiClient(tenant, ocpiEndpoint);
      const result = await ocpiClient.pullCdrs();
      // Return result
      res.json(result);
      next();
    } finally {
      await LockingManager.release(ocpiLock);
    }
  }

  static async handleCheckCdrsEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleCheckCdrsEndpoint');
    // Check auth
    if (!Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.TRIGGER_JOB, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleCheckCdrsOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiCheckCdrsRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleCheckCdrsEndpoint', req.user);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleCheckCdrsEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Get the lock
    const ocpiLock = await LockingHelper.createOCPICheckCpoCdrsLock(tenant.id, ocpiEndpoint);
    if (!ocpiLock) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.OCPI_CHECK_CDRS,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        message: 'Error in checking the OCPI CDRs: cannot acquire the lock',
        module: MODULE_NAME, method: 'handleCheckCdrsEndpoint',
      });
    }
    try {
      // Build OCPI Client
      const ocpiClient = await OCPIClientFactory.getCpoOcpiClient(tenant, ocpiEndpoint);
      // Send EVSE statuses
      const sendResult = await ocpiClient.checkCdrs();
      // Return result
      res.json(sendResult);
      next();
    } finally {
      await LockingManager.release(ocpiLock);
    }
  }

  static async handleCheckSessionsEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleCheckSessionsEndpoint');
    // Check auth
    if (!Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.TRIGGER_JOB, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleCheckSessionsOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiCheckSessionsRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleCheckSessionsEndpoint', req.user);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleCheckSessionsEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Get the lock
    const ocpiLock = await LockingHelper.createOCPICheckCpoSessionsLock(tenant.id, ocpiEndpoint);
    if (!ocpiLock) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.OCPI_CHECK_SESSIONS,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        message: 'Error in checking the OCPI Sessions: cannot acquire the lock',
        module: MODULE_NAME, method: 'handleCheckSessionsEndpoint',
      });
    }
    try {
      // Build OCPI Client
      const ocpiClient = await OCPIClientFactory.getCpoOcpiClient(tenant, ocpiEndpoint);
      // Send EVSE statuses
      const sendResult = await ocpiClient.checkSessions();
      // Return result
      res.json(sendResult);
      next();
    } finally {
      await LockingManager.release(ocpiLock);
    }
  }

  static async handleCheckLocationsEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleCheckLocationsEndpoint');
    // Check auth
    if (!Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.TRIGGER_JOB, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleCheckLocationsEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiCheckLocationsRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleCheckSessionsOcpiEndpoint', req.user);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleCheckLocationsEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Get the lock
    const ocpiLock = await LockingHelper.createOCPICheckCpoLocationsLock(tenant.id, ocpiEndpoint);
    if (!ocpiLock) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.OCPI_CHECK_LOCATIONS,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        message: 'Error in checking the OCPI Locations: cannot acquire the lock',
        module: MODULE_NAME, method: 'handleCheckLocationsEndpoint',
      });
    }
    try {
      // Build OCPI Client
      const ocpiClient = await OCPIClientFactory.getCpoOcpiClient(tenant, ocpiEndpoint);
      // Send EVSE statuses
      const sendResult = await ocpiClient.checkLocations();
      // Return result
      res.json(sendResult);
      next();
    } finally {
      await LockingManager.release(ocpiLock);
    }
  }

  static async handleSendEVSEStatusesOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleSendEVSEStatusesOcpiEndpoint');
    // Check auth
    if (!Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.TRIGGER_JOB, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleSendEVSEStatusesOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointSendEVSEStatusesRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleSendEVSEStatusesOcpiEndpoint', req.user);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleSendEVSEStatusesOcpiEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Get the lock
    const ocpiLock = await LockingHelper.createOCPIPatchCpoLocationsLock(tenant.id, ocpiEndpoint);
    if (!ocpiLock) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.OCPI_PATCH_LOCATIONS,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        message: 'Error in patching the OCPI Locations: cannot acquire the lock',
        module: MODULE_NAME, method: 'handleSendEVSEStatusesOcpiEndpoint',
      });
    }
    try {
      // Build OCPI Client
      const ocpiClient = await OCPIClientFactory.getCpoOcpiClient(tenant, ocpiEndpoint);
      // Send EVSE statuses
      const sendResult = await ocpiClient.sendEVSEStatuses();
      // Return result
      res.json(sendResult);
      next();
    } finally {
      await LockingManager.release(ocpiLock);
    }
  }

  static async handleSendTokensOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleSendTokensOcpiEndpoint');
    // Check auth
    if (!Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.TRIGGER_JOB, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleSendTokensOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointSendTokensRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleSendTokensOcpiEndpoint', req.user);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleSendTokensOcpiEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getEmspOcpiClient(tenant, ocpiEndpoint);
    // Send EVSE statuses
    const sendResult = await ocpiClient.sendTokens();
    // Return result
    res.json(sendResult);
    next();
  }

  static async handleUnregisterOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleUnregisterOcpiEndpoint');
    // Check auth
    if (!Authorizations.canRegisterOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.REGISTER, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleUnregisterOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointRegisterRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleUnregisterOcpiEndpoint', req.user);
    // Get OcpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUnregisterOcpiEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getOcpiClient(tenant, ocpiEndpoint);
    // Try to register
    const result = await ocpiClient.unregister();
    // Check ping result
    if (result.statusCode === StatusCodes.OK) {
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: MODULE_NAME, method: 'handleUnregisterOcpiEndpoint',
        message: `Ocpi Endpoint '${ocpiEndpoint.name}' can be reached successfully`,
        action: action,
        detailedMessages: { result }
      });
      res.json(Object.assign(result, Constants.REST_RESPONSE_SUCCESS));
    } else {
      // Log
      Logging.logSecurityError({
        tenantID: req.user.tenantID,
        user: req.user, module: MODULE_NAME, method: 'handleUnregisterOcpiEndpoint',
        message: `Ocpi Endpoint '${ocpiEndpoint.name}' cannot be reached`,
        action: action,
        detailedMessages: { result }
      });
      res.json(result);
    }
    next();
  }

  static async handleRegisterOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.UPDATE, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleRegisterOcpiEndpoint');
    // Check auth
    if (!Authorizations.canRegisterOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.REGISTER, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleRegisterOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointRegisterRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleRegisterOcpiEndpoint', req.user);
    // Get OcpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleRegisterOcpiEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getOcpiClient(tenant, ocpiEndpoint);
    // Try to register
    const result = await ocpiClient.register();
    // Check ping result
    if (result.statusCode === StatusCodes.OK) {
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: MODULE_NAME, method: 'handleRegisterOcpiEndpoint',
        message: `Ocpi Endpoint '${ocpiEndpoint.name}' can be reached successfully`,
        action: action,
        detailedMessages: { result }
      });
      res.json(Object.assign(result, Constants.REST_RESPONSE_SUCCESS));
    } else {
      // Log
      Logging.logSecurityError({
        tenantID: req.user.tenantID,
        user: req.user, module: MODULE_NAME, method: 'handleRegisterOcpiEndpoint',
        message: `Ocpi Endpoint '${ocpiEndpoint.name}' cannot be reached`,
        action: action,
        detailedMessages: { result }
      });
      res.json(result);
    }
    next();
  }

  static async handleGenerateLocalTokenOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.UPDATE, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleGenerateLocalTokenOcpiEndpoint');
    // Check auth
    if (!Authorizations.canGenerateLocalTokenOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.GENERATE_LOCAL_TOKEN, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleGenerateLocalTokenOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointGenerateLocalTokenRequest(req.body);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    const localToken = OCPIUtils.generateLocalToken(tenant.subdomain);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleGenerateLocalTokenOcpiEndpoint',
      message: `Local Token for Ocpi Endpoint '${filteredRequest.name}' has been generatd successfully`,
      action: action,
      detailedMessages: { token: filteredRequest }
    });
    // Ok
    res.json(Object.assign({
      id: filteredRequest.id,
      localToken: localToken
    }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }
}

