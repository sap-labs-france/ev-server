import User from './User';
import { OCPIToken } from './ocpi/OCPIToken';

export default interface Tag {
  id: string;
  description?: string;
  issuer: boolean;
  userID?: string;
  deleted?: boolean;
  lastChangedBy?: Partial<User>;
  lastChangedOn?: Date;
  ocpiToken?: OCPIToken;
}
