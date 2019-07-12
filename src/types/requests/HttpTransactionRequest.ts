import HttpByIDRequest from "./HttpByIDRequest";
import HttpDatabaseRequest from "./HttpDatabaseRequest";

export interface HttpTransactionsRefundRequest {
  transactionIds: number[];
}

export interface HttpTransactionRequest {
  ID: number;
}

export interface HttpTransactionsRequest extends HttpDatabaseRequest {
  ChargeBoxID: string;
  ConnectorId: number;
  SiteAreaID: string;
  UserID: string;
}