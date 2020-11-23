import { AnalyticsSettings, AnalyticsSettingsType, AssetSettings, AssetSettingsType, BillingSettings, BillingSettingsType, PricingSettings, PricingSettingsType, RefundSettings, RefundSettingsType, RoamingSettings, SettingDB, SmartChargingSettings, SmartChargingSettingsType } from '../../types/Setting';
import global, { FilterParams } from '../../types/GlobalType';

import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectID } from 'mongodb';
import TenantComponents from '../../types/TenantComponents';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'SettingStorage';

export default class SettingStorage {
  public static async getSetting(tenantID: string, id: string = Constants.UNKNOWN_OBJECT_ID, projectFields?: string[]): Promise<SettingDB> {
    const settingMDB = await SettingStorage.getSettings(tenantID, {
      settingID: id
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return settingMDB.count === 1 ? settingMDB.result[0] : null;
  }

  public static async getSettingByIdentifier(tenantID: string, identifier: string = Constants.UNKNOWN_STRING_ID, projectFields?: string[]): Promise<SettingDB> {
    const settingsMDB = await SettingStorage.getSettings(
      tenantID, { identifier: identifier }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return settingsMDB.count === 1 ? settingsMDB.result[0] : null;
  }

  public static async saveSettings(tenantID: string, settingToSave: Partial<SettingDB>): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveSetting');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID is provided
    if (!settingToSave.id && !settingToSave.identifier) {
      // ID must be provided!
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'saveSetting',
        message: 'Setting has no ID and no Identifier'
      });
    }
    const settingFilter: any = {};
    // Build Request
    if (settingToSave.id) {
      settingFilter._id = Utils.convertToObjectID(settingToSave.id);
    } else {
      settingFilter._id = new ObjectID();
    }
    // Properties to save
    const settingMDB = {
      _id: settingFilter._id,
      identifier: settingToSave.identifier,
      content: settingToSave.content,
      sensitiveData: settingToSave.sensitiveData
    };
    DatabaseUtils.addLastChangedCreatedProps(settingMDB, settingToSave);
    // Modify
    await global.database.getCollection<SettingDB>(tenantID, 'settings').findOneAndUpdate(
      settingFilter,
      { $set: settingMDB },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveSetting', uniqueTimerID, settingMDB);
    // Create
    return settingFilter._id.toHexString();
  }

  public static async getOCPISettings(tenantID: string): Promise<RoamingSettings> {
    const ocpiSettings = {
      identifier: TenantComponents.OCPI,
    } as RoamingSettings;
    // Get the Ocpi settings
    const settings = await SettingStorage.getSettings(tenantID, { identifier: TenantComponents.OCPI }, Constants.DB_PARAMS_MAX_LIMIT);
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      // ID
      ocpiSettings.id = settings.result[0].id;
      ocpiSettings.sensitiveData = settings.result[0].sensitiveData;
      // OCPI
      if (config.ocpi) {
        ocpiSettings.ocpi = config.ocpi;
      }
    }
    return ocpiSettings;
  }

