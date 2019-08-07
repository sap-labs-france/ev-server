import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import CentralServerService from '../api/client/CentralServerService';
import CONTEXTS from './contextProvider/ContextConstants';
import ContextProvider from './contextProvider/ContextProvider';
import Factory from '../factories/Factory';
import SiteContext from './ContextProvider/SiteContext';
import TenantContext from './ContextProvider/TenantContext';

chai.use(chaiSubset);

class TestData {
  public tenantContext: TenantContext;
  public centralUserContext: any;
  public centralUserService: CentralServerService;
  public userContext: any;
  public userService: CentralServerService;
  public siteContext: SiteContext;
  public newUser: any;
  public createdUsers: any[] = [];
}

const testData: TestData = new TestData();

describe('User tests', function() {
  this.timeout(1000000); // Will automatically stop the unit test after that period of time

  before(async () => {
    chai.config.includeStack = true;
    await ContextProvider.DefaultInstance.prepareContexts();
  });

  afterEach(() => {
    // Can be called after each UT to clean up created data
  });

  after(async () => {
    // Final clean up at the end
    await ContextProvider.DefaultInstance.cleanUpCreatedContent();
  });

  describe('With component Organization (tenant ut-org)', () => {

    before(async () => {
      testData.tenantContext = await ContextProvider.DefaultInstance.getTenantContext(CONTEXTS.TENANT_CONTEXTS.TENANT_ORGANIZATION);
      testData.centralUserContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.siteContext = testData.tenantContext.getSiteContext(CONTEXTS.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT);
      testData.centralUserService = new CentralServerService(
        testData.tenantContext.getTenant().subdomain,
        testData.centralUserContext
      );
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
    });

    describe('Where admin user', () => {

      before(async () => {
        testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
        if (testData.userContext === testData.centralUserContext) {
          // Reuse the central user service (to avoid double login)
          testData.userService = testData.centralUserService;
        } else {
          testData.userService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            testData.userContext
          );
        }
      });

      describe('Using various basic APIs', () => {

        it('Should be able to create a new user', async () => {
          // Create
          testData.newUser = await testData.userService.createEntity(
            testData.userService.userApi,
            Factory.user.build()
          );
          // Remove Passwords
          delete testData.newUser.passwords;
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
          testData.newUser.name = 'New Name';
          // Update
          await testData.userService.updateEntity(
            testData.userService.userApi,
            testData.newUser
          );
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
          const response = await testData.userService.userApi.readAllInError({}, { limit: 100, skip: 0 });
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
          const response = await testData.userService.userApi.readAllInError({}, { limit: 100, skip: 0 });
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
          const response = await testData.userService.userApi.readAllInError({}, { limit: 100, skip: 0 });
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
          const response = await testData.userService.userApi.readAllInError({}, { limit: 100, skip: 0 });
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
          const response = await testData.userService.userApi.readAllInError({}, { limit: 100, skip: 0 });
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
