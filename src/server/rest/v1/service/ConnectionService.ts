import { Action, Entity } from '../../../../types/Authorization';
import Connection, { ConnectionType } from '../../../../types/Connection';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Authorizations from '../../../../authorization/Authorizations';
import CarConnectorFactory from '../../../../integration/car-connector/CarConnectorFactory';
import ConnectionStorage from '../../../../storage/mongodb/ConnectionStorage';
import ConnectionValidatorRest from '../validator/ConnectionValidatorRest';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import RefundFactory from '../../../../integration/refund/RefundFactory';
import { ServerAction } from '../../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'ConnectionService';

export default class ConnectionService {
  public static async handleGetConnection(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const connectionID = ConnectionValidatorRest.getInstance().validateConnectionGetReq(req.query).ID;
    // Charge Box is mandatory
    if (!connectionID) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Connection\'s ID must be provided',
        module: MODULE_NAME, method: 'handleGetConnection',
        user: req.user
      });
    }
    // Check auth
    if (!await Authorizations.canReadConnection(req.user, connectionID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.CONNECTION,
        module: MODULE_NAME, method: 'handleGetConnection',
        value: connectionID
      });
    }
    // Check User
    let userProject: string[] = [];
    if ((await Authorizations.canListUsers(req.user)).authorized) {
      userProject = [ 'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName' ];
    }
    // Get it
    const connection = await ConnectionStorage.getConnection(req.tenant, connectionID,
      [ 'id', 'connectorId', 'createdAt', 'validUntil', 'lastChangedOn', 'createdOn', ...userProject ]);
    UtilsService.assertObjectExists(action, connection, `Connection ID '${connectionID}' does not exist`,
      MODULE_NAME, 'handleGetConnection', req.user);
    res.json(connection);
    next();
  }

  public static async handleGetConnections(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!await Authorizations.canListConnections(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST, entity: Entity.CONNECTION,
        module: MODULE_NAME, method: 'handleGetConnections'
      });
    }
    // Filter
    const filteredRequest = ConnectionValidatorRest.getInstance().validateConnectionsGetReq(req.query);
    // Check Users
    let userProject: string[] = [];
    if ((await Authorizations.canListUsers(req.user)).authorized) {
      userProject = [ 'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName' ];
    }
    // Get
    const connections = await ConnectionStorage.getConnectionsByUserId(req.tenant, filteredRequest.UserID,
      [ 'id', 'connectorId', 'createdAt', 'validUntil', 'lastChangedOn', 'createdOn', ...userProject ]);
    res.json(connections);
    next();
  }

  public static async handleCreateConnection(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!await Authorizations.canCreateConnection(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE, entity: Entity.CONNECTION,
        module: MODULE_NAME, method: 'handleCreateConnection'
      });
    }
    // Filter
    const filteredRequest = ConnectionValidatorRest.getInstance().validateConnectionCreateReq(req.body);
    let integrationConnector = null;
    switch (filteredRequest.connectorId) {
      case ConnectionType.MERCEDES:
        integrationConnector = await CarConnectorFactory.getCarConnectorImpl(req.tenant, filteredRequest.connectorId);
        break;
      case ConnectionType.CONCUR:
        integrationConnector = await RefundFactory.getRefundImpl(req.tenant);
        break;
    }
    if (!Utils.isNullOrUndefined(integrationConnector)) {
      // Create
      const connection: Connection = await integrationConnector.createConnection(filteredRequest.userId, filteredRequest.data);
      await Logging.logInfo({
        tenantID: req.tenant.id, user: req.user,
        module: MODULE_NAME, method: 'handleCreateConnection',
        message: `Connection to '${connection.connectorId}' has been created successfully`,
        action: action,
        detailedMessages: { connection }
      });
    } else {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        user: req.user,
        module: MODULE_NAME, method: 'handleCreateConnection',
        message: `No integration found for connector '${filteredRequest.connectorId}' `
      });
    }
    res.status(StatusCodes.OK).json(Object.assign({ id: req.tenant.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleDeleteConnection(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const connectionID = ConnectionValidatorRest.getInstance().validateConnectionDeleteReq(req.query).ID;
    if (!connectionID) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        user: req.user,
        module: MODULE_NAME, method: 'handleGetConnection',
        message: 'The Connection\'s ID must be provided'
      });
    }
    // Get connection
    const connection = await ConnectionStorage.getConnection(req.tenant, connectionID);
    UtilsService.assertObjectExists(action, connection, `Connection ID '${connectionID}' does not exist`,
      MODULE_NAME, 'handleDeleteConnection', req.user);
    // Delete
    await ConnectionStorage.deleteConnectionById(req.tenant, connection.id);
    // Log
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user,
      actionOnUser: connection.userId,
      module: MODULE_NAME, method: 'handleDeleteConnection',
      message: `Connection to '${connection.connectorId}' has been deleted successfully`,
      action: action
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
