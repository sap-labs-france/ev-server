import Authorizations from '../../../../authorization/Authorizations';
import Connection from '../../../../types/Connection';
import { DataResult } from '../../../../types/DataResult';
import { HttpConnectionsRequest } from '../../../../types/requests/HttpConnectionRequest';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class ConnectionSecurity {
  public static filterConnectionDeleteRequest(request: any) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.userId = sanitize(request.userId);
    filteredRequest.connectorId = sanitize(request.connectorId);
    return filteredRequest;
  }

  public static filterConnectionRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterConnectionsRequest(request: any): HttpConnectionsRequest {
    const filteredRequest: HttpConnectionsRequest = {
      userId: sanitize(request.userId)
    } as HttpConnectionsRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterConnectionUpdateRequest(request: any): Connection {
    const filteredRequest = ConnectionSecurity.filterConnectionRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  public static filterConnectionCreateRequest(request: any): Connection {
    return ConnectionSecurity.filterConnectionRequest(request);
  }

  public static filterConnectionResponse(connection: Connection, loggedUser: UserToken): Connection {
    let filteredConnection: Connection;
    if (!connection) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadConnection(loggedUser, connection.userId)) {
      // Set only necessary info
      filteredConnection = {
        id: connection.id,
        connectorId: connection.connectorId,
        createdAt: connection.createdAt,
        validUntil: connection.validUntil,
      } as Connection;
      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredConnection, connection, loggedUser);
    }
    return filteredConnection;
  }

  public static filterConnectionsResponse(connections: DataResult<Connection>, loggedUser: UserToken): DataResult<Connection> {
    const filteredConnections = [];
    if (!connections.result) {
      return null;
    }
    if (!Authorizations.canListConnections(loggedUser)) {
      return null;
    }
    for (const connection of connections.result) {
      // Filter
      const filteredConnection = ConnectionSecurity.filterConnectionResponse(connection, loggedUser);
      if (filteredConnection) {
        // Add
        filteredConnections.push(filteredConnection);
      }
    }
    connections.result = filteredConnections;
  }

  private static filterConnectionRequest(request: any): Connection {
    return {
      connectorId: sanitize(request.connectorId),
      userId: sanitize(request.userId),
      data: sanitize(request.data),
    };
  }
}

