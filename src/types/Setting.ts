import CreatedUpdatedProps from './CreatedUpdatedProps';

export enum ComponentType {
  OCPI = 'ocpi',
  ORGANIZATION = 'organization',
  PRICING = 'pricing',
  BILLING = 'billing',
  REFUND = 'refund',
  STATISTICS = 'statistics',
  ANALYTICS = 'analytics',
  SMART_CHARGING = 'smartCharging'
}

export default interface Setting extends CreatedUpdatedProps {
  id?: string;
  category?: 'business' | 'technical';
  identifier: 'pricing' | 'billing' | 'analytics' | 'refund' | 'ocpi' | 'smartCharging';
  sensitiveData: string[];
  content: SettingContent;
}

export interface SettingContent {
  type: 'gireve' | 'sac' | 'concur' | 'simple' | 'convergentCharging' | 'stripe' | 'notifications' | 'sapSmartCharging';
  ocpi?: OcpiSettings;
  simple?: SimplePricingSettings;
  convergentCharging?: ConvergentChargingPricingSettings;
  stripe?: StripeBillingSettings;
  sac?: AnalyticsSettings;
  links?: AnalyticsLink[];
  concur?: ConcurRefundSettings;
  sapSmartCharging?: SapSmartChargingSettings;
  notifications?: NotificationsSettings;
}

export interface NotificationsSettings {
  userInactivity?: boolean;
}

export enum PricingSettingsType {
  SIMPLE = 'simple',
  CONVERGENT_CHARGING = 'convergentCharging',
}

export interface PricingSettings {
  id?: string;
  identifier: ComponentType.PRICING;
  sensitiveData: string[];
  type: PricingSettingsType;
  simple: SimplePricingSettings;
  convergentCharging: ConvergentChargingPricingSettings;
}

export interface PricingSetting {
}

export interface SimplePricingSettings extends PricingSetting {
  price: number;
  currency: string;
}

export interface ConvergentChargingPricingSettings extends PricingSetting {
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
  lastSynchronizedOn?: Date;
}

export interface OcpiSettings {
  cpo: {
    countryCode: string;
    partyID: string;
  };
  emsp: {
    countryCode: string;
    partyID: string;
  };
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

export interface SapSmartChargingSettings {
  optimizerUrl: string;
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
