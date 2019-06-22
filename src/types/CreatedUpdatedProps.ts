import User from "../entity/User";

export default interface CreatedUpdatedProps {
  createdBy: User;
  createdOn: Date;
  lastChangedBy?: User;
  lastChangedOn?: Date;
}
