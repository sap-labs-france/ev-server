import { HttpOCPIEndpointByIdRequest } from '../../../../types/requests/HttpOCPIEndpointRequest';
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


  private constructor() {
    super('OCPIEndpointValidator');
    this.ocpiEndpointCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-create.json`, 'utf8'));
    this.ocpiEndpointPing = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-ping.json`, 'utf8'));
    this.ocpiEndpointById = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-by-id.json`, 'utf8'));
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
}
