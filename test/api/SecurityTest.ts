import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import Tenant from '../types/Tenant';
import TestConstants from './client/utils/TestConstants';
import TestData from './client/utils/TestData';
import config from '../config';
import { expect } from 'chai';
import global from '../../src/types/GlobalType';

const testData: TestData = new TestData();
let initialTenant: Tenant;

describe('Security tests', function() {
  this.timeout(30000);

  before(async function() {
    global.database = new MongoDBStorage(config.get('storage'));
    await global.database.start();

    // Init values
    testData.superCentralService = new CentralServerService(null, { email: config.get('superadmin.username'), password: config.get('superadmin.password') });
    testData.centralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS, { email: config.get('admin.username'), password: config.get('admin.password') });
    testData.credentials.email = config.get('admin.username');
    // Retrieve the tenant id from the name
    const response = await testData.superCentralService.tenantApi.readAll({ 'Search' : ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS }, { limit: TestConstants.UNLIMITED, skip: 0 });
    testData.credentials.tenantId = response ? response.data.result[0].id : '';
    initialTenant = (await testData.superCentralService.tenantApi.readById(testData.credentials.tenantId)).data;
  });

  describe('Success cases (tenant utall)', () => {
    it.only('Dummy Test', () => {
      expect(1).to.equal(1);
    });
  });
});
