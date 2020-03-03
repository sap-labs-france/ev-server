import User from '../types/User';

export default interface CreatedUpdatedProps {
  createdBy?: Partial<User>;
  createdOn?: Date;
  lastChangedBy?: Partial<User>;
  lastChangedOn?: Date;
}
