import Ajv, { Options, SchemaObjCxt, ValidateFunction } from 'ajv';
import { AnySchemaObject, DataValidateFunction, DataValidationCxt } from 'ajv/dist/types';

import AppError from '../../../../exception/AppError';
import Constants from '../../../../utils/Constants';
import { HTTPError } from '../../../../types/HTTPError';
import Schema from '../../../../types/validator/Schema';
import addFormats from 'ajv-formats';
import countries from 'i18n-iso-countries';
import fs from 'fs';
import global from '../../../../types/GlobalType';
import sanitize from 'mongo-sanitize';

// AJV Format in JSon Schema: https://github.com/ajv-validator/ajv-formats
// AJV Custom Keywords: https://github.com/ajv-validator/ajv-keywords

export default class SchemaValidator {
  private static compiledSchemas = new Map<string, ValidateFunction<unknown>>();
  private readonly ajv: Ajv;
  private commonSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/common/common.json`, 'utf8'));
  private tenantSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant.json`, 'utf8'));
  private tenantComponentSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-components.json`, 'utf8'));
  private chargingStationSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation.json`, 'utf8'));
  private tagSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag.json`, 'utf8'));
  private transactionSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transaction.json`, 'utf8'));
  private userSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user.json`, 'utf8'));
  private carSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/car/car.json`, 'utf8'));
  private assetSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/asset.json`, 'utf8'));
  private companySchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/company/company.json`, 'utf8'));
  private ocpiEndpointSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/ocpi/ocpi-endpoint.json`, 'utf8'));

  constructor(readonly moduleName: string,
      config: Options = {
        allErrors: true,
        removeAdditional: 'all',
        useDefaults: true,
        coerceTypes: true,
        strict: 'log',
      }) {
    // Create AJV
    this.ajv = new Ajv(config);
    // Add MongoDB sanitizer
    this.ajv.addKeyword({
      keyword: 'sanitize',
      compile(schema: any, parentSchema: AnySchemaObject, it: SchemaObjCxt): DataValidateFunction {
        return (data: string, dataValidationCxt: DataValidationCxt): boolean => {
          // Sanitize Mongo
          if (schema === 'mongo') {
            dataValidationCxt.parentData[dataValidationCxt.parentDataProperty] = sanitize(data);
          }
          return true;
        };
      },
    });
    // Add format check
    addFormats(this.ajv);
    // Add custom formats
    this.ajv.addFormat('latitude', {
      type: 'number',
      validate: (c) => Constants.REGEX_VALIDATION_LATITUDE.test(c.toString())
    });
    this.ajv.addFormat('longitude', {
      type: 'number',
      validate: (c) => Constants.REGEX_VALIDATION_LONGITUDE.test(c.toString())
    });
    this.ajv.addFormat('country', {
      type: 'string',
      validate: (c) => countries.isValid(c)
    });
    // Add common schema
    this.ajv.addSchema(this.commonSchema);
    this.ajv.addSchema(this.tenantSchema);
    this.ajv.addSchema(this.tenantComponentSchema);
    this.ajv.addSchema(this.chargingStationSchema);
    this.ajv.addSchema(this.tagSchema);
    this.ajv.addSchema(this.transactionSchema);
    this.ajv.addSchema(this.userSchema);
    this.ajv.addSchema(this.carSchema);
    this.ajv.addSchema(this.assetSchema);
    this.ajv.addSchema(this.companySchema);
    this.ajv.addSchema(this.ocpiEndpointSchema);
  }

  protected validate(schemaID: string, schema: Schema, data: any): any {
    // Get schema from cache
    let fnValidate = SchemaValidator.compiledSchemas.get(schemaID);
    if (!fnValidate) {
      // Compile schema
      fnValidate = this.ajv.compile(schema);
      // Add it to cache
      SchemaValidator.compiledSchemas.set(schemaID, fnValidate);
    }
    if (!fnValidate(data)) {
      if (!fnValidate.errors) {
        fnValidate.errors = [];
      }
      const concatenatedErrors: string[] = [];
      for (const validationError of fnValidate.errors) {
        if (validationError.instancePath && validationError.instancePath !== '') {
          concatenatedErrors.push(`Property '${validationError.instancePath}': ${validationError.message}`);
        } else {
          concatenatedErrors.push(`Error: ${validationError.message}`);
        }
      }
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: concatenatedErrors.join(', '),
        module: this.moduleName,
        method: 'validate',
        detailedMessages: { errors: fnValidate.errors, data, schema }
      });
    }
    return data;
  }
}
