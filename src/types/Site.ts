import Address from './Address';
import Company from './Company';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import SiteArea from './SiteArea';

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

export default interface SiteUser {
  site: Site;
  userID: string;
  siteAdmin: boolean;
}

