import { ChargePointErrorCode, ChargePointStatus, OCPPStatusNotificationRequest } from '../../src/types/ocpp/OCPPServer';
import { SapSmartChargingSetting, SettingDB, SmartChargingSetting, SmartChargingSettingsType } from '../../src/types/Setting';
import chai, { assert, expect } from 'chai';

import CentralServerService from './client/CentralServerService';
import { ChargingProfile } from '../types/ChargingProfile';
import ChargingStationContext from './context/ChargingStationContext';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Cypher from '../../src/utils/Cypher';
import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import SiteAreaContext from './context/SiteAreaContext';
import SiteContext from './context/SiteContext';
import SmartChargingFactory from '../../src/integration/smart-charging/SmartChargingFactory';
import SmartChargingIntegration from '../../src/integration/smart-charging/SmartChargingIntegration';
import TenantContext from './context/TenantContext';
import Transaction from '../types/Transaction';
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
  public userContext;
  public userService: CentralServerService;
  public siteContext: SiteContext;
  public siteAreaContext: SiteAreaContext;
  public chargingStationContext: ChargingStationContext;
  public chargingStationContext1: ChargingStationContext;
  public createdUsers = [];
  public isForcedSynchro: boolean;
  public pending = false;

  public static async setSmartChargingValidCredentials(testData): Promise<void> {
    const sapSmartChargingSettings = TestData.getSmartChargingSettings();
    await TestData.saveSmartChargingSettings(testData, sapSmartChargingSettings);
    sapSmartChargingSettings.password = Cypher.encrypt(sapSmartChargingSettings.password);
    smartChargingIntegration = await SmartChargingFactory.getSmartChargingImpl(testData.tenantContext.getTenant().id);
    expect(smartChargingIntegration).to.not.be.null;
  }

  public static getSmartChargingSettings(): SapSmartChargingSetting {
    return {
      optimizerUrl: config.get('smartCharging.optimizerUrl'),
      user: config.get('smartCharging.user'),
      password: config.get('smartCharging.password'),
    } as SapSmartChargingSetting;
  }

  public static async saveSmartChargingSettings(testData, sapSmartChargingSettings: SapSmartChargingSetting): Promise<void> {
    const tenantSmartChargingSettings = await testData.userService.settingApi.readAll({ 'Identifier': 'smartCharging' });
    expect(tenantSmartChargingSettings.data.count).to.be.eq(1);
    const componentSetting: SettingDB = tenantSmartChargingSettings.data.result[0];
    componentSetting.content.type = SmartChargingSettingsType.SAP_SMART_CHARGING;
    componentSetting.content.sapSmartCharging = sapSmartChargingSettings;
    componentSetting.sensitiveData = ['content.password.secretKey'];
    await testData.userService.settingApi.update(componentSetting);
  }

  // Validate properties of a charging profile with the related transaction
  public static validateChargingProfile(chargingProfile: ChargingProfile, transaction: Transaction): void {
    expect(chargingProfile).containSubset({
      'chargingStationID': transaction.chargeBoxID,
      'connectorID': transaction.connectorId,
      'chargePointID': 1,
      'profile': {
        'chargingProfileId': chargingProfile.profile.chargingProfileId,
        'chargingProfileKind': 'Absolute',
        'chargingProfilePurpose': 'TxProfile',
        'stackLevel': 2,
        'transactionId': transaction.id,
        'chargingSchedule': {
          'chargingRateUnit': 'A',
          'duration': chargingProfile.profile.chargingSchedule.chargingSchedulePeriod.length * 15 * 60
        }
      }
    });
  }
}

const testData: TestData = new TestData();

const smartChargingSettings = TestData.getSmartChargingSettings();
for (const key of Object.keys(smartChargingSettings)) {
  if (!smartChargingSettings[key] || smartChargingSettings[key] === '') {
    testData.pending = true;
  }
}

// Notification requests to avoid duplicated code
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

// Most common cp schedules used to validate the schedules of the returned charging profiles
const limit96 = [
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
  }
];

const limit32 = [
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
];

const limit0 = [
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
];

