import User from './User';

export default interface Tag {
  id: string;
  description?: string;
  issuer: boolean;
  userID?: string;
  deleted?: boolean;
  lastChangedBy?: Partial<User>;
  lastChangedOn?: Date;
}
