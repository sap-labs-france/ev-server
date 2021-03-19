import HttpDatabaseRequest from './HttpDatabaseRequest';
import { InactivityStatus } from '../Transaction';

export interface HttpTransactionsRefundRequest {
  transactionIds: number[];
}

export interface HttpAssignTransactionsToUserRequest {
  UserID: string;
  TagID: string;
}

export interface HttpUnassignTransactionsToUserRequest {
  TagID: string;
}

export interface HttpTransactionRequest {
  ID: number;
}

export interface HttpPushTransactionCdrRequest {
  transactionId: number;
}

export interface HttpTransactionsRequest extends HttpDatabaseRequest {
  ChargeBoxID: string;
  Issuer: boolean;
  ConnectorID: string;
  SiteAreaID?: string;
  SiteID?: string;
  UserID?: string;
  TagID?: string;
  StartDateTime?: Date;
  EndDateTime?: Date;
  Search?: string;
  ErrorType?: string;
  RefundStatus?: string;
  InactivityStatus?: InactivityStatus;
  MinimalPrice?: boolean;
  Statistics?: 'refund' | 'history';
  ReportIDs?: string;
  Status?: 'completed' | 'active';
}

export interface HttpConsumptionFromTransactionRequest {
  TransactionId: number;
  LoadAllConsumptions?: boolean;
  StartDateTime: Date;
  EndDateTime: Date;
}
