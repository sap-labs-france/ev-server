import { HttpConnectionRequest, HttpConnectionsRequest } from '../../../../types/requests/HttpConnectionRequest';

import Connection from '../../../../types/Connection';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class ConnectionValidator extends SchemaValidator {
  private static instance: ConnectionValidator|null = null;
  private connectionCreate: Schema;
  private connectionsGet: Schema;
  private connectionGet: Schema;

  private constructor() {
    super('ConnectionValidator');
    this.connectionCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/connections/connection-create.json`, 'utf8'));
    this.connectionsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/connections/connections-get.json`, 'utf8'));
    this.connectionGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/connections/connection-get.json`, 'utf8'));
  }

  public static getInstance(): ConnectionValidator {
    if (!ConnectionValidator.instance) {
      ConnectionValidator.instance = new ConnectionValidator();
    }
    return ConnectionValidator.instance;
  }

  validateConnectionCreateReq(data: unknown): Connection {
    return this.validate('validateConnectionCreateReq', this.connectionCreate, data);
  }

  validateConnectionsGetReq(data: unknown): HttpConnectionsRequest {
    return this.validate('validateConnectionsGetReq', this.connectionsGet, data);
  }

  validateConnectionGetReq(data: unknown): HttpConnectionRequest {
    return this.validate('validateConnectionGetReq', this.connectionGet, data);
  }
}

