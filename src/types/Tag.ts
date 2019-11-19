import User from './User';

export default interface Tag {
  id: string;
  internal: boolean;
  userID?: string;
  provider?: string;
  deleted?: boolean;
  lastChangedBy?: Partial<User>;
  lastChangedOn?: Date;
}
