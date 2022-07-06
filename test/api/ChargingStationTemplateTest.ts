import CentralServerService from './client/CentralServerService';
import { ChargingStationTemplate } from '../../src/types/ChargingStation';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import { StatusCodes } from 'http-status-codes';
import { expect } from 'chai';

class TestData {
  public newChargingStationTemplate: ChargingStationTemplate;
  public updatedChargingStationTemplate: ChargingStationTemplate;
  public tenantContext: any;
  public superAdminCentralService: CentralServerService;
  public basicUserContext: any;
  public basicCentralService: CentralServerService;
  public adminUserContext: any;
  public createdChargingStationTemplates: ChargingStationTemplate[] = [];
}

const testData: TestData = new TestData();

describe('Charging Station Template', () => {
  jest.setTimeout(30000);

  beforeAll(async () => {
    testData.superAdminCentralService = new CentralServerService('');
  });

  afterAll(async () => {
    // Final clean up at the end
    await ContextProvider.defaultInstance.cleanUpCreatedContent();
  });

  describe('With all component (super)', () => {
    describe('Success cases', () => {
      it('Should be able to create a new cst', async () => {
        const cstToCreate = Factory.chargingStationTemplate.build();
        const response = await testData.superAdminCentralService.createEntity(testData.superAdminCentralService.chargingStationTemplateApi,cstToCreate, false);
        expect(response.status).to.equal(StatusCodes.OK);
        expect(response.data).not.null;
        expect(response.data.status).to.eql('Success');
        expect(response.data).to.have.property('id');
        testData.createdChargingStationTemplates.push(response);
        testData.newChargingStationTemplate = response.data;
      });

      it('Should find the created cst by id', async () => {
        expect(testData.newChargingStationTemplate).to.not.be.null;
        // Retrieve it from the backend
        const response = await testData.superAdminCentralService.chargingStationTemplateApi.readById(testData.newChargingStationTemplate.id);
        // Check if ok
        expect(response.status).to.equal(StatusCodes.OK);
        expect(response.data.id).is.eql(testData.newChargingStationTemplate.id);
      });

      // Check creation readAll
      it(
        'Should find the created cst in the tokens list',
        async () => {
          // Check if the created entity is in the list
          await testData.superAdminCentralService.checkEntityInList(
            testData.superAdminCentralService.chargingStationTemplateApi,
            testData.newChargingStationTemplate
          );
        }
      );

      // Update
      it('Should be able to update a cst', async () => {
        const CSTtoUpdate = Factory.chargingStationTemplate.build();
        CSTtoUpdate.chargePointVendor = 'new chargePointVendor';
        await testData.superAdminCentralService.updateEntity(
          testData.superAdminCentralService.chargingStationTemplateApi,
          CSTtoUpdate,
        );
      });

      // Delete
      it('Should be able to delete the created cst',
        async () => {
        // Delete the created entity
          await testData.superAdminCentralService.deleteEntity(
            testData.superAdminCentralService.chargingStationTemplateApi,
            testData.newChargingStationTemplate
          );
        });
    });
  });
});