// Helpers to store ongoing transactions across different tests
let transaction = {} as Transaction;
let transaction1 = {} as Transaction;
let transaction2 = {} as Transaction;


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
      await testData.chargingStationContext1.cleanUpCreatedData();
    });

    it('Should connect to Smart Charging Provider', async () => {
      const response = await testData.userService.smartChargingApi.testConnection({});
      expect(response.data).containSubset(Constants.REST_RESPONSE_SUCCESS);
    });

    describe('Test for three phased site area', () => {
      describe('Safe Cars', () => {
        before(async () => {
          testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
          testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_THREE_PHASED);
          testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
          testData.chargingStationContext1 = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16 + '-' + `${ContextDefinition.SITE_CONTEXTS.SITE_BASIC}-${ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_THREE_PHASED}` + '-' + 'singlePhased');
        });

        after(async () => {
          // Set Connector Status back to available
          await testData.chargingStationContext.setConnectorStatus(chargingStationConnector1Available);
          await testData.chargingStationContext.setConnectorStatus(chargingStationConnector2Available);
          await testData.chargingStationContext1.setConnectorStatus(chargingStationConnector1Available);
          await testData.chargingStationContext1.setConnectorStatus(chargingStationConnector2Available);
        });

        it('Test for one car charging', async () => {
          // Start transaction on connector 1
          const transactionStartResponse = await testData.chargingStationContext.startTransaction(1, testData.userContext.tags[0].id, 180, new Date);
          // Get and store started transaction
          const transactionResponse = await testData.centralUserService.transactionApi.readById(transactionStartResponse.transactionId);
          transaction = transactionResponse.data;
          // Set Connector Status to 'charging
          await testData.chargingStationContext.setConnectorStatus(chargingStationConnector1Charging);
          // Call Smart Charging
          const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
          // Validate Charging Profile with Transaction
          TestData.validateChargingProfile(chargingProfiles[0], transaction);
          // Validate Charging Schedule
          expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit96);
        });

        it('Test for two cars charging', async () => {
          const transactionStartResponse = await testData.chargingStationContext.startTransaction(2, testData.userContext.tags[0].id, 180, new Date);
          const transactionResponse = await testData.centralUserService.transactionApi.readById(transactionStartResponse.transactionId);
          transaction1 = transactionResponse.data;
          await testData.chargingStationContext.setConnectorStatus(chargingStationConnector2Charging);
          const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
          TestData.validateChargingProfile(chargingProfiles[0], transaction);
          expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit96);
          TestData.validateChargingProfile(chargingProfiles[1], transaction1);
          expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit96);
        });

        it('Test for two cars charging with lower site area limit', async () => {
          testData.siteAreaContext.getSiteArea().maximumPower = 32000;
          const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
          TestData.validateChargingProfile(chargingProfiles[0], transaction);
          expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
            {
              'startPeriod': 0,
              'limit': 43
            },
            {
              'startPeriod': 900,
              'limit': 43
            },
            {
              'startPeriod': 1800,
              'limit': 43
            }
          ]);
          TestData.validateChargingProfile(chargingProfiles[1], transaction1);
          expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit96);
        });

        it('Test for three cars charging with lower site area limit and one car on a single phased station', async () => {
          // Start transaction on single phased Charging Station
          const transactionStartResponse = await testData.chargingStationContext1.startTransaction(1, testData.userContext.tags[0].id, 180, new Date);
          const transactionResponse = await testData.centralUserService.transactionApi.readById(transactionStartResponse.transactionId);
          transaction2 = transactionResponse.data;
          await testData.chargingStationContext1.setConnectorStatus(chargingStationConnector1Charging);
          const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
          TestData.validateChargingProfile(chargingProfiles[0], transaction);
          expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit0);
          TestData.validateChargingProfile(chargingProfiles[1], transaction1);
          expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
            {
              'startPeriod': 0,
              'limit': 43
            },
            {
              'startPeriod': 900,
              'limit': 43
            },
            {
              'startPeriod': 1800,
              'limit': 43
            }
          ]);
          TestData.validateChargingProfile(chargingProfiles[2], transaction2);
          expect(chargingProfiles[2].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit32);
        });

        it('Test for 3 single phased cars charging with lower site area limit and one car on a single phased station (meter value received)', async () => {
          // Send meter values for both connectors of the 3 phased stations
          await testData.chargingStationContext.sendConsumptionMeterValue(
            1,
            transaction.id,
            new Date(),
            {
              energyActiveImportMeterValue: 7360,
              voltageMeterValue: 230,
              voltageL1MeterValue: 230,
              voltageL2MeterValue: 230,
              voltageL3MeterValue: 230,
              amperageMeterValue: 32,
              amperageL1MeterValue: 0,
              amperageL2MeterValue: 32,
              amperageL3MeterValue: 0,
            }
          );
          await testData.chargingStationContext.sendConsumptionMeterValue(
            2,
            transaction1.id,
            new Date(),
            {
              energyActiveImportMeterValue: 7360,
              voltageMeterValue: 230,
              voltageL1MeterValue: 230,
              voltageL2MeterValue: 230,
              voltageL3MeterValue: 230,
              amperageMeterValue: 32,
              amperageL1MeterValue: 0,
              amperageL2MeterValue: 0,
              amperageL3MeterValue: 32,
            }
          );
          const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
          // Charging Profiles should use the full power, because every car is charging on another phase
          TestData.validateChargingProfile(chargingProfiles[0], transaction);
          expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit96);
          TestData.validateChargingProfile(chargingProfiles[1], transaction1);
          expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit96);
          TestData.validateChargingProfile(chargingProfiles[2], transaction2);
          expect(chargingProfiles[2].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit32);
        });
      });
    });
    describe('Test for single phased site area', () => {
      before(async () => {
        testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
        testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_SINGLE_PHASED);
        testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
      });

      after(async () => {
        await testData.chargingStationContext.setConnectorStatus(chargingStationConnector1Available);
        await testData.chargingStationContext.setConnectorStatus(chargingStationConnector2Available);
      });

      it('Test for one car charging', async () => {
        const transactionStartResponse = await testData.chargingStationContext.startTransaction(1, testData.userContext.tags[0].id, 180, new Date);
        const transactionResponse = await testData.centralUserService.transactionApi.readById(transactionStartResponse.transactionId);
        transaction = transactionResponse.data;
        await testData.chargingStationContext.setConnectorStatus(chargingStationConnector1Charging);
        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
        TestData.validateChargingProfile(chargingProfiles[0], transaction);
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit32);
      });

      it('Test for two cars charging', async () => {
        const transactionStartResponse = await testData.chargingStationContext.startTransaction(2, testData.userContext.tags[0].id, 180, new Date);
        const transactionResponse = await testData.centralUserService.transactionApi.readById(transactionStartResponse.transactionId);
        transaction1 = transactionResponse.data;
        await testData.chargingStationContext.setConnectorStatus(chargingStationConnector2Charging);
        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
        TestData.validateChargingProfile(chargingProfiles[0], transaction);
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit32);
        TestData.validateChargingProfile(chargingProfiles[1], transaction1);
        expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit32);
      });

      it('Test for two cars charging with lower site area limit', async () => {
        testData.siteAreaContext.getSiteArea().maximumPower = 10000;
        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
        TestData.validateChargingProfile(chargingProfiles[0], transaction);
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit0);
        TestData.validateChargingProfile(chargingProfiles[1], transaction1);
        expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit32);
      });
    });

    describe('Test for DC site area', () => {
      before(async () => {
        testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
        testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_DC);
        testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
      });

      after(async () => {
        await testData.chargingStationContext.setConnectorStatus(chargingStationConnector1Available);
        await testData.chargingStationContext.setConnectorStatus(chargingStationConnector2Available);
      });


      it('Test for one car charging', async () => {
        const transactionStartResponse = await testData.chargingStationContext.startTransaction(1, testData.userContext.tags[0].id, 180, new Date);
        const transactionResponse = await testData.centralUserService.transactionApi.readById(transactionStartResponse.transactionId);
        transaction = transactionResponse.data;
        await testData.chargingStationContext.setConnectorStatus(chargingStationConnector1Charging);
        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
        TestData.validateChargingProfile(chargingProfiles[0], transaction);
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
        const transactionStartResponse = await testData.chargingStationContext.startTransaction(2, testData.userContext.tags[0].id, 180, new Date);
        const transactionResponse = await testData.centralUserService.transactionApi.readById(transactionStartResponse.transactionId);
        transaction1 = transactionResponse.data;
        await testData.chargingStationContext.setConnectorStatus(chargingStationConnector2Charging);
        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
        TestData.validateChargingProfile(chargingProfiles[0], transaction);
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
          }
        ]);
        TestData.validateChargingProfile(chargingProfiles[1], transaction1);
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

      it('Test for two cars charging with lower site area limit', async () => {
        testData.siteAreaContext.getSiteArea().maximumPower = 100000;
        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
        TestData.validateChargingProfile(chargingProfiles[0], transaction);
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
        TestData.validateChargingProfile(chargingProfiles[1], transaction1);
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
  describe('Test for ChargingStation refusing the charging profile', () => {
    before(async () => {
      testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_DC);
      testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
    });

    after(async () => {
      chargingStationConnector1Available.timestamp = new Date().toISOString();
      await testData.chargingStationContext.setConnectorStatus(chargingStationConnector1Available);

      // Reset modifications on siteArea and ChargingStation
      testData.siteAreaContext.getSiteArea().smartCharging = false;
      await testData.userService.siteAreaApi.update(testData.siteAreaContext.getSiteArea());
      testData.chargingStationContext.getChargingStation().excludeFromSmartCharging = false;
      await testData.userService.chargingStationApi.update(testData.chargingStationContext.getChargingStation());
    });


    it('Check if charging station will be excluded from smart charging, when pushing fails', async () => {
      testData.siteAreaContext.getSiteArea().maximumPower = 200000;
      testData.siteAreaContext.getSiteArea().smartCharging = true;
      await testData.userService.siteAreaApi.update(testData.siteAreaContext.getSiteArea());
      await testData.chargingStationContext.startTransaction(1, testData.userContext.tags[0].id, 180, new Date);
      chargingStationConnector1Charging.timestamp = new Date().toISOString();
      await testData.chargingStationContext.setConnectorStatus(chargingStationConnector1Charging);
      const chargingStationResponse = await testData.userService.chargingStationApi.readById(testData.chargingStationContext.getChargingStation().id);
      expect(chargingStationResponse.status).to.be.eq(200);
      const chargingStation = chargingStationResponse.data;
      expect(chargingStation.excludeFromSmartCharging).to.be.eq(true);
    });
  });
});
