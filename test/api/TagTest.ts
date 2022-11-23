import chai, { assert, expect } from 'chai';

import CentralServerService from '../api/client/CentralServerService';
import ChargingStationContext from './context/ChargingStationContext';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import { HTTPError } from '../../src/types/HTTPError';
import Site from '../../src/types/Site';
import SiteContext from './context/SiteContext';
import { StatusCodes } from 'http-status-codes';
import Tag from '../../src/types/Tag';
import TenantContext from './context/TenantContext';
import TestUtils from './TestUtils';
import User from '../../src/types/User';
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
  public newTagUnassigned: Tag;
  public createdUsers: any[] = [];
  public createdTags: any[] = [];
  public siteAreaContext: any;
  public chargingStationContext: ChargingStationContext;
  public tagsToImport: any;
  public importedTags: Tag[];
  public newSite: Site;
  public createdSites: any[] = [];
}

const testData: TestData = new TestData();
// To remove once we remove the site Admin from the token
function login(userRole) {
  testData.userContext = testData.tenantContext.getUserContext(userRole);
  if (testData.userContext === testData.centralUserContext) {
    // Reuse the central user service (to avoid double login)
    testData.userService = testData.centralUserService;
  } else {
    testData.userService = new CentralServerService(
      testData.tenantContext.getTenant().subdomain,
      testData.userContext
    );
  }
}

