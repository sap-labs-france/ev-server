import CreatedUpdatedProps from "./CreatedUpdatedProps";
import Address from "./Address";

export default interface User extends CreatedUpdatedProps {

  id: string;
  email: string;
  phone: string;
  mobile: string;
  role: string;
  status: string;
  locale: string;
  plateID: string;
  address: Address;
  image: string;
  notificationsActive: boolean;
  iNumber: string;
  costCenter: string;
  
  deleted: boolean;

  eulaAcceptedHash: string;
  eulaAcceptedVersion: string;
  eulaAcceptedOn: Date;
  
  lastName: string;
  firstName: string;
  
  password: string;
  passwordResetHash: string;
  passwordWrongNbrTrials: number;
  passwordBlockedUntil: Date;
  verificationToken: string;
  verifiedAt: Date;

  tagIDs?: string[]; //TODO whats this

}