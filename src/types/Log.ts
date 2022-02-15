import { ServerAction, ServerType } from './Server';

import { AuthorizationActions } from './Authorization';
import User from './User';
import UserToken from './UserToken';

export interface Log extends AuthorizationActions {
  tenantID?: string;
  id?: string;
  level?: LogLevel;
  chargingStationID?: string;
  siteAreaID?: string;
  siteID?: string;
  companyID?: string;
  source?: ServerType;
  host?: string;
  module: string;
  method: string;
  timestamp?: Date;
  action: ServerAction;
  message: string;
  user?: User|UserToken|string;
  actionOnUser?: User|UserToken|string;
  hasDetailedMessages?: boolean;
  detailedMessages?: any;
}

export enum LogLevel {
  DEBUG = 'D',
  INFO = 'I',
  WARNING = 'W',
  ERROR = 'E',
  NONE = 'NONE',
  DEFAULT = 'DEFAULT',
}
