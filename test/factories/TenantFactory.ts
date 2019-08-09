import jsf from 'json-schema-faker';
import tenantCreation from '../../src/assets/server/rest/schemas/tenant/tenant-creation.json';
import tenantUpdate from '../../src/assets/server/rest/schemas/tenant/tenant-update.json';

export default class TenantFactory {
  static buildTenantCreate() {
    return jsf.generate(tenantCreation);
  }

  static buildTenantUpdate() {
    return jsf.generate(tenantUpdate);
  }
}
