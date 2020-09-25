import chai, { assert, expect } from 'chai';

import CentralServerService from '../api/client/CentralServerService';
import ChargingStationContext from './context/ChargingStationContext';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import SiteContext from './context/SiteContext';
import Tag from '../types/Tag';
import TenantContext from './context/TenantContext';
import User from '../types/User';
import chaiSubset from 'chai-subset';
import moment from 'moment';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);


class TestData {
  public tenantContext: TenantContext;
  public centralUserContext: any;
  public centralUserService: CentralServerService;
  public userContext: any;
  public userService: CentralServerService;
  public siteContext: SiteContext;
  public newUser: User;
  public newTag: Tag;
  public createdUsers: any[] = [];
  public createdTags: any[] = [];
  public siteAreaContext: any;
  public chargingStationContext: ChargingStationContext;
}

const testData: TestData = new TestData();

describe('User tests', function() {
  this.timeout(1000000); // Will automatically stop the unit test after that period of time

  before(async () => {
    chai.config.includeStack = true;
    await ContextProvider.defaultInstance.prepareContexts();
  });

  afterEach(() => {
    // Can be called after each UT to clean up created data
  });

  after(async () => {
    // Final clean up at the end
    await ContextProvider.defaultInstance.cleanUpCreatedContent();
  });

  describe('With component Organization (tenant utorg)', () => {

    before(async () => {
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_ORGANIZATION);
      testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT);
      testData.centralUserService = new CentralServerService(
        testData.tenantContext.getTenant().subdomain,
        testData.centralUserContext
      );
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);
      testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
    });

    after(async () => {
      // Delete any created user
      testData.createdUsers.forEach(async (user) => {
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.userApi,
          user,
          false
        );
      });
      testData.createdUsers = [];
      // Delete any created tag
      testData.createdTags.forEach(async (tag) => {
        await testData.centralUserService.userApi.deleteTag(tag.id);
      });
      testData.createdTags = [];
    });

    describe('Where admin user', () => {
      before(() => {
        testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
        assert(testData.userContext, 'User context cannot be null');
        if (testData.userContext === testData.centralUserContext) {
          // Reuse the central user service (to avoid double login)
          testData.userService = testData.centralUserService;
        } else {
          testData.userService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            testData.userContext
          );
        }
        assert(!!testData.userService, 'User service cannot be null');
      });

      describe('Using various basic APIs', () => {

        it('Should have accepted the Eula', async () => {
          // Send
          const response = await testData.userService._baseApi.send({
            method: 'GET',
            url: `/client/auth/CheckEndUserLicenseAgreement?Email=${testData.userContext.email}&Tenant=${testData.tenantContext.getTenant().subdomain}`,
            headers: {
              'Content-Type': 'application/json'
            }
          });
          expect(response.status).to.equal(200);
          expect(response.data).not.null;
          expect(response.data).to.have.property('eulaAccepted');
          expect(response.data.eulaAccepted).to.eql(true);
        });

        it('Should be able to create a new user', async () => {
          // Create
          testData.newUser = await testData.userService.createEntity(
            testData.userService.userApi,
            Factory.user.build()
          );
          testData.newUser.issuer = true;
          // Remove Passwords
          delete testData.newUser['passwords'];
          testData.createdUsers.push(testData.newUser);
        });

        it('Should find the created user in the auto-assign site', async () => {
          // Checks if the sites to which the new user is assigned contains the auto-assign site
          await testData.userService.checkEntityInListWithParams(
            testData.userService.siteApi,
            testData.siteContext.getSite(),
            { 'UserID': testData.newUser.id }
          );
        });

        it('Should find the created user by id', async () => {
          // Check if the created entity can be retrieved with its id
          await testData.userService.getEntityById(
            testData.userService.userApi,
            testData.newUser
          );
        });

        it('Should find the created user in the user list', async () => {
          // Check if the created entity is in the list
          await testData.userService.checkEntityInList(
            testData.userService.userApi,
            testData.newUser
          );
        });

        it('Should be able to update the user', async () => {
          // Change entity
          testData.newUser.name = 'NEW NAME';
          // Update
          await testData.userService.updateEntity(
            testData.userService.userApi,
            testData.newUser
          );
        });

        it('Should be able to create a tag for user', async () => {
          testData.newTag = Factory.tag.build({ userID: testData.newUser.id });
          const response = await testData.userService.userApi.createTag(testData.newTag);
          expect(response.status).to.equal(200);
          testData.createdTags.push(testData.newTag);
        });

        it('Should not be able to delete a badge that has already been used', async () => {
          const connectorId = 1;
          const tagId = testData.newTag.id;
          const meterStart = 180;
          const startDate = moment();
          let response = await testData.chargingStationContext.startTransaction(
            connectorId, tagId, meterStart, startDate.toDate());
          // eslint-disable-next-line @typescript-eslint/unbound-method
          expect(response).to.be.transactionValid;
          response = await testData.userService.userApi.deleteTag(tagId);
          expect(response.status).to.equal(575);
          const tag = (await testData.userService.userApi.readTag(tagId)).data;
          expect(tag).to.not.be.null;
        });

        it('Should be able to deactivate a badge', async () => {
          testData.newTag.active = false;
          const response = await testData.userService.userApi.updateTag(testData.newTag);
          expect(response.status).to.equal(200);
          const tag = (await testData.userService.userApi.readTag(testData.newTag.id)).data;
          expect(tag.active).to.equal(false);
        });

        it('Should not be able to start a transaction with a deactivated badge', async () => {
          const connectorId = 1;
          const tagId = testData.newTag.id;
          const meterStart = 180;
          const startDate = moment();
          const response = await testData.chargingStationContext.startTransaction(
            connectorId, tagId, meterStart, startDate.toDate());
          // eslint-disable-next-line @typescript-eslint/unbound-method
          expect(response).to.be.transactionStatus('Invalid');
        });

        it('Should be able to delete a badge that has not been used', async () => {
          testData.newTag = Factory.tag.build({ userID: testData.newUser.id });
          let response = await testData.userService.userApi.createTag(testData.newTag);
          expect(response.status).to.equal(200);
          response = await testData.userService.userApi.deleteTag(testData.newTag.id);
          expect(response.status).to.equal(200);
          response = (await testData.userService.userApi.readTag(testData.newTag.id));
          expect(response.status).to.equal(550);
        });

        it('Should find the updated user by id', async () => {
          // Check if the updated entity can be retrieved with its id
          const updatedUser = await testData.userService.getEntityById(
            testData.userService.userApi,
            testData.newUser
          );
          // Check
          expect(updatedUser.name).to.equal(testData.newUser.name);
        });

        it('Should be able to delete the created user', async () => {
          // Delete the created entity
          await testData.userService.deleteEntity(
            testData.userService.userApi,
            testData.newUser
          );
        });

        it('Should not find the deleted user with its id', async () => {
          // Check if the deleted entity cannot be retrieved with its id
          await testData.userService.checkDeletedEntityById(
            testData.userService.userApi,
            testData.newUser
          );
        });

      });
      describe('Using function "readAllInError"', () => {

        it('Should not find an active user in error', async () => {
          const user = await testData.userService.createEntity(
            testData.userService.userApi,
            Factory.user.build({ status: 'A' })
          );
          testData.createdUsers.push(user);
          const response = await testData.userService.userApi.readAllInError({}, {
            limit: 100,
            skip: 0
          });
          expect(response.status).to.equal(200);
          response.data.result.forEach((u) => expect(u.id).to.not.equal(user.id));

          await testData.userService.deleteEntity(
            testData.userService.userApi,
            user
          );
        });

        it('Should find a pending user', async () => {
          const user = await testData.userService.createEntity(
            testData.userService.userApi,
            Factory.user.build({ status: 'P' })
          );
          testData.createdUsers.push(user);
          const response = await testData.userService.userApi.readAllInError({}, {
            limit: 100,
            skip: 0
          });
          expect(response.status).to.equal(200);
          const found = response.data.result.find((u) => u.id === user.id);
          expect(found).to.not.be.null;

          await testData.userService.deleteEntity(
            testData.userService.userApi,
            user
          );
        });

        it('Should find a blocked user', async () => {
          const user = await testData.userService.createEntity(
            testData.userService.userApi,
            Factory.user.build({ status: 'B' })
          );
          testData.createdUsers.push(user);
          const response = await testData.userService.userApi.readAllInError({}, {
            limit: 100,
            skip: 0
          });
          expect(response.status).to.equal(200);
          const found = response.data.result.find((u) => u.id === user.id);
          expect(found).to.not.be.null;

          await testData.userService.deleteEntity(
            testData.userService.userApi,
            user
          );
        });

        it('Should find a locked user', async () => {
          const user = await testData.userService.createEntity(
            testData.userService.userApi,
            Factory.user.build({ status: 'L' })
          );
          testData.createdUsers.push(user);
          const response = await testData.userService.userApi.readAllInError({}, {
            limit: 100,
            skip: 0
          });
          expect(response.status).to.equal(200);
          const found = response.data.result.find((u) => u.id === user.id);
          expect(found).to.not.be.null;

          await testData.userService.deleteEntity(
            testData.userService.userApi,
            user
          );
        });

        it('Should find an inactive user', async () => {
          const user = await testData.userService.createEntity(
            testData.userService.userApi,
            Factory.user.build({ status: 'I' })
          );
          testData.createdUsers.push(user);
          const response = await testData.userService.userApi.readAllInError({}, {
            limit: 100,
            skip: 0
          });
          expect(response.status).to.equal(200);
          const found = response.data.result.find((u) => u.id === user.id);
          expect(found).to.not.be.null;

          await testData.userService.deleteEntity(
            testData.userService.userApi,
            user
          );
        });

      });

    });

  });

});
