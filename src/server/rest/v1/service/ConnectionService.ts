import { Action, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Authorizations from '../../../../authorization/Authorizations';
import ConnectionSecurity from './security/ConnectionSecurity';
import ConnectionStorage from '../../../../storage/mongodb/ConnectionStorage';
import ConnectionValidator from '../validator/ConnectionValidator';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import RefundFactory from '../../../../integration/refund/RefundFactory';
import { ServerAction } from '../../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import UtilsService from './UtilsService';

const MODULE_NAME = 'ConnectionService';

export default class ConnectionService {
  public static async handleGetConnection(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const connectionID = ConnectionSecurity.filterConnectionRequestByID(req.query);
    // Charge Box is mandatory
    if (!connectionID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Connection\'s ID must be provided',
        module: MODULE_NAME, method: 'handleGetConnection',
        user: req.user
      });
    }
    // Check auth
    if (!Authorizations.canReadConnection(req.user, connectionID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ, entity: Entity.CONNECTION,
        module: MODULE_NAME, method: 'handleGetConnection',
        value: connectionID
      });
    }
    // Check User
    let userProject: string[] = [];
    if (Authorizations.canListUsers(req.user)) {
      userProject = [ 'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName' ];
    }
    // Get it
    const connection = await ConnectionStorage.getConnection(req.user.tenantID, connectionID,
      [ 'id', 'connectorId', 'createdAt', 'validUntil', 'lastChangedOn', 'createdOn', ...userProject ]);
    UtilsService.assertObjectExists(action, connection, `Connection ID '${connectionID}' does not exist`,
      MODULE_NAME, 'handleGetConnection', req.user);
    res.json(connection);
    next();
  }

  public static async handleGetConnections(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListConnections(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.CONNECTIONS,
        module: MODULE_NAME, method: 'handleGetConnections'
      });
    }
    // Filter
    const filteredRequest = ConnectionSecurity.filterConnectionsRequest(req.query);
    // Check Users
    let userProject: string[] = [];
    if (Authorizations.canListUsers(req.user)) {
      userProject = [ 'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName' ];
    }
    // Get
    const connections = await ConnectionStorage.getConnectionsByUserId(req.user.tenantID, filteredRequest.UserID,
      [ 'id', 'connectorId', 'createdAt', 'validUntil', 'lastChangedOn', 'createdOn', ...userProject ]);
    res.json(connections);
    next();
  }

  public static async handleCreateConnection(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canCreateConnection(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE, entity: Entity.CONNECTION,
        module: MODULE_NAME, method: 'handleCreateConnection'
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
      action: action,
      detailedMessages: { connection }
    });
    // Ok
    res.status(StatusCodes.OK).json(Object.assign({ id: req.user.tenantID }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleDeleteConnection(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
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
    UtilsService.assertObjectExists(action, connection, `Connection ID '${connectionID}' does not exist`,
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
