import { BillingSettings, BillingSettingsType } from '../../../src/types/Setting';

import BackendError from '../../../src/exception/BackendError';
import BillingFactory from '../../../src/integration/billing/BillingFactory';
import Constants from '../../../src/utils/Constants';
import ContextDefinition from './ContextDefinition';
import Cypher from '../../../src/utils/Cypher';
import SettingStorage from '../../../src/storage/mongodb/SettingStorage';
import TenantComponents from '../../../src/types/TenantComponents';
import TenantContext from './TenantContext';
import User from '../../../src/types/User';
import config from '../../config';

export default class BillingContext {

  private tenantContext: TenantContext;

  constructor(tenantContext: TenantContext) {
    this.tenantContext = tenantContext;
  }

  private static getBillingSettings(): BillingSettings {
    const billingProperties = {
      isTransactionBillingActivated: config.get('billing.isTransactionBillingActivated'),
      immediateBillingAllowed: config.get('billing.immediateBillingAllowed'),
      periodicBillingAllowed: config.get('billing.periodicBillingAllowed'),
      taxID: config.get('billing.taxID')
    };
    const stripeProperties = {
      url: config.get('stripe.url'),
      publicKey: config.get('stripe.publicKey'),
      secretKey: config.get('stripe.secretKey'),
    };
    return {
      identifier: TenantComponents.BILLING,
      type: BillingSettingsType.STRIPE,
      billing: billingProperties,
      stripe: stripeProperties,
    };
  }

  public async createTestData(): Promise<void> {
    const settings = BillingContext.getBillingSettings();
    const skip = (!settings.stripe.secretKey);
    if (skip) {
      // Skip billing context generation if no settings are provided
      return;
    }
    await this.saveBillingSettings(BillingContext.getBillingSettings());
    const tenantID = this.tenantContext.getTenant().id;
    const billingImpl = await BillingFactory.getBillingImpl(tenantID);
    if (!billingImpl) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        message: 'Billing service is not configured',
        method: 'createTestData',
        module: 'BillingContext'
      });
    }
    // Create Users
    const adminUser: User = this.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
    const basicUser: User = this.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
    // Synchronize at least these 2 users - this creates a customer on the STRIPE side
    await billingImpl.synchronizeUser(adminUser);
    await billingImpl.synchronizeUser(basicUser);
  }

  private async saveBillingSettings(billingSettings: BillingSettings) {
    // TODO - rethink that part
    const tenantBillingSettings = await SettingStorage.getBillingSettings(this.tenantContext.getTenant().id);
    tenantBillingSettings.billing = billingSettings.billing;
    tenantBillingSettings.stripe = billingSettings.stripe;
    tenantBillingSettings.sensitiveData = ['content.stripe.secretKey'];
    tenantBillingSettings.stripe.secretKey = await Cypher.encrypt(this.tenantContext.getTenant().id, billingSettings.stripe.secretKey);
    await SettingStorage.saveBillingSettings(this.tenantContext.getTenant().id, tenantBillingSettings);
  }
}
