import Ajv from 'ajv';
import AppError from '../../../../exception/AppError';
import Constants from '../../../../utils/Constants';
import { HTTPError } from '../../../../types/HTTPError';
import ajvSanitizer from 'ajv-sanitizer';
import fs from 'fs';
import global from '../../../../types/GlobalType';
import sanitize from 'mongo-sanitize';

const extraSanitizers = {
  mongo: (value) => sanitize(value),
};

export default class SchemaValidator {
  private readonly ajv: Ajv.Ajv;
  private _commonSchema: any = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/common/common.json`, 'utf8'));
  private _tenantComponentSchema: any = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-components.json`, 'utf8'));

  constructor(readonly moduleName: string,
    config: {allErrors: boolean; removeAdditional: boolean|'all'|'failing'|undefined;
      useDefaults: boolean; coerceTypes: boolean; } = {
      allErrors: true,
      removeAdditional: 'all',
      useDefaults: true,
      coerceTypes: true
    }) {
    this.ajv = ajvSanitizer(new Ajv(config), extraSanitizers);
    this.ajv.addSchema(this._commonSchema);
    this.ajv.addSchema(this._tenantComponentSchema);
  }

  public validate(schema: boolean|object, content: any): void {
    const fnValidate = this.ajv.compile(schema);
    if (!fnValidate(content)) {
      if (!fnValidate.errors) {
        fnValidate.errors = [];
      }
      const errors = fnValidate.errors.map((error) => ({
        path: error.dataPath,
        message: error.message ? error.message : ''
      }));
      const concatenatedErrors: string[] = [];
      for (const error of errors) {
        if (error.path && error.path !== '') {
          concatenatedErrors.push(`Property '${error.path}': ${error.message}`);
        } else {
          concatenatedErrors.push(`Error: ${error.message}`);
        }
      }
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: concatenatedErrors.join(', '),
        module: this.moduleName,
        method: 'validate',
        detailedMessages: { errors, content, schema }
      });
    }
  }
}
