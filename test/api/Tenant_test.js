const {
    expect
} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const CentralServerService = require('./client/CentralServerService');
const TenantFactory = require('../factories/TenantFactory');
const HttpStatus = require('http-status-codes');

describe('Tenant tests', function () {
    this.timeout(10000);

    describe('Tenant Creation', function () {
        it('should be possible to create a valid tenant', async () => {
            let tenant = TenantFactory.buildTenantCreate();
            let response = await CentralServerService.tenant.create(tenant);
            expect(response.status).to.equal(HttpStatus.CREATED);
            expect(response.data.id).to.match(/^[a-f0-9]+$/);
        });

        it('should not be possible to create a tenant without email', async () => {
            let tenant = TenantFactory.buildTenantCreate();
            delete tenant.email;
            let response = await CentralServerService.tenant.create(tenant);
            expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
        });

        it('should not be possible to create a tenant without name', async () => {
            let tenant = TenantFactory.buildTenantCreate();
            delete tenant.name;
            let response = await CentralServerService.tenant.create(tenant);
            expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
        });

        it('should not be possible to create a tenant without subdomain', async () => {
            let tenant = TenantFactory.buildTenantCreate();
            delete tenant.subdomain;
            let response = await CentralServerService.tenant.create(tenant);
            expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
        });

        it('should not be possible to create a tenant with empty email', async () => {
            let tenant = TenantFactory.buildTenantCreate();
            tenant.email = '';
            let response = await CentralServerService.tenant.create(tenant);
            expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
        });

        it('should not be possible to create a tenant with empty name', async () => {
            let tenant = TenantFactory.buildTenantCreate();
            tenant.name = '';
            let response = await CentralServerService.tenant.create(tenant);
            expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
        });

        it('should not be possible to create a tenant with empty subdomain', async () => {
            let tenant = TenantFactory.buildTenantCreate();
            tenant.subdomain = '';
            let response = await CentralServerService.tenant.create(tenant);
            expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
        });

        it('should not be possible to create a tenant with invalid email', async () => {
            let tenant = TenantFactory.buildTenantCreate();
            tenant.email = 'missingAt';
            let response = await CentralServerService.tenant.create(tenant);
            expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
        });

        it('should not be possible to create a tenant with invalid name', async () => {
            let tenant = TenantFactory.buildTenantCreate();
            tenant.name = 'A very long name impossible to store in database';
            let response = await CentralServerService.tenant.create(tenant);
            expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
        });

        it('should not be possible to create a tenant with invalid subdomain', async () => {
            let tenant = TenantFactory.buildTenantCreate();
            tenant.subdomain = 'Sub domain';
            let response = await CentralServerService.tenant.create(tenant);
            expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
        });
    });

    describe('Tenant Verify', function () {
        it('should be possible to verify an existing tenant', async () => {
            let tenant = TenantFactory.buildTenantCreate();
            let response = await CentralServerService.tenant.create(tenant);
            expect(response.status).to.equal(HttpStatus.CREATED);

            response = await CentralServerService.tenantNoAuth.verify(tenant.subdomain);
            expect(response.status).to.equal(HttpStatus.OK);
        });

        it('should be possible to verify empty tenant', async () => {
            let response = await CentralServerService.tenantNoAuth.verify('');
            expect(response.status).to.equal(HttpStatus.OK);
        });

        it('should not be possible to verify invalid tenant', async () => {
            let response = await CentralServerService.tenantNoAuth.verify('invalid tenant');
            expect(response.status).to.equal(HttpStatus.NOT_FOUND);
        });

        it('should not be possible to verify an unknown tenant', async () => {
            let response = await CentralServerService.tenantNoAuth.verify('youAreUnknown');
            expect(response.status).to.equal(HttpStatus.NOT_FOUND);
        });
    })

    describe('Tenant Read', function () {
        it('should be possible to read an existing tenant', async () => {
            let tenant = TenantFactory.buildTenantCreate();
            let response = await CentralServerService.tenant.create(tenant);
            expect(response.status).to.equal(HttpStatus.CREATED);

            let tenantId = response.data.id;
            response = await CentralServerService.tenant.readById(tenantId);
            expect(response.status).to.equal(HttpStatus.OK);
            expect(response.data.id).to.equal(tenantId);
            expect(response.data.name).to.equal(tenant.name);
            expect(response.data.email).to.equal(tenant.email);
            expect(response.data.subdomain).to.equal(tenant.subdomain);
        });

        it('should not be possible to read an empty tenant', async () => {
            response = await CentralServerService.tenant.readById('');
            expect(response.status).to.equal(HttpStatus.BAD_REQUEST);
        });

        it('should not be possible to read an invalid tenant', async () => {
            response = await CentralServerService.tenant.readById('youAreInvalid');
            expect(response.status).to.equal(HttpStatus.INTERNAL_SERVER_ERROR);
        });

        it('should not be possible to read an unknown tenant', async () => {
            response = await CentralServerService.tenant.readById('123456789012345678901234');
            expect(response.status).to.equal(HttpStatus.NOT_FOUND);
        });
    })

    describe('Tenants Read', function () {
        it('should be possible to list existing tenants', async () => {
            let tenant = TenantFactory.buildTenantCreate();
            let response = await CentralServerService.tenant.create(tenant);
            expect(response.status).to.equal(HttpStatus.CREATED);

            response = await CentralServerService.tenant.read(tenant.id);
            expect(response.status).to.equal(HttpStatus.OK);
            expect(response.data.count).to.match(/[0-9]*/);
        });
    })
});