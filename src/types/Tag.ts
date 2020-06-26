import { OCPIToken } from './ocpi/OCPIToken';
import User from './User';

export default interface Tag {
  id: string;
  description?: string;
  issuer: boolean;
  active: boolean;
  userID?: string;
  lastChangedBy?: Partial<User>;
  lastChangedOn?: Date;
  transactionsCount?: number;
  ocpiToken?: OCPIToken;
}
