const SchemaValidator = require('./SchemaValidator');
const tenantCreation = require('../schemas/tenant/tenant-creation.json');
const tenantUpdate = require('../schemas/tenant/tenant-update.json');

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

module.exports = instance;