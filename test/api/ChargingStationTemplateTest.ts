import CentralServerService from './client/CentralServerService';
import { ChargingStationTemplate } from '../../src/types/ChargingStation';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import { StatusCodes } from 'http-status-codes';
import { expect } from 'chai';

class TestData {
  public newChargingStationTemplateID: any = {};
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
        const response = await testData.superAdminCentralService.createEntity(testData.superAdminCentralService.chargingStationTemplateApi, cstToCreate, false);
        expect(response.status).to.equal(StatusCodes.OK);
        expect(response.data).not.null;
        expect(response.data.status).to.eql('Success');
        expect(response.data).to.have.property('id');
        testData.createdChargingStationTemplates.push(cstToCreate);
        testData.newChargingStationTemplateID.id = response.data.id;
      });

      it('Should find the created cst by id', async () => {
        expect(testData.newChargingStationTemplateID.id).to.not.be.null;
        // Retrieve it from the backend
        const response = await testData.superAdminCentralService.chargingStationTemplateApi.readById(testData.newChargingStationTemplateID.id);
        // Check if ok
        expect(response.status).to.equal(StatusCodes.OK);
        expect(response.data.id).is.eql(testData.newChargingStationTemplateID.id);
      });

      // useless for me
      it(
        'Should find the created cst in the db',
        async () => {
          // Check if the created entity is in the list
          await testData.superAdminCentralService.getEntityById(
            testData.superAdminCentralService.chargingStationTemplateApi,
            testData.newChargingStationTemplateID
          );
        }
      );

      // Update
      it('Should be able to update a cst', async () => {
        const CSTtoUpdate = testData.createdChargingStationTemplates[0];
        CSTtoUpdate.template.chargePointVendor = 'new chargePointVendor';
        await testData.superAdminCentralService.updateEntity(
          testData.superAdminCentralService.chargingStationTemplateApi,
          { ...CSTtoUpdate, ...testData.newChargingStationTemplateID },
        );
      });

      // Delete
      it('Should be able to delete the created cst',
        async () => {
        // Delete the created CST
          await testData.superAdminCentralService.deleteEntity(
            testData.superAdminCentralService.chargingStationTemplateApi,
            testData.newChargingStationTemplateID
          );
        });
    });
  });
});
