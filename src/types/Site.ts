import Address from './Address';
import Company from './Company';
import ConnectorStats from './ConnectorStats';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import { OCPILocation } from './ocpi/OCPILocation';
import { OpeningTimes } from './OpeningTimes';
import SiteArea from './SiteArea';
import { SiteAuthorizationActions } from './Authorization';

export default interface Site extends CreatedUpdatedProps, SiteAuthorizationActions {
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
  openingTimes?: OpeningTimes;
  tariffID?: string;
  ocpiData?: SiteOcpiData;
}

export interface SiteUser {
  site: Site;
  siteID?: string;
  userID: string;
  siteAdmin: boolean;
  siteOwner: boolean;
}

export interface SiteOcpiData {
  location: OCPILocation;
}
