import CentralServerService from './client/CentralServerService';
import { ChargingStationTemplate } from '../../src/types/ChargingStation';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import { HTTPError } from '../../src/types/HTTPError';
import { StatusCodes } from 'http-status-codes';
import { expect } from 'chai';
import faker from 'faker';
import moment from 'moment';

class TestData {
  public newChargingStationTemplate: ChargingStationTemplate;
  public updatedChargingStationTemplate: ChargingStationTemplate;
  public tenantContext: any;
  public adminCentralService: CentralServerService;
  public basicUserContext: any;
  public basicCentralService: CentralServerService;
  public adminUserContext: any;
  public createdChargingStationTemplates: ChargingStationTemplate[] = [];
}

const testData: TestData = new TestData();

describe('Charging Station Template', () => {
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
      it('Should be able to create a new charging station template', async () => {
        const ChargingStationTemplateToCreate = Factory.chargingStationTemplate.build();
        testData.newChargingStationTemplate = await testData.adminCentralService.createEntity(
          testData.adminCentralService.chargingStationTemplateApi,
          ChargingStationTemplateToCreate
        );
        testData.createdChargingStationTemplates.push(testData.newChargingStationTemplate);
      });

      // Check creation readById
      it('Should find the created registration token by id', async () => {
        await testData.adminCentralService.getEntityById(
          testData.adminCentralService.registrationApi,
          testData.newChargingStationTemplate
        );
      });

      // Check creation readAll
      it(
        'Should find the created registration token in the tokens list',
        async () => {
          // Check if the created entity is in the list
          await testData.adminCentralService.checkEntityInList(
            testData.adminCentralService.registrationApi,
            testData.newChargingStationTemplate
          );
        }
      );

      // Update
      // it('Should be able to update a registration token', async () => {
      //   testData.newChargingStationTemplate.expirationDate = faker.date.past();
      //   await testData.adminCentralService.updateEntity(
      //     testData.adminCentralService.registrationApi,
      //     testData.newChargingStationTemplate,
      //   );
      // });

      // Verify update readById
      // it('Should find the updated registration token by id', async () => {
      //   // Check if the updated entity can be retrieved with its id
      //   const updatedChargingStationTemplate = await testData.adminCentralService.getEntityById(
      //     testData.adminCentralService.registrationApi,
      //     testData.newChargingStationTemplate,
      //     false
      //   );
      //   // Expect(updatedChargingStationTemplate.data.description).to.equal(testData.newChargingStationTemplate.description);
      //   expect(updatedChargingStationTemplate.data.expirationDate).to.equal(moment.utc(testData.newChargingStationTemplate.expirationDate).format('yyyy-MM-DD[T]HH:mm:ss.SSS[Z]'));
      // });

      // Delete
      it('Should be able to delete the created registration token', async () => {
        // Delete the created entity
        await testData.adminCentralService.deleteEntity(
          testData.adminCentralService.registrationApi,
          testData.newChargingStationTemplate
        );
      });

      // Verify delete readById
      it('Should not find the deleted asset with its id', async () => {
        const ChargingStationTemplateToCreate = Factory.chargingStationTemplate.build();
        testData.newChargingStationTemplate = await testData.adminCentralService.createEntity(
          testData.adminCentralService.registrationApi,
          ChargingStationTemplateToCreate
        );
        await testData.adminCentralService.deleteEntity(
          testData.adminCentralService.registrationApi,
          testData.newChargingStationTemplate
        );
        // Check the deleted entity cannot be retrieved with its id
        await testData.adminCentralService.checkDeletedEntityById(
          testData.adminCentralService.registrationApi,
          testData.newChargingStationTemplate
        );
      });
    });

  });
});