describe('Tag', () => {
  jest.setTimeout(1000000); // Will automatically stop the unit test after that period of time

  beforeAll(async () => {
    chai.config.includeStack = true;
    await ContextProvider.defaultInstance.prepareContexts();
  });

  afterEach(() => {
    // Can be called after each UT to clean up created data
  });

  afterAll(async () => {
    // Final clean up at the end
    await ContextProvider.defaultInstance.cleanUpCreatedContent();
  });

  describe('With component Organization (utorg)', () => {

    beforeAll(async () => {
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

    afterAll(async () => {
      // Delete any created user
      for (const user of testData.createdUsers) {
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.userApi,
          user,
          false
        );
      }
      testData.createdUsers = [];
      // Delete any created tag
      for (const tag of testData.createdTags) {
        await testData.centralUserService.tagApi.deleteTag(tag.id);

      }
      testData.createdTags = [];
      // Delete any created site
      for (const site of testData.createdSites) {
        await testData.centralUserService.siteApi.delete(site.id);

      }
      testData.createdSites = [];
    });

    describe('Where admin user', () => {
      beforeAll(async () => {
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
        // Create a site
        testData.newSite = await testData.userService.createEntity(
          testData.userService.siteApi,
          Factory.site.build({ companyID: testData.tenantContext.getContext().companies[0].id, autoUserSiteAssignment: true }), true
        );
        testData.createdSites.push(testData.newSite);
      });

      describe('Using various basic APIs', () => {

        it('Should be able to create a new user', async () => {
          // Create
          testData.newUser = await testData.userService.createEntity(
            testData.userService.userApi,
            Factory.user.build()
          );
          testData.newUser.issuer = true;
          delete testData.newUser['password'];
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

        it('Should be able to create a tag for user', async () => {
          testData.newTag = Factory.tag.build({ userID: testData.newUser.id });
          const response = await testData.userService.tagApi.createTag(testData.newTag);
          expect(response.status).to.equal(StatusCodes.CREATED);
          testData.createdTags.push(testData.newTag);
        });

        it('Should be able to create a tag without a user', async () => {
          testData.newTagUnassigned = Factory.tag.build();
          const response = await testData.userService.tagApi.createTag(testData.newTagUnassigned);
          expect(response.status).to.equal(StatusCodes.CREATED);
          testData.createdTags.push(testData.newTagUnassigned);
        });

        it('Should be able to deactivate a badge', async () => {
          testData.newTag.active = false;
          const response = await testData.userService.tagApi.updateTag(testData.newTag);
          expect(response.status).to.equal(StatusCodes.OK);
          const tag = (await testData.userService.tagApi.readTag(testData.newTag.id)).data;
          expect(tag.active).to.equal(false);
        });

        it(
          'Should not be able to start a transaction with a deactivated badge',
          async () => {
            const connectorId = 1;
            const tagId = testData.newTag.id;
            const meterStart = 180;
            const startDate = moment();
            const response = await testData.chargingStationContext.startTransaction(
              connectorId, tagId, meterStart, startDate.toDate());
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(response).to.be.transactionStatus('Invalid');
          }
        );

        it('Should be able to delete a badge that has not been used', async () => {
          testData.newTag = Factory.tag.build({ userID: testData.newUser.id });
          let response = await testData.userService.tagApi.createTag(testData.newTag);
          expect(response.status).to.equal(StatusCodes.CREATED);
          response = await testData.userService.tagApi.deleteTag(testData.newTag.id);
          expect(response.status).to.equal(StatusCodes.OK);
          response = (await testData.userService.tagApi.readTag(testData.newTag.id));
          expect(response.status).to.equal(StatusCodes.NOT_FOUND);
        });

        it('Should be able to export tag list', async () => {
          const response = await testData.userService.tagApi.exportTags({});
          const tags = await testData.userService.tagApi.readTags({});
          const responseFileArray = TestUtils.convertExportFileToObjectArray(response.data);

          expect(response.status).eq(StatusCodes.OK);
          expect(response.data).not.null;
          // Verify we have as many tags inserted as tags in the export
          expect(responseFileArray.length).to.be.eql(tags.data.result.length);
        });

        // // TODO: Need to verify the real logic, not only if we can import (read create) tags
        // // Something like this ?
        // it('Should be able to import tag list', async () => {
        //   const response = await testData.tagService.insertTags(
        //     tenantid,
        //     user,
        //     action,
        //     tagsToBeImported,
        //     result);
        //   expect(response.status).to.equal(??);
        //   testData.importedTags.push(tag);
        // });

        it('Should get the user default car tag', async () => {
          // Create a tag
          testData.newTag = Factory.tag.build({ userID: testData.newUser.id });
          let response = await testData.userService.tagApi.createTag(testData.newTag);
          expect(response.status).to.equal(StatusCodes.CREATED);
          testData.createdTags.push(testData.newTag);
          // Retrieve it
          response = await testData.userService.userApi.getUserSessionContext({
            userID: testData.newUser.id, chargingStationID: testData.chargingStationContext.getChargingStation().id, connectorID: 1 });
          expect(response.status).to.be.eq(StatusCodes.OK);
          expect(response.data.tag.visualID).to.be.eq(testData.newTag.visualID);
          expect(response.data.car).to.be.undefined;
          expect(response.data.errorCodes).to.be.not.null;
          expect(response.data.smartChargingSessionParameters).to.be.null;
        });

        it('Should get the user default car tag with deprecated method', async () => {
          // Retrieve it
          const response = await testData.userService.userApi.getDefaultTagCar(testData.newUser.id);
          expect(response.status).to.be.eq(StatusCodes.OK);
          expect(response.data.tag.visualID).to.be.eq(testData.newTag.visualID);
          expect(response.data.car).to.be.undefined;
          expect(response.data.errorCodes).to.be.not.null;
        });
      });

    });

    describe('Where basic user', () => {
      beforeAll(() => {
        testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER_NO_TAGS);
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

        it('Should not be able to create a badge for user', async () => {
          testData.newTag = Factory.tag.build({ userID: testData.newUser.id });
          const response = await testData.userService.tagApi.createTag(testData.newTag);
          expect(response.status).to.equal(StatusCodes.FORBIDDEN);
        });

        it('Should be able to assign a badge for himself', async () => {
          testData.newTagUnassigned.userID = testData.userContext.id;
          const response = await testData.userService.tagApi.assignTag(testData.newTagUnassigned);
          expect(response.status).to.equal(StatusCodes.CREATED);
          testData.createdTags.push(testData.newTagUnassigned);
        });

        it('Should be able to read his own badge', async () => {
          const response = await testData.userService.tagApi.readTagByVisualID(testData.newTagUnassigned.visualID);
          expect(response.status).to.equal(StatusCodes.OK);
          expect(response.data.visualID).to.equal(testData.newTagUnassigned.visualID);
        });

        it('Should be able to update his own badge', async () => {
          testData.newTagUnassigned.description = 'My new description';
          const id = testData.newTagUnassigned.id;
          delete testData.newTagUnassigned.id; // Basic User should not be able to see his ID
          const response = await testData.userService.tagApi.updateTagByVisualID(testData.newTagUnassigned);
          expect(response.status).to.equal(StatusCodes.OK);
          const tag = (await testData.userService.tagApi.readTagByVisualID(testData.newTagUnassigned.visualID)).data;
          expect(tag.description).to.equal('My new description');
          testData.newTagUnassigned.id = id;
        });

        it('Should get the user default car tag with deprecated method', async () => {
          // Retrieve it
          const response = await testData.userService.userApi.getDefaultTagCar(testData.newTagUnassigned.userID);
          expect(response.status).to.be.eq(StatusCodes.OK);
          expect(response.data.tag.visualID).to.be.eq(testData.newTagUnassigned.visualID);
          expect(response.data.car).to.be.undefined;
          expect(response.data.errorCodes).to.be.not.null;
        });

        it('Should get the user default car tag', async () => {
          // Retrieve it
          const response = await testData.userService.userApi.getUserSessionContext({
            userID: testData.newTagUnassigned.userID, chargingStationID: testData.chargingStationContext.getChargingStation().id, connectorID: 1 });
          expect(response.status).to.be.eq(StatusCodes.OK);
          expect(response.data.tag.visualID).to.be.eq(testData.newTagUnassigned.visualID);
          expect(response.data.car).to.be.undefined;
          expect(response.data.errorCodes).to.be.not.null;
          expect(response.data.smartChargingSessionParameters).to.be.null;
        });

        it('Should be able to unassign his own badge', async () => {
          let response = await testData.userService.tagApi.unassignTag(testData.newTagUnassigned);
          expect(response.status).to.equal(StatusCodes.OK);
          response = await testData.userService.tagApi.readTagByVisualID(testData.newTagUnassigned.visualID);
          expect(response.status).to.equal(StatusCodes.NOT_FOUND);
        });
      });

    });


    // where site admin

    describe('Where site admin user', () => {
      beforeAll(async () => {
        testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER_NO_TAGS);
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
        login(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
        testData.userContext = await testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        await testData.userService.siteApi.addUsersToSite(testData.newSite.id, [testData.userContext.id]);
        await testData.userService.siteApi.addUsersToSite(testData.newSite.id, [testData.newUser.id]);
        await testData.userService.siteApi.assignSiteAdmin(testData.newSite.id, testData.userContext.id);
        login(ContextDefinition.USER_CONTEXTS.BASIC_USER);
      });

      describe('Using various basic APIs', () => {

        it('Should not be able to create a badge without a user', async () => {
          testData.newTag = Factory.tag.build();
          const response = await testData.userService.tagApi.createTag(testData.newTag);
          expect(response.status).to.equal(StatusCodes.FORBIDDEN);
        });

        it(
          'Should be not be able to read badge of user not assigned to his site',
          async () => {
            const response = await testData.userService.tagApi.readTag(testData.newTag.id);
            expect(response.status).to.equal(StatusCodes.NOT_FOUND);
          }
        );

        it(
          'Should be able to create a badge for a user assigned to his site',
          async () => {
            testData.newTag = Factory.tag.build({ userID: testData.newUser.id });
            const response = await testData.userService.tagApi.createTag(testData.newTag);
            expect(response.status).to.equal(StatusCodes.CREATED);
            testData.createdTags.push(testData.newTag);
          }
        );

        it(
          'Should be able to update a badge of a user assigned to his site',
          async () => {
            testData.newTag.description = 'My new description for site admin';
            const response = await testData.userService.tagApi.updateTag(testData.newTag);
            expect(response.status).to.equal(StatusCodes.OK);
            const tag = (await testData.userService.tagApi.readTag(testData.newTag.id)).data;
            expect(tag.description).to.equal('My new description for site admin');
          }
        );
      });

    });


  });

});
