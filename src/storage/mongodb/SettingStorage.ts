import { AnalyticsSettings, AnalyticsSettingsType, AssetSettings, AssetSettingsType, BillingSetting, BillingSettings, BillingSettingsType, CarConnectorSettings, CarConnectorSettingsType, CryptoSetting, CryptoSettings, CryptoSettingsType, PricingSettings, PricingSettingsType, RefundSettings, RefundSettingsType, RoamingSettings, SettingDB, SmartChargingSettings, SmartChargingSettingsType, TaskSettings, TaskSettingsType, TechnicalSettings, UserSettings, UserSettingsType } from '../../types/Setting';
import Tenant, { TenantComponents } from '../../types/Tenant';
import global, { DatabaseCount, FilterParams } from '../../types/GlobalType';

import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectId } from 'mongodb';
import { SettingDBDataResult } from '../../types/DataResult';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'SettingStorage';

export default class SettingStorage {
  public static async getSetting(tenant: Tenant, id: string = Constants.UNKNOWN_OBJECT_ID, projectFields?: string[]): Promise<SettingDB> {
    const settingMDB = await SettingStorage.getSettings(tenant,
      { settingID: id },
      Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return settingMDB.count === 1 ? settingMDB.result[0] : null;
  }

  public static async getSettingByIdentifier(tenant: Tenant, identifier: string = Constants.UNKNOWN_STRING_ID, projectFields?: string[]): Promise<SettingDB> {
    const settingsMDB = await SettingStorage.getSettings(tenant,
      { identifier: identifier },
      Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return settingsMDB.count === 1 ? settingsMDB.result[0] : null;
  }

  public static async saveSettings(tenant: Tenant, settingToSave: Partial<SettingDB>): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Check if ID is provided
    if (!settingToSave.id && !settingToSave.identifier) {
      // ID must be provided!
      throw new BackendError({
        module: MODULE_NAME,
        method: 'saveSetting',
        message: 'Setting has no ID and no Identifier'
      });
    }
    const settingFilter: any = {};
    // Build Request
    if (settingToSave.id) {
      settingFilter._id = DatabaseUtils.convertToObjectID(settingToSave.id);
    } else {
      settingFilter._id = new ObjectId();
    }
    // Properties to save
    const settingMDB = {
      _id: settingFilter._id,
      identifier: settingToSave.identifier,
      content: settingToSave.content,
      sensitiveData: settingToSave.sensitiveData,
      backupSensitiveData: settingToSave.backupSensitiveData
    };
    DatabaseUtils.addLastChangedCreatedProps(settingMDB, settingToSave);
    // Modify
    await global.database.getCollection<any>(tenant.id, 'settings').findOneAndUpdate(
      settingFilter,
      { $set: settingMDB },
      { upsert: true, returnDocument: 'after' });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveSettings', startTime, settingMDB);
    // Create
    return settingFilter._id.toString();
  }

  public static async getOCPISettings(tenant: Tenant): Promise<RoamingSettings> {
    const ocpiSettings = {
      identifier: TenantComponents.OCPI,
    } as RoamingSettings;
    // Get the Ocpi settings
    const settings = await SettingStorage.getSettings(tenant,
      { identifier: TenantComponents.OCPI },
      Constants.DB_PARAMS_MAX_LIMIT);
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      // ID
      ocpiSettings.id = settings.result[0].id;
      ocpiSettings.sensitiveData = settings.result[0].sensitiveData;
      ocpiSettings.backupSensitiveData = settings.result[0].backupSensitiveData;
      // OCPI
      if (config.ocpi) {
        ocpiSettings.ocpi = config.ocpi;
      }
    }
    return ocpiSettings;
  }

