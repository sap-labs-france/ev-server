import { HttpOICPEndpointCreateRequest, HttpOICPEndpointDeleteRequest, HttpOICPEndpointGetRequest, HttpOICPEndpointPingRequest, HttpOICPEndpointUpdateRequest, HttpOICPEndpointsGetRequest } from '../../../../types/requests/HttpOICPEndpointRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class OICPEndpointValidatorRest extends SchemaValidator {
  private static instance: OICPEndpointValidatorRest|null = null;
  private oicpEndpointCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/oicp/oicp-endpoint-create.json`, 'utf8'));
  private oicpEndpointPing: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/oicp/oicp-endpoint-ping.json`, 'utf8'));
  private oicpEndpointGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/oicp/oicp-endpoint-get.json`, 'utf8'));
  private oicpEndpointDelete: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/oicp/oicp-endpoint-delete.json`, 'utf8'));
  private oicpEndpointsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/oicp/oicp-endpoints-get.json`, 'utf8'));
  private oicpEndpointUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/oicp/oicp-endpoint-update.json`, 'utf8'));


  private constructor() {
    super('OICPEndpointValidatorRest');
  }

  public static getInstance(): OICPEndpointValidatorRest {
    if (!OICPEndpointValidatorRest.instance) {
      OICPEndpointValidatorRest.instance = new OICPEndpointValidatorRest();
    }
    return OICPEndpointValidatorRest.instance;
  }

  public validateOICPEndpointCreateReq(data: Record<string, unknown>): HttpOICPEndpointCreateRequest {
    return this.validate(this.oicpEndpointCreate, data);
  }

  public validateOICPEndpointPingReq(data: Record<string, unknown>): HttpOICPEndpointPingRequest {
    return this.validate(this.oicpEndpointPing, data);
  }

  public validateOICPEndpointGetReq(data: Record<string, unknown>): HttpOICPEndpointGetRequest {
    return this.validate(this.oicpEndpointGet, data);
  }

  public validateOICPEndpointDeleteReq(data: Record<string, unknown>): HttpOICPEndpointDeleteRequest {
    return this.validate(this.oicpEndpointDelete, data);
  }

  public validateOICPEndpointsGetReq(data: Record<string, unknown>): HttpOICPEndpointsGetRequest {
    return this.validate(this.oicpEndpointsGet, data);
  }

  public validateOICPEndpointUpdateReq(data: Record<string, unknown>): HttpOICPEndpointUpdateRequest {
    return this.validate(this.oicpEndpointUpdate, data);
  }
}
