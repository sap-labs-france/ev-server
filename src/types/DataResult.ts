import { Car, CarCatalog } from './Car';

import Company from './Company';
import Site from './Site';
import SiteArea from './SiteArea';
import Tag from './Tag';
import { Transaction } from '@google-cloud/firestore';

export interface DataResult<T> {
  count: number;
  result: T[];
  projectedFields?: string[];
}

export interface CompanyDataResult extends DataResult<Company>{
  canCreate: boolean;
}
export interface SiteDataResult extends DataResult<Site>{
  canCreate: boolean;
  canAssignUsers: boolean;
  canUnassignUsers: boolean;
}

export interface SiteAreaDataResult extends DataResult<SiteArea> {
  canCreate: boolean;
}
export interface CarDataResult extends DataResult<Car> {
  canCreate: boolean;
}

export interface CarCatalogDataResult extends DataResult<CarCatalog>{
  canSync: boolean;
}
export interface TagDataResult extends DataResult<Tag>{
  canCreate: boolean;
  canDelete: boolean;
  canImport: boolean;
  canExport: boolean;
}

export interface TransactionDataResult {
  count: number;
  result: Transaction[];
  stats: {
    count: number;
    firstTimestamp?: Date;
    lastTimestamp?: Date;
    totalConsumptionWattHours: number;
    totalDurationSecs: number;
    totalInactivitySecs: number;
    totalPrice: number;
    currency: string;
  };
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