  public static async getOICPSettings(tenant: Tenant): Promise<RoamingSettings> {
    const oicpSettings = {
      identifier: TenantComponents.OICP,
    } as RoamingSettings;
    // Get the oicp settings
    const settings = await SettingStorage.getSettings(tenant, { identifier: TenantComponents.OICP }, Constants.DB_PARAMS_MAX_LIMIT);
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      // ID
      oicpSettings.id = settings.result[0].id;
      oicpSettings.sensitiveData = settings.result[0].sensitiveData;
      // OICP
      if (config.oicp) {
        oicpSettings.oicp = config.oicp;
      }
    }
    return oicpSettings;
  }

  public static async getAnalyticsSettings(tenant: Tenant): Promise<AnalyticsSettings> {
    const analyticsSettings = {
      identifier: TenantComponents.ANALYTICS,
    } as AnalyticsSettings;
    // Get the analytics settings
    const settings = await SettingStorage.getSettings(tenant,
      { identifier: TenantComponents.ANALYTICS },
      Constants.DB_PARAMS_MAX_LIMIT);
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      analyticsSettings.id = settings.result[0].id;
      analyticsSettings.sensitiveData = settings.result[0].sensitiveData;
      analyticsSettings.backupSensitiveData = settings.result[0].backupSensitiveData;
      // SAP Analytics
      if (config.sac) {
        analyticsSettings.type = AnalyticsSettingsType.SAC;
        analyticsSettings.sac = {
          timezone: config.sac.timezone ? config.sac.timezone : '',
          mainUrl: config.sac.mainUrl ? config.sac.mainUrl : '',
        };
      }
    }
    return analyticsSettings;
  }

  public static async getAssetsSettings(tenant: Tenant): Promise<AssetSettings> {
    const assetSettings = {
      identifier: TenantComponents.ASSET,
    } as AssetSettings;
    // Get the settings
    const settings = await SettingStorage.getSettings(tenant,
      { identifier: TenantComponents.ASSET },
      Constants.DB_PARAMS_MAX_LIMIT);
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      assetSettings.id = settings.result[0].id;
      assetSettings.sensitiveData = settings.result[0].sensitiveData;
      assetSettings.backupSensitiveData = settings.result[0].backupSensitiveData;
      // Asset
      if (config.asset) {
        assetSettings.type = AssetSettingsType.ASSET;
        assetSettings.asset = {
          connections: config.asset.connections ? config.asset.connections : []
        };
      }
    }
    return assetSettings;
  }

  public static async getRefundSettings(tenant: Tenant): Promise<RefundSettings> {
    const refundSettings = {
      identifier: TenantComponents.REFUND
    } as RefundSettings;
    const settings = await SettingStorage.getSettings(tenant,
      { identifier: TenantComponents.REFUND },
      Constants.DB_PARAMS_MAX_LIMIT);
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      refundSettings.id = settings.result[0].id;
      refundSettings.sensitiveData = settings.result[0].sensitiveData;
      refundSettings.backupSensitiveData = settings.result[0].backupSensitiveData;
      if (config.concur) {
        refundSettings.type = RefundSettingsType.CONCUR;
        refundSettings.concur = {
          authenticationUrl: config.concur.authenticationUrl ? config.concur.authenticationUrl : '',
          apiUrl: config.concur.apiUrl ? config.concur.apiUrl : '',
          appUrl: config.concur.appUrl ? config.concur.appUrl : '',
          clientId: config.concur.clientId ? config.concur.clientId : '',
          clientSecret: config.concur.clientSecret ? config.concur.clientSecret : '',
          paymentTypeId: config.concur.paymentTypeId ? config.concur.paymentTypeId : '',
          expenseTypeCode: config.concur.expenseTypeCode ? config.concur.expenseTypeCode : '',
          policyId: config.concur.policyId ? config.concur.policyId : '',
          reportName: config.concur.reportName ? config.concur.reportName : '',
        };
      }
    }
    return refundSettings;
  }

  public static async getCarConnectorSettings(tenant: Tenant): Promise<CarConnectorSettings> {
    const carConnectorSettings = {
      identifier: TenantComponents.CAR_CONNECTOR,
    } as CarConnectorSettings;
    // Get the settings
    const settings = await SettingStorage.getSettings(tenant,
      { identifier: TenantComponents.CAR_CONNECTOR },
      Constants.DB_PARAMS_MAX_LIMIT);
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      carConnectorSettings.id = settings.result[0].id;
      carConnectorSettings.sensitiveData = settings.result[0].sensitiveData;
      carConnectorSettings.backupSensitiveData = settings.result[0].backupSensitiveData;
      // Car Connector
      if (config.carConnector) {
        carConnectorSettings.type = CarConnectorSettingsType.CAR_CONNECTOR;
        carConnectorSettings.carConnector = {
          connections: config.carConnector.connections ? config.carConnector.connections : []
        };
      }
    }
    return carConnectorSettings;
  }

  public static async saveCarConnectorSettings(tenant: Tenant, carConnectorSettingToSave: CarConnectorSettings): Promise<void> {
    // Build internal structure
    const settingsToSave = {
      id: carConnectorSettingToSave.id,
      identifier: carConnectorSettingToSave.identifier,
      lastChangedOn: new Date(),
      sensitiveData: carConnectorSettingToSave.sensitiveData,
      content: {
        type: carConnectorSettingToSave.type,
        carConnector: carConnectorSettingToSave.carConnector
      },
    } as SettingDB;
    // Save
    await SettingStorage.saveSettings(tenant, settingsToSave);
  }

  public static async getPricingSettings(tenant: Tenant, limit?: number, skip?: number, dateFrom?: Date, dateTo?: Date): Promise<PricingSettings> {
    const pricingSettings = {
      identifier: TenantComponents.PRICING,
    } as PricingSettings;
    // Get the Pricing settings
    const settings = await SettingStorage.getSettings(tenant,
      { identifier: TenantComponents.PRICING, dateFrom: dateFrom, dateTo: dateTo },
      { limit, skip });
    // Get the currency
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      // ID
      pricingSettings.id = settings.result[0].id;
      pricingSettings.sensitiveData = settings.result[0].sensitiveData;
      pricingSettings.backupSensitiveData = settings.result[0].backupSensitiveData;
      // Simple price
      if (config.simple) {
        pricingSettings.type = PricingSettingsType.SIMPLE;
        pricingSettings.simple = {
          price: config.simple.price ? Utils.convertToFloat(config.simple.price) : 0,
          currency: config.simple.currency ? config.simple.currency : '',
          last_updated: settings.result[0].lastChangedOn ? Utils.convertToDate(settings.result[0].lastChangedOn) : null,
        };
      }
    }
    return pricingSettings;
  }

  public static async getSmartChargingSettings(tenant: Tenant): Promise<SmartChargingSettings> {
    const smartChargingSettings = {
      identifier: TenantComponents.SMART_CHARGING,
    } as SmartChargingSettings;
    // Get the Smart Charging settings
    const settings = await SettingStorage.getSettings(tenant,
      { identifier: TenantComponents.SMART_CHARGING },
      Constants.DB_PARAMS_MAX_LIMIT);
    // Get the currency
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      // ID
      smartChargingSettings.id = settings.result[0].id;
      smartChargingSettings.sensitiveData = settings.result[0].sensitiveData;
      smartChargingSettings.backupSensitiveData = settings.result[0].backupSensitiveData;
      // SAP Smart Charging
      if (config.sapSmartCharging) {
        smartChargingSettings.type = SmartChargingSettingsType.SAP_SMART_CHARGING;
        smartChargingSettings.sapSmartCharging = {
          optimizerUrl: config.sapSmartCharging.optimizerUrl ? config.sapSmartCharging.optimizerUrl : '',
          user: config.sapSmartCharging.user ? config.sapSmartCharging.user : '',
          password: config.sapSmartCharging.password ? config.sapSmartCharging.password : '',
          stickyLimitation: config.sapSmartCharging.stickyLimitation ? config.sapSmartCharging.stickyLimitation : false,
          limitBufferDC: config.sapSmartCharging.limitBufferDC ? config.sapSmartCharging.limitBufferDC : 0,
          limitBufferAC: config.sapSmartCharging.limitBufferAC ? config.sapSmartCharging.limitBufferAC : 0,
          prioritizationParametersActive: config.sapSmartCharging.prioritizationParametersActive ?? false,
        };
      }
    }
    return smartChargingSettings;
  }

  public static async getCryptoSettings(tenant: Tenant): Promise<CryptoSettings> {
    // Get the Crypto Key settings
    const settings = await SettingStorage.getSettings(tenant,
      { identifier: TechnicalSettings.CRYPTO },
      Constants.DB_PARAMS_MAX_LIMIT);
    if (settings.count > 0) {
      const cryptoSetting = {
        key: settings.result[0].content.crypto.key,
        keyProperties: {
          blockCypher: settings.result[0].content.crypto.keyProperties.blockCypher,
          blockSize: settings.result[0].content.crypto.keyProperties.blockSize,
          operationMode: settings.result[0].content.crypto.keyProperties.operationMode,
        },
        migrationToBeDone: settings.result[0].content.crypto.migrationToBeDone
      } as CryptoSetting;
      if (settings.result[0].content.crypto.formerKey) {
        cryptoSetting.formerKey = settings.result[0].content.crypto.formerKey;
        cryptoSetting.formerKeyProperties = {
          blockCypher: settings.result[0].content.crypto.formerKeyProperties?.blockCypher,
          blockSize: settings.result[0].content.crypto.formerKeyProperties?.blockSize,
          operationMode: settings.result[0].content.crypto.formerKeyProperties?.operationMode,
        };
      }
      return {
        id: settings.result[0].id,
        identifier: TechnicalSettings.CRYPTO,
        type: CryptoSettingsType.CRYPTO,
        crypto: cryptoSetting
      };
    }
  }

  public static async getUserSettings(tenant: Tenant): Promise<UserSettings> {
    let userSettings: UserSettings;
    // Get the user settings
    const settings = await SettingStorage.getSettings(tenant, { identifier: TechnicalSettings.USER }, Constants.DB_PARAMS_SINGLE_RECORD);
    if (settings.count > 0) {
      userSettings = {
        id: settings.result[0].id,
        identifier: TechnicalSettings.USER,
        type: UserSettingsType.USER,
        user: settings.result[0].content.user,
      };
    }
    return userSettings;
  }

  public static async getSettings(tenant: Tenant,
      params: { identifier?: string; settingID?: string, dateFrom?: Date, dateTo?: Date },
      dbParams: DbParams, projectFields?: string[]): Promise<SettingDBDataResult> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: FilterParams = {};
    // Source?
    if (params.settingID) {
      filters._id = DatabaseUtils.convertToObjectID(params.settingID);
    }
    // Identifier
    if (params.identifier) {
      filters.identifier = params.identifier;
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Count Records
    const settingsCountMDB = await global.database.getCollection<any>(tenant.id, 'settings')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Rename ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { identifier: 1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const settingsMDB = await global.database.getCollection<any>(tenant.id, 'settings')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as SettingDB[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getSettings', startTime, aggregation, settingsMDB);
    return {
      count: (settingsCountMDB.length > 0 ? settingsCountMDB[0].count : 0),
      result: settingsMDB
    };
  }

  public static async deleteSetting(tenant: Tenant, id: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete Component
    await global.database.getCollection<any>(tenant.id, 'settings')
      .findOneAndDelete({ '_id': DatabaseUtils.convertToObjectID(id) });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteSetting', startTime, { id });
  }

  public static async saveUserSettings(tenant: Tenant, userSettingToSave: UserSettings): Promise<void> {
    // Build internal structure
    const settingsToSave = {
      id: userSettingToSave.id,
      identifier: TechnicalSettings.USER,
      lastChangedOn: new Date(),
      content: {
        type: UserSettingsType.USER,
        user: userSettingToSave.user
      },
    } as SettingDB;
    // Save
    await SettingStorage.saveSettings(tenant, settingsToSave);
  }

  public static async saveCryptoSettings(tenant: Tenant, cryptoSettingsToSave: CryptoSettings): Promise<void> {
    // Build internal structure
    const settingsToSave = {
      id: cryptoSettingsToSave.id,
      identifier: TechnicalSettings.CRYPTO,
      lastChangedOn: new Date(),
      content: {
        type: CryptoSettingsType.CRYPTO,
        crypto: cryptoSettingsToSave.crypto
      },
    } as SettingDB;
    // Save
    await SettingStorage.saveSettings(tenant, settingsToSave);
  }

  public static async getBillingSetting(tenant: Tenant, projectedFields?: string[]): Promise<BillingSettings> {
    // Get BILLING Settings by Identifier
    const setting = await SettingStorage.getSettingByIdentifier(tenant, TenantComponents.BILLING, projectedFields);
    if (setting) {
      const { id, backupSensitiveData, category } = setting;
      const { createdBy, createdOn, lastChangedBy, lastChangedOn } = setting;
      const { content } = setting;
      const billing: BillingSetting = {
        isTransactionBillingActivated: !!content.billing?.isTransactionBillingActivated,
        immediateBillingAllowed: !!content.billing?.immediateBillingAllowed,
        periodicBillingAllowed: !!content.billing?.periodicBillingAllowed,
        taxID: content.billing?.taxID,
        usersLastSynchronizedOn: content.billing?.usersLastSynchronizedOn,
      };
      // Insert platformFeeTaxID only if the billing platform is enabled
      if (Utils.isTenantComponentActive(tenant, TenantComponents.BILLING_PLATFORM)) {
        billing.platformFeeTaxID = content.billing?.platformFeeTaxID;
      }
      const billingSettings: BillingSettings = {
        id,
        identifier: TenantComponents.BILLING,
        type: content.type as BillingSettingsType,
        backupSensitiveData,
        billing,
        category,
        createdBy,
        createdOn,
        lastChangedBy,
        lastChangedOn,
      };
      switch (content.type) {
        // Only STRIPE so far
        case BillingSettingsType.STRIPE:
          billingSettings.stripe = {
            url: content.stripe?.url,
            secretKey: content.stripe?.secretKey,
            publicKey: content.stripe?.publicKey,
          };
          billingSettings.sensitiveData = ['stripe.secretKey'];
          break;
      }
      return billingSettings;
    }
    return null;
  }

  public static async saveBillingSetting(tenant: Tenant, billingSettings: BillingSettings): Promise<string> {
    const { id, identifier, sensitiveData, backupSensitiveData, category } = billingSettings;
    const { createdBy, createdOn, lastChangedBy, lastChangedOn } = billingSettings;
    const { type, billing, stripe } = billingSettings;
    const setting: SettingDB = {
      id, identifier, sensitiveData, backupSensitiveData,
      content: {
        type,
        billing,
      },
      category, createdBy, createdOn, lastChangedBy, lastChangedOn,
    };
    if (billingSettings.type === BillingSettingsType.STRIPE) {
      setting.sensitiveData = ['content.stripe.secretKey'];
      setting.content.stripe = stripe;
    }
    return SettingStorage.saveSettings(tenant, setting);
  }

  public static async getTaskSettings(tenant: Tenant): Promise<TaskSettings> {
    let taskSettings: TaskSettings;
    // Get task settings
    const settings = await SettingStorage.getSettings(tenant, { identifier: TechnicalSettings.TASK }, Constants.DB_PARAMS_SINGLE_RECORD);
    if (settings.count > 0) {
      taskSettings = {
        id: settings.result[0].id,
        identifier: TechnicalSettings.TASK,
        type: TaskSettingsType.TASK,
        task: settings.result[0].content.task,
      };
    }
    return taskSettings;
  }

}
