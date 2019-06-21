import Logging from '../../../utils/Logging';
import AppError from '../../../exception/AppError';
import UnauthorizedError from '../../../exception/UnauthorizedError';
import Constants from '../../../utils/Constants';
import AbstractConnector from '../../../integration/AbstractConnector';
import ConcurConnector from '../../../integration/refund/ConcurConnector';
import Authorizations from '../../../authorization/Authorizations';
import ConnectorSecurity from './security/ConnectorSecurity';
import HttpStatusCodes from 'http-status-codes';
import ConnectionValidator from '../validation/ConnectionValidator';
import AbstractService from './AbstractService';

const MODULE_NAME = 'ConnectorService';

export default class ConnectorService extends AbstractService {
  public static async handleGetConnection(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = ConnectorSecurity.filterConnectionRequest(req.query, req.user);
      // Charge Box is mandatory
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Connection's ID must be provided`, 500,
          MODULE_NAME, 'handleGetConnection', req.user);
      }

      // Check auth
      if (!Authorizations.canReadConnection(req.user, filteredRequest.ID)) {
        // Not Authorized!
        throw new UnauthorizedError(
          Constants.ACTION_READ,
          Constants.ENTITY_CONNECTION,
          filteredRequest.ID,
          req.user);
      }
      // Get it
      const connection = await AbstractConnector.getConnection(req.user.tenantID, filteredRequest.ID);
      if (!connection) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Connection with ID '${filteredRequest.ID}' does not exist`, 550,
          MODULE_NAME, 'handleGetConnection', req.user);
      }
      // Return
      res.json(
        // Filter
        ConnectorSecurity.filterConnectionResponse(
          connection.getModel(), req.user)
      );
      next();
    } catch (error) {
      AbstractService._handleError(error, req, next, action, MODULE_NAME, 'handleGetConnection');
    }
  }

  public static async handleGetConnections(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canListConnections(req.user)) {
        // Not Authorized!
        throw new UnauthorizedError(
          Constants.ACTION_LIST,
          Constants.ENTITY_CONNECTIONS,
          null,
          req.user);
      }
      // Filter
      const filteredRequest = ConnectorSecurity.filterConnectionsRequest(req.query, req.user);
      const connections = await AbstractConnector.getConnectionsByUserId(req.user.tenantID, filteredRequest.userId);
      // Set
      connections.result = connections.result.map((connection) => { return connection.getModel(); });
      // Filter
      ConnectorSecurity.filterConnectionsResponse(connections, req.user);
      // Return
      res.json(connections);
      next();
    } catch (error) {
      AbstractService._handleError(error, req, next, action, MODULE_NAME, 'handleGetConnections');
    }
  }

  public static async handleCreateConnection(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canCreateConnection(req.user)) {
        // Not Authorized!
        throw new UnauthorizedError(
          Constants.ACTION_CREATE,
          Constants.ENTITY_CONNECTION,
          null,
          req.user);
      }

      // Filter
      const filteredRequest = ConnectorSecurity.filterConnectionCreateRequest(req.body, req.user);
      const setting = await AbstractConnector.getConnectorSetting(req.user.tenantID, filteredRequest.settingId);
      const connector = this.instantiateConnector(req.user.tenantID, filteredRequest.connectorId, setting.getContent()[filteredRequest.connectorId]);
      const connection = await connector.createConnection(filteredRequest.userId, filteredRequest.data);

      ConnectionValidator.getInstance().validateConnectionCreation(req.body);

      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID, user: req.user,
        module: MODULE_NAME, method: 'handleCreateConnection',
        message: `Connection [${connection.getConnectorId()},${connection.getUserId()}] has been created successfully`,
        action: action
      });
      // Ok
      res.status(HttpStatusCodes.OK).json(Object.assign({ id: req.user.tenantID }, Constants.REST_RESPONSE_SUCCESS));
      next();
    } catch (error) {
      AbstractService._handleError(error, req, next, action, MODULE_NAME, 'handleCreateConnection');
    }
  }

  public static async handleDeleteConnection(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = ConnectorSecurity.filterConnectionDeleteRequest(req.query, req.user);
      // Check auth
      if (!Authorizations.canDeleteConnection(req.user, filteredRequest.userId)) {
        // Not Authorized!
        throw new UnauthorizedError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_CONNECTION,
          null,
          req.user);
      }

      if (!filteredRequest.userId) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The userId must be provided`, 500,
          MODULE_NAME, 'handleDeleteConnection', req.user);
      }

      if (!filteredRequest.connectorId) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The connectorId must be provided`, 500,
          MODULE_NAME, 'handleDeleteConnection', req.user);
      }

      // Check auth
      if (!Authorizations.canDeleteConnection(req.user, filteredRequest.userId)) {
        // Not Authorized!
        throw new UnauthorizedError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_CONNECTION,
          null,
          req.user);
      }

      const connection = await AbstractConnector.getConnectionByUserIdAndConnectorId(req.user.tenantID, filteredRequest.connectorId, filteredRequest.userId);

      if (!connection) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Connection [${filteredRequest.connectorId},${filteredRequest.userId}] does not exist`, 550,
          MODULE_NAME, 'handleDeleteConnection', req.user);
      }

      await AbstractConnector.deleteConnectionById(connection.getTenantID(), connection.getId());

      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID, user: req.user,
        module: MODULE_NAME, method: 'handleDeleteConnection',
        message: `Connection [${filteredRequest.connectorId},${filteredRequest.userId}] has been deleted successfully`,
        action: action
      });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      AbstractService._handleError(error, req, next, action, MODULE_NAME, 'handleCreateTenant');
    }
  }

  private static instantiateConnector(tenantId, connectorId, setting) {
    switch (connectorId) {
      case 'concur':
        return new ConcurConnector(tenantId, setting);
    }
  }
}


