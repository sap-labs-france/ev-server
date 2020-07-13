import { ChargePointErrorCode, ChargePointStatus, OCPPStatusNotificationRequest } from '../../src/types/ocpp/OCPPServer';
import { SapSmartChargingSetting, SettingDB, SmartChargingSetting, SmartChargingSettingsType } from '../../src/types/Setting';
import chai, { assert, expect } from 'chai';

import CPOSessionsEndpoint from '../server/ocpi/ocpi-services-impl/ocpi-2.1.1/CPOSessionsEndpoint';
import CentralServerService from './client/CentralServerService';
import ChargingStationContext from './context/ChargingStationContext';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Cypher from '../../src/utils/Cypher';
import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import SapSmartChargingIntegration from '../../src/integration/smart-charging/sap-smart-charging/SapSmartChargingIntegration';
import SiteContext from './context/SiteContext';
import SmartChargingIntegration from '../../src/integration/smart-charging/SmartChargingIntegration';
import TenantContext from './context/TenantContext';
import User from '../../src/types/User';
import chaiSubset from 'chai-subset';
import config from '../config';
import global from '../../src/types/GlobalType';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

let smartChargingIntegration: SmartChargingIntegration<SmartChargingSetting>;

class TestData {
  public tenantContext: TenantContext;
  public centralUserContext: any;
  public centralUserService: CentralServerService;
  public userContext: User;
  public userService: CentralServerService;
  public siteContext: SiteContext;
  public siteAreaContext: any;
  public chargingStationContext: ChargingStationContext;
  public createdUsers: User[] = [];
  public isForcedSynchro: boolean;
  public pending = false;

  public static async setSmartChargingValidCredentials(testData) {
    const sapSmartChargingSettings = TestData.getSmartChargingSettings();
    await TestData.saveSmartChargingSettings(testData, sapSmartChargingSettings);
    sapSmartChargingSettings.password = Cypher.encrypt(sapSmartChargingSettings.password);
    smartChargingIntegration = new SapSmartChargingIntegration(testData.tenantContext.getTenant().id, sapSmartChargingSettings);
    expect(smartChargingIntegration).to.not.be.null;
  }


  public static getSmartChargingSettings(): SapSmartChargingSetting {
    return {
      optimizerUrl: config.get('smartCharging.optimizerUrl'),
      user: config.get('smartCharging.user'),
      password: config.get('smartCharging.password'),
    } as SapSmartChargingSetting;
  }

  public static async saveSmartChargingSettings(testData, sapSmartChargingSettings: SapSmartChargingSetting) {
    const tenantSmartChargingSettings = await testData.userService.settingApi.readAll({ 'Identifier': 'smartCharging' });
    expect(tenantSmartChargingSettings.data.count).to.be.eq(1);
    const componentSetting: SettingDB = tenantSmartChargingSettings.data.result[0];
    componentSetting.content.type = SmartChargingSettingsType.SAP_SMART_CHARGING;
    componentSetting.content.sapSmartCharging = sapSmartChargingSettings;
    componentSetting.sensitiveData = ['content.password.secretKey'];
    await testData.userService.settingApi.update(componentSetting);
  }
}

const testData: TestData = new TestData();

const smartChargingSettings = TestData.getSmartChargingSettings();
for (const key of Object.keys(smartChargingSettings)) {
  if (!smartChargingSettings[key] || smartChargingSettings[key] === '') {
    testData.pending = true;
  }
}

const chargingStationConnector1Charging: OCPPStatusNotificationRequest = {
  connectorId: 1,
  status: ChargePointStatus.CHARGING,
  errorCode: ChargePointErrorCode.NO_ERROR,
  timestamp: new Date().toISOString()
};
const chargingStationConnector2Charging: OCPPStatusNotificationRequest = {
  connectorId: 2,
  status: ChargePointStatus.CHARGING,
  errorCode: ChargePointErrorCode.NO_ERROR,
  timestamp: new Date().toISOString()
};

