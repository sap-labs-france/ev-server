import User, { UserRole } from '../../src/types/User';
import chai, { assert, expect } from 'chai';

import CentralServerService from '../api/client/CentralServerService';
import ChargingStationContext from './context/ChargingStationContext';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import { RESTServerRoute } from '../../src/types/Server';
import SiteContext from './context/SiteContext';
import { StatusCodes } from 'http-status-codes';
import Tag from '../../src/types/Tag';
import TenantContext from './context/TenantContext';
import TestUtils from './TestUtils';
import chaiSubset from 'chai-subset';
import responseHelper from '../helpers/responseHelper';
import global from '../../src/types/GlobalType';
import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import config from '../config'
import CarStorage from '../../src/storage/mongodb/CarStorage';
import TagStorage from '../../src/storage/mongodb/TagStorage';

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
  public tagsToImport: any;
  public importedTags: Tag[];
}

const testData: TestData = new TestData();

describe('User', () => {
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
    });

    describe('When admin user', () => {
      beforeAll(() => {
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
            url: '/v1/auth/' + RESTServerRoute.REST_END_USER_LICENSE_AGREEMENT_CHECK + `?Email=${testData.userContext.email}&Tenant=${testData.tenantContext.getTenant().subdomain}`,
            headers: {
              'Content-Type': 'application/json'
            }
          });
          expect(response.status).to.equal(StatusCodes.OK);
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
          delete testData.newUser['password'];
          testData.createdUsers.push(testData.newUser);
        });

        it('Should find the created user in the auto-assign site', async () => {
          // Checks if the sites to which the new user is assigned contains the auto-assign site
          await testData.userService.checkEntityInListWithParams(
            testData.userService.siteApi,
            testData.siteContext.getSite(),
            {'UserID': testData.newUser.id}
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
            {...testData.newUser, password: testData.newUser.password}
          );
        });

        it(
          'Should be able to update the user with a single attribute in the request',
          async () => {
            // Update
            await testData.userService.updateEntity(
              testData.userService.userApi,
              {id: testData.newUser.id, role: UserRole.ADMIN}
            );

            testData.newUser = (await testData.userService.getEntityById(
              testData.userService.userApi,
              testData.newUser,
              false
            )).data;
          }
        );

        it('Should be able to export users list', async () => {
          const response = await testData.userService.userApi.exportUsers({});
          const users = await testData.userService.userApi.readAll({}, {limit: 1000, skip: 0});
          const responseFileArray = TestUtils.convertExportFileToObjectArray(response.data);
          expect(response.status).eq(StatusCodes.OK);
          expect(response.data).not.null;
          // Verify we have as many users inserted as users in the export
          expect(responseFileArray.length).to.be.eql(users.data.result.length);
        });

        it('Should find the updated user by id', async () => {
          // Check if the updated entity can be retrieved with its id
          const updatedUser = await testData.userService.getEntityById(
            testData.userService.userApi,
            testData.newUser
          );
          expect(updatedUser.name).to.equal(testData.newUser.name);
        });

        it('Should update user\'s mobile token', async () => {
          const response = await testData.userService.userApi.updateMobileToken(
            testData.newUser.id,
            'new_mobile_token',
            'ios'
          );
          expect(response.status).to.be.eq(StatusCodes.OK);
          expect(response.data).to.be.deep.eq(Constants.REST_RESPONSE_SUCCESS);
        });

        it('Should not get new user image', async () => {
          const response = await testData.userService.userApi.getImage(testData.newUser.id);
          expect(response.status).to.be.eq(StatusCodes.NOT_FOUND);
        });

        it('Should get the user default car tag', async () => {
          // Create a tag
          testData.newTag = Factory.tag.build({userID: testData.newUser.id});
          let response = await testData.userService.tagApi.createTag(testData.newTag);
          expect(response.status).to.equal(StatusCodes.CREATED);
          testData.createdTags.push(testData.newTag);
          // Retrieve it
          response = await testData.userService.userApi.getUserSessionContext({
            userID: testData.newUser.id,
            chargingStationID: testData.chargingStationContext.getChargingStation().id,
            connectorID: 1
          });
          expect(response.status).to.be.eq(StatusCodes.OK);
          expect(response.data.tag.visualID).to.be.eq(testData.newTag.visualID);
          expect(response.data.car).to.be.undefined;
          expect(response.data.errorCodes).to.be.not.null;
          expect(response.data.smartChargingSessionParameters).to.be.null;
        });

        it('Should get the user default car tag with deprecated method', async () => {
          const response = await testData.userService.userApi.getDefaultTagCar(testData.newUser.id);
          expect(response.status).to.be.eq(StatusCodes.OK);
          expect(response.data.tag.visualID).to.be.eq(testData.newTag.visualID);
          expect(response.data.car).to.be.undefined;
          expect(response.data.errorCodes).to.be.not.null;
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

        it('Should be able to set/unset the technical flag', async () => {
          // Check the technical flag can be set
          const response = await testData.userService.userApi.exportUsers({});
          let users = await testData.userService.userApi.readAll({}, {
            limit: Constants.DB_RECORD_COUNT_MAX_PAGE_LIMIT,
            skip: 0
          });
          expect(response.status).eq(StatusCodes.OK);
          expect(response.data).not.null;
          expect(users.data.result.length).to.be.greaterThan(1);
          const user1 = users.data.result[0];
          user1.technical = true;
          await testData.userService.userApi.update(user1);
          users = await testData.userService.userApi.readAll({}, {
            limit: Constants.DB_RECORD_COUNT_MAX_PAGE_LIMIT,
            skip: 0
          });
          const user2 = users.data.result[0];
          expect(user2.technical).eq(true);
          // Unset technical flag.
          user2.technical = false;
          await testData.userService.userApi.update(user2);
          users = await testData.userService.userApi.readAll({}, {
            limit: Constants.DB_RECORD_COUNT_MAX_PAGE_LIMIT,
            skip: 0
          });
          expect(user2.technical).eq(false);
        });
      });

      describe('Using function "readAllInError"', () => {
        it('Should not find an active user in error', async () => {
          const user = await testData.userService.createEntity(
            testData.userService.userApi,
            Factory.user.build({status: 'A'})
          );
          testData.createdUsers.push(user);
          const response = await testData.userService.userApi.readAllInError({}, {
            limit: 100,
            skip: 0
          });
          expect(response.status).to.equal(StatusCodes.OK);
          response.data.result.forEach((u) => expect(u.id).to.not.equal(user.id));
          await testData.userService.deleteEntity(
            testData.userService.userApi,
            user
          );
        });

        it('Should find a pending user', async () => {
          const user = await testData.userService.createEntity(
            testData.userService.userApi,
            Factory.user.build({status: 'P'})
          );
          testData.createdUsers.push(user);
          const response = await testData.userService.userApi.readAllInError({}, {
            limit: 100,
            skip: 0
          });
          expect(response.status).to.equal(StatusCodes.OK);
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
            Factory.user.build({status: 'B'})
          );
          testData.createdUsers.push(user);
          const response = await testData.userService.userApi.readAllInError({}, {
            limit: 100,
            skip: 0
          });
          expect(response.status).to.equal(StatusCodes.OK);
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
            Factory.user.build({status: 'L'})
          );
          testData.createdUsers.push(user);
          const response = await testData.userService.userApi.readAllInError({}, {
            limit: 100,
            skip: 0
          });
          expect(response.status).to.equal(StatusCodes.OK);
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
            Factory.user.build({status: 'I'})
          );
          testData.createdUsers.push(user);
          const response = await testData.userService.userApi.readAllInError({}, {
            limit: 100,
            skip: 0
          });
          expect(response.status).to.equal(StatusCodes.OK);
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

  describe('With component Organization (utbilling)', () => {
    beforeAll(async () => {
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING);
      testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT);
      testData.centralUserService = new CentralServerService(
        testData.tenantContext.getTenant().subdomain,
        testData.centralUserContext
      );
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);
      testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
    });

    describe('Using various basic APIs', () => {


      describe('When admin user', () => {
        beforeAll(() => {
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

        it('Should be able to set freeAccess flag on basic user', async () => {
          const fakeUser = {
            ...Factory.user.build(),
          } as User;
          fakeUser.issuer = true;
          // Let's create a user
          await testData.userService.createEntity(
            testData.userService.userApi,
            fakeUser
          );
          testData.createdUsers.push(fakeUser);
          // Let's check that user exists with default freeAccess flag
          const myUser = await testData.userService.userApi.readById(fakeUser.id);
          expect(myUser).to.be.not.null;
          expect(!!myUser.data.freeAccess).eq(false);
          // Let's update the new user
          fakeUser.freeAccess = true;
          await testData.userService.updateEntity(
            testData.userService.userApi,
            fakeUser,
            false
          );
          // Let's check that user exists with freeAccess flag
          const myUser2 = await testData.userService.userApi.readById(fakeUser.id);
          expect(myUser2).to.be.not.null;
          expect(myUser2.data.freeAccess).to.be.eq(true);
          // Let's delete the user
          await testData.userService.deleteEntity(
            testData.userService.userApi,
            {id: testData.createdUsers[0].id}
          );
          testData.createdUsers.shift();
        });

      });
    });
  });

  describe('Car component is active (utcar)', () => {
    beforeAll(async () => {
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_CAR);
      testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT);
      testData.centralUserService = new CentralServerService(
        testData.tenantContext.getTenant().subdomain,
        testData.centralUserContext
      );
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);
      testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
    });

    describe('Get user session context', () => {
      let carCatalogID;
      beforeAll(async () => {
        carCatalogID = (await testData.centralUserService.carApi.readCarCatalogs({}, Constants.DB_PARAMS_SINGLE_RECORD)).data.result[0].id;
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

      describe('Given a user with no tag and no car', () => {
        const user = Factory.user.build();

        beforeAll(async () => {
          const createUserResponse = await testData.userService.userApi.create(user);
          user.id = createUserResponse.data.id;
        });

        test('When getting his session context for (any connector), (any charging station)', async () => {
          const response = await testData.userService.userApi.getUserSessionContext({
            userID: user.id,
            chargingStationID: testData.chargingStationContext.getChargingStation().id,
            connectorID: 1
          });
          expect(response.status).to.be.eq(StatusCodes.OK);
          assert(response.data.car == null);
          assert(response.data.tag == null);
        });

        test('When getting his session context for (any connector), (any charging station) and (non null carID)', async () => {
          const randomCarID = (await testData.userService.carApi.create(Factory.car.build({carCatalogID}))).data.id;
          const response = await testData.userService.userApi.getUserSessionContext({
            userID: user.id,
            chargingStationID: testData.chargingStationContext.getChargingStation().id,
            connectorID: 1,
            carID: randomCarID
          })
          expect(response.status).to.be.eq(StatusCodes.BAD_REQUEST);
        });

        test('When getting his session context for (any connector), (any charging station) and (non null tagID)', async () => {
          const randomTagID = (await testData.userService.tagApi.createTag(Factory.tag.build())).data.id;
          const response = await testData.userService.userApi.getUserSessionContext({
            userID: user.id,
            chargingStationID: testData.chargingStationContext.getChargingStation().id,
            connectorID: 1,
            tagID: randomTagID
          });
          expect(response.status).to.be.eq(StatusCodes.BAD_REQUEST);
        });
      });

      describe('Given a user with a tag and a car but no defaults', () => {
        const user = Factory.user.build();
        let car;
        let tag;

        beforeAll(async () => {
          global.database = new MongoDBStorage(config.get('storage'));
          await global.database.start();

          const createUserResponse = await testData.userService.userApi.create(user);
          user.id = createUserResponse.data.id;

          // We use storage layer directly to enforce setting default to false
          car = Factory.car.build({default: false, carCatalogID, userID: user.id});
          const createdCarID = await CarStorage.saveCar(testData.tenantContext.getTenant(), car);
          car.id = createdCarID;

          // We use storage layer directly to enforce setting default to false
          tag = Factory.tag.build({default: false, userID: user.id});
          await TagStorage.saveTag(testData.tenantContext.getTenant(), tag);
        });

        afterAll(async () => {
          await global.database.stop();
        });

        test('When getting his sessions context for (any connector), (any charging station)', async () => {
          const response = await testData.userService.userApi.getUserSessionContext({
            userID: user.id,
            chargingStationID: testData.chargingStationContext.getChargingStation().id,
            connectorID: 1
          });

          expect(response.status).to.be.eq(StatusCodes.OK);
          assert(response.data.car.id === car.id);
          assert(response.data.tag.id === tag.id);
          assert(!response.data.car.default);
          assert(!response.data.tag.default);
        });
      });

      describe('Given a user with 2 cars and 2 tags', () => {
        const user = Factory.user.build();
        let defaultTag;
        let defaultCar;
        let car;
        let tag;

        beforeAll(async () => {
          global.database = new MongoDBStorage(config.get('storage'));
          await global.database.start();

          const createUserResponse = await testData.userService.userApi.create(user);
          user.id = createUserResponse.data.id;


          // Create non-default user car via storage layer
          car = Factory.car.build({carCatalogID, userID: user.id, default: false});
          const createdCarID = await CarStorage.saveCar(testData.tenantContext.getTenant(), car);
          car.id = createdCarID;

          // Create default user car via storage layer
          defaultCar = Factory.car.build({carCatalogID, userID: user.id, default: true});
          const createDefaultCarID = await CarStorage.saveCar(testData.tenantContext.getTenant(), defaultCar);
          defaultCar.id = createDefaultCarID

          // Create non-default user tag via storage layer
          tag = Factory.tag.build({userID: user.id, default: false});
          await TagStorage.saveTag(testData.tenantContext.getTenant(), tag);

          // Create default user tag via storage layer
          defaultTag = Factory.tag.build({userID: user.id, default: true});
          await TagStorage.saveTag(testData.tenantContext.getTenant(), defaultTag);
        });

        afterAll(async () => {
          await global.database.stop();
        });

        test('When getting his session context for (any connector), (any charging station)', async () => {
          const response = await testData.userService.userApi.getUserSessionContext({
            userID: user.id,
            chargingStationID: testData.chargingStationContext.getChargingStation().id,
            connectorID: 1
          });

          expect(response.status).to.be.eq(StatusCodes.OK);
          assert(response.data.car.id === defaultCar.id);
          assert(response.data.tag.id === defaultTag.id);
          expect(response.data.car.default).to.be.true;
          expect(response.data.tag.default).to.be.true;
        });

        test('When getting his session context for (any connector), (any charging station), (default tag id) and (default car id)', async () => {
          const response = await testData.userService.userApi.getUserSessionContext({
            userID: user.id,
            chargingStationID: testData.chargingStationContext.getChargingStation().id,
            connectorID: 1,
            carID: defaultCar.id,
            tagID: defaultTag.id
          });
          expect(response.status).to.be.eq(StatusCodes.OK);
          assert(response.data.car.id === defaultCar.id);
          assert(response.data.tag.id === defaultTag.id);
          expect(response.data.car.default).to.be.true;
          expect(response.data.tag.default).to.be.true;
        });

        test('When getting his session context for (any connector), (any charging station), (non-default tag id) and (non-default car id)', async () => {
          const response = await testData.userService.userApi.getUserSessionContext({
            userID: user.id,
            chargingStationID: testData.chargingStationContext.getChargingStation().id,
            connectorID: 1,
            carID: car.id,
            tagID: tag.id
          });

          expect(response.status).to.be.eq(StatusCodes.OK);
          assert(response.data.car.id === car.id);
          assert(response.data.tag.id === tag.id);
          assert(!response.data.car.default);
          assert(!response.data.tag.default);

        });
      });
    });
  });
});
