import Address from './Address';
import { AuthorizationActions } from './Authorization';
import Company from './Company';
import ConnectorStats from './ConnectorStats';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import SiteArea from './SiteArea';

export default interface Site extends CreatedUpdatedProps, AuthorizationActions {
  id: string;
  name: string;
  issuer: boolean;
  address: Address;
  companyID: string;
  autoUserSiteAssignment: boolean;
  image?: string;
  connectorStats: ConnectorStats;
  siteAreas?: SiteArea[];
  company?: Company;
  distanceMeters?: number;
  public?: boolean;
}

export interface SiteUser {
  site: Site;
  siteID?: string;
  userID: string;
  siteAdmin: boolean;
  siteOwner: boolean;
}

