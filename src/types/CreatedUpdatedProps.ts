import User from "../entity/User";

export default interface CreatedUpdatedProps {
  readonly id: string;
  createdBy: User;
  createdOn: Date;
  lastChangedBy?: User;
  lastChangedOn?: Date;
}
