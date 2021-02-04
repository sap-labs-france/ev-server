import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import { HTTPAuthError } from '../../src/types/HTTPError';
import RegistrationToken from '../types/RegistrationToken';
import { expect } from 'chai';
import faker from 'faker';
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

describe('Registration token tests', function() {
  this.timeout(300000); // Will automatically stop the unit test after that period of time

  before(async () => {
    testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
    testData.adminUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
    testData.adminCentralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS, testData.adminUserContext);
  });

  after(async () => {
    // Final clean up at the end
    await ContextProvider.defaultInstance.cleanUpCreatedContent();
  });

  describe('With all component (tenant utall)', () => {
    describe('Where admin user', () => {
      // Create
      it('Should be able to create a new registration token', async () => {
        const registrationTokenToCreate = Factory.registrationToken.build();
        testData.newRegistrationToken = await testData.adminCentralService.createEntity(
          testData.adminCentralService.registrationApi,
          registrationTokenToCreate
        );
        testData.createdRegistrationTokens.push(registrationTokenToCreate);
      });

      // Check creation readById
      it('Should find the created registration token by id', async () => {
        await testData.adminCentralService.getEntityById(
          testData.adminCentralService.registrationApi,
          testData.newRegistrationToken
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

      // Update / revoke
      it('Should be able to update a registration token', async () => {
        testData.newRegistrationToken.description = faker.random.word();
        testData.newRegistrationToken.expirationDate = faker.date.future();

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
      before(async () => {
        testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
        testData.basicUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        testData.basicCentralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS, testData.basicUserContext);
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
        expect(response.status).to.be.eq(HTTPAuthError.ERROR);
      });

      // Check readById
      it('Should not be able to get registration token by id', async () => {
        // Check cannot access
        const response = await testData.basicCentralService.getEntityById(
          testData.basicCentralService.registrationApi,
          testData.newRegistrationToken,
          false
        );
        expect(response.status).to.be.eq(HTTPAuthError.ERROR);
      });

      // Check readAll
      it('Should not be able to retrieve registration tokens list', async () => {
        // Check cannot access
        const response = await testData.basicCentralService.checkEntityInList(
          testData.basicCentralService.registrationApi,
          testData.newRegistrationToken,
          false
        );
        expect(response.status).to.equal(HTTPAuthError.ERROR);
      });

      // Update
      it('Should not be able to update a registration token', async () => {
        // Check cannot update
        testData.newRegistrationToken.description = faker.random.word();
        testData.newRegistrationToken.expirationDate = faker.date.future();

        const response = await testData.basicCentralService.updateEntity(
          testData.basicCentralService.registrationApi,
          testData.newRegistrationToken,
          false
        );
        expect(response.status).to.equal(HTTPAuthError.ERROR);
      });

      // Delete
      it('Should not be able to delete the created registration token', async () => {
        // Check cannot delete
        const response = await testData.basicCentralService.deleteEntity(
          testData.basicCentralService.registrationApi,
          testData.newRegistrationToken,
          false
        );
        expect(response.status).to.equal(HTTPAuthError.ERROR);
      });
    });
  });
});
