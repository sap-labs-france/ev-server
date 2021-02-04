import chai, { expect } from 'chai';

import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import RegistrationToken from '../types/RegistrationToken';
import config from '../config';
import faker from 'faker';
import moment from 'moment';

class TestData {
  public newRegistrationToken: RegistrationToken;
  public updatedRegistrationToken: RegistrationToken;
  public createdTokens: RegistrationToken[] = [];
  public superAdminCentralService: any;
  // Public centralService: CentralServerService;
  public tenantContext: any;
  public userContext: any;
  public fakeRegistrationToken: any;
  public userAdminContext: any;
  public adminCentralService: CentralServerService;
  public basicUserContext: any;
  public basicCentralService: CentralServerService;
}

const testData: TestData = new TestData();

describe('Registration token tests', function() {
  this.timeout(300000); // Will automatically stop the unit test after that period of time

  before(async () => {
    // Chai.config.includeStack = true;
    // await ContextProvider.defaultInstance.prepareContexts();
    // testData.adminCentralService = new CentralServerService(null, { email: config.get('superadmin.username'), password: config.get('superadmin.password') });
    testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
    testData.basicUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
    testData.adminCentralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS, {
      email: config.get('admin.username'),
      password: config.get('admin.password')
    });
  });

  after(async () => {
    // TestData.adminCentralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS, {
    //   email: config.get('admin.username'),
    //   password: config.get('admin.password')
    // });
    // // Delete any created car
    // // eslint-disable-next-line @typescript-eslint/no-misused-promises
    // testData.createdTokens.forEach(async (token) => {
    //   await testData.adminCentralService.deleteEntity(
    //     testData.adminCentralService.registrationApi,
    //     token,
    //     false
    //   );
    // });
  });

  describe('Success cases', () => {
    describe('With all component (tenant utall)', () => {
      describe('Where admin user', () => {
        // Create
        it('Should be able to create a new registration token', async () => {
          const registrationTokenToCreate = Factory.registrationToken.build();
          testData.newRegistrationToken = await testData.adminCentralService.createEntity(
            testData.adminCentralService.registrationApi,
            registrationTokenToCreate
          );
          testData.createdTokens.push(testData.newRegistrationToken);
        });

        // Check creation readById
        it('Should find the created registration token by id', async () => {
          await testData.adminCentralService.getEntityById(
            testData.adminCentralService.registrationApi,
            testData.createdTokens[0],
          );
        });

        // Check creation readAll
        it('Should find the created registration token in the tokens list', async () => {
          // Check if the created entity is in the list
          await testData.adminCentralService.checkEntityInList(
            testData.adminCentralService.registrationApi,
            testData.newRegistrationToken
          );
        });

        // Update
        it('Should be able to update a registration token', async () => {
          testData.newRegistrationToken.description = faker.random.word();
          testData.newRegistrationToken.expirationDate = faker.date.future();

          await testData.adminCentralService.updateEntity(
            testData.adminCentralService.registrationApi,
            testData.newRegistrationToken,
            false
          );
        });

        // Verify update readById
        it('Should find the updated registration token by id', async () => {
          // Check if the updated entity can be retrieved with its id
          const updatedRegistrationToken = await testData.adminCentralService.getEntityById(
            testData.adminCentralService.registrationApi,
            testData.newRegistrationToken,
            false
          );
          expect(updatedRegistrationToken.data.description).to.equal(testData.newRegistrationToken.description);
          expect(updatedRegistrationToken.data.expirationDate).to.equal(moment.utc(testData.newRegistrationToken.expirationDate).format('yyyy-MM-DD[T]HH:mm:ss.SSS[Z]'));
        });

        // Delete
        it('Should be able to delete the created registration token', async () => {
          // Delete the created entity
          await testData.adminCentralService.deleteEntity(
            testData.adminCentralService.registrationApi,
            testData.newRegistrationToken
          );
        });

        // Verify delete readById
        it('Should not find the deleted asset with its id', async () => {
          // Check the deleted entity cannot be retrieved with its id
          await testData.adminCentralService.checkDeletedEntityById(
            testData.adminCentralService.registrationApi,
            testData.newRegistrationToken
          );
        });
      });

      describe('Where basic user', () => {
        // Before(async function() {
        //   testData.basicUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        //   testData.basicCentralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS, testData.basicUserContext);

        //   const registrationTokenToCreate = Factory.registrationToken.build();
        //   testData.newRegistrationToken = await testData.adminCentralService.createEntity(
        //     testData.adminCentralService.registrationApi,
        //     registrationTokenToCreate
        //   );
        // });

        // Create
        // it('Should not be able to create a new registration token', async () => {
        //   testData.fakeRegistrationToken = Factory.registrationToken.build();

        //   const response = await testData.basicCentralService.createEntity(
        //     testData.basicCentralService.registrationApi,
        //     testData.fakeRegistrationToken,
        //     false
        //   );
        //   expect(response.status).to.equal(401);
        // });

        // Check creation readById
        // it('Should not be able to get by id', async () => {

        //   // Check if the created entity can be retrieved with its id
        //   const response = await testData.basicCentralService.getEntityById(
        //     testData.basicCentralService.registrationApi,
        //     testData.newRegistrationToken
        //   );
        //   expect(response.status).to.equal(401);
        // });

        // Check creation readAll
        // it('Should not be able to access the tokens list', async () => {
        // // Check if the created entity is in the list
        //   const response = await testData.basicCentralService.checkEntityInList(
        //     testData.basicCentralService.registrationApi,
        //     testData.newRegistrationToken
        //   );
        //   expect(response.status).to.be.eq(HTTPAuthError.ERROR);
        // });

        // Update
        // it('Should not be able to update a registration token', async () => {
        // // Await testData.adminCentralService.createEntity(
        // //   testData.adminCentralService.registrationApi,
        // //   testData.fakeRegistrationToken
        // // );

        //   testData.fakeRegistrationToken.description = faker.random.word();
        //   testData.fakeRegistrationToken.expirationDate = faker.date.future();

        //   const response = await testData.basicCentralService.updateEntity(
        //     testData.basicCentralService.registrationApi,
        //     testData.fakeRegistrationToken
        //   );
        //   expect(response.status).to.be.eq(HTTPAuthError.ERROR);
        // });

        // Verify update didn't work readById
        // it('Should find the not updated registration token with its id', async () => {
        // // Check if the updated entity can be retrieved with its id
        //   const updatedRegistrationToken = await testData.adminCentralService.getEntityById(
        //     testData.adminCentralService.registrationApi,
        //     testData.fakeRegistrationToken
        //   );
        //   expect(updatedRegistrationToken.description).to.not.equal(testData.fakeRegistrationToken.description);
        //   expect(updatedRegistrationToken.expirationDate).to.not.equal(testData.fakeRegistrationToken.expirationDate);
        // });

        // Delete
        // it('Should not be able to delete registration token', async () => {
        // // TestData.fakeRegistrationToken = Factory.registrationToken.build();
        // // await testData.basicCentralService.createEntity(
        // //   testData.basicCentralService.registrationApi,
        // //   testData.fakeRegistrationToken
        // // );

        //   // testData.fakeRegistrationToken.description = faker.random.word();
        //   // testData.fakeRegistrationToken.expirationDate = faker.date.future();

        //   // await testData.basicCentralService.updateEntity(
        //   //   testData.basicCentralService.registrationApi,
        //   //   testData.fakeRegistrationToken,
        //   // );

        //   const response = await testData.basicCentralService.deleteEntity(
        //     testData.basicCentralService.registrationApi,
        //     testData.fakeRegistrationToken
        //   );
        //   expect(response.status).to.be.eq(HTTPAuthError.ERROR);
        // });

        // Verify delete didn't work readById
        // it('Should find the not deleted registration token with its id', async () => {
        // // Check the deleted entity cannot be retrieved with its id
        //   const response = await testData.adminCentralService.checkDeletedEntityById(
        //     testData.adminCentralService.registrationApi,
        //     testData.createdTokens[0]
        //   );
        //   // Expect the registration token to be found
        //   expect(response.status).to.equal(200);

        // });
      });
    }); // Fin de describe('With all component (tenant utall)
    after(async () => {
      testData.adminCentralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS, {
        email: config.get('admin.username'),
        password: config.get('admin.password')
      });
      // Delete any created car
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      testData.createdTokens.forEach(async (token) => {
        await testData.adminCentralService.deleteEntity(
          testData.adminCentralService.registrationApi,
          token,
          false
        );
      });
    });
  });
});
