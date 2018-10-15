import SchemaValidator from './SchemaValidator';
import tenantCreation from '../schemas/tenant/tenant-creation.json';

class TenantValidator extends SchemaValidator{

    constructor() {
        if (!TenantValidator.instance) {
            super("TenantValidator");
            TenantValidator.instance = this;
        }

        return TenantValidator.instance;
    }

    validateTenantCreation(content) {
        this.validate(tenantCreation, content);
    }
}

const instance = new TenantValidator();
Object.freeze(instance);

export default instance;