const chargingStationConnector1Available: OCPPStatusNotificationRequest = {
  connectorId: 1,
  status: ChargePointStatus.AVAILABLE,
  errorCode: ChargePointErrorCode.NO_ERROR,
  timestamp: new Date().toISOString()
};
const chargingStationConnector2Available: OCPPStatusNotificationRequest = {
  connectorId: 2,
  status: ChargePointStatus.AVAILABLE,
  errorCode: ChargePointErrorCode.NO_ERROR,
  timestamp: new Date().toISOString()
};


describe('Smart Charging Service', function() {
  this.pending = testData.pending;
  this.timeout(1000000);

  describe('With component SmartCharging (tenant utsmartcharging)', () => {
    before(async () => {
      global.database = new MongoDBStorage(config.get('storage'));
      await global.database.start();
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_SMART_CHARGING);
      testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      expect(testData.userContext).to.not.be.null;
      testData.centralUserService = new CentralServerService(
        testData.tenantContext.getTenant().subdomain,
        testData.centralUserContext
      );
      testData.isForcedSynchro = false;
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
      const tenant = testData.tenantContext.getTenant();
      if (tenant.id) {
        await TestData.setSmartChargingValidCredentials(testData);
      } else {
        throw new Error(`Unable to get Tenant ID for tenant : ${ContextDefinition.TENANT_CONTEXTS.TENANT_SMART_CHARGING}`);
      }
    });

    after(async () => {
      await testData.chargingStationContext.cleanUpCreatedData();
    });

    it('Should connect to Smart Charging Provider', async () => {
      const response = await testData.userService.smartChargingApi.testConnection({});
      expect(response.data).containSubset(Constants.REST_RESPONSE_SUCCESS);
    });

    describe('Test for three phased site area', () => {
      before(async () => {
        testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
        testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_THREE_PHASED);
        testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
        testData.siteAreaContext.siteArea.voltage = 230;
        testData.siteAreaContext.siteArea.numberOfPhases = 3;
        // Console.log(testData.chargingStationContext);
      });

      after(async () => {
        await testData.chargingStationContext.setConnectorStatus(chargingStationConnector1Available);
        await testData.chargingStationContext.setConnectorStatus(chargingStationConnector2Available);
      });


      it('Test for one car charging', async () => {
        const connectorId = 1;
        const tagId = testData.userContext.tags[0].id;
        const meterStart = 180;
        const startDate = new Date;
        const transactionResponse = await testData.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
        await testData.chargingStationContext.setConnectorStatus(chargingStationConnector1Charging);
        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.siteArea);
        expect(chargingProfiles).containSubset([{
          'chargingStationID': 'cs-16-ut-site-withSmartChargingThreePhased',
          'connectorID': chargingStationConnector1Charging.connectorId,
          'chargePointID': 1,
          'profile': {
            'chargingProfileId': 1,
            'chargingProfileKind': 'Absolute',
            'chargingProfilePurpose': 'TxProfile',
            'stackLevel': 2,
            'transactionId': transactionResponse.transactionId,
            'chargingSchedule': {
              'chargingRateUnit': 'A',
              'duration': chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod.length * 15 * 60
            }
          }
        }]);
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': 96
          },
          {
            'startPeriod': 900,
            'limit': 96
          },
          {
            'startPeriod': 1800,
            'limit': 96
          },
          {
            'startPeriod': 2700,
            'limit': 96
          },
          {
            'startPeriod': 3600,
            'limit': 96
          },
          {
            'startPeriod': 4500,
            'limit': 96
          },
          {
            'startPeriod': 5400,
            'limit': 96
          },
          {
            'startPeriod': 6300,
            'limit': 96
          },
          {
            'startPeriod': 7200,
            'limit': 96
          },
          {
            'startPeriod': 8100,
            'limit': 96
          },
        ]);
      });

      it('Test for two cars charging', async () => {
        const connectorId = 2;
        const tagId = testData.userContext.tags[0].id;
        const meterStart = 180;
        const startDate = new Date;
        const transactionResponse = await testData.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
        await testData.chargingStationContext.setConnectorStatus(chargingStationConnector2Charging);
        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.siteArea);
        expect(chargingProfiles[0]).containSubset({
          'chargingStationID': 'cs-16-ut-site-withSmartChargingThreePhased',
          'connectorID': chargingStationConnector1Charging.connectorId,
          'chargePointID': 1,
          'profile': {
            'chargingProfileId': 1,
            'chargingProfileKind': 'Absolute',
            'chargingProfilePurpose': 'TxProfile',
            'stackLevel': 2,
            'chargingSchedule': {
              'chargingRateUnit': 'A',
              'duration': chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod.length * 15 * 60
            }
          }
        });
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': 96
          },
          {
            'startPeriod': 900,
            'limit': 96
          },
          {
            'startPeriod': 1800,
            'limit': 96
          },
          {
            'startPeriod': 2700,
            'limit': 96
          },
          {
            'startPeriod': 3600,
            'limit': 96
          },
          {
            'startPeriod': 4500,
            'limit': 96
          },
          {
            'startPeriod': 5400,
            'limit': 96
          },
          {
            'startPeriod': 6300,
            'limit': 96
          },
          {
            'startPeriod': 7200,
            'limit': 96
          },
          {
            'startPeriod': 8100,
            'limit': 96
          },
        ]);
        expect(chargingProfiles[1]).containSubset({
          'chargingStationID': 'cs-16-ut-site-withSmartChargingThreePhased',
          'connectorID': chargingStationConnector2Charging.connectorId,
          'chargePointID': 1,
          'profile': {
            'transactionId': transactionResponse.transactionId,
            'chargingProfileId': 2,
            'chargingProfileKind': 'Absolute',
            'chargingProfilePurpose': 'TxProfile',
            'stackLevel': 2,
            'chargingSchedule': {
              'chargingRateUnit': 'A',
              'duration': chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod.length * 15 * 60
            }
          }
        });
        expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': 96
          },
          {
            'startPeriod': 900,
            'limit': 96
          },
          {
            'startPeriod': 1800,
            'limit': 96
          },
          {
            'startPeriod': 2700,
            'limit': 96
          },
          {
            'startPeriod': 3600,
            'limit': 96
          },
          {
            'startPeriod': 4500,
            'limit': 96
          },
          {
            'startPeriod': 5400,
            'limit': 96
          },
          {
            'startPeriod': 6300,
            'limit': 96
          },
          {
            'startPeriod': 7200,
            'limit': 96
          },
          {
            'startPeriod': 8100,
            'limit': 96
          },
        ]);
      });
      it('Test for two cars charging with lower site area limit', async () => {
        testData.siteAreaContext.siteArea.maximumPower = 30000;
        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.siteArea);
        expect(chargingProfiles[0]).containSubset({
          'chargingStationID': 'cs-16-ut-site-withSmartChargingThreePhased',
          'connectorID': chargingStationConnector1Charging.connectorId,
          'chargePointID': 1,
          'profile': {
            'chargingProfileId': 1,
            'chargingProfileKind': 'Absolute',
            'chargingProfilePurpose': 'TxProfile',
            'stackLevel': 2,
            'chargingSchedule': {
              'chargingRateUnit': 'A',
              'chargingSchedulePeriod': [
                {
                  'startPeriod': 0,
                  'limit': 0
                },
                {
                  'startPeriod': 900,
                  'limit': 0
                },
                {
                  'startPeriod': 1800,
                  'limit': 0
                }
              ],
              'duration': chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod.length * 15 * 60
            }
          }
        });
        expect(chargingProfiles[1]).containSubset({
          'chargingStationID': 'cs-16-ut-site-withSmartChargingThreePhased',
          'connectorID': chargingStationConnector2Charging.connectorId,
          'chargePointID': 1,
          'profile': {
            'chargingProfileId': 2,
            'chargingProfileKind': 'Absolute',
            'chargingProfilePurpose': 'TxProfile',
            'stackLevel': 2,
            'chargingSchedule': {
              'chargingRateUnit': 'A',
              'duration': chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod.length * 15 * 60
            }
          }
        });
        expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': 96
          },
          {
            'startPeriod': 900,
            'limit': 96
          },
          {
            'startPeriod': 1800,
            'limit': 96
          },
          {
            'startPeriod': 2700,
            'limit': 96
          },
          {
            'startPeriod': 3600,
            'limit': 96
          },
          {
            'startPeriod': 4500,
            'limit': 96
          },
          {
            'startPeriod': 5400,
            'limit': 96
          },
          {
            'startPeriod': 6300,
            'limit': 96
          },
          {
            'startPeriod': 7200,
            'limit': 96
          },
          {
            'startPeriod': 8100,
            'limit': 96
          },
        ]);
      });
    });
    describe('Test for single phased site area', () => {
      before(async () => {
        testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
        testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_SINGLE_PHASED);
        testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
        testData.siteAreaContext.siteArea.voltage = 230;
        testData.siteAreaContext.siteArea.numberOfPhases = 1;
      });

      after(async () => {
        await testData.chargingStationContext.setConnectorStatus(chargingStationConnector1Available);
        await testData.chargingStationContext.setConnectorStatus(chargingStationConnector2Available);
      });


      it('Test for one car charging', async () => {
        const connectorId = 1;
        const tagId = testData.userContext.tags[0].id;
        const meterStart = 180;
        const startDate = new Date;
        const transactionResponse = await testData.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
        await testData.chargingStationContext.setConnectorStatus(chargingStationConnector1Charging);
        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.siteArea);
        expect(chargingProfiles).containSubset([{
          'chargingStationID': 'cs-16-ut-site-withSmartChargingSinglePhased',
          'connectorID': chargingStationConnector1Charging.connectorId,
          'chargePointID': 1,
          'profile': {
            'transactionId': transactionResponse.transactionId,
            'chargingProfileId': 1,
            'chargingProfileKind': 'Absolute',
            'chargingProfilePurpose': 'TxProfile',
            'stackLevel': 2,
            'chargingSchedule': {
              'chargingRateUnit': 'A',
              'duration': chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod.length * 15 * 60
            }
          }
        }]);
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': 32
          },
          {
            'startPeriod': 900,
            'limit': 32
          },
          {
            'startPeriod': 1800,
            'limit': 32
          },
          {
            'startPeriod': 2700,
            'limit': 32
          },
          {
            'startPeriod': 3600,
            'limit': 32
          },
          {
            'startPeriod': 4500,
            'limit': 32
          },
          {
            'startPeriod': 5400,
            'limit': 32
          },
          {
            'startPeriod': 6300,
            'limit': 32
          },
          {
            'startPeriod': 7200,
            'limit': 32
          },
          {
            'startPeriod': 8100,
            'limit': 32
          },
        ]);
      });

      it('Test for two cars charging', async () => {
        const connectorId = 2;
        const tagId = testData.userContext.tags[0].id;
        const meterStart = 180;
        const startDate = new Date;
        const transactionResponse = await testData.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
        await testData.chargingStationContext.setConnectorStatus(chargingStationConnector2Charging);
        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.siteArea);
        expect(chargingProfiles[0]).containSubset({
          'chargingStationID': 'cs-16-ut-site-withSmartChargingSinglePhased',
          'connectorID': 1,
          'chargePointID': 1,
          'profile': {
            'chargingProfileId': 1,
            'chargingProfileKind': 'Absolute',
            'chargingProfilePurpose': 'TxProfile',
            'stackLevel': 2,
            'chargingSchedule': {
              'chargingRateUnit': 'A',
              'chargingSchedulePeriod': [
                {
                  'startPeriod': 0,
                  'limit': 32
                },
                {
                  'startPeriod': 900,
                  'limit': 32
                },
                {
                  'startPeriod': 1800,
                  'limit': 32
                }
              ],
              'duration': chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod.length * 15 * 60
            }
          }
        });
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': 32
          },
          {
            'startPeriod': 900,
            'limit': 32
          },
          {
            'startPeriod': 1800,
            'limit': 32
          },
          {
            'startPeriod': 2700,
            'limit': 32
          },
          {
            'startPeriod': 3600,
            'limit': 32
          },
          {
            'startPeriod': 4500,
            'limit': 32
          },
          {
            'startPeriod': 5400,
            'limit': 32
          },
          {
            'startPeriod': 6300,
            'limit': 32
          },
          {
            'startPeriod': 7200,
            'limit': 32
          },
          {
            'startPeriod': 8100,
            'limit': 32
          },
        ]);
        expect(chargingProfiles[1]).containSubset({
          'chargingStationID': 'cs-16-ut-site-withSmartChargingSinglePhased',
          'connectorID': 2,
          'chargePointID': 1,
          'profile': {
            'chargingProfileId': 2,
            'chargingProfileKind': 'Absolute',
            'chargingProfilePurpose': 'TxProfile',
            'stackLevel': 2,
            'chargingSchedule': {
              'chargingRateUnit': 'A',
              'duration': chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod.length * 15 * 60
            }
          }
        });
        expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': 32
          },
          {
            'startPeriod': 900,
            'limit': 32
          },
          {
            'startPeriod': 1800,
            'limit': 32
          },
          {
            'startPeriod': 2700,
            'limit': 32
          },
          {
            'startPeriod': 3600,
            'limit': 32
          },
          {
            'startPeriod': 4500,
            'limit': 32
          },
          {
            'startPeriod': 5400,
            'limit': 32
          },
          {
            'startPeriod': 6300,
            'limit': 32
          },
          {
            'startPeriod': 7200,
            'limit': 32
          },
          {
            'startPeriod': 8100,
            'limit': 32
          },
        ]);
      });
      it('Test for two cars charging with lower site area limit', async () => {
        testData.siteAreaContext.siteArea.maximumPower = 10000;
        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.siteArea);
        expect(chargingProfiles[0]).containSubset({
          'chargingStationID': 'cs-16-ut-site-withSmartChargingSinglePhased',
          'connectorID': 1,
          'chargePointID': 1,
          'profile': {
            'chargingProfileId': 1,
            'chargingProfileKind': 'Absolute',
            'chargingProfilePurpose': 'TxProfile',
            'stackLevel': 2,
            'chargingSchedule': {
              'chargingRateUnit': 'A',
              'duration': chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod.length * 15 * 60
            }
          }
        });
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': 0
          },
          {
            'startPeriod': 900,
            'limit': 0
          },
          {
            'startPeriod': 1800,
            'limit': 0
          }
        ]);
        expect(chargingProfiles[1]).containSubset({
          'chargingStationID': 'cs-16-ut-site-withSmartChargingSinglePhased',
          'connectorID': 2,
          'chargePointID': 1,
          'profile': {
            'chargingProfileId': 2,
            'chargingProfileKind': 'Absolute',
            'chargingProfilePurpose': 'TxProfile',
            'stackLevel': 2,
            'chargingSchedule': {
              'chargingRateUnit': 'A',
              'duration': chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod.length * 15 * 60
            }
          }
        });
        expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': 32
          },
          {
            'startPeriod': 900,
            'limit': 32
          },
          {
            'startPeriod': 1800,
            'limit': 32
          },
          {
            'startPeriod': 2700,
            'limit': 32
          },
          {
            'startPeriod': 3600,
            'limit': 32
          },
          {
            'startPeriod': 4500,
            'limit': 32
          },
          {
            'startPeriod': 5400,
            'limit': 32
          },
          {
            'startPeriod': 6300,
            'limit': 32
          },
          {
            'startPeriod': 7200,
            'limit': 32
          },
          {
            'startPeriod': 8100,
            'limit': 32
          },
        ]);
      });
    });

    describe('Test for DC site area', () => {
      before(async () => {
        testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
        testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_DC);
        testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
        testData.siteAreaContext.siteArea.voltage = 230;
        testData.siteAreaContext.siteArea.numberOfPhases = 3;
      });

      after(async () => {
        await testData.chargingStationContext.setConnectorStatus(chargingStationConnector1Available);
        await testData.chargingStationContext.setConnectorStatus(chargingStationConnector2Available);
      });


      it('Test for one car charging', async () => {
        const connectorId = 1;
        const tagId = testData.userContext.tags[0].id;
        const meterStart = 180;
        const startDate = new Date;
        const transactionResponse = await testData.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
        await testData.chargingStationContext.setConnectorStatus(chargingStationConnector1Charging);
        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.siteArea);
        expect(chargingProfiles).containSubset([{
          'chargingStationID': 'cs-16-ut-site-withSmartChargingDC',
          'connectorID': chargingStationConnector1Charging.connectorId,
          'chargePointID': 1,
          'profile': {
            'transactionId': transactionResponse.transactionId,
            'chargingProfileId': 1,
            'chargingProfileKind': 'Absolute',
            'chargingProfilePurpose': 'TxProfile',
            'stackLevel': 2,
            'chargingSchedule': {
              'chargingRateUnit': 'A',
              'duration': chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod.length * 15 * 60
            }
          }
        }]);
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': 654
          },
          {
            'startPeriod': 900,
            'limit': 654
          },
          {
            'startPeriod': 1800,
            'limit': 654
          }
        ]);
      });

      it('Test for two cars charging', async () => {
        const connectorId = 2;
        const tagId = testData.userContext.tags[0].id;
        const meterStart = 180;
        const startDate = new Date;
        const transactionResponse = await testData.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
        await testData.chargingStationContext.setConnectorStatus(chargingStationConnector2Charging);
        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.siteArea);
        expect(chargingProfiles[0]).containSubset({
          'chargingStationID': 'cs-16-ut-site-withSmartChargingDC',
          'connectorID': 1,
          'chargePointID': 1,
          'profile': {
            'chargingProfileId': 1,
            'chargingProfileKind': 'Absolute',
            'chargingProfilePurpose': 'TxProfile',
            'stackLevel': 2,
            'chargingSchedule': {
              'chargingRateUnit': 'A',
              'duration': chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod.length * 15 * 60
            }
          }
        });
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': 327
          },
          {
            'startPeriod': 900,
            'limit': 327
          },
          {
            'startPeriod': 1800,
            'limit': 327
          },
          {
            'startPeriod': 2700,
            'limit': 327
          },
          {
            'startPeriod': 3600,
            'limit': 327
          },
          {
            'startPeriod': 4500,
            'limit': 327
          },
        ]);
        expect(chargingProfiles[1]).containSubset({
          'chargingStationID': 'cs-16-ut-site-withSmartChargingDC',
          'connectorID': 2,
          'chargePointID': 1,
          'profile': {
            'chargingProfileId': 2,
            'chargingProfileKind': 'Absolute',
            'chargingProfilePurpose': 'TxProfile',
            'stackLevel': 2,
            'chargingSchedule': {
              'chargingRateUnit': 'A',
              'duration': chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod.length * 15 * 60
            }
          }
        });
        expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': 327
          },
          {
            'startPeriod': 900,
            'limit': 327
          },
          {
            'startPeriod': 1800,
            'limit': 327
          },
          {
            'startPeriod': 2700,
            'limit': 327
          },
          {
            'startPeriod': 3600,
            'limit': 327
          },
          {
            'startPeriod': 4500,
            'limit': 327
          },
        ]);
      });
      it('Test for two cars charging with lower site area limit', async () => {
        testData.siteAreaContext.siteArea.maximumPower = 100000;
        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.siteArea);
        expect(chargingProfiles[0]).containSubset({
          'chargingStationID': 'cs-16-ut-site-withSmartChargingDC',
          'connectorID': 1,
          'chargePointID': 1,
          'profile': {
            'chargingProfileId': 1,
            'chargingProfileKind': 'Absolute',
            'chargingProfilePurpose': 'TxProfile',
            'stackLevel': 2,
            'chargingSchedule': {
              'chargingRateUnit': 'A',
              'duration': chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod.length * 15 * 60
            }
          }
        });
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': 107
          },
          {
            'startPeriod': 900,
            'limit': 107
          },
          {
            'startPeriod': 1800,
            'limit': 107
          },
        ]);
        expect(chargingProfiles[1]).containSubset({
          'chargingStationID': 'cs-16-ut-site-withSmartChargingDC',
          'connectorID': 2,
          'chargePointID': 1,
          'profile': {
            'chargingProfileId': 2,
            'chargingProfileKind': 'Absolute',
            'chargingProfilePurpose': 'TxProfile',
            'stackLevel': 2,
            'chargingSchedule': {
              'chargingRateUnit': 'A',
              'duration': chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod.length * 15 * 60
            }
          }
        });
        expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': 327
          },
          {
            'startPeriod': 900,
            'limit': 327
          },
          {
            'startPeriod': 1800,
            'limit': 327
          }
        ]);
      });
    });
  });
});
