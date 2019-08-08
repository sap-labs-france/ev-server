import Address from './Address';
import Company from './Company';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import SiteArea from './SiteArea';
import ConnectorStats from './ConnectorStats';

export default interface Site extends CreatedUpdatedProps {
  id: string;
  name: string;
  address: Address;
  companyID: string;
  autoUserSiteAssignment: boolean;
  image?: string;
  connectorStats: ConnectorStats;
  siteAreas?: SiteArea[];
  company?: Company;
}

export interface SiteUser {
  site: Site;
  userID: string;
  siteAdmin: boolean;
}

