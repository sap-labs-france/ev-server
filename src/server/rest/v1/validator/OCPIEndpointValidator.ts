import { HttpOCPIEndpointByIdRequest, HttpOCPIEndpointRequest, HttpOCPIEndpointsRequest } from '../../../../types/requests/HttpOCPIEndpointRequest';

import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class OCPIEndpointValidator extends SchemaValidator {
  private static instance: OCPIEndpointValidator|null = null;
  private ocpiEndpointCreate: Schema;
  private ocpiEndpointPing: Schema;
  private ocpiEndpointById: Schema;
  private ocpiEndpointGet: Schema;
  private ocpiEndpointsGet: Schema;
  private ocpiEndpointUpdate: Schema;


  private constructor() {
    super('OCPIEndpointValidator');
    this.ocpiEndpointCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-create.json`, 'utf8'));
    this.ocpiEndpointPing = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-ping.json`, 'utf8'));
    this.ocpiEndpointById = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-by-id.json`, 'utf8'));
    this.ocpiEndpointGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-get.json`, 'utf8'));
    this.ocpiEndpointsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoints-get.json`, 'utf8'));
    this.ocpiEndpointUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-update.json`, 'utf8'));
  }

  public static getInstance(): OCPIEndpointValidator {
    if (!OCPIEndpointValidator.instance) {
      OCPIEndpointValidator.instance = new OCPIEndpointValidator();
    }
    return OCPIEndpointValidator.instance;
  }

  public validateOCPIEndpointCreateReq(data: Record<string, unknown>): OCPIEndpoint {
    return this.validate(this.ocpiEndpointCreate, data);
  }

  public validateOCPIEndpointPingReq(data: Record<string, unknown>): OCPIEndpoint {
    return this.validate(this.ocpiEndpointPing, data);
  }

  public validateOCPIEndpointByIdReq(data: Record<string, unknown>): HttpOCPIEndpointByIdRequest {
    return this.validate(this.ocpiEndpointById, data);
  }

  public validateOCPIEndpointGetReq(data: Record<string, unknown>): HttpOCPIEndpointRequest {
    return this.validate(this.ocpiEndpointGet, data);
  }

  public validateOCPIEndpointsGetReq(data: Record<string, unknown>): HttpOCPIEndpointsRequest {
    return this.validate(this.ocpiEndpointsGet, data);
  }

  public validateOCPIEndpointUpdateReq(data: Record<string, unknown>): OCPIEndpoint {
    return this.validate(this.ocpiEndpointUpdate, data);
  }
}
