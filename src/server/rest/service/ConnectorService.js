const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const UnauthorizedError = require('../../../exception/UnauthorizedError');
const ConflictError = require('../../../exception/ConflictError');
const Constants = require('../../../utils/Constants');
const AbstractConnector = require('../../../entity/integration/AbstractConnector');
const ConcurConnector = require('../../../entity/integration/ConcurConnector');
const User = require('../../../entity/User');
const Authorizations = require('../../../authorization/Authorizations');
const ConnectorSecurity = require('./security/ConnectorSecurity');
const HttpStatusCodes = require('http-status-codes');
const ConnectionValidator = require('../validation/ConnectionValidator');
const AbstractService = require('./AbstractService');
const NotificationHandler = require('../../../notification/NotificationHandler');
const Utils = require('../../../utils/Utils');

const MODULE_NAME = 'ConnectorService';

class ConnectorService extends AbstractService {
  static async handleDeleteConnection(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = ConnectorSecurity.filterConnectionDeleteRequest(
        req.query, req.user);
      // Check Mandatory fields
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Tenant's ID must be provided`, 500,
          MODULE_NAME, 'handleDeleteTenant', req.user);
      }
      // Get
      const tenant = await Connector.getConnection(filteredRequest.ID);
      // Found?
      if (!tenant) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Tenant with ID '${filteredRequest.ID}' does not exist`, 550,
          MODULE_NAME, 'handleDeleteTenant', req.user);
      }
      // Check auth
      if (!Authorizations.canDeleteTenant(req.user, tenant.getModel())) {
        // Not Authorized!
        throw new UnauthorizedError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_TENANT,
          tenant.getID(),
          req.user);
      }
      if (tenant.getID() === req.user.tenantID) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Your own tenant with id '${tenant.getID()}' cannot be deleted`, 550,
          MODULE_NAME, 'handleDeleteTenant', req.user);
      }
      // Delete
      await tenant.delete();
      if (filteredRequest.forced && !Utils.isServerInProductionMode()) {
        Logging.logWarning({
          tenantID: req.user.tenantID,
          module: 'MongoDBStorage', method: 'deleteTenantDatabase',
          message: `Deleting collections for tenant ${tenant.getID()}`
        });
        tenant.deleteEnvironment();
      }
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID, user: req.user,
        module: MODULE_NAME, method: 'handleDeleteTenant',
        message: `Tenant '${tenant.getName()}' has been deleted successfully`,
        action: action,
        detailedMessages: tenant
      });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      AbstractService._handleError(error, req, next, action, MODULE_NAME, 'handleDeleteTenant');
    }
  }

  static async handleGetConnection(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = ConnectorSecurity.filterConnectionRequest(req.query, req.user);
      // Charge Box is mandatory
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Tenant's ID must be provided`, 500,
          MODULE_NAME, 'handleGetConnection', req.user);
      }
      // Get it
      const tenant = await Connector.getConnection(filteredRequest.ID);
      if (!tenant) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Tenant with ID '${filteredRequest.ID}' does not exist`, 550,
          MODULE_NAME, 'handleGetConnection', req.user);
      }
      // Check auth
      if (!Authorizations.canReadTenant(req.user, tenant.getModel())) {
        // Not Authorized!
        throw new UnauthorizedError(
          Constants.ACTION_READ,
          Constants.ENTITY_TENANT,
          tenant.getID(),
          req.user);
      }
      // Return
      res.json(
        // Filter
        ConnectorSecurity.filterConnectionResponse(
          tenant.getModel(), req.user)
      );
      next();
    } catch (error) {
      AbstractService._handleError(error, req, next, action, MODULE_NAME, 'handleGetConnection');
    }
  }

  static async handleGetConnections(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canListTenants(req.user)) {
        // Not Authorized!
        throw new UnauthorizedError(
          Constants.ACTION_LIST,
          Constants.ENTITY_CONNECTIONS,
          null,
          req.user);
      }
      // Filter
      const filteredRequest = ConnectorSecurity.filterConnectionsRequest(req.query, req.user);
      const connections = await AbstractConnector.getConnectionsByUserId(req.user.tenantID, req.user.id);
      // Set
      connections.result = connections.result.map((connection) => connection.getModel());
      // Filter
      connections.result = ConnectorSecurity.filterConnectionsResponse(
        connections.result, req.user);
      // Return
      res.json(connections);
      next();
    } catch (error) {
      AbstractService._handleError(error, req, next, action, MODULE_NAME, 'handleGetConnections');
    }
  }

  static async handleCreateConnection(action, req, res, next) {
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
      ConnectionValidator.validateConnectionCreation(req.body);
      // Filter
      const filteredRequest = ConnectorSecurity.filterConnectionCreateRequest(req.body, req.user);
      const setting = await AbstractConnector.getConnectorSetting(req.user.tenantID, filteredRequest.settingId);

      const connector = this.instantiateConnector(req.user.tenantID, filteredRequest.connectorId, setting.getContent()[filteredRequest.connectorId]);
      const connection = await connector.createConnection(filteredRequest.userId, filteredRequest.data);

      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID, user: req.user,
        module: MODULE_NAME, method: 'handleCreateConnection',
        message: `Connection [${connection.getConnectorId()},${connection.getUserId()}] has been created successfully`,
        action: action
      });
      // Ok
      res.status(HttpStatusCodes.OK).json(Object.assign({id: req.user.tenantID}, Constants.REST_RESPONSE_SUCCESS));
      next();
    } catch (error) {
      AbstractService._handleError(error, req, next, action, MODULE_NAME, 'handleCreateTenant');
    }
  }

  /**
   *
   * @param tenantId
   * @param connectorId
   * @param setting
   * @returns {AbstractConnector}
   */
  static instantiateConnector(tenantId, connectorId, setting) {
    switch (connectorId) {
      case 'concur':
        return new ConcurConnector(tenantId, setting);
    }
  }

  static async handleUpdateConnection(action, req, res, next) {
    try {
      // Filter
      ConnectionValidator.validateTenantUpdate(req.body);
      const filteredRequest = ConnectorSecurity.filterConnectionUpdateRequest(req.body, req.user);

      // Check email
      const tenant = await Connector.getConnection(filteredRequest.id);
      if (!tenant) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Tenant with ID '${filteredRequest.ID}' does not exist`, 550,
          MODULE_NAME, 'handleUpdateTenant', req.user);
      }
      // Check auth
      if (!Authorizations.canUpdateTenant(req.user, tenant.getModel())) {
        // Not Authorized!
        throw new UnauthorizedError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_TENANT,
          tenant.getID(),
          req.user);
      }
      // Update
      Database.updateTenant(filteredRequest, tenant.getModel());
      // Update timestamp
      tenant.setLastChangedBy(new User(req.user.tenantID, {
        'id': req.user.id
      }));
      tenant.setLastChangedOn(new Date());
      // Update Tenant
      const updatedTenant = await tenant.save();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID, user: req.user,
        module: MODULE_NAME, method: 'handleUpdateTenant',
        message: `Tenant '${updatedTenant.getName()}' has been updated successfully`,
        action: action,
        detailedMessages: updatedTenant
      });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      AbstractService._handleError(error, req, next, action, MODULE_NAME, 'handleUpdateTenant');
    }
  }

}

module.exports = ConnectorService;
