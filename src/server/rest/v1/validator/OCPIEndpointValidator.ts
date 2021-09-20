import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class OCPIEndpointValidator extends SchemaValidator {
  private static instance: OCPIEndpointValidator|null = null;
  private ocpiEndpointCreate: Schema;


  private constructor() {
    super('OCPIEndpointValidator');
    this.ocpiEndpointCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint-create.json`, 'utf8'));
  }

  public static getInstance(): OCPIEndpointValidator {
    if (!OCPIEndpointValidator.instance) {
      OCPIEndpointValidator.instance = new OCPIEndpointValidator();
    }
    return OCPIEndpointValidator.instance;
  }

  public validateCreateOCPIEndpoint(data: any): OCPIEndpoint {
    // Validate schema
    this.validate(this.ocpiEndpointCreate, data);
    return data;
  }
}
