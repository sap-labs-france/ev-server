import { Action, Entity } from '../../../../types/Authorization';
import { AsyncTaskType, AsyncTasks } from '../../../../types/AsyncTask';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import AsyncTaskBuilder from '../../../../async-task/AsyncTaskBuilder';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import LockingHelper from '../../../../locking/LockingHelper';
import LockingManager from '../../../../locking/LockingManager';
import Logging from '../../../../utils/Logging';
import OCPIClientFactory from '../../../../client/ocpi/OCPIClientFactory';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import OCPIEndpointStorage from '../../../../storage/mongodb/OCPIEndpointStorage';
import OCPIEndpointValidator from '../validator/OCPIEndpointValidator';
import { OCPIRegistrationStatus } from '../../../../types/ocpi/OCPIRegistrationStatus';
import OCPIUtils from '../../../ocpi/OCPIUtils';
import { ServerAction } from '../../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import { TenantComponents } from '../../../../types/Tenant';
import UtilsService from './UtilsService';

const MODULE_NAME = 'OCPIEndpointService';

export default class OCPIEndpointService {
  public static async handleDeleteOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.DELETE, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleDeleteOcpiEndpoint');
    // Filter
    const filteredRequest = OCPIEndpointValidator.getInstance().validateOCPIEndpointGetReq(req.query);
    // Check auth
    if (!await Authorizations.canDeleteOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.DELETE, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleDeleteOcpiEndpoint',
        value: filteredRequest.ID
      });
    }
    // Get
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.tenant, filteredRequest.ID);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleDeleteOcpiEndpoint', req.user);
    // Delete
    await OCPIEndpointStorage.deleteOcpiEndpoint(req.tenant, ocpiEndpoint.id);
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteOcpiEndpoint',
      message: `Ocpi Endpoint '${ocpiEndpoint.name}' has been deleted successfully`,
      action,
      detailedMessages: { ocpiEndpoint }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleGetOcpiEndpoint');
    // Filter
    const endpointID = OCPIEndpointValidator.getInstance().validateOCPIEndpointGetReq(req.query).ID;
    // Check auth
    if (!await Authorizations.canReadOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleGetOcpiEndpoint',
        value: endpointID
      });
    }
    // Get it
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.tenant, endpointID,
      [
        'id', 'name', 'role', 'baseUrl', 'countryCode', 'partyId', 'version', 'status', 'patchJobStatus', 'localToken', 'token',
        'patchJobResult.successNbr', 'patchJobResult.failureNbr', 'patchJobResult.totalNbr'
      ]);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPI Endpoint ID '${endpointID}' does not exist`,
      MODULE_NAME, 'handleGetOcpiEndpoint', req.user);
    res.json(ocpiEndpoint);
    next();
  }

  public static async handleGetOcpiEndpoints(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.LIST, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleGetOcpiEndpoints');
    // Check auth
    if (!await Authorizations.canListOcpiEndpoints(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleGetOcpiEndpoints'
      });
    }
    // Check User
    let userProject: string[] = [];
    if ((await Authorizations.canListUsers(req.user)).authorized) {
      userProject = [ 'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName' ];
    }
    // Filter
    const filteredRequest = OCPIEndpointValidator.getInstance().validateOCPIEndpointsGetReq(req.query);
    // Get all ocpiendpoints
    const ocpiEndpoints = await OCPIEndpointStorage.getOcpiEndpoints(req.tenant,
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
    res.json(ocpiEndpoints);
    next();
  }

  public static async handleCreateOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.CREATE, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleCreateOcpiEndpoint');
    // Check auth
    if (!await Authorizations.canCreateOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleCreateOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointValidator.getInstance().validateOCPIEndpointCreateReq(req.body);
    const ocpiEndpoint: OCPIEndpoint = {
      ...filteredRequest,
      createdBy: { id: req.user.id },
      createdOn: new Date(),
      status: OCPIRegistrationStatus.NEW
    } as OCPIEndpoint;
    const endpointID = await OCPIEndpointStorage.saveOcpiEndpoint(req.tenant, ocpiEndpoint);
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user, module: MODULE_NAME, method: 'handleCreateOcpiEndpoint',
      message: `Ocpi Endpoint '${filteredRequest.name}' has been created successfully`,
      action,
      detailedMessages: { endpoint: filteredRequest }
    });
    res.json(Object.assign({ id: endpointID }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.UPDATE, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleUpdateOcpiEndpoint');
    // Filter
    const filteredRequest = OCPIEndpointValidator.getInstance().validateOCPIEndpointUpdateReq(req.body);
    // Check auth
    if (!await Authorizations.canUpdateOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleUpdateOcpiEndpoint',
        value: filteredRequest.id
      });
    }
    // Get OcpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.tenant, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPI Endpoint ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUpdateOcpiEndpoint', req.user);
    // Update timestamp
    ocpiEndpoint.lastChangedBy = { 'id': req.user.id };
    ocpiEndpoint.lastChangedOn = new Date();
    // Update OcpiEndpoint
    await OCPIEndpointStorage.saveOcpiEndpoint(req.tenant, { ...ocpiEndpoint, ...filteredRequest });
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user, module: MODULE_NAME, method: 'handleUpdateOcpiEndpoint',
      message: `Ocpi Endpoint '${ocpiEndpoint.name}' has been updated successfully`,
      action,
      detailedMessages: { endpoint: ocpiEndpoint }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handlePingOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handlePingOcpiEndpoint');
    // Check auth
    if (!await Authorizations.canPingOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.PING, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handlePingOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointValidator.getInstance().validateOCPIEndpointPingReq(req.body);
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getOcpiClient(req.tenant, filteredRequest);
    // Try to ping
    const result = await ocpiClient.ping();
    // Check ping result
    if (result.statusCode === StatusCodes.OK) {
      await Logging.logInfo({
        tenantID: req.tenant.id,
        user: req.user, module: MODULE_NAME, method: 'handlePingOcpiEndpoint',
        message: `Ocpi Endpoint '${filteredRequest.name}' can be reached successfully`,
        action,
        detailedMessages: { result }
      });
    } else {
      throw new AppError({
        module: MODULE_NAME, method: 'handlePingOcpiEndpoint',
        action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `${result.statusText} (${result.statusCode})`,
      });
    }
    res.json(Object.assign(result, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handlePullLocationsEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handlePullLocationsEndpoint');
    // Check auth
    if (!await Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.TRIGGER_JOB, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handlePullLocationsEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointValidator.getInstance().validateOCPIEndpointByIdReq(req.body);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.tenant, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPI Endpoint ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handlePullLocationsEndpoint', req.user);
    // Get the lock
    const pullLocationsLock = await LockingHelper.createOCPIPullLocationsLock(req.tenant.id, ocpiEndpoint);
    if (!pullLocationsLock) {
      throw new AppError({
        action,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        module: MODULE_NAME, method: 'handlePullLocationsEndpoint',
        message: 'Error in pulling the OCPI Locations: cannot acquire the lock',
        user: req.user
      });
    }
    try {
      // Create and Save async task
      await AsyncTaskBuilder.createAndSaveAsyncTasks({
        name: AsyncTasks.OCPI_PULL_LOCATIONS,
        action,
        type: AsyncTaskType.TASK,
        tenantID: req.tenant.id,
        parameters: {
          endpointID: filteredRequest.id,
        },
        module: MODULE_NAME,
        method: 'handlePullLocationsEndpoint',
      });
    } finally {
      // Release the lock
      await LockingManager.release(pullLocationsLock);
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handlePullSessionsEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handlePullSessionsEndpoint');
    // Check auth
    if (!await Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.TRIGGER_JOB, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handlePullLocationsEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointValidator.getInstance().validateOCPIEndpointByIdReq(req.body);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.tenant, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPI Endpoint ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handlePullSessionsEndpoint', req.user);
    // Get the lock
    const pullSessionsLock = await LockingHelper.createOCPIPullSessionsLock(req.tenant.id, ocpiEndpoint);
    if (!pullSessionsLock) {
      throw new AppError({
        action: ServerAction.OCPI_EMSP_GET_SESSION,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        message: 'Error in pulling the OCPI Sessions: cannot acquire the lock',
        module: MODULE_NAME, method: 'handlePullSessionsEndpoint',
      });
    }
    try {
      // Create and Save async task
      await AsyncTaskBuilder.createAndSaveAsyncTasks({
        name: AsyncTasks.OCPI_PULL_SESSIONS,
        action,
        type: AsyncTaskType.TASK,
        tenantID: req.tenant.id,
        parameters: {
          endpointID: filteredRequest.id,
        },
        module: MODULE_NAME,
        method: 'handlePullSessionsEndpoint',
      });
    } finally {
      // Release the lock
      await LockingManager.release(pullSessionsLock);
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handlePullTokensEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handlePullTokensEndpoint');
    // Check auth
    if (!await Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.TRIGGER_JOB, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handlePullTokensEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointValidator.getInstance().validateOCPIEndpointByIdReq(req.body);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.tenant, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPI Endpoint ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handlePullTokensEndpoint', req.user);
    // Get the lock
    const pullTokensLock = await LockingHelper.createOCPIPullTokensLock(req.tenant.id, ocpiEndpoint, false);
    if (!pullTokensLock) {
      throw new AppError({
        action: ServerAction.OCPI_CPO_GET_TOKENS,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        message: 'Error in pulling the OCPI tokens: cannot acquire the lock',
        module: MODULE_NAME, method: 'handlePullTokensEndpoint',
      });
    }
    try {
      // Create and Save async task
      await AsyncTaskBuilder.createAndSaveAsyncTasks({
        name: AsyncTasks.OCPI_PULL_TOKENS,
        action,
        type: AsyncTaskType.TASK,
        tenantID: req.tenant.id,
        parameters: {
          endpointID: filteredRequest.id,
        },
        module: MODULE_NAME,
        method: 'handlePullTokensEndpoint',
      });
    } finally {
      // Release the lock
      await LockingManager.release(pullTokensLock);
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handlePullCdrsEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handlePullCdrsEndpoint');
    // Check auth
    if (!await Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.TRIGGER_JOB, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handlePullCdrsEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointValidator.getInstance().validateOCPIEndpointByIdReq(req.body);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.tenant, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPI Endpoint ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handlePullCdrsEndpoint', req.user);
    // Get the lock
    const pullCdrsLock = await LockingHelper.createOCPIPullCdrsLock(req.tenant.id, ocpiEndpoint);
    if (!pullCdrsLock) {
      throw new AppError({
        action: ServerAction.OCPI_EMSP_GET_CDRS,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        message: 'Error in pulling the OCPI CDRs: cannot acquire the lock',
        module: MODULE_NAME, method: 'handlePullCdrsEndpoint',
      });
    }
    try {
      // Create and Save async task
      await AsyncTaskBuilder.createAndSaveAsyncTasks({
        name: AsyncTasks.OCPI_PULL_CDRS,
        action,
        type: AsyncTaskType.TASK,
        tenantID: req.tenant.id,
        parameters: {
          endpointID: filteredRequest.id,
        },
        module: MODULE_NAME,
        method: 'handlePullCdrsEndpoint',
      });
    } finally {
      // Release the lock
      await LockingManager.release(pullCdrsLock);
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleCheckCdrsEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleCheckCdrsEndpoint');
    // Check auth
    if (!await Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.TRIGGER_JOB, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleCheckCdrsOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointValidator.getInstance().validateOCPIEndpointByIdReq(req.body);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.tenant, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPI Endpoint ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleCheckCdrsEndpoint', req.user);
    // Get the lock
    const checkCdrsLock = await LockingHelper.createOCPICheckCdrsLock(req.tenant.id, ocpiEndpoint);
    if (!checkCdrsLock) {
      throw new AppError({
        action: ServerAction.OCPI_CPO_CHECK_CDRS,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        message: 'Error in checking the OCPI CDRs: cannot acquire the lock',
        module: MODULE_NAME, method: 'handleCheckCdrsEndpoint',
      });
    }
    try {
      // Create and Save async task
      await AsyncTaskBuilder.createAndSaveAsyncTasks({
        name: AsyncTasks.OCPI_CHECK_CDRS,
        action,
        type: AsyncTaskType.TASK,
        tenantID: req.tenant.id,
        parameters: {
          endpointID: filteredRequest.id,
        },
        module: MODULE_NAME,
        method: 'handleCheckCdrsEndpoint',
      });
    } finally {
      // Release the lock
      await LockingManager.release(checkCdrsLock);
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleCheckSessionsEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleCheckSessionsEndpoint');
    // Check auth
    if (!await Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.TRIGGER_JOB, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleCheckSessionsOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointValidator.getInstance().validateOCPIEndpointByIdReq(req.body);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.tenant, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPI Endpoint ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleCheckSessionsEndpoint', req.user);
    // Get the lock
    const checkSessionsLock = await LockingHelper.createOCPICheckSessionsLock(req.tenant.id, ocpiEndpoint);
    if (!checkSessionsLock) {
      throw new AppError({
        action: ServerAction.OCPI_CPO_CHECK_SESSIONS,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        message: 'Error in checking the OCPI Sessions: cannot acquire the lock',
        module: MODULE_NAME, method: 'handleCheckSessionsEndpoint',
      });
    }
    try {
      // Create and Save async task
      await AsyncTaskBuilder.createAndSaveAsyncTasks({
        name: AsyncTasks.OCPI_CHECK_SESSIONS,
        action,
        type: AsyncTaskType.TASK,
        tenantID: req.tenant.id,
        parameters: {
          endpointID: filteredRequest.id,
        },
        module: MODULE_NAME,
        method: 'handleCheckSessionsEndpoint',
      });
    } finally {
      // Release the lock
      await LockingManager.release(checkSessionsLock);
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleCheckLocationsEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleCheckLocationsEndpoint');
    // Check auth
    if (!await Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.TRIGGER_JOB, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleCheckLocationsEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointValidator.getInstance().validateOCPIEndpointByIdReq(req.body);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.tenant, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPI Endpoint ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleCheckLocationsEndpoint', req.user);
    // Get the lock
    const checkLocationsLock = await LockingHelper.createOCPICheckLocationsLock(req.tenant.id, ocpiEndpoint);
    if (!checkLocationsLock) {
      throw new AppError({
        action: ServerAction.OCPI_CPO_CHECK_LOCATIONS,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        message: 'Error in checking the OCPI Locations: cannot acquire the lock',
        module: MODULE_NAME, method: 'handleCheckLocationsEndpoint',
      });
    }
    try {
      // Create and Save async task
      await AsyncTaskBuilder.createAndSaveAsyncTasks({
        name: AsyncTasks.OCPI_CHECK_LOCATIONS,
        action,
        type: AsyncTaskType.TASK,
        tenantID: req.tenant.id,
        parameters: {
          endpointID: filteredRequest.id,
        },
        module: MODULE_NAME,
        method: 'handleCheckLocationsEndpoint',
      });
    } finally {
      // Release the lock
      await LockingManager.release(checkLocationsLock);
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handlePushEVSEStatusesOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handlePushEVSEStatusesOcpiEndpoint');
    // Check auth
    if (!await Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.TRIGGER_JOB, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handlePushEVSEStatusesOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointValidator.getInstance().validateOCPIEndpointByIdReq(req.body);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.tenant, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPI Endpoint ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handlePushEVSEStatusesOcpiEndpoint', req.user);
    // Get the lock
    const patchStatusesLock = await LockingHelper.createOCPIPatchEVSEStatusesLock(req.tenant.id, ocpiEndpoint);
    if (!patchStatusesLock) {
      throw new AppError({
        action: ServerAction.OCPI_EMSP_UPDATE_LOCATION,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        message: 'Error in pushing the OCPI EVSE Statuses: cannot acquire the lock',
        module: MODULE_NAME, method: 'handlePushEVSEStatusesOcpiEndpoint',
      });
    }
    try {
      // Create and Save async task
      await AsyncTaskBuilder.createAndSaveAsyncTasks({
        name: AsyncTasks.OCPI_PUSH_EVSE_STATUSES,
        action,
        type: AsyncTaskType.TASK,
        tenantID: req.tenant.id,
        parameters: {
          endpointID: filteredRequest.id,
        },
        module: MODULE_NAME,
        method: 'handlePushEVSEStatusesOcpiEndpoint',
      });
    } finally {
      // Release the lock
      await LockingManager.release(patchStatusesLock);
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handlePushTokensOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handlePushTokensOcpiEndpoint');
    // Check auth
    if (!await Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.TRIGGER_JOB, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handlePushTokensOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointValidator.getInstance().validateOCPIEndpointByIdReq(req.body);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.tenant, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPI Endpoint ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handlePushTokensOcpiEndpoint', req.user);
    // Get the lock
    const pushTokensLock = await LockingHelper.createOCPIPushTokensLock(req.tenant.id, ocpiEndpoint);
    if (!pushTokensLock) {
      throw new AppError({
        action,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        module: MODULE_NAME, method: 'handlePushTokensOcpiEndpoint',
        message: 'Error in pushing the Tokens: cannot acquire the lock',
        user: req.user
      });
    }
    try {
      // Create and Save async task
      await AsyncTaskBuilder.createAndSaveAsyncTasks({
        name: AsyncTasks.OCPI_PUSH_TOKENS,
        action,
        type: AsyncTaskType.TASK,
        tenantID: req.tenant.id,
        parameters: {
          endpointID: filteredRequest.id,
        },
        module: MODULE_NAME,
        method: 'handlePushTokensOcpiEndpoint',
      });
    } finally {
      // Release the lock
      await LockingManager.release(pushTokensLock);
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUpdateCredentialsOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // // Check if component is active
    // UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
    //   Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleUnregisterOcpiEndpoint');
    // // Check auth
    // if (!await Authorizations.canRegisterOcpiEndpoint(req.user)) {
    //   throw new AppAuthError({
    //     errorCode: HTTPAuthError.FORBIDDEN,
    //     user: req.user,
    //     action: Action.REGISTER, entity: Entity.OCPI_ENDPOINT,
    //     module: MODULE_NAME, method: 'handleUnregisterOcpiEndpoint'
    //   });
    // }
    // // Filter
    // const filteredRequest = OCPIEndpointValidator.getInstance().validateOCPIEndpointByIdReq(req.body);
    // // Get OcpiEndpoint
    // const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.tenant, filteredRequest.id);
    // UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPI Endpoint ID '${filteredRequest.id}' does not exist`,
    //   MODULE_NAME, 'handleUnregisterOcpiEndpoint', req.user);
    // // Build OCPI Client
    // const ocpiClient = await OCPIClientFactory.getOcpiClient(req.tenant, ocpiEndpoint);
    // // Try to register
    // const result = await ocpiClient.unregister();
    // // Check ping result
    // if (result.statusCode === StatusCodes.OK) {
    //   await Logging.logInfo({
    //     tenantID: req.tenant.id,
    //     user: req.user, module: MODULE_NAME, method: 'handleUnregisterOcpiEndpoint',
    //     message: `Ocpi Endpoint '${ocpiEndpoint.name}' can be reached successfully`,
    //     action,
    //     detailedMessages: { result }
    //   });
    // } else {
    //   // Already unregistered
    //   if (result.statusCode === 405) {
    //     throw new AppError({
    //       module: MODULE_NAME, method: 'handleUnregisterOcpiEndpoint',
    //       action,
    //       errorCode: HTTPError.OCPI_ENDPOINT_ALREADY_UNREGISTERED,
    //       message: 'Ocpi Endpoint is already unregistered',
    //     });
    //   }
    //   throw new AppError({
    //     module: MODULE_NAME, method: 'handleUnregisterOcpiEndpoint',
    //     action,
    //     errorCode: HTTPError.GENERAL_ERROR,
    //     message: `${result.statusText} (${result.statusCode})`,
    //   });
    // }
    // res.json(Object.assign(result, Constants.REST_RESPONSE_SUCCESS));
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
  
  public static async handleUnregisterOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleUnregisterOcpiEndpoint');
    // Check auth
    if (!await Authorizations.canRegisterOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.REGISTER, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleUnregisterOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointValidator.getInstance().validateOCPIEndpointByIdReq(req.body);
    // Get OcpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.tenant, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPI Endpoint ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUnregisterOcpiEndpoint', req.user);
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getOcpiClient(req.tenant, ocpiEndpoint);
    // Try to register
    const result = await ocpiClient.unregister();
    // Check ping result
    if (result.statusCode === StatusCodes.OK) {
      await Logging.logInfo({
        tenantID: req.tenant.id,
        user: req.user, module: MODULE_NAME, method: 'handleUnregisterOcpiEndpoint',
        message: `Ocpi Endpoint '${ocpiEndpoint.name}' can be reached successfully`,
        action,
        detailedMessages: { result }
      });
    } else {
      // Already unregistered
      if (result.statusCode === 405) {
        throw new AppError({
          module: MODULE_NAME, method: 'handleUnregisterOcpiEndpoint',
          action,
          errorCode: HTTPError.OCPI_ENDPOINT_ALREADY_UNREGISTERED,
          message: 'Ocpi Endpoint is already unregistered',
        });
      }
      throw new AppError({
        module: MODULE_NAME, method: 'handleUnregisterOcpiEndpoint',
        action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `${result.statusText} (${result.statusCode})`,
      });
    }
    res.json(Object.assign(result, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleRegisterOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.UPDATE, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleRegisterOcpiEndpoint');
    // Check auth
    if (!await Authorizations.canRegisterOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.REGISTER, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleRegisterOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointValidator.getInstance().validateOCPIEndpointByIdReq(req.body);
    // Get OcpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.tenant, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPI Endpoint ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleRegisterOcpiEndpoint', req.user);
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getOcpiClient(req.tenant, ocpiEndpoint);
    // Try to register
    const result = await ocpiClient.register();
    // Check ping result
    if (result.statusCode === StatusCodes.OK) {
      await Logging.logInfo({
        tenantID: req.tenant.id,
        user: req.user, module: MODULE_NAME, method: 'handleRegisterOcpiEndpoint',
        message: `Ocpi Endpoint '${ocpiEndpoint.name}' can be reached successfully`,
        action,
        detailedMessages: { result }
      });
    } else {
      // Already registered
      if (result.statusCode === 405) {
        throw new AppError({
          module: MODULE_NAME, method: 'handleRegisterOcpiEndpoint',
          action,
          errorCode: HTTPError.OCPI_ENDPOINT_ALREADY_REGISTERED,
          message: 'Ocpi Endpoint is already registered',
        });
      }
      throw new AppError({
        module: MODULE_NAME, method: 'handleRegisterOcpiEndpoint',
        action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `${result.statusText} (${result.statusCode})`,
      });
    }
    res.json(Object.assign(result, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleGenerateLocalTokenOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.UPDATE, Entity.OCPI_ENDPOINT, MODULE_NAME, 'handleGenerateLocalTokenOcpiEndpoint');
    // Check auth
    if (!await Authorizations.canGenerateLocalTokenOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.GENERATE_LOCAL_TOKEN, entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME, method: 'handleGenerateLocalTokenOcpiEndpoint'
      });
    }
    // Generate endpoint
    const localToken = OCPIUtils.generateLocalToken(req.tenant.subdomain);
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user, module: MODULE_NAME, method: 'handleGenerateLocalTokenOcpiEndpoint',
      message: 'Local Token for Ocpi Endpoint has been generated successfully',
      action,
      detailedMessages: { token: localToken }
    });
    res.json(Object.assign({
      localToken: localToken
    }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }
}

