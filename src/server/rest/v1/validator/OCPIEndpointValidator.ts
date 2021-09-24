import { HttpOCPIEndpointByIdRequest, HttpOCPIEndpointGenerateLocalTokenRequest, HttpOCPIEndpointRequest, HttpOCPIEndpointsRequest } from '../../../../types/requests/HttpOCPIEndpointRequest';

import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class OCPIEndpointValidator extends SchemaValidator {
  private static instance: OCPIEndpointValidator|null = null;
  private ocpiEndpointCreate: Schema;
  private ocpiEndpointPing: Schema;
  private ocpiEndpointById: Schema;
  private ocpiEndpointGenerateLocalToken: Schema;
  private ocpiEndpointGet: Schema;
  private ocpiEndpointsGet: Schema;
  private ocpiEndpointUpdate: Schema;


  private constructor() {
    super('OCPIEndpointValidator');
    this.ocpiEndpointCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-create.json`, 'utf8'));
    this.ocpiEndpointPing = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-ping.json`, 'utf8'));
    this.ocpiEndpointById = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-by-id.json`, 'utf8'));
    this.ocpiEndpointGenerateLocalToken = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-generate-local-token.json`, 'utf8'));
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

  public validateOCPIEndpointCreate(data: any): OCPIEndpoint {
    // Validate schema
    this.validate(this.ocpiEndpointCreate, data);
    return data;
  }

  public validateOCPIEndpointPing(data: any): OCPIEndpoint {
    // Validate schema
    this.validate(this.ocpiEndpointPing, data);
    return data;
  }

  public validateOCPIEndpointById(data: any): HttpOCPIEndpointByIdRequest {
    // Validate schema
    this.validate(this.ocpiEndpointById, data);
    return data;
  }

  public validateOCPIEndpointGenerateLocalToken(data: any): HttpOCPIEndpointGenerateLocalTokenRequest {
    // Validate schema
    this.validate(this.ocpiEndpointGenerateLocalToken, data);
    return data;
  }

  public validateOCPIEndpointGet(data: any): HttpOCPIEndpointRequest {
    // Validate schema
    this.validate(this.ocpiEndpointGet, data);
    return data;
  }

  public validateOCPIEndpointsGet(data: any): HttpOCPIEndpointsRequest {
    // Validate schema
    this.validate(this.ocpiEndpointsGet, data);
    return data;
  }

  public validateOCPIEndpointUpdate(data: any): OCPIEndpoint {
    // Validate schema
    this.validate(this.ocpiEndpointUpdate, data);
    return data;
  }
}
