import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';

export default class ConnectorSecurity {
  static filterConnectionDeleteRequest(request, loggedUser: UserToken) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.userId = sanitize(request.userId);
    filteredRequest.connectorId = sanitize(request.connectorId);
    return filteredRequest;
  }

  static filterConnectionRequest(request, loggedUser: UserToken) {
    const filteredRequest: any = {};
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  static filterConnectionsRequest(request, loggedUser: UserToken) {
    const filteredRequest: any = {};
    filteredRequest.userId = sanitize(request.userId);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterConnectionUpdateRequest(request, loggedUser: UserToken) {
    const filteredRequest = ConnectorSecurity._filterConnectionRequest(request, loggedUser);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterConnectionCreateRequest(request, loggedUser: UserToken) {
    return ConnectorSecurity._filterConnectionRequest(request, loggedUser);
  }

  static _filterConnectionRequest(request, loggedUser: UserToken) {
    const filteredRequest: any = {};
    filteredRequest.connectorId = sanitize(request.connectorId);
    filteredRequest.settingId = sanitize(request.settingId);
    filteredRequest.userId = sanitize(request.userId);
    filteredRequest.data = sanitize(request.data);
    return filteredRequest;
  }

  static filterConnectionResponse(connection, loggedUser: UserToken) {
    let filteredConnection;

    if (!connection) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadConnection(loggedUser, connection.userId)) {
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

  static filterConnectionsResponse(connections, loggedUser: UserToken) {
    const filteredConnections = [];

    if (!connections.result) {
      return null;
    }
    if (!Authorizations.canListConnections(loggedUser)) {
      return null;
    }
    for (const connection of connections.result) {
      // Filter
      const filteredConnection = ConnectorSecurity.filterConnectionResponse(connection, loggedUser);
      // Ok?
      if (filteredConnection) {
        // Add
        filteredConnections.push(filteredConnection);
      }
    }
    connections.result = filteredConnections;
  }
}

