import Ajv from 'ajv';
import AppError from '../../../exception/AppError';
import Constants from '../../../utils/Constants';
import HttpStatus from 'http-status-codes';

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
    this.ajv = new Ajv(config);
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
      throw new AppError(
        Constants.CENTRAL_SERVER,
        concatenatedError.message, Constants.HTTP_GENERAL_ERROR,
        this.moduleName, 'validate', null, null, 'validate', concatenatedError);
    }
  }
}
