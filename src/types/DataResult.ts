import { BillingAccount, BillingInvoice, BillingPaymentMethod } from './Billing';
import { Car, CarCatalog } from './Car';
import Transaction, { TransactionStats } from './Transaction';

import Asset from './Asset';
import { AuthorizationDefinitionFieldMetadata } from './Authorization';
import { ChargingProfile } from './ChargingProfile';
import ChargingStation from './ChargingStation';
import { ChargingStationInError } from './InError';
import Company from './Company';
import { Log } from './Log';
import PricingDefinition from './Pricing';
import RegistrationToken from './RegistrationToken';
import Site from './Site';
import SiteArea from './SiteArea';
import Tag from './Tag';
import User from './User';

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

export interface CompanyDataResult extends DataResult<Company> {
  canCreate: boolean;
}

export interface SiteDataResult extends DataResult<Site> {
  canCreate: boolean;
  canAssignUsers: boolean;
  canUnassignUsers: boolean;
  canListCompanies: boolean;
}

export interface LogDataResult extends DataResult<Log> {
  canExport: boolean;
}

export interface SiteAreaDataResult extends DataResult<SiteArea> {
  canCreate: boolean;
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
}

export interface BillingInvoiceDataResult extends DataResult<BillingInvoice> {
  canListUsers?: boolean;
}

export interface BillingPaymentMethodDataResult extends DataResult<BillingPaymentMethod> {
  canCreate?: boolean;
}

export interface BillingSubaccountsDataResult extends DataResult<BillingAccount> {
  canListUsers?: boolean;
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
  canListSites?:boolean;
  canListSiteAreas?:boolean;
  canListCompanies?:boolean;
  canListUsers?:boolean;
}
