import { HttpOICPEndpointRequest, HttpOICPEndpointsRequest } from '../../../../types/requests/HttpOICPEndpointRequest';

import OICPEndpoint from '../../../../types/oicp/OICPEndpoint';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class OICPEndpointValidator extends SchemaValidator {
  private static instance: OICPEndpointValidator|null = null;
  private oicpEndpointCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/oicp/oicp-endpoint-create.json`, 'utf8'));
  private oicpEndpointPing: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/oicp/oicp-endpoint-ping.json`, 'utf8'));
  private oicpEndpointGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/oicp/oicp-endpoint-get.json`, 'utf8'));
  private oicpEndpointsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/oicp/oicp-endpoints-get.json`, 'utf8'));
  private oicpEndpointUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/oicp/oicp-endpoint-update.json`, 'utf8'));


  private constructor() {
    super('OICPEndpointValidator');
  }

  public static getInstance(): OICPEndpointValidator {
    if (!OICPEndpointValidator.instance) {
      OICPEndpointValidator.instance = new OICPEndpointValidator();
    }
    return OICPEndpointValidator.instance;
  }

  public validateOICPEndpointCreateReq(data: Record<string, unknown>): OICPEndpoint {
    return this.validate(this.oicpEndpointCreate, data);
  }

  public validateOICPEndpointPingReq(data: Record<string, unknown>): OICPEndpoint {
    return this.validate(this.oicpEndpointPing, data);
  }

  public validateOICPEndpointGetReq(data: Record<string, unknown>): HttpOICPEndpointRequest {
    return this.validate(this.oicpEndpointGet, data);
  }

  public validateOICPEndpointsGetReq(data: Record<string, unknown>): HttpOICPEndpointsRequest {
    return this.validate(this.oicpEndpointsGet, data);
  }

  public validateOICPEndpointUpdateReq(data: Record<string, unknown>): OICPEndpoint {
    return this.validate(this.oicpEndpointUpdate, data);
  }
}
