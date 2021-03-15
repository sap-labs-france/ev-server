import CreatedUpdatedProps from './CreatedUpdatedProps';
import { HTTPError } from './HTTPError';
import { OCPIToken } from './ocpi/OCPIToken';
import { StatusCodes } from 'http-status-codes';
import User from './User';

export default interface Tag extends CreatedUpdatedProps {
  id: string;
  description?: string;
  issuer: boolean;
  active: boolean;
  userID?: string;
  transactionsCount?: number;
  ocpiToken?: OCPIToken;
  user?: User;
  default?: boolean
  deleted?: boolean
}

export interface ImportedTag {
  id: string;
  description: string;
  importedBy?: string;
  importedOn?: Date;
  errorCode?: HTTPError | StatusCodes;
  errorDescription?: string;
}
