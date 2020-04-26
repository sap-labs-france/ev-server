import { NextFunction, Request, Response } from 'express';
import HttpStatusCodes from 'http-status-codes';
import Authorizations from '../../../authorization/Authorizations';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import RefundFactory from '../../../integration/refund/RefundFactory';
import ConnectionStorage from '../../../storage/mongodb/ConnectionStorage';
import { Action, Entity } from '../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import ConnectionValidator from '../validation/ConnectionValidator';
import ConnectionSecurity from './security/ConnectionSecurity';
import UtilsService from './UtilsService';

const MODULE_NAME = 'ConnectionService';

export default class ConnectionService {
  public static async handleGetConnection(action: Action, req: Request, res: Response, next: NextFunction) {
    // Filter
    const connectionID = ConnectionSecurity.filterConnectionRequestByID(req.query);
    // Charge Box is mandatory
    if (!connectionID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Connection\'s ID must be provided',
        module: MODULE_NAME,
        method: 'handleGetConnection',
        user: req.user
      });
    }
    // Check auth
    if (!Authorizations.canReadConnection(req.user, connectionID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.CONNECTION,
        module: MODULE_NAME,
        method: 'handleGetConnection',
        value: connectionID
      });
    }
    // Get it
    const connection = await ConnectionStorage.getConnection(req.user.tenantID, connectionID);
    UtilsService.assertObjectExists(action, connection, `Connection ID '${connectionID}' doesn't exist anymore.`,
      MODULE_NAME, 'handleGetConnection', req.user);
    // Return
    res.json(
      // Filter
      ConnectionSecurity.filterConnectionResponse(connection, req.user)
    );
    next();
  }

  public static async handleGetConnections(action: Action, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canListConnections(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.CONNECTIONS,
        module: MODULE_NAME,
        method: 'handleGetConnections'
      });
    }
    // Filter
    const filteredRequest = ConnectionSecurity.filterConnectionsRequest(req.query);
    // Get
    const connections = await ConnectionStorage.getConnectionsByUserId(req.user.tenantID, filteredRequest.userId);
    // Filter
    ConnectionSecurity.filterConnectionsResponse(connections, req.user);
    // Return
    res.json(connections);
    next();
  }

  public static async handleCreateConnection(action: Action, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canCreateConnection(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE,
        entity: Entity.CONNECTION,
        module: MODULE_NAME,
        method: 'handleCreateConnection'
      });
    }
    // Filter
    const filteredRequest = ConnectionSecurity.filterConnectionCreateRequest(req.body);
    // Get factory
    const refundConnector = await RefundFactory.getRefundImpl(req.user.tenantID);
    // Create
    const connection = await refundConnector.createConnection(filteredRequest.userId, filteredRequest.data);
    // Check
    ConnectionValidator.getInstance().validateConnectionCreation(req.body);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID, user: req.user,
      module: MODULE_NAME, method: 'handleCreateConnection',
      message: `Connection to '${connection.connectorId}' has been created successfully`,
      action: action
    });
    // Ok
    res.status(HttpStatusCodes.OK).json(Object.assign({ id: req.user.tenantID }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleDeleteConnection(action: Action, req: Request, res: Response, next: NextFunction) {
    // Filter
    const connectionID = ConnectionSecurity.filterConnectionRequestByID(req.query);
    if (!connectionID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        user: req.user,
        module: MODULE_NAME, method: 'handleGetConnection',
        message: 'The Connection\'s ID must be provided'
      });
    }
    // Get connection
    const connection = await ConnectionStorage.getConnection(req.user.tenantID, connectionID);
    UtilsService.assertObjectExists(action, connection, `Connection ID '${connectionID}' doesn't exist anymore.`,
      MODULE_NAME, 'handleDeleteConnection', req.user);
    // Delete
    await ConnectionStorage.deleteConnectionById(req.user.tenantID, connection.id);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user,
      actionOnUser: connection.userId,
      module: MODULE_NAME, method: 'handleDeleteConnection',
      message: `Connection to '${connection.connectorId}' has been deleted successfully`,
      action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
