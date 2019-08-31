import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpTransactionsRefundRequest {
  transactionIds: number[];
}

export interface HttpAssignTransactionsToUserRequest {
  UserID?: string;
}

export interface HttpAssignTransactionsToUserRequest {
  UserID?: string;
}

export interface HttpTransactionRequest {
  ID: number;
}

export interface HttpTransactionsRequest extends HttpDatabaseRequest {
  ChargeBoxID: string;
  ConnectorId: number;
  SiteAreaID?: string;
  SiteID?: string;
  UserID?: string;
  StartDateTime?: Date;
  EndDateTime?: Date;
  Search?: string;
  ErrorType?: string;
  RefundStatus?: string;
  MinimalPrice?: boolean;
  Statistics?: 'refund'|'history';
}

export interface HttpConsumptionFromTransactionRequest {
  TransactionId: number;
  StartDateTime: Date;
  EndDateTime: Date;
}
