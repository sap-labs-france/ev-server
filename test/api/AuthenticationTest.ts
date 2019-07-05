import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import config from '../config';
import jwt from 'jsonwebtoken';
import CentralServerService from './client/CentralServerService';
import UserFactory from '../factories/UserFactory';

const testData: any = {};

chai.use(chaiSubset);

describe('Authentication Service', function() {
  this.timeout(5000);

  before(() => {
    // Get credentials
    testData.adminEmail = config.get('admin.username');
    testData.adminPassword = config.get('admin.password');
    testData.superAdminEmail = config.get('superadmin.username');
    testData.superAdminPassword = config.get('superadmin.password');
    testData.adminTenant = config.get('admin.tenant');
  });

  describe('Success cases', () => {
    it('Should authenticate a registered user', async () => {
      // Check Login
      const response = await CentralServerService.DefaultInstance.authenticationApi.login(
        testData.adminEmail, testData.adminPassword, true, testData.adminTenant);
      // Check
      expect(response.status).to.be.eql(200);
      expect(response.data).to.have.property('token');
      expect(response.data.token).to.be.a('string');
      const centralServiceSuperAdmin = new CentralServerService(testData.adminEmail, { email: testData.superAdminEmail, password: testData.superAdminPassword });
      const tenantID = jwt.decode(response.data.token)['tenantID'];
      const tenant = await centralServiceSuperAdmin.getEntityById(centralServiceSuperAdmin.tenantApi, { id: tenantID });
      expect(tenant).to.have.property('subdomain', testData.adminTenant);
    });

    it('Should be possible to register a new user', async () => {
      // Check Login
      const newUser = UserFactory.buildRegisterUser();
      let response = await CentralServerService.DefaultInstance.authenticationApi.registerUser(newUser, testData.adminTenant);
      // Check
      expect(response.status).to.be.eql(200);
      expect(response.data).to.have.property('status', 'Success');

      response = await CentralServerService.DefaultInstance.userApi.getByEmail(newUser.email);
      expect(response.status).to.be.eql(200);
      expect(response.data).to.have.property('count', 1);
      const user = response.data.result[0];
      expect(user).to.have.property('email', newUser.email);
      expect(user).to.have.property('name', newUser.name);
      expect(user).to.have.property('firstName', newUser.firstName);
      expect(user).to.have.property('status', 'P');
      expect(user).to.have.property('role', 'B');
    });

    it('Should be possible to register a new user', async () => {
      const newUser = UserFactory.buildRegisterUser();
      let response = await CentralServerService.DefaultInstance.authenticationApi.registerUser(newUser, testData.adminTenant);
      // Check
      expect(response.status).to.be.eql(200);
      expect(response.data).to.have.property('status', 'Success');

      response = await CentralServerService.DefaultInstance.userApi.getByEmail(newUser.email);
      expect(response.status).to.be.eql(200);
      expect(response.data).to.have.property('count', 1);
      const user = response.data.result[0];
      expect(user).to.have.property('email', newUser.email);
      expect(user).to.have.property('name', newUser.name);
      expect(user).to.have.property('firstName', newUser.firstName);
      expect(user).to.have.property('status', 'P');
      expect(user).to.have.property('role', 'B');
    });

    it('Should be possible to reset a user password', async () => {
      const newUser = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.userApi, UserFactory.build());

      const response = await CentralServerService.DefaultInstance.authenticationApi.resetUserPassword(newUser.email, testData.adminTenant);
      // Check
      expect(response.status).to.be.eql(200);
      expect(response.data).to.have.property('status', 'Success');
    });
  });

  describe('Error cases', () => {
    it('Should not allow authentication of known user with wrong password', async () => {
      // Call
      const response = await CentralServerService.DefaultInstance.authenticationApi.login(testData.adminEmail, 'another', true);
      // Check
      console.log(response);
      expect(response.status).to.be.eql(550);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow authentication without password', async () => {
      // Call
      const response = await CentralServerService.DefaultInstance.authenticationApi.login(
        testData.adminEmail, null, true, testData.adminTenant);
      // Check
      expect(response.status).to.be.eql(500);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow authentication not accepting eula', async () => {
      // Call
      const response = await CentralServerService.DefaultInstance.authenticationApi.login(
        testData.adminEmail, testData.adminPassword, false, testData.adminTenant);
      // Check
      expect(response.status).to.be.eql(520);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow authentication without eula', async () => {
      // Call
      const response = await CentralServerService.DefaultInstance.authenticationApi.login(
        testData.adminEmail, testData.adminPassword, null, testData.adminTenant);
      // Check
      expect(response.status).to.be.eql(520);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow authentication without email', async () => {
      // Call
      const response = await CentralServerService.DefaultInstance.authenticationApi.login(
        null, testData.adminPassword, true, testData.adminTenant);
      // Check
      expect(response.status).to.be.eql(500);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow authentication of unknown email', async () => {
      // Call
      const response = await CentralServerService.DefaultInstance.authenticationApi.login('unknown@sap.com', testData.adminPassword, true);
      expect(response.status).to.be.eql(550);
      expect(response.data).to.not.have.property('token');
    });

    it('should not allow authentication without tenant', async () => {
      const response = await CentralServerService.DefaultInstance.authenticationApi.login('unknown@sap.com', testData.adminPassword, true, null);
      expect(response.status).to.be.eql(550);
      expect(response.data).to.not.have.property('token');
    });

    it('should not allow authentication of unknown tenant', async () => {
      const response = await CentralServerService.DefaultInstance.authenticationApi.login('unknown@sap.com', testData.adminPassword, true, 'unknown');
      expect(response.status).to.be.eql(550);
      expect(response.data).to.not.have.property('token');
    });
  });
});