  public static async getAnalyticsSettings(tenantID: string): Promise<AnalyticsSettings> {
    const analyticsSettings = {
      identifier: TenantComponents.ANALYTICS,
    } as AnalyticsSettings;
    // Get the analytics settings
    const settings = await SettingStorage.getSettings(tenantID, { identifier: TenantComponents.ANALYTICS }, Constants.DB_PARAMS_MAX_LIMIT);
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      analyticsSettings.id = settings.result[0].id;
      analyticsSettings.sensitiveData = settings.result[0].sensitiveData;
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

  public static async getAssetsSettings(tenantID: string): Promise<AssetSettings> {
    const assetSettings = {
      identifier: TenantComponents.ASSET,
    } as AssetSettings;
    // Get the settings
    const settings = await SettingStorage.getSettings(tenantID, { identifier: TenantComponents.ASSET }, Constants.DB_PARAMS_MAX_LIMIT);
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      assetSettings.id = settings.result[0].id;
      assetSettings.sensitiveData = settings.result[0].sensitiveData;
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

  public static async getRefundSettings(tenantID: string): Promise<RefundSettings> {
    const refundSettings = {
      identifier: TenantComponents.REFUND
    } as RefundSettings;
    const settings = await SettingStorage.getSettings(tenantID, { identifier: TenantComponents.REFUND }, Constants.DB_PARAMS_MAX_LIMIT);
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      refundSettings.id = settings.result[0].id;
      refundSettings.sensitiveData = settings.result[0].sensitiveData;
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

  public static async getPricingSettings(tenantID: string, limit?: number, skip?: number, dateFrom?: Date, dateTo?: Date): Promise<PricingSettings> {
    const pricingSettings = {
      identifier: TenantComponents.PRICING,
    } as PricingSettings;
    // Get the Pricing settings
    const settings = await SettingStorage.getSettings(tenantID, { identifier: TenantComponents.PRICING, dateFrom: dateFrom, dateTo: dateTo }, {
      limit,
      skip
    });
    // Get the currency
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      // ID
      pricingSettings.id = settings.result[0].id;
      pricingSettings.sensitiveData = settings.result[0].sensitiveData;
      // Simple price
      if (config.simple) {
        pricingSettings.type = PricingSettingsType.SIMPLE;
        pricingSettings.simple = {
          price: config.simple.price ? Utils.convertToFloat(config.simple.price) : 0,
          currency: config.simple.currency ? config.simple.currency : '',
          last_updated: settings.result[0].lastChangedOn ? Utils.convertToDate(settings.result[0].lastChangedOn) : null,
        };
      }
      // Convergent Charging
      if (config.convergentCharging) {
        pricingSettings.type = PricingSettingsType.CONVERGENT_CHARGING;
        pricingSettings.convergentCharging = {
          url: config.convergentCharging.url ? config.convergentCharging.url : '',
          chargeableItemName: config.convergentCharging.chargeableItemName ? config.convergentCharging.chargeableItemName : '',
          user: config.convergentCharging.user ? config.convergentCharging.user : '',
          password: config.convergentCharging.password ? config.convergentCharging.password : '',
        };
      }
    }
    return pricingSettings;
  }

  public static async getSmartChargingSettings(tenantID: string): Promise<SmartChargingSettings> {
    const smartChargingSettings = {
      identifier: TenantComponents.SMART_CHARGING,
    } as SmartChargingSettings;
    // Get the Smart Charging settings
    const settings = await SettingStorage.getSettings(tenantID,
      { identifier: TenantComponents.SMART_CHARGING },
      Constants.DB_PARAMS_MAX_LIMIT);
    // Get the currency
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      // ID
      smartChargingSettings.id = settings.result[0].id;
      smartChargingSettings.sensitiveData = settings.result[0].sensitiveData;
      // SAP Smart Charging
      if (config.sapSmartCharging) {
        smartChargingSettings.type = SmartChargingSettingsType.SAP_SMART_CHARGING;
        smartChargingSettings.sapSmartCharging = {
          optimizerUrl: config.sapSmartCharging.optimizerUrl,
          user: config.sapSmartCharging.user,
          password: config.sapSmartCharging.password,
        };
      }
    }
    return smartChargingSettings;
  }

  public static async saveBillingSettings(tenantID: string, billingSettingsToSave: BillingSettings): Promise<string> {
    const settings = await SettingStorage.getBillingSettings(tenantID);
    if (settings.type === BillingSettingsType.STRIPE) {
      if (!billingSettingsToSave.stripe.secretKey ||
          (!billingSettingsToSave.stripe.immediateBillingAllowed && billingSettingsToSave.stripe.periodicBillingAllowed && !billingSettingsToSave.stripe.advanceBillingAllowed)) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME,
          method: 'saveBillingSettings',
          message: 'One or several mandatory fields are missing'
        });
      }
    }
    // Build internal structure
    const settingsToSave = {
      id: billingSettingsToSave.id,
      identifier: billingSettingsToSave.identifier,
      sensitiveData: billingSettingsToSave.sensitiveData,
      lastChangedOn: new Date(),
      content: {
        stripe: billingSettingsToSave.stripe
      },
    } as SettingDB;
    // Save
    return this.saveSettings(tenantID, settingsToSave);
  }

  public static async getBillingSettings(tenantID: string): Promise<BillingSettings> {
    const billingSettings = {
      identifier: TenantComponents.BILLING,
    } as BillingSettings;
    const settings = await SettingStorage.getSettings(tenantID, { identifier: TenantComponents.BILLING }, Constants.DB_PARAMS_MAX_LIMIT);
    const config = settings.result[0].content;
    if (settings && settings.count > 0 && settings.result[0].content) {
      // ID
      billingSettings.id = settings.result[0].id;
      billingSettings.sensitiveData = settings.result[0].sensitiveData;
      // Currency
      const pricingSettings = await SettingStorage.getPricingSettings(tenantID);
      let currency = 'EUR';
      if (pricingSettings) {
        if (pricingSettings.simple) {
          currency = pricingSettings.simple.currency;
        } else if (pricingSettings.convergentCharging) {
          if (pricingSettings.convergentCharging['currency']) {
            currency = pricingSettings.convergentCharging['currency'];
          }
        }
      }
      // Billing type
      if (config.stripe) {
        billingSettings.type = BillingSettingsType.STRIPE;
        billingSettings.stripe = {
          url: config.stripe.url ? config.stripe.url : '',
          publicKey: config.stripe.publicKey ? config.stripe.publicKey : '',
          secretKey: config.stripe.secretKey ? config.stripe.secretKey : '',
          currency: currency,
          noCardAllowed: config.stripe.noCardAllowed ? config.stripe.noCardAllowed : false,
          advanceBillingAllowed: config.stripe.advanceBillingAllowed ? config.stripe.advanceBillingAllowed : false,
          immediateBillingAllowed: config.stripe.immediateBillingAllowed ? config.stripe.immediateBillingAllowed : false,
          periodicBillingAllowed: config.stripe.periodicBillingAllowed ? config.stripe.periodicBillingAllowed : false,
          usersLastSynchronizedOn: config.stripe.usersLastSynchronizedOn ? config.stripe.usersLastSynchronizedOn : new Date(0),
          invoicesLastSynchronizedOn: config.stripe.invoicesLastSynchronizedOn ? config.stripe.invoicesLastSynchronizedOn : new Date(0),
          taxID: config.stripe.taxID ? (config.stripe.taxID !== 'none' ? config.stripe.taxID : null) : null,
        };
      }
      return billingSettings;
    }
  }

  public static async getSettings(tenantID: string,
    params: {identifier?: string; settingID?: string, dateFrom?: Date, dateTo?: Date},
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<SettingDB>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getSettings');
    // Check Tenant
    await Utils.checkTenant(tenantID);
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
      filters._id = Utils.convertToObjectID(params.settingID);
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
    const settingsCountMDB = await global.database.getCollection<any>(tenantID, 'settings')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
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
    const settingsMDB = await global.database.getCollection<SettingDB>(tenantID, 'settings')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getSettings', uniqueTimerID, settingsMDB);
    // Ok
    return {
      count: (settingsCountMDB.length > 0 ? settingsCountMDB[0].count : 0),
      result: settingsMDB
    };
  }

  public static async deleteSetting(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'deleteSetting');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete Component
    await global.database.getCollection<any>(tenantID, 'settings')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'deleteSetting', uniqueTimerID, { id });
  }
}
