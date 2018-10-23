const {
  expect
} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const CentralServerService = require('./client/CentralServerService');
const TenantFactory = require('../factories/TenantFactory');
const HttpStatus = require('http-status-codes');

describe('Tenant tests', function(){
  this.timeout(10000);

  describe('Tenant Creation', function(){
    it('should be possible to create a valid tenant', async () => {
      const tenant = TenantFactory.buildTenantCreate();
      const response = await CentralServerService.tenant.create(tenant);
      expect(response.status).to.equal(HttpStatus.CREATED);
      expect(response.data.id).to.match(/^[a-f0-9]+$/);
    });

    it('should not be possible to create a tenant without email', async () => {
      const tenant = TenantFactory.buildTenantCreate();
      delete tenant.email;
      const response = await CentralServerService.tenant.create(tenant);
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
    });

    it('should not be possible to create a tenant without name', async () => {
      const tenant = TenantFactory.buildTenantCreate();
      delete tenant.name;
      const response = await CentralServerService.tenant.create(tenant);
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
    });

    it('should not be possible to create a tenant without subdomain', async () => {
      const tenant = TenantFactory.buildTenantCreate();
      delete tenant.subdomain;
      const response = await CentralServerService.tenant.create(tenant);
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
    });

    it('should not be possible to create a tenant with empty email', async () => {
      const tenant = TenantFactory.buildTenantCreate();
      tenant.email = '';
      const response = await CentralServerService.tenant.create(tenant);
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
    });

    it('should not be possible to create a tenant with empty name', async () => {
      const tenant = TenantFactory.buildTenantCreate();
      tenant.name = '';
      const response = await CentralServerService.tenant.create(tenant);
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
    });

    it('should not be possible to create a tenant with empty subdomain', async () => {
      const tenant = TenantFactory.buildTenantCreate();
      tenant.subdomain = '';
      const response = await CentralServerService.tenant.create(tenant);
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
    });

    it('should not be possible to create a tenant with invalid email', async () => {
      const tenant = TenantFactory.buildTenantCreate();
      tenant.email = 'missingAt';
      const response = await CentralServerService.tenant.create(tenant);
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
    });

    it('should not be possible to create a tenant with invalid name', async () => {
      const tenant = TenantFactory.buildTenantCreate();
      tenant.name = 'A very long name impossible to store in database';
      const response = await CentralServerService.tenant.create(tenant);
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
    });

    it('should not be possible to create a tenant with invalid subdomain', async () => {
      const tenant = TenantFactory.buildTenantCreate();
      tenant.subdomain = 'Sub domain';
      const response = await CentralServerService.tenant.create(tenant);
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
    });
  });

  describe('Tenant Verify', function(){
    it('should be possible to verify an existing tenant', async () => {
      const tenant = TenantFactory.buildTenantCreate();
      let response = await CentralServerService.tenant.create(tenant);
      expect(response.status).to.equal(HttpStatus.CREATED);

      response = await CentralServerService.tenantNoAuth.verify(tenant.subdomain);
      expect(response.status).to.equal(HttpStatus.OK);
    });

    it('should be possible to verify empty tenant', async () => {
      const response = await CentralServerService.tenantNoAuth.verify('');
      expect(response.status).to.equal(HttpStatus.OK);
    });

    it('should not be possible to verify invalid tenant', async () => {
      const response = await CentralServerService.tenantNoAuth.verify('invalid tenant');
      expect(response.status).to.equal(HttpStatus.NOT_FOUND);
    });

    it('should not be possible to verify an unknown tenant', async () => {
      const response = await CentralServerService.tenantNoAuth.verify('youAreUnknown');
      expect(response.status).to.equal(HttpStatus.NOT_FOUND);
    });
  });

  describe('Tenant Read', function(){
    it('should be possible to read an existing tenant', async () => {
      const tenant = TenantFactory.buildTenantCreate();
      let response = await CentralServerService.tenant.create(tenant);
      expect(response.status).to.equal(HttpStatus.CREATED);

      const tenantId = response.data.id;
      response = await CentralServerService.tenant.readById(tenantId);
      expect(response.status).to.equal(HttpStatus.OK);
      expect(response.data.id).to.equal(tenantId);
      expect(response.data.name).to.equal(tenant.name);
      expect(response.data.email).to.equal(tenant.email);
      expect(response.data.subdomain).to.equal(tenant.subdomain);
    });

    it('should not be possible to read an empty tenant', async () => {
      const response = await CentralServerService.tenant.readById('');
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
    });

    it('should not be possible to read an invalid tenant', async () => {
      const response = await CentralServerService.tenant.readById('youAreInvalid');
      expect(response.status).to.equal(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should not be possible to read an unknown tenant', async () => {
      const response = await CentralServerService.tenant.readById('123456789012345678901234');
      expect(response.status).to.equal(HttpStatus.NOT_FOUND);
    });
  });

  describe('Tenants Read', function(){
    it('should be possible to list existing tenants', async () => {
      const response = await CentralServerService.tenant.read();
      expect(response.status).to.equal(HttpStatus.OK);
      expect(response.data.count).to.match(/[0-9]*/);
    });
  });
});