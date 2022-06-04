import { HttpOCPIEndpointCommandRequest, HttpOCPIEndpointCreateRequest, HttpOCPIEndpointDeleteRequest, HttpOCPIEndpointGetRequest, HttpOCPIEndpointPingRequest, HttpOCPIEndpointUpdateRequest, HttpOCPIEndpointsGetRequest } from '../../../../types/requests/HttpOCPIEndpointRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class OCPIEndpointValidatorRest extends SchemaValidator {
  private static instance: OCPIEndpointValidatorRest|null = null;
  private ocpiEndpointCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-create.json`, 'utf8'));
  private ocpiEndpointPing: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-ping.json`, 'utf8'));
  private ocpiEndpointById: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-by-id.json`, 'utf8'));
  private ocpiEndpointGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-get.json`, 'utf8'));
  private ocpiEndpointDelete: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-delete.json`, 'utf8'));
  private ocpiEndpointsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoints-get.json`, 'utf8'));
  private ocpiEndpointUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-update.json`, 'utf8'));


  private constructor() {
    super('OCPIEndpointValidatorRest');
  }

  public static getInstance(): OCPIEndpointValidatorRest {
    if (!OCPIEndpointValidatorRest.instance) {
      OCPIEndpointValidatorRest.instance = new OCPIEndpointValidatorRest();
    }
    return OCPIEndpointValidatorRest.instance;
  }

  public validateOCPIEndpointCreateReq(data: Record<string, unknown>): HttpOCPIEndpointUpdateRequest {
    return this.validate(this.ocpiEndpointCreate, data);
  }

  public validateOCPIEndpointPingReq(data: Record<string, unknown>): HttpOCPIEndpointPingRequest {
    return this.validate(this.ocpiEndpointPing, data);
  }

  public validateOCPIEndpointCommandReq(data: Record<string, unknown>): HttpOCPIEndpointCommandRequest {
    return this.validate(this.ocpiEndpointById, data);
  }

  public validateOCPIEndpointGetReq(data: Record<string, unknown>): HttpOCPIEndpointGetRequest {
    return this.validate(this.ocpiEndpointGet, data);
  }

  public validateOCPIEndpointDeleteReq(data: Record<string, unknown>): HttpOCPIEndpointDeleteRequest {
    return this.validate(this.ocpiEndpointDelete, data);
  }

  public validateOCPIEndpointsGetReq(data: Record<string, unknown>): HttpOCPIEndpointsGetRequest {
    return this.validate(this.ocpiEndpointsGet, data);
  }

  public validateOCPIEndpointUpdateReq(data: Record<string, unknown>): HttpOCPIEndpointCreateRequest {
    return this.validate(this.ocpiEndpointUpdate, data);
  }
}
