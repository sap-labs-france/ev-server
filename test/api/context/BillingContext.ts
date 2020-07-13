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

  static readonly USERS: any = [
    ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN,
    ContextDefinition.USER_CONTEXTS.BASIC_USER
  ];

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
      periodicBillingAllowed: config.get('billing.periodicBillingAllowed')
    } as StripeBillingSetting;
  }

  public async createTestData() {
    let skip = false;
    const settings = BillingContext.getBillingSettings();
    for (const [key, value] of Object.entries(settings)) {
      if (!settings[key] || value === '') {
        skip = true;
      }
    }
    // Skip billing context generation if no settings are provided
    if (skip) {
      return;
    }
    await this.saveBillingSettings(BillingContext.getBillingSettings());
    const billingImpl = await BillingFactory.getBillingImpl(this.tenantContext.getTenant().id);
    if (!billingImpl) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        message: 'Billing service is not configured',
        method: 'createTestData',
        module: 'BillingContext'
      });
    }

    const adminUser: User = this.tenantContext.getUserContext(BillingContext.USERS[0]);
    const basicUser: User = this.tenantContext.getUserContext(BillingContext.USERS[1]);

    await billingImpl.synchronizeUser(this.tenantContext.getTenant().id, adminUser);
    await billingImpl.synchronizeUser(this.tenantContext.getTenant().id, basicUser);

    const adminBillingUser = await billingImpl.getUserByEmail(adminUser.email);
    const basicBillingUser = await billingImpl.getUserByEmail(basicUser.email);
    for (let i = 0; i < 2; i++) {
      await billingImpl.createInvoice(adminBillingUser, { description: 'TestAdmin' + (i + 1), amount: 100 });
      await billingImpl.createInvoice(basicBillingUser, { description: 'TestBasic' + (i + 1), amount: 100 });
    }
    let invoice = await billingImpl.createInvoice(adminBillingUser, { description: 'TestAdmin3', amount: 100 });
    await billingImpl.sendInvoiceToUser(invoice.invoice);
    invoice = await billingImpl.createInvoice(basicBillingUser, { description: 'TestBasic3', amount: 100 });
    await billingImpl.sendInvoiceToUser(invoice.invoice);
  }

  private async saveBillingSettings(stripeSettings) {
    const tenantBillingSettings = await SettingStorage.getBillingSettings(this.tenantContext.getTenant().id);
    tenantBillingSettings.stripe = stripeSettings;
    tenantBillingSettings.sensitiveData = ['content.stripe.secretKey'];
    tenantBillingSettings.stripe.secretKey = Cypher.encrypt(stripeSettings.secretKey);
    await SettingStorage.saveBillingSettings(this.tenantContext.getTenant().id, tenantBillingSettings);
  }
}
