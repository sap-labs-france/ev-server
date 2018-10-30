const jsf = require('json-schema-faker');
const tenantCreation = require('../../src/server/front-end/schemas/tenant/tenant-creation.json');
const tenantUpdate = require('../../src/server/front-end/schemas/tenant/tenant-update.json');

class TenantFactory {
  static buildTenantCreate(){
    return jsf.generate(tenantCreation);
  }

  static buildTenantUpdate(){
    return jsf.generate(tenantUpdate);
  }
}

module.exports = TenantFactory;
