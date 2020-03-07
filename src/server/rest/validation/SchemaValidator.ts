import Ajv from 'ajv';
import ajvSanitizer from 'ajv-sanitizer';
import sanitize from 'mongo-sanitize';
import AppError from '../../../exception/AppError';
import { HTTPError } from '../../../types/HTTPError';
import Constants from '../../../utils/Constants';

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

  public validate(schema: object, content: any): void {
    const fnValidate = this.ajv.compile(schema);
    if (!fnValidate(content)) {
      if (!fnValidate.errors) {
        fnValidate.errors = [];
      }
      const errors = fnValidate.errors.map((error) => ({
        path: error.dataPath,
        message: error.message ? error.message : ''
      }));
      const concatenatedError = { path: errors.map((e) => e.path).join(','), message: errors.map((e) => e.message).join(',') };
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: concatenatedError.message,
        module: this.moduleName,
        method: 'validate',
        detailedMessages: concatenatedError
      });
    }
  }
}
