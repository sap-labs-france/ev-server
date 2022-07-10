import CreatedUpdatedProps from './CreatedUpdatedProps';
import { ImportStatus } from './GlobalType';
import { OCPIToken } from './ocpi/OCPIToken';
import { TagAuthorizationActions } from './Authorization';
import User from './User';

export default interface Tag extends CreatedUpdatedProps, TagAuthorizationActions {
  id: string;
  description?: string;
  visualID?: string;
  issuer: boolean;
  active: boolean;
  userID?: string;
  transactionsCount?: number;
  ocpiToken?: OCPIToken;
  user?: User;
  default?: boolean
  limit?: TagLimit;
  importedData?: {
    autoActivateUserAtImport: boolean;
    autoActivateTagAtImport: boolean;
  };
}

export interface TagLimit {
  limitKwhEnabled?: boolean;
  limitKwh?: number;
  limitKwhConsumed?: number;
  changeHistory?: TagChangeHistory[];
}

export interface TagChangeHistory {
  lastChangedOn: Date;
  lastChangedBy: Partial<User>;
  oldLimitKwhEnabled: boolean;
  newLimitKwhEnabled: boolean;
  oldLimitKwh: number;
  oldLimitKwhConsumed: number;
  newLimitKwh: number;
  newLimitKwhConsumed: number;
}

export interface ImportedTag {
  id: string;
  visualID: string;
  description: string;
  limitKwh: number;
  importedBy?: string;
  importedOn?: Date;
  status?: ImportStatus;
  errorDescription?: string;
  name?: string;
  firstName?: string;
  email?: string;
  importedData?: {
    autoActivateUserAtImport: boolean;
    autoActivateTagAtImport: boolean;
  };
  siteIDs?: string;
}

export const TagRequiredImportProperties = [
  'id'
];

