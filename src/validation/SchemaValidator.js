import Ajv from 'ajv';
import BadRequestError from '../exception/BadRequestError';
import { CENTRAL_SERVER } from '../utils/Constants';

class SchemaValidator {
    constructor(moduleName) {
        this.moduleName = moduleName;
        this.ajv = new Ajv({
            allErrors: true,
            removeAdditional: 'all'
        });
    }

    validate(schema, content) {
        let fnValidate = this.ajv.compile(schema);
        if (!fnValidate(content)) {
            throw new BadRequestError(CENTRAL_SERVER, "Invalid content", fnValidate.errors, this.moduleName);
        }
    }
}

export default SchemaValidator;