import chai, { expect } from 'chai';

import CentralServerService from '../api/client/CentralServerService';
import Factory from '../factories/Factory';
import TestUtils from './TestUtils';
import chaiSubset from 'chai-subset';
import faker from 'faker';

chai.use(chaiSubset);

class TestData {
  public newTenant: any;
  public superAdminCentralService: any;
}

const testData: TestData = new TestData();

describe('Tenant tests', function() {
  this.timeout(30000);
  before(async () => {
    testData.superAdminCentralService = new CentralServerService('');
  });

  describe('Success cases', () => {
    it('Should be possible to create a valid tenant', async () => {
      // Create
      testData.newTenant = await CentralServerService.defaultInstance.createEntity(
        CentralServerService.defaultInstance.tenantApi, Factory.tenant.build());
    });

    it('Should find the created tenant by id', async () => {
      // Check if the created entity can be retrieved with its id
      await CentralServerService.defaultInstance.getEntityById(
        CentralServerService.defaultInstance.tenantApi, testData.newTenant);
    });

    it('Should find the created tenant in the tenant list', async () => {
      // Check if the created entity is in the list
      await CentralServerService.defaultInstance.checkEntityInList(
        CentralServerService.defaultInstance.tenantApi, testData.newTenant);
    });

    it('Should update the tenant', async () => {
      // Change entity
      // Using faker to avoid duplicated key in DB
      testData.newTenant.name = faker.company.companyName();
      testData.newTenant.address.address1 = 'New Address1';
      // Update
      await CentralServerService.defaultInstance.updateEntity(
        CentralServerService.defaultInstance.tenantApi, testData.newTenant);
    });

    it('Should find the updated tenant by id', async () => {
      // Check if the updated entity can be retrieved with its id
      const updatedTenant = await CentralServerService.defaultInstance.getEntityById(
        CentralServerService.defaultInstance.tenantApi, testData.newTenant);
      // Check
      expect(updatedTenant.name).to.equal(testData.newTenant.name);
    });

    it('Should delete the created tenant', async () => {
      // Temporary workaround to avoid MongoDB issue: Trying to delete a Tenant during index creation leads to an exception like:
      // Cannot perform operation: a background operation is currently running for collection...
      await TestUtils.sleep(1000);
      // Delete the created entity
      await CentralServerService.defaultInstance.deleteEntity(
        CentralServerService.defaultInstance.tenantApi, testData.newTenant);
    });

    it('Should not find the deleted tenant with its id', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      await CentralServerService.defaultInstance.checkDeletedEntityById(
        CentralServerService.defaultInstance.tenantApi, testData.newTenant);
    });
  });

  describe('Error cases', () => {
    it('Should not be possible to read an empty tenant', async () => {
      // Exec
      const response = await CentralServerService.defaultInstance.getEntityById(
        CentralServerService.defaultInstance.tenantApi, { id: '' }, false);
      // Check
      expect(response.status).to.equal(500);
    });

    it('Should not be possible to read an invalid tenant', async () => {
      // Exec
      const response = await CentralServerService.defaultInstance.getEntityById(
        CentralServerService.defaultInstance.tenantApi, { id: 'youAreInvalid' }, false);
      // Check
      expect(response.status).to.equal(500);
    });

    it('Should not be possible to read an unknown tenant', async () => {
      // Exec
      const response = await CentralServerService.defaultInstance.getEntityById(
        CentralServerService.defaultInstance.tenantApi, { id: '123456789012345678901234' }, false);
      // Check
      expect(response.status).to.equal(550);
    });

    it('Should not be possible to create a tenant without email', async () => {
      // Create
      const tenant = Factory.tenant.build();
      delete tenant.email;
      // Call
      const response = await CentralServerService.defaultInstance.createEntity(
        CentralServerService.defaultInstance.tenantApi, tenant, false);
      // Check
      expect(response.status).to.equal(500);
    });

    it('Should not be possible to create a tenant without a name', async () => {
      // Create
      const tenant = Factory.tenant.build();
      delete tenant.name;
      // Call
      const response = await CentralServerService.defaultInstance.createEntity(
        CentralServerService.defaultInstance.tenantApi, tenant, false);
      // Check
      expect(response.status).to.equal(500);
    });

    it('Should not be possible to create a tenant without a subdomain', async () => {
      // Create
      const tenant = Factory.tenant.build();
      delete tenant.subdomain;
      // Call
      const response = await CentralServerService.defaultInstance.createEntity(
        CentralServerService.defaultInstance.tenantApi, tenant, false);
      // Check
      expect(response.status).to.equal(500);
    });

    it('Should not be possible to create a tenant with an empty email', async () => {
      // Create
      const tenant = Factory.tenant.build();
      tenant.email = '';
      // Call
      const response = await CentralServerService.defaultInstance.createEntity(
        CentralServerService.defaultInstance.tenantApi, tenant, false);
      // Check
      expect(response.status).to.equal(500);
    });

    it('Should not be possible to create a tenant with an empty name', async () => {
      // Create
      const tenant = Factory.tenant.build();
      tenant.name = '';
      // Call
      const response = await CentralServerService.defaultInstance.createEntity(
        CentralServerService.defaultInstance.tenantApi, tenant, false);
      // Check
      expect(response.status).to.equal(500);
    });

    it('Should not be possible to create a tenant with an empty subdomain', async () => {
      // Create
      const tenant = Factory.tenant.build();
      tenant.subdomain = '';
      // Call
      const response = await CentralServerService.defaultInstance.createEntity(
        CentralServerService.defaultInstance.tenantApi, tenant, false);
      // Check
      expect(response.status).to.equal(500);
    });

    it('Should not be possible to create a tenant with an invalid email', async () => {
      // Create
      const tenant = Factory.tenant.build();
      tenant.email = 'missingAt';
      // Call
      const response = await CentralServerService.defaultInstance.createEntity(
        CentralServerService.defaultInstance.tenantApi, tenant, false);
      // Check
      expect(response.status).to.equal(500);
    });

    it('Should not be possible to create a tenant with an invalid name', async () => {
      // Create
      const tenant = Factory.tenant.build();
      tenant.name = 'A very long name impossible to store in database - A very long name impossible to store in database - A very long name impossible to store in database';
      // Call
      const response = await CentralServerService.defaultInstance.createEntity(
        CentralServerService.defaultInstance.tenantApi, tenant, false);
      // Check
      expect(response.status).to.equal(500);
    });

    it('Should not be possible to create a tenant with an invalid subdomain', async () => {
      // Create
      const tenant = Factory.tenant.build();
      tenant.subdomain = 'Sub domain';
      // Call
      const response = await CentralServerService.defaultInstance.createEntity(
        CentralServerService.defaultInstance.tenantApi, tenant, false);
      // Check
      expect(response.status).to.equal(500);
    });
  });
});
