import { AuthorizationActions } from './Authorization';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import { ImportStatus } from './GlobalType';
import { OCPIToken } from './ocpi/OCPIToken';
import User from './User';

export default interface Tag extends CreatedUpdatedProps, AuthorizationActions {
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
}

export interface ImportedTag {
  id: string;
  visualID?: string;
  description: string;
  importedBy?: string;
  importedOn?: Date;
  status?: ImportStatus;
  errorDescription?: string;
  name?: string;
  firstName?: string;
  email?: string;
}

export const TagRequiredImportProperties = [
  'id'
];

