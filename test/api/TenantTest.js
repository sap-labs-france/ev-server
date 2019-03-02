const path = require('path');
global.appRoot = path.resolve(__dirname, '../../src');
const { expect } = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const CentralServerService = require('./client/CentralServerService');
const TenantFactory = require('../factories/TenantFactory');
const HttpStatus = require('http-status-codes');

describe('Tenant tests', function () {
  this.timeout(30000);

  describe('Success cases', () => {
    it('Should be possible to create a valid tenant', async () => {
      // Create
      this.newTenant = await CentralServerService.createEntity(
        CentralServerService.tenantApi, TenantFactory.buildTenantCreate());
    });

    it('Should find the created tenant by id', async () => {
      // Check if the created entity can be retrieved with its id
      await CentralServerService.getEntityById(
        CentralServerService.tenantApi, this.newTenant);
    });

    it('Should find the created tenant in the tenant list', async () => {
      // Check if the created entity is in the list
      await CentralServerService.checkEntityInList(
        CentralServerService.tenantApi, this.newTenant);
    });

    it('Should update the tenant', async () => {
      // Change entity
      this.newTenant.name = "New Name";
      // Update
      await CentralServerService.updateEntity(
        CentralServerService.tenantApi, this.newTenant);
    });

    it('Should find the updated tenant by id', async () => {
      // Check if the updated entity can be retrieved with its id
      let updatedTenant = await CentralServerService.getEntityById(
        CentralServerService.tenantApi, this.newTenant);
      // Check
      expect(updatedTenant.name).to.equal(this.newTenant.name);
    });

    it('Should be possible to verify an existing tenant', async () => {
      // Exec
      let response = await CentralServerService.tenantApi.verify(this.newTenant.subdomain);
      // Check
      expect(response.status).to.equal(HttpStatus.OK);
    });

    it('Should be possible to verify empty tenant', async () => {
      // Exec
      let response = await CentralServerService.tenantApi.verify('');
      // Check
      expect(response.status).to.equal(HttpStatus.OK);
    });    

    it('Should delete the created tenant', async () => {
      // Delete the created entity
      await CentralServerService.deleteEntity(
        CentralServerService.tenantApi, this.newTenant);
    });

    it('Should not find the deleted tenant with its id', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      await CentralServerService.checkDeletedEntityById(
        CentralServerService.tenantApi, this.newTenant);
    });
  });

  describe('Error cases', () => {
    it('Should not be possible to read an empty tenant', async () => {
      // Exec
      let response = await CentralServerService.getEntityById(
        CentralServerService.tenantApi, {id: ''}, false);
      // Check
      expect(response.status).to.equal(500);
    });

    it('Should not be possible to read an invalid tenant', async () => {
      // Exec
      let response = await CentralServerService.getEntityById(
        CentralServerService.tenantApi, {id: 'youAreInvalid'}, false);
      // Check
      expect(response.status).to.equal(500);
    });

    it('Should not be possible to read an unknown tenant', async () => {
      // Exec
      let response = await CentralServerService.getEntityById(
        CentralServerService.tenantApi, {id: '123456789012345678901234'}, false);
      // Check
      expect(response.status).to.equal(550);
    });

    it('Should not be possible to verify invalid tenant', async () => {
      // Exec
      let response = await CentralServerService.tenantApi.verify('invalid tenant');
      // Check
      expect(response.status).to.equal(550);
    });

    it('Should not be possible to verify an unknown tenant', async () => {
      // Exec
      let response = await CentralServerService.tenantApi.verify('youAreUnknown');
      // Check
      expect(response.status).to.equal(550);
    });

    it('Should not be possible to create a tenant without email', async () => {
      // Create
      let tenant = TenantFactory.buildTenantCreate();
      delete tenant.email;
      // Call
      let response = await CentralServerService.createEntity(
        CentralServerService.tenantApi, tenant, false);
      // Check
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
    });

    it('Should not be possible to create a tenant without a name', async () => {
      // Create
      let tenant = TenantFactory.buildTenantCreate();
      delete tenant.name;
      // Call
      let response = await CentralServerService.createEntity(
        CentralServerService.tenantApi, tenant, false);
      // Check
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
    });

    it('Should not be possible to create a tenant without a name', async () => {
      // Create
      let tenant = TenantFactory.buildTenantCreate();
      delete tenant.subdomain;
      // Call
      let response = await CentralServerService.createEntity(
        CentralServerService.tenantApi, tenant, false);
      // Check
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
    });

    it('Should not be possible to create a tenant with an empty email', async () => {
      // Create
      let tenant = TenantFactory.buildTenantCreate();
      tenant.email = '';
      // Call
      let response = await CentralServerService.createEntity(
        CentralServerService.tenantApi, tenant, false);
      // Check
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
    });

    it('Should not be possible to create a tenant with an empty name', async () => {
      // Create
      let tenant = TenantFactory.buildTenantCreate();
      tenant.name = '';
      // Call
      let response = await CentralServerService.createEntity(
        CentralServerService.tenantApi, tenant, false);
      // Check
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
    });

    it('Should not be possible to create a tenant with an empty subdomain', async () => {
      // Create
      let tenant = TenantFactory.buildTenantCreate();
      tenant.subdomain = '';
      // Call
      let response = await CentralServerService.createEntity(
        CentralServerService.tenantApi, tenant, false);
      // Check
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
    });

    it('Should not be possible to create a tenant with an invalid email', async () => {
      // Create
      let tenant = TenantFactory.buildTenantCreate();
      tenant.email = 'missingAt';
      // Call
      let response = await CentralServerService.createEntity(
        CentralServerService.tenantApi, tenant, false);
      // Check
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
    });

    it('Should not be possible to create a tenant with an invalid name', async () => {
      // Create
      let tenant = TenantFactory.buildTenantCreate();
      tenant.name = 'A very long name impossible to store in database - A very long name impossible to store in database - A very long name impossible to store in database';
      // Call
      let response = await CentralServerService.createEntity(
        CentralServerService.tenantApi, tenant, false);
      // Check
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
    });

    it('Should not be possible to create a tenant with an invalid subdomain', async () => {
      // Create
      let tenant = TenantFactory.buildTenantCreate();
      tenant.subdomain = 'Sub domain';
      // Call
      let response = await CentralServerService.createEntity(
        CentralServerService.tenantApi, tenant, false);
      // Check
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
    });
  });
});