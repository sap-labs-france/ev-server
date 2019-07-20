const jsf = require('json-schema-faker');
const tenantCreation = require('../../src/assets/server/rest/schemas/tenant/tenant-creation.json');
const tenantUpdate = require('../../src/assets/server/rest/schemas/tenant/tenant-update.json');

class TenantFactory {
  static buildTenantCreate() {
    return jsf.generate(tenantCreation);
  }

  static buildTenantUpdate() {
    return jsf.generate(tenantUpdate);
  }
}

module.exports = TenantFactory;
