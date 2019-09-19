import CreatedUpdatedProps from './CreatedUpdatedProps';

export default interface Setting extends CreatedUpdatedProps {
  id?: string;
  identifier: 'pricing' | 'billing' | 'analytics' | 'refund' | 'ocpi';
  sensitiveData: string[];
  content: SettingContent;
}

export interface SettingContent {
  type: 'gireve' | 'sac' | 'concur' | 'simple' | 'convergentCharging' | 'stripe';
  ocpi?: OcpiSettings;
  simple?: SimplePricingSettings;
  convergentCharging?: ConvergentChargingPricingSettings;
  stripe?: StripeBillingSettings;
  sac?: AnalyticsSettings;
  links?: AnalyticsLink[];
  concur?: ConcurRefundSettings;
}

export interface SimplePricingSettings {
  price: number;
  currency: string;
}

export interface ConvergentChargingPricingSettings {
  url: string;
  chargeableItemName: string;
  user: string;
  password: string;
}

export interface StripeBillingSettings {
  url: string;
  secretKey: string;
  publicKey: string;
  noCardAllowed: boolean;
  immediateBillingAllowed: boolean;
  periodicBillingAllowed: boolean;
  // Default billing plan(s)?
  advanceBillingAllowed: boolean;
}

export interface OcpiSettings {
  countryCode: string;
  partyID: string;
  businessDetails: {
    name: string;
    website: string;
    logo: {
      url: string;
      thumbnail: string;
      category: string;
      type: string;
      width: string;
      height: string;
    };
  };
}

export interface AnalyticsSettings {
  mainUrl: string;
  timezone: string;
}

export interface AnalyticsLink {
  id: string;
  name: string;
  description: string;
  role: string;
  url: string;
}

export interface ConcurRefundSettings {
  authenticationUrl: string;
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  paymentTypeId: string;
  expenseTypeCode: string;
  policyId: string;
  reportName: string;
}
