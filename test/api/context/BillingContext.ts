import BackendError from '../../../src/exception/BackendError';
import BillingFactory from '../../../src/integration/billing/BillingFactory';
import Constants from '../../../src/utils/Constants';
import ContextDefinition from './ContextDefinition';
import Cypher from '../../../src/utils/Cypher';
import SettingStorage from '../../../src/storage/mongodb/SettingStorage';
import { StripeBillingSetting } from '../../../src/types/Setting';
import TenantContext from './TenantContext';
import User from '../../../src/types/User';
import config from '../../config';

export default class BillingContext {

  private tenantContext: TenantContext;

  constructor(tenantContext: TenantContext) {
    this.tenantContext = tenantContext;
  }

  private static getBillingSettings(): StripeBillingSetting {
    return {
      url: config.get('billing.url'),
      publicKey: config.get('billing.publicKey'),
      secretKey: config.get('billing.secretKey'),
      noCardAllowed: config.get('billing.noCardAllowed'),
      advanceBillingAllowed: config.get('billing.advanceBillingAllowed'),
      currency: config.get('billing.currency'),
      immediateBillingAllowed: config.get('billing.immediateBillingAllowed'),
      periodicBillingAllowed: config.get('billing.periodicBillingAllowed'),
      taxID: config.get('billing.taxID')
    };
  }

  public async createTestData(): Promise<void> {
    const settings = BillingContext.getBillingSettings();
    const skip = (!settings.secretKey);
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

  private async saveBillingSettings(stripeSettings) {
    const tenantBillingSettings = await SettingStorage.getBillingSettings(this.tenantContext.getTenant().id);
    tenantBillingSettings.stripe = stripeSettings;
    tenantBillingSettings.sensitiveData = ['content.stripe.secretKey'];
    tenantBillingSettings.stripe.secretKey = await Cypher.encrypt(this.tenantContext.getTenant().id, stripeSettings.secretKey);
    await SettingStorage.saveBillingSettings(this.tenantContext.getTenant().id, tenantBillingSettings);
  }
}
