import { HttpOCPIEndpointByIdRequest, HttpOCPIEndpointRequest, HttpOCPIEndpointsRequest } from '../../../../types/requests/HttpOCPIEndpointRequest';

import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class OCPIEndpointValidator extends SchemaValidator {
  private static instance: OCPIEndpointValidator|null = null;
  private ocpiEndpointCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-create.json`, 'utf8'));
  private ocpiEndpointPing: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-ping.json`, 'utf8'));
  private ocpiEndpointById: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-by-id.json`, 'utf8'));
  private ocpiEndpointGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-get.json`, 'utf8'));
  private ocpiEndpointsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoints-get.json`, 'utf8'));
  private ocpiEndpointUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-update.json`, 'utf8'));


  private constructor() {
    super('OCPIEndpointValidator');
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
