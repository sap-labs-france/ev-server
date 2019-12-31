import CreatedUpdatedProps from './CreatedUpdatedProps';
import { BillingPartialTax } from './Billing';

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

export interface Setting {
  id?: string;
  identifier: ComponentType;
  sensitiveData: string[];
}

// Database Settings interface
export interface SettingDB extends CreatedUpdatedProps, Setting {
  category?: 'business' | 'technical';
  content: SettingDBContent;
}

// Database Settings Content interface
export interface SettingDBContent {
  type: RoamingSettingsType | AnalyticsSettingsType | RefundSettingsType | PricingSettingsType | BillingSettingsType | NotificationsSettingsType | SmartChagingSettingsType;
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

export enum NotificationsSettingsType {
  NOTIFICATIONS = 'notifications'
}

export interface NotificationsSettings {
  userInactivity?: boolean;
}

export enum PricingSettingsType {
  SIMPLE = 'simple',
  CONVERGENT_CHARGING = 'convergentCharging',
}

export interface PricingSettings extends Setting {
  identifier: ComponentType.PRICING;
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

export enum RoamingSettingsType {
  GIREVE = 'gireve'
}

export interface RoamingSettings extends Setting {
  identifier: ComponentType.OCPI;
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

export enum AnalyticsSettingsType {
  SAC = 'sac'
}

export interface AnalyticsSettings extends Setting {
  identifier: ComponentType.ANALYTICS;
  sac?: SacAnalyticsSetting;
}

export interface SacAnalyticsSetting {
  mainUrl: string;
  timezone: string;
}

export enum SmartChagingSettingsType {
  SAP_SMART_CHARGING = 'sapSmartCharging'
}

export interface SapSmartChargingSetting {
  optimizerUrl: string;
}

export interface SettingLink {
  id: string;
  name: string;
  description: string;
  role: string;
  url: string;
}

export enum RefundSettingsType {
  CONCUR = 'concur',
}

export interface RefundSettings extends Setting {
  identifier: ComponentType.REFUND;
  type: RefundSettingsType;
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

export interface BillingSettings extends Setting{
  identifier: ComponentType.BILLING;
  type: BillingSettingsType;
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
  taxID: string;
}

export enum BillingSettingsType {
  STRIPE = 'stripe'
}
