import User from './User';
import { OCPIToken } from './ocpi/OCPIToken';

export default interface Tag {
  id: string;
  description?: string;
  issuer: boolean;
  active: boolean;
  userID?: string;
  lastChangedBy?: Partial<User>;
  lastChangedOn?: Date;
  sessionCount?: number;
  ocpiToken?: OCPIToken;
}
