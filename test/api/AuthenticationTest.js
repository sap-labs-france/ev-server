const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const CentralServerService = require('./client/CentralServerService');
const config = require('../config');
const jwt = require('jsonwebtoken');

describe('Authentication Service', () => {
  describe('Success cases', () => {
    before(async () => {
      // Get credentials
      this.adminEmail = config.get('admin.username');
      this.adminPassword = config.get('admin.password');
      this.adminTenant = config.get('admin.tenant');
    });

    it('Should authenticate a registered user', async () => {
      // Check Login
      const response = await CentralServerService.authenticationApi.login(this.adminEmail, this.adminPassword, true, this.adminTenant);
      // Check
      expect(response.status).to.be.eql(200);
      expect(response.data).to.have.property('token');
      expect(response.data.token).to.be.a('string');
      const tenantID = jwt.decode(response.data.token).tenantID;
      const tenant = await CentralServerService.getEntityById(CentralServerService.tenantApi, {id : tenantID});
      expect(tenant).to.have.property('subdomain', this.adminTenant);
    });
  });

  describe('Error cases', () => {
    it('Should not allow authentication of known user with wrong password', async () => {
      // Call
      let response = await CentralServerService.authenticationApi.login(this.adminEmail, 'another', true);
      // Check
      expect(response.status).to.be.eql(550);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow authentication without password', async () => {
      // Call
      let response = await CentralServerService.authenticationApi.login(this.adminEmail, null, true);
      // Check
      expect(response.status).to.be.eql(500);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow authentication not accepting eula', async () => {
      // Call
      let response = await CentralServerService.authenticationApi.login(this.adminEmail, this.adminPassword, false);
      // Check
      expect(response.status).to.be.eql(520);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow authentication without eula', async () => {
      // Call
      let response = await CentralServerService.authenticationApi.login(this.adminEmail, this.adminPassword, null);
      // Check
      expect(response.status).to.be.eql(520);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow authentication without email', async () => {
      // Call
      let response = await CentralServerService.authenticationApi.login(null, this.adminPassword, true);
      // Check
      expect(response.status).to.be.eql(500);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow authentication of unknown email', async () => {
      // Call
      let response = await CentralServerService.authenticationApi.login('unkown@sap.com', this.adminPassword, true);
      expect(response.status).to.be.eql(550);
      expect(response.data).to.not.have.property('token');
    });

    it('should not allow authentication without tenant', async () => {
      let response = await CentralServerService.authenticationApi.login('unkown@sap.com', this.adminPassword, true, null);
      expect(response.status).to.be.eql(500);
      expect(response.data).to.not.have.property('token');
    });

    it('should not allow authentication of unknown tenant', async () => {
      let response = await CentralServerService.authenticationApi.login('unkown@sap.com', this.adminPassword, true, 'unkown');
      expect(response.status).to.be.eql(550);
      expect(response.data).to.not.have.property('token');
    });
  });
});

