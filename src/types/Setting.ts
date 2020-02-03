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

export interface Setting {
  id?: string;
  identifier: ComponentType;
  sensitiveData?: string[];
  category?: 'business' | 'technical';
}

// Database Settings interface
export interface SettingDB extends CreatedUpdatedProps, Setting {
  content: SettingDBContent;
}

export interface SettingLink {
  id: string;
  name: string;
  description: string;
  role: string;
  url: string;
}

// Database Settings Content interface
export interface SettingDBContent {
  type: RoamingSettingsType | AnalyticsSettingsType | RefundSettingsType | PricingSettingsType | BillingSettingsType | SmartChargingSettingsType;
  ocpi?: OcpiSetting;
  simple?: SimplePricingSetting;
  convergentCharging?: ConvergentChargingPricingSetting;
  stripe?: StripeBillingSetting;
  sac?: SacAnalyticsSetting;
  links?: SettingLink[];
  concur?: ConcurRefundSetting;
  sapSmartCharging?: SapSmartChargingSetting;
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
  type: RoamingSettingsType;
  ocpi?: OcpiSetting;
}

export interface OcpiSetting {
  cpo: OcpiIdentifier;
  emsp: OcpiIdentifier;
  businessDetails: OcpiBusinessDetails;
}

export interface OcpiIdentifier {
  countryCode: string;
  partyID: string;
}

export interface OcpiBusinessDetails {
  name: string;
  website: string;
  logo?: {
    url: string;
    thumbnail: string;
    category: string;
    type: string;
    width: string;
    height: string;
  };
}

export enum AnalyticsSettingsType {
  SAC = 'sac'
}

export interface AnalyticsSettings extends Setting {
  identifier: ComponentType.ANALYTICS;
  type: AnalyticsSettingsType;
  sac?: SacAnalyticsSetting;
  links: SettingLink[];
}

export interface SacAnalyticsSetting {
  mainUrl: string;
  timezone: string;
}

export enum SmartChargingSettingsType {
  SAP_SMART_CHARGING = 'sapSmartCharging'
}

export interface SmartChargingSettings extends Setting {
  identifier: ComponentType.SMART_CHARGING;
  type: SmartChargingSettingsType;
  sapSmartCharging?: SapSmartChargingSetting;
}

export interface SapSmartChargingSetting {
  optimizerUrl: string;
  user: string;
  password: string;
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
  appUrl: string;
  clientId: string;
  clientSecret: string;
  paymentTypeId: string;
  expenseTypeCode: string;
  policyId: string;
  reportName: string;
}

export enum BillingSettingsType {
  STRIPE = 'stripe'
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

export enum PricingContentType {
  SIMPLE = 'simple',
  CONVERGENT_CHARGING = 'convergentCharging',
}

export enum RefundContentType {
  CONCUR = 'concur',
  GIREVE = 'gireve',
  OCPI = 'ocpi',
  SAC = 'sac',
}

export enum BillingContentType {
  STRIPE = 'stripe',
}

export enum SmartChargingContentType {
  SAP_SMART_CHARGING = 'sapSmartCharging',
}
