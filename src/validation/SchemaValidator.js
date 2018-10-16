import Ajv from 'ajv';
import BadRequestError from '../exception/BadRequestError';

class SchemaValidator {
    constructor(moduleName) {
        this.moduleName = moduleName;
        this.ajv = new Ajv({
            allErrors: true,
            removeAdditional: 'all',
            useDefaults: true
        });
    }

    validate(schema, content) {
        let fnValidate = this.ajv.compile(schema);
        if (!fnValidate(content)) {
            throw new BadRequestError(fnValidate.errors);
        }
    }
}

export default SchemaValidator;