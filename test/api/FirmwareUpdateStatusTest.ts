import { ChargePointStatus, OCPPFirmwareStatus } from '../../src/types/ocpp/OCPPServer';
import chai, { expect } from 'chai';

import ChargingStationContext from './context/ChargingStationContext';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import SiteAreaContext from './context/SiteAreaContext';
import SiteContext from './context/SiteContext';
import { StatusCodes } from 'http-status-codes';
import TenantContext from './context/TenantContext';
import chaiSubset from 'chai-subset';

chai.use(chaiSubset);

class TestData {
  public tenantContext: TenantContext;
  public centralUserContext: any;
  public siteContext: SiteContext;
  public siteAreaContext: SiteAreaContext;
  public chargingStationContext: ChargingStationContext;
}

const testData: TestData = new TestData();

describe('Firmware Update Status', () => {
  jest.setTimeout(60000); // Will automatically stop test after that period of time

  beforeAll(async () => {
    chai.config.includeStack = true;
    await ContextProvider.defaultInstance.prepareContexts();
  });

  afterAll(async () => {
    // Final cleanup at the end
    await ContextProvider.defaultInstance.cleanUpCreatedContent();
  });

  describe('With all components (utall)', () => {
    beforeAll(async () => {
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
      testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION);
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);
      testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
      await testData.chargingStationContext.sendHeartbeat();
    });

    afterAll(async () => {
      await testData.chargingStationContext.cleanUpCreatedData();
    });

    describe('Where any user', () => {

      afterAll(async () => {
        // After tests ensure that the charging station are Idle
        const response = await testData.chargingStationContext.sendFirmwareStatusNotification(OCPPFirmwareStatus.IDLE);
        expect(response).to.eql({});
      });

      it(
        'An idle Charging station should have the firmwareUpdateStatus set to Idle or be empty',
        async () => {
          const response = await testData.chargingStationContext.readChargingStation();
          expect(response.status).to.equal(StatusCodes.OK);
          expect(response.data.firmwareUpdateStatus).to.satisfy((firmwareUpdateStatus) => {
            if (!firmwareUpdateStatus || firmwareUpdateStatus === OCPPFirmwareStatus.IDLE) {
              return true;
            }
            return false;
          });
        }
      );

      it('Should correctly assign Downloaded Status', async () => {
        const firmwareResponse = await testData.chargingStationContext.sendFirmwareStatusNotification(OCPPFirmwareStatus.DOWNLOADED);
        expect(firmwareResponse).to.eql({});
        const chargingStationResponse = await testData.chargingStationContext.readChargingStation();
        expect(chargingStationResponse.status).to.equal(StatusCodes.OK);
        expect(chargingStationResponse.data.firmwareUpdateStatus).to.equal(OCPPFirmwareStatus.DOWNLOADED);
      });

      it('Should correctly assign Downloading Status', async () => {
        const firmwareResponse = await testData.chargingStationContext.sendFirmwareStatusNotification(OCPPFirmwareStatus.DOWNLOADING);
        expect(firmwareResponse).to.eql({});
        const chargingStationResponse = await testData.chargingStationContext.readChargingStation();
        expect(chargingStationResponse.status).to.equal(StatusCodes.OK);
        expect(chargingStationResponse.data.firmwareUpdateStatus).to.equal(OCPPFirmwareStatus.DOWNLOADING);
      });

      it('Should correctly assign Download Failed Status', async () => {
        const firmwareResponse = await testData.chargingStationContext.sendFirmwareStatusNotification(OCPPFirmwareStatus.DOWNLOAD_FAILED);
        expect(firmwareResponse).to.eql({});
        const chargingStationResponse = await testData.chargingStationContext.readChargingStation();
        expect(chargingStationResponse.status).to.equal(StatusCodes.OK);
        expect(chargingStationResponse.data.firmwareUpdateStatus).to.equal(OCPPFirmwareStatus.DOWNLOAD_FAILED);
      });

      it('Should have the connectors to available before Installing', async () => {
        const chargingStationResponse = await testData.chargingStationContext.readChargingStation();
        expect(chargingStationResponse.status).to.equal(StatusCodes.OK);
        for (let i = 0; i < chargingStationResponse.data.connectors.length; i++) {
          expect(chargingStationResponse.data.connectors[i].status).to.equal(ChargePointStatus.AVAILABLE);
        }
      });

      it('Should correctly assign Installing Status', async () => {
        const firmwareResponse = await testData.chargingStationContext.sendFirmwareStatusNotification(OCPPFirmwareStatus.INSTALLING);
        expect(firmwareResponse).to.eql({});
        const chargingStationResponse = await testData.chargingStationContext.readChargingStation();
        expect(chargingStationResponse.status).to.equal(StatusCodes.OK);
        expect(chargingStationResponse.data.firmwareUpdateStatus).to.equal(OCPPFirmwareStatus.INSTALLING);
      });

      it('Should correctly assign Installed Status', async () => {
        const firmwareResponse = await testData.chargingStationContext.sendFirmwareStatusNotification(OCPPFirmwareStatus.INSTALLED);
        expect(firmwareResponse).to.eql({});
        const chargingStationResponse = await testData.chargingStationContext.readChargingStation();
        expect(chargingStationResponse.status).to.equal(StatusCodes.OK);
        expect(chargingStationResponse.data.firmwareUpdateStatus).to.equal(OCPPFirmwareStatus.INSTALLED);
      });

      it(
        'Should restore the connectors to available after Installing',
        async () => {
          const response = await testData.chargingStationContext.readChargingStation();
          expect(response.status).to.equal(StatusCodes.OK);
          const chargingStation = response.data;
          for (let i = 0; i < chargingStation.connectors.length; i++) {
            expect(chargingStation.connectors[i].status).to.equal(ChargePointStatus.AVAILABLE);
          }
        }
      );

      it('Should correctly assign Installation Failed Status', async () => {
        const firmwareResponse = await testData.chargingStationContext.sendFirmwareStatusNotification(OCPPFirmwareStatus.INSTALLATION_FAILED);
        expect(firmwareResponse).to.eql({});
        const chargingStationResponse = await testData.chargingStationContext.readChargingStation();
        expect(chargingStationResponse.status).to.equal(StatusCodes.OK);
        expect(chargingStationResponse.data.firmwareUpdateStatus).to.equal(OCPPFirmwareStatus.INSTALLATION_FAILED);
      });

      it('Should correctly assign Idle Status', async () => {
        const firmwareResponse = await testData.chargingStationContext.sendFirmwareStatusNotification(OCPPFirmwareStatus.IDLE);
        expect(firmwareResponse).to.eql({});
        const chargingStationResponse = await testData.chargingStationContext.readChargingStation();
        expect(chargingStationResponse.status).to.equal(StatusCodes.OK);
        expect(chargingStationResponse.data.firmwareUpdateStatus).to.equal(OCPPFirmwareStatus.IDLE);
      });
    });
  });
});
