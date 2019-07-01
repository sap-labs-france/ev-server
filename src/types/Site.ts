import CreatedUpdatedProps from "./CreatedUpdatedProps";
import Address from "./Address";
import SiteArea from "./SiteArea";
import Company from "./Company";

export default interface Site extends CreatedUpdatedProps {
  id: string;
  name: string;
  address: Address;
  companyID: string;
  allowAllUsersToStopTransactions: boolean;
  autoUserSiteAssignment: boolean;
  image?: string;
  availableChargers?: number;
  totalChargers?: number;
  availableConnectors?: number;
  totalConnectors?: number;
  siteAreas?: SiteArea[];
  company?: Company;
}

export interface SiteUser {
  site: Site;
  userID: string;
  siteAdmin: boolean;
}

