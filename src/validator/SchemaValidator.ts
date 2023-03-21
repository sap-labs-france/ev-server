import Ajv, { Options, SchemaObjCxt, ValidateFunction } from 'ajv';
import { AnySchemaObject, DataValidateFunction, DataValidationCxt } from 'ajv/dist/types';

import AppError from '../exception/AppError';
import Constants from '../utils/Constants';
import { ObjectId } from 'mongodb';
import Schema from '../types/validator/Schema';
import { StatusCodes } from 'http-status-codes';
import _ from 'lodash';
import addFormats from 'ajv-formats';
import chalk from 'chalk';
import countries from 'i18n-iso-countries';
import fs from 'fs';
import global from '../types/GlobalType';
import keywords from 'ajv-keywords';
import sanitize from 'mongo-sanitize';

// AJV Format in JSon Schema: https://github.com/ajv-validator/ajv-formats
// AJV Custom Keywords: https://github.com/ajv-validator/ajv-keywords

export default class SchemaValidator {
  private static commonSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/common/common.json`, 'utf8'));
  private static tenantSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/tenant/tenant.json`, 'utf8'));
  private static tenantComponentSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/tenant/tenant-components.json`, 'utf8'));
  private static chargingStationSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/chargingstation/chargingstation.json`, 'utf8'));
  private static chargingStationProfileSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/chargingstation/chargingstation-profile.json`, 'utf8'));
  private static chargingStationTemplateSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/chargingstation/chargingstation-template.json`, 'utf8'));
  private static tagSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/tag/tag.json`, 'utf8'));
  private static transactionSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/transaction/transaction.json`, 'utf8'));
  private static userSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/user/user.json`, 'utf8'));
  private static carSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/car/car.json`, 'utf8'));
  private static assetSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/asset/asset.json`, 'utf8'));
  private static companySchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/company/company.json`, 'utf8'));
  private static ocpiEndpointSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/ocpi/ocpi-endpoint.json`, 'utf8'));
  private static pricingDefinitionSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/pricing/pricing-definition.json`, 'utf8'));
  private static oicpEndpointSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/oicp/oicp-endpoint.json`, 'utf8'));
  private static settingSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/setting/setting.json`, 'utf8'));
  private static registrationTokenSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/registration-token/registration-token.json`, 'utf8'));
  private static siteAreasSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/site-area/site-area.json`, 'utf8'));
  private static siteSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/site/site.json`, 'utf8'));
  private static billingAccountSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/schemas/billing/billing-account.json`, 'utf8'));

  protected moduleName: string;
  private readonly ajv: Ajv;

  protected constructor(moduleName: string,
      config: Options = {
        strict: false, // When 'true', it fails with anyOf required fields: https://github.com/ajv-validator/ajv/issues/1571
        allErrors: false,
        removeAdditional: 'all', // Careful with 'All' and usage of anyOf/oneOf/allOf: https://github.com/ajv-validator/ajv/issues/1784
        allowUnionTypes: true,
        useDefaults: true,
        coerceTypes: true,
        verbose: false,
      }) {
    this.moduleName = moduleName;
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
    this.ajv.addSchema([
      SchemaValidator.commonSchema,
      SchemaValidator.tenantSchema,
      SchemaValidator.tenantComponentSchema,
      SchemaValidator.chargingStationSchema,
      SchemaValidator.chargingStationProfileSchema,
      SchemaValidator.chargingStationTemplateSchema,
      SchemaValidator.tagSchema,
      SchemaValidator.transactionSchema,
      SchemaValidator.userSchema,
      SchemaValidator.carSchema,
      SchemaValidator.assetSchema,
      SchemaValidator.companySchema,
      SchemaValidator.ocpiEndpointSchema,
      SchemaValidator.pricingDefinitionSchema,
      SchemaValidator.oicpEndpointSchema,
      SchemaValidator.settingSchema,
      SchemaValidator.registrationTokenSchema,
      SchemaValidator.siteAreasSchema,
      SchemaValidator.siteSchema,
      SchemaValidator.billingAccountSchema
    ]);
  }

  protected validate(schema: Schema, data: any, cloneObject = false): any {
    if (cloneObject) {
      data = this.cloneObject(data);
    }
    let fnValidate: ValidateFunction<unknown>;
    if (!schema.$id) {
      if (this.isDevelopmentEnv()) {
        this.logConsoleError('====================================');
        this.logConsoleError('Missing schema ID:');
        this.logConsoleError(JSON.stringify(schema));
        this.logConsoleError('====================================');
      }
      // Not cached: Compile schema
      fnValidate = this.ajv.compile(schema);
    } else {
      // Get schema from cache
      fnValidate = this.ajv.getSchema(schema['$id'] as string);
      if (!fnValidate) {
        // Add it to cache
        this.ajv.addSchema(schema);
        // Get compile schema
        fnValidate = this.ajv.getSchema(schema['$id'] as string);
      }
    }
    // Keep the original version for checking missing props after
    const originalSchema = this.serializeOriginalSchema(data);
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
        errorCode: StatusCodes.BAD_REQUEST,
        message: concatenatedErrors.join(', '),
        module: this.moduleName,
        method: 'validate',
        detailedMessages: { errors: fnValidate.errors, data, schema }
      });
    }
    // Check for missing fields in Authorization Definition (not possible to make AJV failing on missing fields)
    this.checkOriginalSchema(originalSchema, data);
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
          // Convert to Date
          if (data && schema === 'date') {
            dataValidationCxt.parentData[dataValidationCxt.parentDataProperty] = new Date(data);
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

  private serializeOriginalSchema(originalSchema: Record<string, unknown>): string {
    // Check for schema missing vars
    if (this.isDevelopmentEnv()) {
      return JSON.stringify(originalSchema);
    }
  }

  private checkOriginalSchema(originalSchema: string, validatedSchema: any): void {
    if (this.isDevelopmentEnv() && originalSchema !== JSON.stringify(validatedSchema)) {
      this.logConsoleError('====================================');
      this.logConsoleError('Data changed after schema validation');
      this.logConsoleError('Original Data:');
      this.logConsoleError(originalSchema);
      this.logConsoleError('Validated Data:');
      this.logConsoleError(JSON.stringify(validatedSchema));
      this.logConsoleError('====================================');
    }
  }

  // Dup method: Avoid circular deps with Utils class
  // src/validator/SchemaValidator.ts -> src/utils/Utils.ts -> src/utils/Cypher.ts -> src/storage/mongodb/SettingStorage.ts -> src/utils/Logging.ts -> src/storage/mongodb/PerformanceStorage.ts -> src/storage/mongodb/validator/PerformanceValidatorStorage.ts -> src/validator/SchemaValidator.ts
  private isDevelopmentEnv(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  // Created to avoid circular dependency
  private logConsoleError(message: string): void {
    console.error(chalk.red(`${new Date().toLocaleString()} - ${message}`));
  }

  // Ducplicated cloneObject method from Utils class to avoid circular deps
  // src/validator/SchemaValidator.ts -> src/utils/Utils.ts -> src/utils/Configuration.ts -> src/storage/validator/ConfigurationValidatorStorage.ts -> src/validator/SchemaValidator.ts
  private cloneObject<T>(object: T): T {
    if (!object) {
      return object;
    }
    return _.cloneDeep(object);
  }
}
