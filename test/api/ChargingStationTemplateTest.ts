import CentralServerService from './client/CentralServerService';
import { ChargingStationTemplate } from '../../src/types/ChargingStation';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import { StatusCodes } from 'http-status-codes';
import TenantContext from './context/TenantContext';
import { expect } from 'chai';

class TestData {
  public tenantContext: TenantContext;
  public superAdminCentralService: CentralServerService;
  public newChargingStationTemplate: Partial<ChargingStationTemplate> = {};
  public createdChargingStationTemplates: ChargingStationTemplate[] = [];
}

const testData: TestData = new TestData();

describe('Charging Station Template', () => {
  jest.setTimeout(60000);

  beforeAll(() => {
    testData.superAdminCentralService = new CentralServerService();
  });

  afterAll(async () => {
    // Final clean up at the end
    await ContextProvider.defaultInstance.cleanUpCreatedContent();
  });

  describe('In super tenant', () => {
    describe('Success cases', () => {
      it('Should be able to create a new template', async () => {
        const templateToCreate = Factory.chargingStationTemplate.build();
        const response = await testData.superAdminCentralService.createEntity(testData.superAdminCentralService.chargingStationTemplateApi, templateToCreate, false);
        expect(response.status).to.equal(StatusCodes.OK);
        expect(response.data).not.null;
        expect(response.data.status).to.eql('Success');
        expect(response.data).to.have.property('id');
        testData.createdChargingStationTemplates.push(templateToCreate);
        testData.newChargingStationTemplate.id = response.data.id;
      });

      it('Should find the created template by id', async () => {
        // Retrieve it from the backend
        const response = await testData.superAdminCentralService.chargingStationTemplateApi.readById(testData.newChargingStationTemplate.id);
        // Check if ok
        expect(response.status).to.equal(StatusCodes.OK);
        expect(response.data.id).is.eql(testData.newChargingStationTemplate.id);
      });

      // Update
      it('Should be able to update a template', async () => {
        const templateToUpdate = testData.createdChargingStationTemplates[0];
        templateToUpdate.template.chargePointVendor = 'new chargePointVendor';
        await testData.superAdminCentralService.updateEntity(
          testData.superAdminCentralService.chargingStationTemplateApi,
          { ...templateToUpdate, ...testData.newChargingStationTemplate },
        );
      });

      // Delete
      it('Should be able to delete the created template', async () => {
        await testData.superAdminCentralService.deleteEntity(
          testData.superAdminCentralService.chargingStationTemplateApi,
          testData.newChargingStationTemplate
        );
      });
    });
  });
});
