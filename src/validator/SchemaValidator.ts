import Ajv, { Options, SchemaObjCxt, ValidateFunction } from 'ajv';
import { AnySchemaObject, DataValidateFunction, DataValidationCxt } from 'ajv/dist/types';

import AppError from '../exception/AppError';
import Constants from '../utils/Constants';
import { HTTPError } from '../types/HTTPError';
import { ObjectId } from 'mongodb';
import Schema from '../types/validator/Schema';
import Utils from '../utils/Utils';
import addFormats from 'ajv-formats';
import countries from 'i18n-iso-countries';
import fs from 'fs';
import global from '../types/GlobalType';
import keywords from 'ajv-keywords';
import sanitize from 'mongo-sanitize';

// AJV Format in JSon Schema: https://github.com/ajv-validator/ajv-formats
// AJV Custom Keywords: https://github.com/ajv-validator/ajv-keywords

export default class SchemaValidator {
  private static compiledSchemas = new Map<string, ValidateFunction<unknown>>();
  private readonly ajv: Ajv;
  private commonSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/common/common.json`, 'utf8'));
  private tenantSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/tenant/tenant.json`, 'utf8'));
  private tenantComponentSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/tenant/tenant-components.json`, 'utf8'));
  private chargingStationSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/chargingstation/chargingstation.json`, 'utf8'));
  private tagSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/tag/tag.json`, 'utf8'));
  private transactionSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/transaction/transaction.json`, 'utf8'));
  private userSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/user/user.json`, 'utf8'));
  private carSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/car/car.json`, 'utf8'));
  private assetSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/asset/asset.json`, 'utf8'));
  private companySchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/company/company.json`, 'utf8'));
  private ocpiEndpointSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/ocpi/ocpi-endpoint.json`, 'utf8'));

  constructor(readonly moduleName: string,
      config: Options = {
        strict: false, // When 'true', it fails with anyOf required fields: https://github.com/ajv-validator/ajv/issues/1571
        allErrors: true,
        removeAdditional: 'all', // Careful with 'All' and usage of anyOf/oneOf/allOf: https://github.com/ajv-validator/ajv/issues/1784
        allowUnionTypes: true,
        useDefaults: true,
        coerceTypes: true,
        verbose: true,
      }) {
    // Create AJV
    this.ajv = new Ajv(config);
    // Add keywords
    keywords(this.ajv);
    // Add format keywords
    addFormats(this.ajv);
    // Add custom keywords
    this.addCustomKeywords();
    // Add custom Formatter
    this.addCustomFormatters();
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

  protected validate(schemaID: string, schema: Schema, data: Record<string, unknown>): any {
    // Get schema from cache
    let fnValidate = SchemaValidator.compiledSchemas.get(schemaID);
    if (!fnValidate) {
      // Compile schema
      fnValidate = this.ajv.compile(schema);
      // Add it to cache
      SchemaValidator.compiledSchemas.set(schemaID, fnValidate);
    }
    // Keep the original version for checking missing props after
    const originalSchema = Utils.serializeOriginalSchema(data);
    // Run validation
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
    // Check for missing fields in Authorization Definition (not possible to make AJV failing on missing fields)
    Utils.checkOriginalSchema(originalSchema, data);
    return data;
  }

  private addCustomKeywords(): void {
    // Add MongoDB sanitizer keyword
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
    // Add MongoDB sanitizer
    this.ajv.addKeyword({
      keyword: 'customType',
      compile(schema: any, parentSchema: AnySchemaObject, it: SchemaObjCxt): DataValidateFunction {
        return (data: string, dataValidationCxt: DataValidationCxt): boolean => {
          // Convert to Mongo ObjectID
          if (data && schema === 'objectId') {
            dataValidationCxt.parentData[dataValidationCxt.parentDataProperty] = new ObjectId(data);
          }
          return true;
        };
      },
    });
  }

  private addCustomFormatters() {
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
  }
}
