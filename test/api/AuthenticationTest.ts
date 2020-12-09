import chai, { expect } from 'chai';

import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import User from '../types/User';
import UserFactory from '../factories/UserFactory';
import chaiSubset from 'chai-subset';
import config from '../config';
import jwt from 'jsonwebtoken';

chai.use(chaiSubset);

const testData = {
  adminEmail: null,
  adminPassword: null,
  superAdminEmail: null,
  superAdminPassword: null,
  adminTenant: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS,
  createdUsersAdminTenant: [],
  centralServiceDefaultTenant: null,
  createdUsersDefaultTenant: []
};

describe('Authentication Service (tenant utall)', function() {
  this.timeout(50000);

  before(() => {
    // Get credentials
    testData.adminEmail = config.get('admin.username');
    testData.adminPassword = config.get('admin.password');
    testData.superAdminEmail = config.get('superadmin.username');
    testData.superAdminPassword = config.get('superadmin.password');
  });

  after(() => {
    // Delete all created users again
    if (testData.centralServiceDefaultTenant) {
      testData.createdUsersDefaultTenant.forEach(async (user) => {
        await testData.centralServiceDefaultTenant.userApi.delete(user.id);
      });
    }
    testData.createdUsersAdminTenant.forEach(async (user) => {
      await CentralServerService.defaultInstance.userApi.delete(user.id);
    });
  });

  describe('Success cases', () => {
    it('Should authenticate a registered user', async () => {
      // Check Login
      const response = await CentralServerService.defaultInstance.authenticationApi.login(
        testData.adminEmail, testData.adminPassword, true, testData.adminTenant);
      // Check
      expect(response.status).to.be.eql(200);
      expect(response.data).to.have.property('token');
      expect(response.data.token).to.be.a('string');
      const centralServiceSuperAdmin = new CentralServerService(testData.adminEmail, {
        email: testData.superAdminEmail,
        password: testData.superAdminPassword
      });
      const tenantID = jwt.decode(response.data.token)['tenantID'];
      const tenant = await centralServiceSuperAdmin.getEntityById(centralServiceSuperAdmin.tenantApi, { id: tenantID });
      expect(tenant).to.have.property('subdomain', testData.adminTenant);
    });

    it('Should be possible to register a new user', async () => {
      // Check Login
      const newUser = UserFactory.buildRegisterUser();
      let response = await CentralServerService.defaultInstance.authenticationApi.registerUser(newUser, testData.adminTenant);
      // Check
      expect(response.status).to.be.eql(200);
      expect(response.data).to.have.property('status', 'Success');
      testData.createdUsersAdminTenant.push(newUser);

      response = await CentralServerService.defaultInstance.userApi.getByEmail(newUser.email);
      expect(response.status).to.be.eql(200);
      expect(response.data).to.have.property('count', 1);
      const user: User = response.data.result[0];
      response = await CentralServerService.defaultInstance.userApi.readTags({ UserID: user.id });
      expect(response.status).to.be.eql(200);
      expect(response.data).to.have.property('count', 1);
      expect(response.data.result).to.have.lengthOf(1);
      expect(user).to.have.property('email', newUser.email);
      expect(user).to.have.property('name', newUser.name);
      expect(user).to.have.property('firstName', newUser.firstName);
      expect(user).to.have.property('status', 'P');
      expect(user).to.have.property('role', 'B');
      expect(user).to.have.property('locale', 'en_US');
      expect(user.eulaAcceptedHash).to.not.be.null;
      expect(user.eulaAcceptedOn).to.not.be.null;
      expect(user.eulaAcceptedVersion).to.not.be.null;
      expect(user.eulaAcceptedVersion).to.be.above(0);
      expect(user.createdBy).to.be.null;
      expect(user.createdOn).to.not.be.null;
    });


    it('Should be able to update the registered user', async () => {
      let response = await CentralServerService.defaultInstance.userApi.getByEmail(testData.createdUsersAdminTenant[0].email);
      expect(response.status).to.be.eql(200);
      expect(response.data).to.have.property('count', 1);
      const user: User = response.data.result[0];
      // Change entity
      user.name = 'NEW NAME';
      // Update
      response = await CentralServerService.defaultInstance.userApi.update(user);
      // Check
      expect(response.status).to.equal(200);
      expect(response.data.status).to.eql('Success');
    });

    it('Should be possible to register a new user on the default tenant', async () => {
      const newUser = UserFactory.buildRegisterUser();
      let response = await CentralServerService.defaultInstance.authenticationApi.registerUser(newUser, null);
      // Check
      expect(response.status).to.be.eql(200);
      expect(response.data).to.have.property('status', 'Success');

      testData.centralServiceDefaultTenant = new CentralServerService('',
        {
          email: testData.superAdminEmail,
          password: testData.superAdminPassword
        },
        {
          email: testData.superAdminEmail,
          password: testData.superAdminPassword
        });
      response = await testData.centralServiceDefaultTenant.userApi.getByEmail(newUser.email);
      expect(response.status).to.be.eql(200);
      expect(response.data).to.have.property('count', 1);
      const user = response.data.result[0];
      testData.createdUsersDefaultTenant.push(user);
      expect(user).to.have.property('email', newUser.email);
      expect(user).to.have.property('name', newUser.name);
      expect(user).to.have.property('firstName', newUser.firstName);
      expect(user).to.have.property('status', 'P');
      expect(user).to.have.property('role', 'S');
    });

    it('Should be possible to reset a user password', async () => {
      const newUser = await CentralServerService.defaultInstance.createEntity(
        CentralServerService.defaultInstance.userApi, UserFactory.build());
      testData.createdUsersAdminTenant.push(newUser);
      const response = await CentralServerService.defaultInstance.authenticationApi.resetUserPassword(newUser.email, testData.adminTenant);
      // Check
      expect(response.status).to.be.eql(200);
      expect(response.data).to.have.property('status', 'Success');
    });

    // pragma it('Should be logged off when the locale is updated', async () => {
    //   const newUser = await CentralServerService.defaultInstance.createEntity(
    //     CentralServerService.defaultInstance.userApi, UserFactory.build());
    //   testData.createdUsersAdminTenant.push(newUser);
    //   const userAPI = new CentralServerService(testData.adminTenant, {
    //     email: newUser.email,
    //     password: newUser.passwords.password
    //   });
    //   let validResponse = await userAPI.userApi.readById(newUser.id);
    //   // Check
    //   expect(validResponse.status).to.be.eql(HttpStatus.OK);
    //   expect(validResponse.data.id).to.be.eql(newUser.id);

    //   newUser.locale = 'fr_FR';
    //   await CentralServerService.defaultInstance.updateEntity(
    //     CentralServerService.defaultInstance.userApi, newUser);

    //   await Utils.sleep(1000);

    //   const forbiddenResponse = await userAPI.userApi.readById(newUser.id);
    //   expect(forbiddenResponse.status).to.be.eql(HttpStatus.FORBIDDEN);
    //   expect(forbiddenResponse.data.message).to.equal('User has been updated and will be logged off');

    //   await userAPI.reconnect();

    //   validResponse = await userAPI.userApi.readById(newUser.id);
    //   expect(validResponse.status).to.be.eql(HttpStatus.OK);
    //   expect(validResponse.data.id).to.be.eql(newUser.id);
    // });

    // it('Should be logged off when the tags are updated', async () => {
    //   const newUser = await CentralServerService.defaultInstance.createEntity(
    //     CentralServerService.defaultInstance.userApi, UserFactory.build());
    //   testData.createdUsersAdminTenant.push(newUser);
    //   const userAPI = new CentralServerService(testData.adminTenant, {
    //     email: newUser.email,
    //     password: newUser.passwords.password
    //   });
    //   let validResponse = await userAPI.userApi.readById(newUser.id);
    //   // Check
    //   expect(validResponse.status).to.be.eql(HttpStatus.OK);
    //   expect(validResponse.data.id).to.be.eql(newUser.id);

    //   const tag1 = faker.random.alphaNumeric(8).toUpperCase();
    //   const tag2 = faker.random.alphaNumeric(7).toUpperCase();

    //   newUser.tagIDs = [tag1, tag2];
    //   await CentralServerService.defaultInstance.updateEntity(
    //     CentralServerService.defaultInstance.userApi, newUser);

    //   await Utils.sleep(1000);

    //   const forbiddenResponse = await userAPI.userApi.readById(newUser.id);
    //   expect(forbiddenResponse.status).to.be.eql(HttpStatus.FORBIDDEN);
    //   expect(forbiddenResponse.data.message).to.equal('User has been updated and will be logged off');

    //   await userAPI.reconnect();

    //   validResponse = await userAPI.userApi.readById(newUser.id);
    //   expect(validResponse.status).to.be.eql(HttpStatus.OK);
    //   expect(validResponse.data.id).to.be.eql(newUser.id);

    //   // Same list in a different order
    //   newUser.tagIDs = [tag2, tag1];
    //   await CentralServerService.defaultInstance.updateEntity(
    //     CentralServerService.defaultInstance.userApi, newUser);

    //   await Utils.sleep(1000);

    //   validResponse = await userAPI.userApi.readById(newUser.id);
    //   expect(validResponse.status).to.be.eql(HttpStatus.OK);
    //   expect(validResponse.data.id).to.be.eql(newUser.id);
    // });
  });

  describe('Error cases', () => {
    it('Should not allow authentication of known user with wrong password', async () => {
      // Call
      const response = await CentralServerService.defaultInstance.authenticationApi.login(testData.adminEmail, 'another', true);
      // Check
      expect(response.status).to.be.eql(550);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow authentication without password', async () => {
      // Call
      const response = await CentralServerService.defaultInstance.authenticationApi.login(
        testData.adminEmail, null, true, testData.adminTenant);
      // Check
      expect(response.status).to.be.eql(500);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow authentication not accepting eula', async () => {
      // Call
      const response = await CentralServerService.defaultInstance.authenticationApi.login(
        testData.adminEmail, testData.adminPassword, false, testData.adminTenant);
      // Check
      expect(response.status).to.be.eql(520);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow authentication without eula', async () => {
      // Call
      const response = await CentralServerService.defaultInstance.authenticationApi.login(
        testData.adminEmail, testData.adminPassword, null, testData.adminTenant);
      // Check
      expect(response.status).to.be.eql(520);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow authentication without email', async () => {
      // Call
      const response = await CentralServerService.defaultInstance.authenticationApi.login(
        null, testData.adminPassword, true, testData.adminTenant);
      // Check
      expect(response.status).to.be.eql(500);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow authentication of unknown email', async () => {
      // Call
      const response = await CentralServerService.defaultInstance.authenticationApi.login('unknown@sap.com', testData.adminPassword, true);
      expect(response.status).to.be.eql(550);
      expect(response.data).to.not.have.property('token');
    });

    it('should not allow authentication without tenant', async () => {
      const response = await CentralServerService.defaultInstance.authenticationApi.login('unknown@sap.com', testData.adminPassword, true, null);
      expect(response.status).to.be.eql(550);
      expect(response.data).to.not.have.property('token');
    });

    it('should not allow authentication of unknown tenant', async () => {
      const response = await CentralServerService.defaultInstance.authenticationApi.login('unknown@sap.com', testData.adminPassword, true, 'unknown');
      expect(response.status).to.be.eql(550);
      expect(response.data).to.not.have.property('token');
    });

    it('should not be possible to verify email for the Super Tenant', async () => {
      const response = await CentralServerService.defaultInstance.authenticationApi.verifyEmail('unknown@sap.com', 'unknownVerificationToken', '');
      expect(response.status).to.be.eql(500);
      expect(response.data.message).to.be.eq('Cannot verify email in the Super Tenant');
    });

    it('should not be possible to request verification email for the Super Tenant', async () => {
      const response = await CentralServerService.defaultInstance.authenticationApi.resendVerificationEmail('unknown@sap.com', '');
      expect(response.status).to.be.eql(500);
      expect(response.data.message).to.be.eq('Cannot request a verification Email in the Super Tenant');
    });
  });
});

