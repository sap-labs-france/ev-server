import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import { HTTPError } from '../../src/types/HTTPError';
import RegistrationToken from '../../src/types/RegistrationToken';
import { StatusCodes } from 'http-status-codes';
import { expect } from 'chai';
import { faker } from '@faker-js/faker';
import moment from 'moment';

class TestData {
  public newRegistrationToken: RegistrationToken;
  public updatedRegistrationToken: RegistrationToken;
  public tenantContext: any;
  public adminCentralService: CentralServerService;
  public basicUserContext: any;
  public basicCentralService: CentralServerService;
  public adminUserContext: any;
  public createdRegistrationTokens: RegistrationToken[] = [];
}

const testData: TestData = new TestData();

describe('Registration Token', () => {
  jest.setTimeout(300000); // Will automatically stop the unit test after that period of time

  beforeAll(async () => {
    testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
    testData.adminUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
    testData.adminCentralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS, testData.adminUserContext);
  });

  afterAll(async () => {
    // Final clean up at the end
    await ContextProvider.defaultInstance.cleanUpCreatedContent();
  });

  describe('With all component (utall)', () => {
    describe('Where admin user', () => {
      // Create
      it('Should be able to create a new registration token', async () => {
        const registrationTokenToCreate = Factory.registrationToken.build();
        testData.newRegistrationToken = await testData.adminCentralService.createEntity(
          testData.adminCentralService.registrationApi,
          registrationTokenToCreate
        );
        testData.createdRegistrationTokens.push(testData.newRegistrationToken);
      });

      // Check creation readById
      it('Should find the created registration token by id', async () => {
        await testData.adminCentralService.getEntityById(
          testData.adminCentralService.registrationApi,
          testData.newRegistrationToken
        );
      });

      // Check creation readAll
      it(
        'Should find the created registration token in the tokens list',
        async () => {
          // Check if the created entity is in the list
          await testData.adminCentralService.checkEntityInList(
            testData.adminCentralService.registrationApi,
            testData.newRegistrationToken
          );
        }
      );

      // Update
      it('Should be able to update a registration token', async () => {
        testData.newRegistrationToken.expirationDate = faker.date.past();
        await testData.adminCentralService.updateEntity(
          testData.adminCentralService.registrationApi,
          testData.newRegistrationToken,
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
        // Expect(updatedRegistrationToken.data.description).to.equal(testData.newRegistrationToken.description);
        expect(updatedRegistrationToken.data.expirationDate).to.equal(moment.utc(testData.newRegistrationToken.expirationDate).format('yyyy-MM-DD[T]HH:mm:ss.SSS[Z]'));
      });

      // Check revoke expired
      it('Should not be able to revoke expired registration token', async () => {
        // TestData.newRegistrationToken = Factory.registrationToken.build();
        testData.newRegistrationToken.description = faker.random.word();
        const response = await testData.adminCentralService.revokeEntity(
          testData.adminCentralService.registrationApi,
          testData.newRegistrationToken,
          false
        );
        expect(response.status).to.be.eq(HTTPError.GENERAL_ERROR);
      });

      // Revoke
      it('Should be able to revoke a registration token', async () => {
        // Update expiration date before testing revocation
        testData.newRegistrationToken.expirationDate = faker.date.future();
        await testData.adminCentralService.updateEntity(
          testData.adminCentralService.registrationApi,
          testData.newRegistrationToken,
        );
        // TestData.newRegistrationToken.revocationDate = new Date();
        await testData.adminCentralService.revokeEntity(
          testData.adminCentralService.registrationApi,
          testData.newRegistrationToken,
        );
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
        const registrationTokenToCreate = Factory.registrationToken.build();
        testData.newRegistrationToken = await testData.adminCentralService.createEntity(
          testData.adminCentralService.registrationApi,
          registrationTokenToCreate
        );
        await testData.adminCentralService.deleteEntity(
          testData.adminCentralService.registrationApi,
          testData.newRegistrationToken
        );
        // Check the deleted entity cannot be retrieved with its id
        await testData.adminCentralService.checkDeletedEntityById(
          testData.adminCentralService.registrationApi,
          testData.newRegistrationToken
        );
      });
    });

    describe('Where basic user assigned', () => {
      beforeAll(async () => {
        testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
        testData.basicUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        testData.basicCentralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS, testData.basicUserContext);
        // Create the entity
        const registrationTokenToCreate = Factory.registrationToken.build();
        testData.newRegistrationToken = await testData.adminCentralService.createEntity(
          testData.adminCentralService.registrationApi,
          registrationTokenToCreate
        );
        testData.createdRegistrationTokens.push(testData.newRegistrationToken);

      });
      // Create
      it('Should not be able to create a new registration token', async () => {
        // Check cannot create
        testData.newRegistrationToken = Factory.registrationToken.build();
        const response = await testData.basicCentralService.createEntity(
          testData.basicCentralService.registrationApi,
          testData.newRegistrationToken,
          false
        );
        expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
      });

      // Check readById
      it('Should not be able to get registration token by id', async () => {
        // Add a token user should
        // Check cannot access
        const response = await testData.basicCentralService.getEntityById(
          testData.basicCentralService.registrationApi,
          testData.createdRegistrationTokens[1],
          false
        );
        expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
      });

      // Check readAll
      it('Should not be able to retrieve registration tokens list', async () => {
        // Check cannot access
        const response = await testData.basicCentralService.checkEntityInList(
          testData.basicCentralService.registrationApi,
          testData.createdRegistrationTokens[1],
          false
        );
        expect(response.status).to.equal(StatusCodes.OK);
      });

      // Update
      it('Should not be able to update a registration token', async () => {
        // Check cannot update
        testData.newRegistrationToken.description = faker.random.word();
        testData.newRegistrationToken.expirationDate = faker.date.future();

        const response = await testData.basicCentralService.updateEntity(
          testData.basicCentralService.registrationApi,
          testData.createdRegistrationTokens[1],
          false
        );
        expect(response.status).to.equal(StatusCodes.FORBIDDEN);
      });

      // Delete
      it('Should not be able to delete a registration token', async () => {
        // Check cannot delete
        const response = await testData.basicCentralService.deleteEntity(
          testData.basicCentralService.registrationApi,
          testData.createdRegistrationTokens[1],
          false
        );
        expect(response.status).to.equal(StatusCodes.FORBIDDEN);
      });
    });
  });
});
