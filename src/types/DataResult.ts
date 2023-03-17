import { BillingAccount, BillingInvoice, BillingPaymentMethod, BillingTax, BillingTransfer } from './Billing';
import { Car, CarCatalog } from './Car';
import ChargingStation, { ChargingStationTemplate } from './ChargingStation';
import { ChargingStationInError, TransactionInError } from './InError';
import Site, { UserSite } from './Site';
import Transaction, { TransactionStats } from './Transaction';
import User, { SiteUser } from './User';

import Asset from './Asset';
import { AuthorizationDefinitionFieldMetadata } from './Authorization';
import { ChargingProfile } from './ChargingProfile';
import Company from './Company';
import { Log } from './Log';
import OCPIEndpoint from './ocpi/OCPIEndpoint';
import PricingDefinition from './Pricing';
import RegistrationToken from './RegistrationToken';
import { SettingDB } from './Setting';
import SiteArea from './SiteArea';
import Tag from './Tag';

export interface DeletedResult {
  acknowledged?: boolean;
  deletedCount?: number;
}

export interface DataResult<T> {
  count: number;
  result: T[];
  projectFields?: string[];
  metadata?: Record<string, AuthorizationDefinitionFieldMetadata>;
}

export interface PricingDefinitionDataResult extends DataResult<PricingDefinition> {
  canCreate: boolean;
}

export interface RegistrationTokenDataResult extends DataResult<RegistrationToken> {
  canCreate: boolean;
}

export interface ChargingStationTemplateDataResult extends DataResult<ChargingStationTemplate> {
  canCreate: boolean;
}

export interface CompanyDataResult extends DataResult<Company> {
  canCreate: boolean;
}

export interface SiteDataResult extends DataResult<Site> {
  canCreate: boolean;
  canAssignUsers: boolean;
  canUnassignUsers: boolean;
  canListCompanies: boolean;
}

export interface UserSiteDataResult extends DataResult<UserSite> {
  canUpdateUserSites: boolean;
}

export interface SiteUserDataResult extends DataResult<SiteUser> {
  canUpdateSiteUsers: boolean;
}

export interface LogDataResult extends DataResult<Log> {
  canExport: boolean;
}

export interface SiteAreaDataResult extends DataResult<SiteArea> {
  canCreate: boolean;
  smartChargingSessionParametersActive: boolean;
}

export interface CarDataResult extends DataResult<Car> {
  canCreate: boolean;
  canListUsers: boolean;
  canListCarCatalog: boolean;
}

export interface CarCatalogDataResult extends DataResult<CarCatalog> {
  canSync: boolean;
}

export interface UserDataResult extends DataResult<User> {
  canCreate: boolean;
  canExport: boolean;
  canImport: boolean;
  canListTags: boolean;
  canListSites: boolean;
}
export interface TagDataResult extends DataResult<Tag> {
  canCreate: boolean;
  canDelete: boolean;
  canImport: boolean;
  canExport: boolean;
  canUnassign: boolean;
  canAssign: boolean;
  canListUsers: boolean;
  canListSources: boolean;
}

export interface TransactionDataResult extends DataResult<Transaction> {
  stats: TransactionStats;
  canListUsers?: boolean;
  canListSites?: boolean;
  canListSiteAreas?: boolean;
  canListChargingStations?: boolean;
  canListTags?: boolean;
  canExport?: boolean;
  canDelete?: boolean;
  canSyncRefund?: boolean;
  canRefund?: boolean;
  canReadSetting?: boolean;
}

export interface TransactionInErrorDataResult extends DataResult<TransactionInError> {
  canListUsers?: boolean;
  canListSites?: boolean;
  canListSiteAreas?: boolean;
  canListChargingStations?: boolean;
  canListTags?: boolean;
  canExport?: boolean;
  canDelete?: boolean;
}

export interface BillingInvoiceDataResult extends DataResult<BillingInvoice> {
  canListUsers?: boolean;
}

export interface BillingTaxDataResult extends DataResult<BillingTax> {
  canCreate?: boolean;
}

export interface BillingPaymentMethodDataResult extends DataResult<BillingPaymentMethod> {
  canCreate?: boolean;
}

export interface BillingAccountsDataResult extends DataResult<BillingAccount> {
  canCreate?: boolean;
  canListUsers?: boolean;
}

export interface BillingTransfersDataResult extends DataResult<BillingTransfer> {
  canListAccounts?: boolean;
}

export interface TransactionRefundDataResult {
  count: number;
  result: Transaction[];
  stats: {
    count: number;
    totalConsumptionWattHours: number;
    countRefundTransactions: number;
    countPendingTransactions: number;
    countRefundedReports: number;
    totalPriceRefund: number;
    totalPricePending: number;
    currency: string;
  };
}

export interface AssetDataResult extends DataResult<Asset> {
  canCreate: boolean;
  canListSites: boolean;
  canListSiteAreas: boolean;
}
export interface ChargingStationDataResult extends DataResult<ChargingStation> {
  canExport?: boolean;
  canListSites?:boolean;
  canListSiteAreas?:boolean;
  canListCompanies?:boolean;
  canListUsers?:boolean;
}

export interface ChargingStationInErrorDataResult extends DataResult<ChargingStationInError> {
  canExport?: boolean;
  canListSites?:boolean;
  canListSiteAreas?:boolean;
  canListCompanies?:boolean;
  canListUsers?:boolean;
}
export interface ChargingProfileDataResult extends DataResult<ChargingProfile> {
  canListChargingStations?:boolean;
}

export interface SettingDBDataResult extends DataResult<SettingDB> {
  canCreate?: boolean;
}

export interface OcpiEndpointDataResult extends DataResult<OCPIEndpoint> {
  canCreate?: boolean;
  canPing?: boolean;
  canGenerateLocalToken?: boolean;
}
