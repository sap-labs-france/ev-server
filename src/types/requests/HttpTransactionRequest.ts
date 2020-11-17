import HttpDatabaseRequest from './HttpDatabaseRequest';

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
  ConnectorId: number;
  SiteAreaID?: string;
  SiteID?: string;
  UserID?: string;
  TagID?: string;
  StartDateTime?: Date;
  EndDateTime?: Date;
  Search?: string;
  ErrorType?: string;
  RefundStatus?: string;
  InactivityStatus?: string;
  MinimalPrice?: boolean;
  Statistics?: 'refund' | 'history';
  ReportIDs?: string;
}

export interface HttpConsumptionFromTransactionRequest {
  TransactionId: number;
  LoadAllConsumptions?: boolean;
  StartDateTime: Date;
  EndDateTime: Date;
}
