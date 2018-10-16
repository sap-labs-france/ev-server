const Factory = require('rosie').Factory;
const faker = require('faker');
const jsf = require('json-schema-faker');
const tenantCreation = require('../../src/schemas/tenant/tenant-creation.json');

class TenantFactory {
    buildTenantCreate() {
        return jsf.generate(tenantCreation);
    }
}

module.exports = new TenantFactory();
