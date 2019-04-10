const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../authorization/Authorizations');
const UtilsSecurity = require('./UtilsSecurity');

class ConnectorSecurity {

  static filterConnectionDeleteRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.userId = sanitize(request.userId);
    filteredRequest.connectorId = sanitize(request.connectorId);
    return filteredRequest;
  }

  static filterConnectionRequest(request, loggedUser) {
    const filteredRequest = {};
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  static filterConnectionsRequest(request, loggedUser) {
    const filteredRequest = {};
    filteredRequest.userId = sanitize(request.userId);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterConnectionUpdateRequest(request, loggedUser) {
    const filteredRequest = ConnectorSecurity._filterConnectionRequest(request, loggedUser);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterConnectionCreateRequest(request, loggedUser) {
    return ConnectorSecurity._filterConnectionRequest(request, loggedUser);
  }

  static _filterConnectionRequest(request, loggedUser) {
    const filteredRequest = {};
    filteredRequest.connectorId = sanitize(request.connectorId);
    filteredRequest.settingId = sanitize(request.settingId);
    filteredRequest.userId = sanitize(request.userId);
    filteredRequest.data = sanitize(request.data);
    return filteredRequest;
  }

  static filterConnectionResponse(connection, loggedUser) {
    let filteredConnection;

    if (!connection) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadConnection(loggedUser, connection)) {
      // Set only necessary info
      filteredConnection = {};
      filteredConnection.connectorId = connection.connectorId;
      filteredConnection.createdAt = connection.createdAt;
      filteredConnection.validUntil = connection.validUntil;
      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredConnection, connection, loggedUser);
    }
    return filteredConnection;
  }

  static filterConnectionsResponse(connections, loggedUser) {
    const filteredConnections = [];

    if (!connections) {
      return null;
    }
    if (!Authorizations.canListConnections(loggedUser)) {
      return null;
    }
    for (const connection of connections) {
      // Filter
      const filteredConnection = ConnectorSecurity.filterConnectionResponse(connection, loggedUser);
      // Ok?
      if (filteredConnection) {
        // Add
        filteredConnections.push(filteredConnection);
      }
    }
    return filteredConnections;
  }
}

module.exports = ConnectorSecurity;
