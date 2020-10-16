import Ajv from 'ajv';
import AppError from '../../../../exception/AppError';
import Constants from '../../../../utils/Constants';
import { HTTPError } from '../../../../types/HTTPError';
import ajvSanitizer from 'ajv-sanitizer';
import sanitize from 'mongo-sanitize';

const extraSanitizers = {
  mongo: (value) => sanitize(value),
};

export default class SchemaValidator {
  private readonly ajv: Ajv.Ajv;

  constructor(readonly moduleName: string,
    config: {allErrors: boolean; removeAdditional: boolean|'all'|'failing'|undefined;
      useDefaults: boolean; coerceTypes: boolean; } = {
      allErrors: true,
      removeAdditional: 'all',
      useDefaults: true,
      coerceTypes: true
    }) {
    this.ajv = ajvSanitizer(new Ajv(config), extraSanitizers);
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
