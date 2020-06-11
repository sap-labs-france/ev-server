import { Transaction } from '@google-cloud/firestore';

export interface DataResult<T> {
  count: number;
  result: T[];
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
