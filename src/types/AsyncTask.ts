import CreatedUpdatedProps from './CreatedUpdatedProps';
import { ServerAction } from './Server';

export default interface AsyncTask extends CreatedUpdatedProps {
  id: string;
  name: AsyncTasks;
  action: ServerAction;
  type: AsyncTaskType;
  tenantID?: string;
  status?: AsyncTaskStatus;
  parent?: string;
  execHost?: string;
  execTimestamp?: Date;
  execDurationSecs?: number;
  module: string;
  method: string;
  message?: string;
  parameters?: Record<string, any>;
}

export enum AsyncTaskType {
  TASK = 'T',
  TASK_GROUP = 'G',
}

export enum AsyncTaskStatus {
  PENDING = 'P',
  RUNNING = 'R',
  SUCCESS = 'S',
  ERROR = 'E',
}

export enum AsyncTasks {
  END_TRANSACTION = 'EndTransactionAsyncTask',
  BILL_TRANSACTION = 'BillTransactionAsyncTask',
  TAGS_IMPORT = 'TagsImportAsyncTask',
  USERS_IMPORT = 'UsersImportAsyncTask',
  OCPI_PUSH_TOKENS = 'OCPIPushTokensAsyncTask',
  OCPI_PULL_LOCATIONS = 'OCPIPullLocationsAsyncTask',
  OCPI_PULL_SESSIONS = 'OCPIPullSessionsAsyncTask',
  OCPI_PULL_CDRS = 'OCPIPullCdrsAsyncTask',
  OCPI_CHECK_CDRS = 'OCPICheckCdrsAsyncTask',
  OCPI_CHECK_SESSIONS = 'OCPICheckSessionsAsyncTask',
  OCPI_CHECK_LOCATIONS = 'OCPICheckLocationsAsyncTask',
  OCPI_PULL_TOKENS = 'OCPIPullTokensAsyncTask',
  OCPI_PUSH_EVSE_STATUSES = 'OCPIPushEVSEStatusesAsyncTask',
  SYNCHRONIZE_CAR_CATALOGS = 'SynchronizeCarCatalogsAsyncTask',
}

