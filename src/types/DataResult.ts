import Company from './Company';
import Site from './Site';
import SiteArea from './SiteArea';
import { Transaction } from '@google-cloud/firestore';

export interface DataResult<T> {
  count: number;
  result: T[];
}

export interface CompanyDataResult extends DataResult<Company>{
  canCreate: boolean;
}
export interface SiteDataResult extends DataResult<Site>{
  canCreate: boolean;
  canAssignUsers: boolean;
  canUnassignUsers: boolean;
}

export interface SiteAreaDataResult extends DataResult<SiteArea>{
  canCreate: boolean;
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
