import SchemaValidator from './SchemaValidator';
import tenantCreation from '../schemas/tenant/tenant-creation.json';
import tenantUpdate from '../schemas/tenant/tenant-update.json';

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

    validateTenantUpdate(content) {
        this.validate(tenantUpdate, content);
    }
}

const instance = new TenantValidator();
Object.freeze(instance);

export default instance;