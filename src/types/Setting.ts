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

// Database Settings interface
export default interface Setting extends CreatedUpdatedProps {
  id?: string;
  category?: 'business' | 'technical';
  identifier: 'pricing' | 'billing' | 'analytics' | 'refund' | 'ocpi' | 'smartCharging';
  sensitiveData: string[];
  content: SettingContent;
}

// Database Settings Content interface
export interface SettingContent {
  type: 'gireve' | 'sac' | 'concur' | 'simple' | 'convergentCharging' | 'stripe' | 'notifications' | 'sapSmartCharging';
  ocpi?: OcpiSetting;
  simple?: SimplePricingSetting;
  convergentCharging?: ConvergentChargingPricingSetting;
  stripe?: StripeBillingSetting;
  sac?: SacAnalyticsSetting;
  links?: SettingLink[];
  concur?: ConcurRefundSetting;
  sapSmartCharging?: SapSmartChargingSetting;
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
  simple?: SimplePricingSetting;
  convergentCharging?: ConvergentChargingPricingSetting;
}

export interface PricingSetting {
}

export interface SimplePricingSetting extends PricingSetting {
  price: number;
  currency: string;
}

export interface ConvergentChargingPricingSetting extends PricingSetting {
  url: string;
  chargeableItemName: string;
  user: string;
  password: string;
}

export interface OcpiSettings {
  id?: string;
  identifier: ComponentType.OCPI;
  sensitiveData: string[];
  ocpi?: OcpiSetting;
}

export interface OcpiSetting {
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
  id?: string;
  identifier: ComponentType.ANALYTICS;
  sensitiveData: string[];
  sac?: SacAnalyticsSetting;
}

export interface SacAnalyticsSetting {
  mainUrl: string;
  timezone: string;
}

export interface SapSmartChargingSetting {
  optimizerUrl: string;
}

export interface OcpiSettings {
  id?: string;
  identifier: ComponentType.OCPI;
  sensitiveData: string[];
  ocpi?: OcpiSetting;
}

export interface SettingLink {
  id: string;
  name: string;
  description: string;
  role: string;
  url: string;
}

export interface RefundSettingSettings {
  id?: string;
  identifier: ComponentType.REFUND;
  sensitiveData: string[];
  concur?: ConcurRefundSetting;
}

export interface ConcurRefundSetting {
  authenticationUrl: string;
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  paymentTypeId: string;
  expenseTypeCode: string;
  policyId: string;
  reportName: string;
}

export interface BillingSettings {
  id?: string;
  identifier: ComponentType.BILLING;
  type: BillingSettingType;
  sensitiveData: string[];
  stripe?: StripeBillingSetting;
}

export interface BillingSetting {
  lastSynchronizedOn?: Date;
}

export interface StripeBillingSetting extends BillingSetting {
  url: string;
  secretKey: string;
  publicKey: string;
  noCardAllowed: boolean;
  immediateBillingAllowed: boolean;
  periodicBillingAllowed: boolean;
  advanceBillingAllowed: boolean;
  currency: string;
}

export enum BillingSettingType {
  STRIPE = 'stripe'
}
