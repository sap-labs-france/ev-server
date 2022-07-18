import { InactivityStatus, TransactionStatisticsType, TransactionStatus } from '../Transaction';

import HttpByIDRequest from './HttpByIDRequest';
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

export interface HttpTransactionGetRequest extends HttpByIDRequest {
  ID: number;
  WithTag: boolean;
  WithCar: boolean;
  WithUser: boolean;
}

export interface HttpTransactionDeleteRequest extends HttpByIDRequest {
  ID: number;
}

export interface HttpTransactionStopRequest extends HttpByIDRequest {
  ID: number;
}

export interface HttpTransactionCdrPushRequest {
  transactionId: number;
}

export interface HttpTransactionCdrExportRequest {
  ID: number;
}

export interface HttpTransactionsByIDsGetRequest {
  transactionsIDs: number[];
}

export interface HttpTransactionsGetRequest extends HttpDatabaseRequest {
  ChargingStationID: string;
  Issuer: boolean;
  WithCompany: boolean;
  WithTag: boolean;
  WithUser: boolean;
  WithChargingStation: boolean;
  WithCar: boolean;
  WithSite: boolean;
  WithSiteArea: boolean;
  ConnectorID: string;
  SiteAreaID?: string;
  SiteID?: string;
  UserID?: string;
  VisualTagID?: string;
  TagID?: string;
  StartDateTime?: Date;
  EndDateTime?: Date;
  Search?: string;
  ErrorType?: string;
  RefundStatus?: string;
  InactivityStatus?: InactivityStatus;
  MinimalPrice?: boolean;
  Statistics?: TransactionStatisticsType;
  ReportIDs?: string;
  Status?: TransactionStatus;
}

export interface HttpTransactionConsumptionsGetRequest {
  TransactionId: number;
  WithTag: boolean;
  WithCar: boolean;
  WithUser: boolean;
  LoadAllConsumptions?: boolean;
  StartDateTime: Date;
  EndDateTime: Date;
}

export interface HttpTransactionConsumptionsAdvenirGetRequest {
  TransactionId: number;
  AdvenirUserId?: string;
}
