import Ajv from 'ajv';
import BadRequestError from '../../../exception/BadRequestError';

export default class SchemaValidator {

  private readonly ajv: Ajv.Ajv;

  constructor(readonly moduleName: string,
    config: {allErrors: boolean, removeAdditional: boolean|"all"|"failing"|undefined,
      useDefaults: boolean, coerceTypes: boolean} = {
    allErrors: true,
    removeAdditional: 'all',
    useDefaults: true,
    coerceTypes: true
  }) {
    this.ajv = new Ajv(config);
  }

  public validate(schema: object, content: any): void {//TODO Why return void & throw error if we can return bool and let error be handled
    const fnValidate = this.ajv.compile(schema);
    if (!fnValidate(content)) {
      if(!fnValidate.errors) {
        fnValidate.errors = [];
      }
      const errors = fnValidate.errors.map((error) => {
        return {
          path: error.dataPath,
          message: error.message?error.message:''
        };
      });
      const concatenatedError = {path: errors.map((e)=>e.path).join(","), message: errors.map((e)=>e.message).join(',')};
      throw new BadRequestError(concatenatedError);
    }//TODO check the error handling here, there's some kind of mistake.
  }
}

module.exports = SchemaValidator;
