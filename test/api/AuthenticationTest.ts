import chai, { expect } from 'chai';

import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import { HTTPError } from '../../src/types/HTTPError';
import { StatusCodes } from 'http-status-codes';
import User from '../../src/types/User';
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

describe('Authentication Service (utall)', () => {
  jest.setTimeout(60000);

  beforeAll(() => {
    // Get credentials
    testData.adminEmail = config.get('admin.username');
    testData.adminPassword = config.get('admin.password');
    testData.superAdminEmail = config.get('superadmin.username');
    testData.superAdminPassword = config.get('superadmin.password');
  });

  afterAll(async () => {
    // Delete all created users again
    if (testData.centralServiceDefaultTenant) {
      for (const user of testData.createdUsersDefaultTenant) {
        await testData.centralServiceDefaultTenant.userApi.delete(user.id);
      }
    }
    for (const user of testData.createdUsersAdminTenant) {
      await CentralServerService.defaultInstance.userApi.delete(user.id);
    }
  });

  describe('Success cases', () => {
    it('Should authenticate a registered user', async () => {
      // Check Login
      const response = await CentralServerService.defaultInstance.authenticationApi.login(
        testData.adminEmail, testData.adminPassword, true, testData.adminTenant);
      expect(response.status).to.be.eql(StatusCodes.OK);
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
      expect(response.status).to.be.eql(StatusCodes.OK);
      expect(response.data).to.have.property('status', 'Success');
      testData.createdUsersAdminTenant.push(newUser);

      response = await CentralServerService.defaultInstance.userApi.getByEmail(newUser.email);
      expect(response.status).to.be.eql(StatusCodes.OK);
      expect(response.data).to.have.property('count', 1);
      const user: User = response.data.result[0];
      response = await CentralServerService.defaultInstance.tagApi.readTags({ UserID: user.id });
      expect(response.status).to.be.eql(StatusCodes.OK);
      expect(response.data).to.have.property('count', 1);
      expect(response.data.result).to.have.lengthOf(1);
      expect(user).to.have.property('email', newUser.email.toLowerCase());
      expect(user).to.have.property('name', newUser.name.toUpperCase());
      expect(user).to.have.property('firstName', newUser.firstName);
      expect(user).to.have.property('status', 'P');
      expect(user).to.have.property('role', 'B');
      expect(user).to.have.property('locale', 'en_US');
      expect(user.eulaAcceptedHash).to.not.be.null;
      expect(user.eulaAcceptedOn).to.not.be.null;
      expect(user.eulaAcceptedVersion).to.not.be.null;
      expect(user.eulaAcceptedVersion).to.be.above(0);
      expect(user.createdBy).to.be.undefined;
      expect(user.createdOn).to.not.be.null;
    });


    it('Should be able to update the registered user', async () => {
      let response = await CentralServerService.defaultInstance.userApi.getByEmail(testData.createdUsersAdminTenant[0].email);
      expect(response.status).to.be.eql(StatusCodes.OK);
      expect(response.data).to.have.property('count', 1);
      const user: User = response.data.result[0];
      // Change entity
      user.name = 'NEW NAME';
      // Update
      response = await CentralServerService.defaultInstance.userApi.update(user);
      expect(response.status).to.equal(StatusCodes.OK);
      expect(response.data.status).to.eql('Success');
    });

    it(
      'Should be possible to register a new user on the default tenant',
      async () => {
        const newUser = UserFactory.buildRegisterUser();
        let response = await CentralServerService.defaultInstance.authenticationApi.registerUser(newUser, null);
        expect(response.status).to.be.eql(StatusCodes.OK);
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
        expect(response.status).to.be.eql(StatusCodes.OK);
        expect(response.data).to.have.property('count', 1);
        const user = response.data.result[0];
        testData.createdUsersDefaultTenant.push(user);
        expect(user).to.have.property('email', newUser.email.toLowerCase());
        expect(user).to.have.property('name', newUser.name.toUpperCase());
        expect(user).to.have.property('firstName', newUser.firstName);
        expect(user).to.have.property('status', 'P');
        expect(user).to.have.property('role', 'S');
      }
    );

    it('Should be possible to reset a user password', async () => {
      const newUser = await CentralServerService.defaultInstance.createEntity(
        CentralServerService.defaultInstance.userApi, UserFactory.build());
      testData.createdUsersAdminTenant.push(newUser);
      const response = await CentralServerService.defaultInstance.authenticationApi.resetUserPassword(newUser.email, testData.adminTenant);
      expect(response.status).to.be.eql(StatusCodes.OK);
      expect(response.data).to.have.property('status', 'Success');
    });

    it('Should be possible to retrieve tenant EULA', async () => {
      const response = await CentralServerService.defaultInstance.authenticationApi.getEula('');
      expect(response.status).to.be.eql(StatusCodes.OK);
      expect(response.data).to.have.property('text');
    });

    // pragma it('Should be logged off when the locale is updated', async () => {
    //   const newUser = await CentralServerService.defaultInstance.createEntity(
    //     CentralServerService.defaultInstance.userApi, UserFactory.build());
    //   testData.createdUsersAdminTenant.push(newUser);
    //   const userAPI = new CentralServerService(testData.adminTenant, {
    //     email: newUser.email,
    //     password: newUser.password
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
    //     password: newUser.password
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
    it('Should not allow registration without password', async () => {
      // Call
      const newUser = UserFactory.buildRegisterUser();
      delete newUser.password;
      const response = await CentralServerService.defaultInstance.authenticationApi.registerUser(newUser, testData.adminTenant);
      expect(response.status).to.be.eql(StatusCodes.BAD_REQUEST);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow registration with empty string password', async () => {
      // Call
      const newUser = UserFactory.buildRegisterUser();
      newUser.password = '';
      const response = await CentralServerService.defaultInstance.authenticationApi.registerUser(newUser, testData.adminTenant);
      expect(response.status).to.be.eql(StatusCodes.BAD_REQUEST);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow registration with weak password', async () => {
      // Call
      const newUser = UserFactory.buildRegisterUser();
      newUser.password = '1234';
      const response = await CentralServerService.defaultInstance.authenticationApi.registerUser(newUser, testData.adminTenant);
      expect(response.status).to.be.eql(StatusCodes.BAD_REQUEST);
      expect(response.data).to.not.have.property('token');
    });

    it(
      'Should not allow authentication of known user with wrong password',
      async () => {
        // Call
        const response = await CentralServerService.defaultInstance.authenticationApi.login(testData.adminEmail, 'A_M4tch1ng_P4ssw0rd', true);
        expect(response.status).to.be.eql(StatusCodes.NOT_FOUND);
        expect(response.data).to.not.have.property('token');
      }
    );

    it('Should not allow authentication without password', async () => {
      // Call
      const response = await CentralServerService.defaultInstance.authenticationApi.login(
        testData.adminEmail, null, true, testData.adminTenant);
      expect(response.status).to.be.eql(StatusCodes.BAD_REQUEST);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow authentication not accepting eula', async () => {
      // Call
      const response = await CentralServerService.defaultInstance.authenticationApi.login(
        testData.adminEmail, testData.adminPassword, false, testData.adminTenant);
      expect(response.status).to.be.eql(StatusCodes.BAD_REQUEST);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow authentication without eula', async () => {
      // Call
      const response = await CentralServerService.defaultInstance.authenticationApi.login(
        testData.adminEmail, testData.adminPassword, null, testData.adminTenant);
      expect(response.status).to.be.eql(StatusCodes.BAD_REQUEST);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow authentication without email', async () => {
      // Call
      const response = await CentralServerService.defaultInstance.authenticationApi.login(
        null, testData.adminPassword, true, testData.adminTenant);
      expect(response.status).to.be.eql(StatusCodes.BAD_REQUEST);
      expect(response.data).to.not.have.property('token');
    });

    it('Should not allow authentication of unknown email', async () => {
      // Call
      const response = await CentralServerService.defaultInstance.authenticationApi.login('unknown@sap.com', testData.adminPassword, true);
      expect(response.status).to.be.eql(StatusCodes.NOT_FOUND);
      expect(response.data).to.not.have.property('token');
    });

    it('should not allow authentication without tenant', async () => {
      const response = await CentralServerService.defaultInstance.authenticationApi.login('unknown@sap.com', testData.adminPassword, true, null);
      expect(response.status).to.be.eql(StatusCodes.NOT_FOUND);
      expect(response.data).to.not.have.property('token');
    });

    it('should not allow authentication of unknown tenant', async () => {
      const response = await CentralServerService.defaultInstance.authenticationApi.login('unknown@sap.com', testData.adminPassword, true, 'unknown');
      expect(response.status).to.be.eql(StatusCodes.NOT_FOUND);
      expect(response.data).to.not.have.property('token');
    });

    it(
      'should not be possible to verify email for the Super Tenant',
      async () => {
        const response = await CentralServerService.defaultInstance.authenticationApi.verifyEmail('unknown@sap.com', 'unknownVerificationToken', '');
        expect(response.status).to.be.eql(StatusCodes.INTERNAL_SERVER_ERROR);
      }
    );

    it(
      'should not be possible to request verification email for the Super Tenant',
      async () => {
        const response = await CentralServerService.defaultInstance.authenticationApi.resendVerificationEmail('unknown@sap.com', '');
        expect(response.status).to.be.eql(StatusCodes.INTERNAL_SERVER_ERROR);
      }
    );
  });
});

