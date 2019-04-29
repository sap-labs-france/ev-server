const Ajv = require('ajv');
const BadRequestError = require('../../../exception/BadRequestError');

class SchemaValidator {
  constructor(moduleName, config = {
    allErrors: true,
    removeAdditional: 'all',
    useDefaults: true,
    coerceTypes: true
  }) {
    this.moduleName = moduleName;
    this.ajv = new Ajv(config);
  }

  validate(schema, content) {
    const fnValidate = this.ajv.compile(schema);
    if (!fnValidate(content)) {
      const errors = fnValidate.errors.map((error) => {
        return {
          path: error.dataPath,
          message: error.message
        };
      });

      throw new BadRequestError(errors);
    }
  }
}

module.exports = SchemaValidator;
