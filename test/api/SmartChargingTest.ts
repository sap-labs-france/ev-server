import { ChargePointErrorCode, ChargePointStatus, OCPPStatusNotificationRequest } from '../../src/types/ocpp/OCPPServer';
import { SapSmartChargingSetting, SettingDB, SmartChargingSetting, SmartChargingSettingsType } from '../../src/types/Setting';
import Transaction, { CSPhasesUsed } from '../types/Transaction';
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
import { StaticLimitAmps } from '../../src/types/ChargingStation';
import TenantContext from './context/TenantContext';
import Utils from '../../src/utils/Utils';
import chaiSubset from 'chai-subset';
import config from '../config';
import global from '../../src/types/GlobalType';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

let smartChargingIntegration: SmartChargingIntegration<SmartChargingSetting>;
let smartChargingIntegrationWithDifferentBufferValues: SmartChargingIntegration<SmartChargingSetting>;
let smartChargingIntegrationWithoutStickyLimit: SmartChargingIntegration<SmartChargingSetting>;

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
    // Get Crypto Setting
    const cryptoSetting = await Cypher.getCryptoSetting(testData.tenantContext.getTenant().id);
    sapSmartChargingSettings.password = Cypher.encrypt(sapSmartChargingSettings.password, cryptoSetting);
    aCBufferFactor = 1 + sapSmartChargingSettings.limitBufferAC / 100,
    dCBufferFactor = 1 + sapSmartChargingSettings.limitBufferDC / 100,
    smartChargingIntegration = await SmartChargingFactory.getSmartChargingImpl(testData.tenantContext.getTenant().id);
    sapSmartChargingSettings.limitBufferDC = 10,
    sapSmartChargingSettings.limitBufferAC = 5,
    await TestData.saveSmartChargingSettings(testData, sapSmartChargingSettings);
    smartChargingIntegrationWithDifferentBufferValues = await SmartChargingFactory.getSmartChargingImpl(testData.tenantContext.getTenant().id);
    sapSmartChargingSettings.stickyLimitation = false;
    await TestData.saveSmartChargingSettings(testData, sapSmartChargingSettings);
    smartChargingIntegrationWithoutStickyLimit = await SmartChargingFactory.getSmartChargingImpl(testData.tenantContext.getTenant().id);
    expect(smartChargingIntegration).to.not.be.null;
    expect(smartChargingIntegrationWithDifferentBufferValues).to.not.be.null;
    expect(smartChargingIntegrationWithoutStickyLimit).to.not.be.null;
  }

  public static getSmartChargingSettings(): SapSmartChargingSetting {
    return {
      optimizerUrl: config.get('smartCharging.optimizerUrl'),
      user: config.get('smartCharging.user'),
      password: config.get('smartCharging.password'),
      stickyLimitation: config.get('smartCharging.stickyLimitation'),
      limitBufferAC: config.get('smartCharging.limitBufferAC'),
      limitBufferDC: config.get('smartCharging.limitBufferDC')
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

  public static async sendMeterValue(voltage: number, amperagePerPhase:number, transaction: Transaction, chargingStationContext: ChargingStationContext,
    phasesUsed?: CSPhasesUsed): Promise<void> {
    const meterValues = {
      energyActiveImportMeterValue: 0,
      amperageMeterValue: amperagePerPhase,
      voltageMeterValue: voltage,
      powerImportMeterValue: !phasesUsed ? amperagePerPhase * voltage : 0,
      voltageL1MeterValue: 0,
      voltageL2MeterValue: 0,
      voltageL3MeterValue: 0,
      amperageL1MeterValue: 0,
      amperageL2MeterValue: 0,
      amperageL3MeterValue: 0,
    };
    if (phasesUsed) {
      if (phasesUsed.csPhase1) {
        meterValues.amperageL1MeterValue = amperagePerPhase;
        meterValues.voltageL1MeterValue = voltage;
        meterValues.powerImportMeterValue += amperagePerPhase * voltage;
      }
      if (phasesUsed.csPhase2) {
        meterValues.amperageL2MeterValue = amperagePerPhase;
        meterValues.voltageL2MeterValue = voltage;
        meterValues.powerImportMeterValue += amperagePerPhase * voltage;
      }
      if (phasesUsed.csPhase3) {
        meterValues.amperageL3MeterValue = amperagePerPhase;
        meterValues.voltageL3MeterValue = voltage;
        meterValues.powerImportMeterValue += amperagePerPhase * voltage;
      }
    }
    await chargingStationContext.sendConsumptionMeterValue(
      transaction.connectorId,
      transaction.id,
      new Date(),
      meterValues
    );
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

const limitMinThreePhased = [
  {
    'startPeriod': 0,
    'limit': StaticLimitAmps.MIN_LIMIT_PER_PHASE * 3
  },
  {
    'startPeriod': 900,
    'limit': StaticLimitAmps.MIN_LIMIT_PER_PHASE * 3
  },
  {
    'startPeriod': 1800,
    'limit': StaticLimitAmps.MIN_LIMIT_PER_PHASE * 3
  }
];

const limitMinSinglePhased = [
  {
    'startPeriod': 0,
    'limit': StaticLimitAmps.MIN_LIMIT_PER_PHASE
  },
  {
    'startPeriod': 900,
    'limit': StaticLimitAmps.MIN_LIMIT_PER_PHASE
  },
  {
    'startPeriod': 1800,
    'limit': StaticLimitAmps.MIN_LIMIT_PER_PHASE
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

// Buffer Factors
let aCBufferFactor = 0;
let dCBufferFactor = 0;


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
        await TestData.sendMeterValue(230, 32, transaction, testData.chargingStationContext, { csPhase1: false, csPhase2: true, csPhase3: false });
        await TestData.sendMeterValue(230, 32, transaction1, testData.chargingStationContext, { csPhase1: false, csPhase2: false, csPhase3: true });
        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
        // Charging Profiles should use the full power, because every car is charging on another phase
        TestData.validateChargingProfile(chargingProfiles[0], transaction);
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit96);
        TestData.validateChargingProfile(chargingProfiles[1], transaction1);
        expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit96);
        TestData.validateChargingProfile(chargingProfiles[2], transaction2);
        expect(chargingProfiles[2].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit32);
      });

      it('Test for sticky limit - 1 three phased and 2 single phased cars charging with lower site area limit and one car on a single phased station', async () => {
        await testData.chargingStationContext.stopTransaction(transaction.id, testData.userContext.tags[0].id, 180, new Date());
        const transactionStartResponse = await testData.chargingStationContext.startTransaction(1, testData.userContext.tags[0].id, 180, new Date);
        const transactionResponse = await testData.centralUserService.transactionApi.readById(transactionStartResponse.transactionId);
        transaction = transactionResponse.data;
        // Send meter values for all stations
        await TestData.sendMeterValue(230, 13, transaction, testData.chargingStationContext, { csPhase1: true, csPhase2: true, csPhase3: true });
        await TestData.sendMeterValue(230, 24, transaction1, testData.chargingStationContext, { csPhase1: false, csPhase2: false, csPhase3: true });
        await TestData.sendMeterValue(230, 20, transaction2, testData.chargingStationContext1, { csPhase1: true, csPhase2: false, csPhase3: false });

        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
        // Charging Profiles should have limits according the sent meter values + buffer
        TestData.validateChargingProfile(chargingProfiles[0], transaction);
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': Utils.truncTo(13 * 3 * aCBufferFactor, 0)
          },
          {
            'startPeriod': 900,
            'limit': Utils.truncTo(13 * 3 * aCBufferFactor, 0)
          },
          {
            'startPeriod': 1800,
            'limit': Utils.truncTo(13 * 3 * aCBufferFactor, 0)
          }
        ]);
        TestData.validateChargingProfile(chargingProfiles[1], transaction1);
        expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': Utils.truncTo(24 * 3 * aCBufferFactor, 0)
          },
          {
            'startPeriod': 900,
            'limit': Utils.truncTo(24 * 3 * aCBufferFactor, 0)
          },
          {
            'startPeriod': 1800,
            'limit': Utils.truncTo(24 * 3 * aCBufferFactor, 0)
          }
        ]);
        TestData.validateChargingProfile(chargingProfiles[2], transaction2);
        expect(chargingProfiles[2].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': Utils.truncTo(20 * aCBufferFactor, 0)
          },
          {
            'startPeriod': 900,
            'limit': Utils.truncTo(20 * aCBufferFactor, 0)
          },
          {
            'startPeriod': 1800,
            'limit': Utils.truncTo(20 * aCBufferFactor, 0)
          }
        ]);
      });

      it('Test for sticky limit with different buffer value - 1 three phased and 2 single phased cars charging with lower site area limit and one car on a single phased station', async () => {
        const chargingProfiles = await smartChargingIntegrationWithDifferentBufferValues.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
        // Charging Profiles should have limits according the sent meter values + buffer
        TestData.validateChargingProfile(chargingProfiles[0], transaction);
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': Utils.truncTo(13 * 3 * 1.05, 0)
          },
          {
            'startPeriod': 900,
            'limit': Utils.truncTo(13 * 3 * 1.05, 0)
          },
          {
            'startPeriod': 1800,
            'limit': Utils.truncTo(13 * 3 * 1.05, 0)
          }
        ]);
        TestData.validateChargingProfile(chargingProfiles[1], transaction1);
        expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': Utils.truncTo(24 * 3 * 1.05, 0)
          },
          {
            'startPeriod': 900,
            'limit': Utils.truncTo(24 * 3 * 1.05, 0)
          },
          {
            'startPeriod': 1800,
            'limit': Utils.truncTo(24 * 3 * 1.05, 0)
          }
        ]);
        TestData.validateChargingProfile(chargingProfiles[2], transaction2);
        expect(chargingProfiles[2].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': Utils.truncTo(20 * 1.05, 0)
          },
          {
            'startPeriod': 900,
            'limit': Utils.truncTo(20 * 1.05, 0)
          },
          {
            'startPeriod': 1800,
            'limit': Utils.truncTo(20 * 1.05, 0)
          }
        ]);
      });

      it('Test for sticky limit disabled - 1 three phased and 2 single phased cars charging with lower site area limit and one car on a single phased station', async () => {
        const chargingProfiles = await smartChargingIntegrationWithoutStickyLimit.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
        // Charging Profiles should have limits according the sent meter values + buffer
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
        TestData.validateChargingProfile(chargingProfiles[2], transaction2);
        expect(chargingProfiles[2].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit32);
      });

      it('Test for sticky limit - 1 three phased and 2 single phased cars charging with lower site area limit and one car on a single phased station with no consumption on two cars', async () => {
        // Send meter values for all stations
        await TestData.sendMeterValue(230, 0, transaction, testData.chargingStationContext, { csPhase1: true, csPhase2: true, csPhase3: true });
        await TestData.sendMeterValue(230, 0, transaction2, testData.chargingStationContext1, { csPhase1: true, csPhase2: false, csPhase3: false });
        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
        // Charging Profiles should have limits according the sent meter values (+ buffer)
        TestData.validateChargingProfile(chargingProfiles[0], transaction);
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limitMinThreePhased);
        TestData.validateChargingProfile(chargingProfiles[1], transaction1);
        expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': Utils.truncTo(24 * 3 * aCBufferFactor, 0)
          },
          {
            'startPeriod': 900,
            'limit': Utils.truncTo(24 * 3 * aCBufferFactor, 0)
          },
          {
            'startPeriod': 1800,
            'limit': Utils.truncTo(24 * 3 * aCBufferFactor, 0)
          }
        ]);
        TestData.validateChargingProfile(chargingProfiles[2], transaction2);
        expect(chargingProfiles[2].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limitMinSinglePhased);
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

      it('Test for sticky limit - two cars charging with lower site area limit', async () => {
        await TestData.sendMeterValue(230, 16, transaction, testData.chargingStationContext, { csPhase1: true, csPhase2: false, csPhase3:false });
        await TestData.sendMeterValue(230, 20, transaction1, testData.chargingStationContext, { csPhase1: true, csPhase2: false, csPhase3:false });
        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
        TestData.validateChargingProfile(chargingProfiles[0], transaction);
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': Utils.truncTo(16 * aCBufferFactor, 0)
          },
          {
            'startPeriod': 900,
            'limit': Utils.truncTo(16 * aCBufferFactor, 0)
          },
          {
            'startPeriod': 1800,
            'limit': Utils.truncTo(16 * aCBufferFactor, 0)
          }
        ]);
        TestData.validateChargingProfile(chargingProfiles[1], transaction1);
        expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': Utils.truncTo(20 * aCBufferFactor, 0)
          },
          {
            'startPeriod': 900,
            'limit': Utils.truncTo(20 * aCBufferFactor, 0)
          },
          {
            'startPeriod': 1800,
            'limit': Utils.truncTo(20 * aCBufferFactor, 0)
          }
        ]);
      });

      it('Test for sticky limit with different buffer value - two cars charging with lower site area limit', async () => {
        const chargingProfiles = await smartChargingIntegrationWithDifferentBufferValues.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
        TestData.validateChargingProfile(chargingProfiles[0], transaction);
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': Utils.truncTo(16 * 1.05, 0)
          },
          {
            'startPeriod': 900,
            'limit': Utils.truncTo(16 * 1.05, 0)
          },
          {
            'startPeriod': 1800,
            'limit': Utils.truncTo(16 * 1.05, 0)
          }
        ]);
        TestData.validateChargingProfile(chargingProfiles[1], transaction1);
        expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': Utils.truncTo(20 * 1.05, 0)
          },
          {
            'startPeriod': 900,
            'limit': Utils.truncTo(20 * 1.05, 0)
          },
          {
            'startPeriod': 1800,
            'limit': Utils.truncTo(20 * 1.05, 0)
          }
        ]);
      });
      it('Test for sticky limit disabled - two cars charging with lower site area limit', async () => {
        const chargingProfiles = await smartChargingIntegrationWithoutStickyLimit.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
        TestData.validateChargingProfile(chargingProfiles[0], transaction);
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit0);
        TestData.validateChargingProfile(chargingProfiles[1], transaction1);
        expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit32);
      });
      it('Test for sticky limit - two cars charging with lower site area limit and no consumption on one car', async () => {
        await TestData.sendMeterValue(230, 0, transaction, testData.chargingStationContext, { csPhase1: true, csPhase2: false, csPhase3:false });
        await TestData.sendMeterValue(230, 20, transaction1, testData.chargingStationContext, { csPhase1: true, csPhase2: false, csPhase3:false });
        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
        TestData.validateChargingProfile(chargingProfiles[0], transaction);
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limitMinSinglePhased);
        TestData.validateChargingProfile(chargingProfiles[1], transaction1);
        expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': Utils.truncTo(20 * aCBufferFactor, 0)
          },
          {
            'startPeriod': 900,
            'limit': Utils.truncTo(20 * aCBufferFactor, 0)
          },
          {
            'startPeriod': 1800,
            'limit': Utils.truncTo(20 * aCBufferFactor, 0)
          }
        ]);
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
            'limit': 84
          },
          {
            'startPeriod': 900,
            'limit': 84
          },
          {
            'startPeriod': 1800,
            'limit': 84
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

      it('Test for sticky limit - two cars charging with lower site area limit', async () => {
        await TestData.sendMeterValue(400, 100, transaction, testData.chargingStationContext);
        await TestData.sendMeterValue(400, 75, transaction1, testData.chargingStationContext);
        const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
        TestData.validateChargingProfile(chargingProfiles[0], transaction);
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': Utils.truncTo(40000 / 230 / 3 * dCBufferFactor, 0) * 3
          },
          {
            'startPeriod': 900,
            'limit': Utils.truncTo(40000 / 230 / 3 * dCBufferFactor, 0) * 3
          },
          {
            'startPeriod': 1800,
            'limit': Utils.truncTo(40000 / 230 / 3 * dCBufferFactor, 0) * 3
          },
        ]);
        TestData.validateChargingProfile(chargingProfiles[1], transaction1);
        expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': Utils.truncTo(30000 / 230 / 3 * dCBufferFactor, 0) * 3
          },
          {
            'startPeriod': 900,
            'limit': Utils.truncTo(30000 / 230 / 3 * dCBufferFactor, 0) * 3
          },
          {
            'startPeriod': 1800,
            'limit': Utils.truncTo(30000 / 230 / 3 * dCBufferFactor, 0) * 3
          }
        ]);
      });

      it('Test for sticky limit with different buffer value- two cars charging with lower site area limit', async () => {
        const chargingProfiles = await smartChargingIntegrationWithDifferentBufferValues.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
        TestData.validateChargingProfile(chargingProfiles[0], transaction);
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': Utils.truncTo(40000 / 230 / 3 * 1.1, 0) * 3
          },
          {
            'startPeriod': 900,
            'limit': Utils.truncTo(40000 / 230 / 3 * 1.1, 0) * 3
          },
          {
            'startPeriod': 1800,
            'limit': Utils.truncTo(40000 / 230 / 3 * 1.1, 0) * 3
          },
        ]);
        TestData.validateChargingProfile(chargingProfiles[1], transaction1);
        expect(chargingProfiles[1].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': Utils.truncTo(30000 / 230 / 3 * 1.1, 0) * 3
          },
          {
            'startPeriod': 900,
            'limit': Utils.truncTo(30000 / 230 / 3 * 1.1, 0) * 3
          },
          {
            'startPeriod': 1800,
            'limit': Utils.truncTo(30000 / 230 / 3 * 1.1, 0) * 3
          }
        ]);
      });

      it('Test for sticky limit disabled - two cars charging with lower site area limit', async () => {
        const chargingProfiles = await smartChargingIntegrationWithoutStickyLimit.buildChargingProfiles(testData.siteAreaContext.getSiteArea());
        TestData.validateChargingProfile(chargingProfiles[0], transaction);
        expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset([
          {
            'startPeriod': 0,
            'limit': 84
          },
          {
            'startPeriod': 900,
            'limit': 84
          },
          {
            'startPeriod': 1800,
            'limit': 84
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
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_THREE_PHASED);
      testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
      testData.chargingStationContext1 = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16 + '-' + `${ContextDefinition.SITE_CONTEXTS.SITE_BASIC}-${ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_THREE_PHASED}` + '-' + 'singlePhased');
    });

    after(async () => {
      chargingStationConnector1Available.timestamp = new Date().toISOString();
      await testData.chargingStationContext.setConnectorStatus(chargingStationConnector1Available);
      await testData.chargingStationContext1.setConnectorStatus(chargingStationConnector1Available);

      // Reset modifications on siteArea
      testData.siteAreaContext.getSiteArea().smartCharging = false;
      await testData.userService.siteAreaApi.update(testData.siteAreaContext.getSiteArea());
    });


    it('Check if charging station will be excluded from smart charging, when pushing fails', async () => {
      testData.siteAreaContext.getSiteArea().maximumPower = 200000;
      testData.siteAreaContext.getSiteArea().smartCharging = true;
      await testData.userService.siteAreaApi.update(testData.siteAreaContext.getSiteArea());
      await testData.chargingStationContext.startTransaction(1, testData.userContext.tags[0].id, 180, new Date);
      await testData.chargingStationContext1.startTransaction(1, testData.userContext.tags[0].id, 180, new Date);
      chargingStationConnector1Charging.timestamp = new Date().toISOString();
      await testData.chargingStationContext.setConnectorStatus(chargingStationConnector1Charging);
      await testData.chargingStationContext1.setConnectorStatus(chargingStationConnector1Charging);
      const chargingProfiles = await smartChargingIntegration.buildChargingProfiles(testData.siteAreaContext.getSiteArea(),
        [testData.chargingStationContext.getChargingStation().id]);
      expect(chargingProfiles[0].profile.chargingSchedule.chargingSchedulePeriod).containSubset(limit32);
    });
  });
});
