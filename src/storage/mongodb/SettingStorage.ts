import { AnalyticsSettings, BillingSettings, BillingSettingsType, ComponentType, PricingSettings, PricingSettingsType, RefundSettings, RoamingSettings, SettingDB } from '../../types/Setting';
import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectID } from 'mongodb';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

export default class SettingStorage {
  public static async getSetting(tenantID: string, id: string): Promise<SettingDB> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SettingStorage', 'getSetting');
    // Delegate querying
    const settingMDB = await SettingStorage.getSettings(tenantID, { settingID: id }, Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd('SettingStorage', 'getSetting', uniqueTimerID, { id });
    return settingMDB.count > 0 ? settingMDB.result[0] : null;
  }

  public static async getSettingByIdentifier(tenantID: string, identifier: string): Promise<SettingDB> {
    const settingResult = await SettingStorage.getSettings(
      tenantID, { identifier: identifier }, Constants.DB_PARAMS_SINGLE_RECORD);
    return settingResult.count > 0 ? settingResult.result[0] : null;
  }

  public static async saveSettings(tenantID: string, settingToSave: Partial<SettingDB>): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SettingStorage', 'saveSetting');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID is provided
    if (!settingToSave.id && !settingToSave.identifier) {
      // ID must be provided!
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'SettingStorage',
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
    Logging.traceEnd('SettingStorage', 'saveSetting', uniqueTimerID, { settingToSave });
    // Create
    return settingFilter._id.toHexString();
  }

  public static async getOCPISettings(tenantID: string): Promise<RoamingSettings> {
    const ocpiSettings = {
      identifier: ComponentType.OCPI,
    } as RoamingSettings;
    // Get the Ocpi settings
    const settings = await SettingStorage.getSettings(tenantID, { identifier: ComponentType.OCPI }, Constants.DB_PARAMS_MAX_LIMIT);
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
      identifier: ComponentType.ANALYTICS,
    } as AnalyticsSettings;
    // Get the analytics settings
    const settings = await SettingStorage.getSettings(tenantID, { identifier: ComponentType.ANALYTICS }, Constants.DB_PARAMS_MAX_LIMIT);
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      analyticsSettings.id = settings.result[0].id;
      analyticsSettings.sensitiveData = settings.result[0].sensitiveData;
      // SAP Analytics
      if (config.sac) {
        analyticsSettings.sac = {
          timezone: config.sac.timezone ? config.sac.timezone : '',
          mainUrl: config.sac.mainUrl ? config.sac.mainUrl : '',
        };
      }
    }
    return analyticsSettings;
  }

  public static async getRefundSettings(tenantID: string): Promise<RefundSettings> {
    const refundSettings = {
      identifier: ComponentType.REFUND
    } as RefundSettings;

    const settings = await SettingStorage.getSettings(tenantID, { identifier: ComponentType.REFUND }, Constants.DB_PARAMS_MAX_LIMIT);
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      refundSettings.id = settings.result[0].id;
      refundSettings.sensitiveData = settings.result[0].sensitiveData;
      if (config.concur) {
        refundSettings.concur = {
          authenticationUrl: config.concur.authenticationUrl ? config.concur.authenticationUrl : '',
          apiUrl: config.concur.apiUrl ? config.concur.apiUrl : '',
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

  public static async getPricingSettings(tenantID: string): Promise<PricingSettings> {
    const pricingSettings = {
      identifier: ComponentType.PRICING,
    } as PricingSettings;
    // Get the Pricing settings
    const settings = await SettingStorage.getSettings(tenantID, { identifier: ComponentType.PRICING }, Constants.DB_PARAMS_MAX_LIMIT);
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
          price: config.simple.price ? parseFloat(config.simple.price + '') : 0,
          currency: config.simple.currency ? config.simple.currency : '',
        };
      }
      // Convergeant Charging
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
  // TODO handle 'none' value
  public static async saveBillingSettings(tenantID: string, billingSettingsToSave: BillingSettings): Promise<string> {
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

  // TODO handle 'none' value
  public static async getBillingSettings(tenantID: string): Promise<BillingSettings> {
    const billingSettings = {
      identifier: ComponentType.BILLING,
    } as BillingSettings;
    const settings = await SettingStorage.getSettings(tenantID, { identifier: ComponentType.BILLING }, Constants.DB_PARAMS_MAX_LIMIT);
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
          lastSynchronizedOn: config.stripe.lastSynchronizedOn ? config.stripe.lastSynchronizedOn : new Date(0),
          tax: config.stripe.tax ? (config.stripe.tax !== 'none' ? config.stripe.tax : null) : null,
        };
      }
      return billingSettings;
    }
  }

  public static async getSettings(tenantID: string,
    params: {identifier?: string; settingID?: string},
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<SettingDB>> {
    // Debug
    const uniqueTimerID = Logging.traceStart('SettingStorage', 'getSettings');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: any = {};
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
    DatabaseUtils.renameDatabaseID(aggregation);
    // Sort
    if (dbParams.sort) {
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      aggregation.push({
        $sort: {
          identifier: 1
        }
      });
    }
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
    Logging.traceEnd('SettingStorage', 'getSettings', uniqueTimerID, { params, dbParams });
    // Ok
    return {
      count: (settingsCountMDB.length > 0 ? settingsCountMDB[0].count : 0),
      result: settingsMDB
    };
  }

  public static async deleteSetting(tenantID: string, id: string) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SettingStorage', 'deleteSetting');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete Component
    await global.database.getCollection<any>(tenantID, 'settings')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd('SettingStorage', 'deleteSetting', uniqueTimerID, { id });
  }
}
