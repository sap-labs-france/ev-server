import { SiteAuthorizationActions, UserSiteAuthorizationActions } from './Authorization';

import Address from './Address';
import { BillingAccountData } from './Billing';
import Company from './Company';
import ConnectorStats from './ConnectorStats';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import { OCPILocation } from './ocpi/OCPILocation';
import { OpeningTimes } from './OpeningTimes';
import SiteArea from './SiteArea';

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
  ownerName?: string;
  accountData?: BillingAccountData;
}

export interface UserSite extends UserSiteAuthorizationActions{
  site: Site;
  siteID?: string;
  userID: string;
  siteAdmin: boolean;
  siteOwner: boolean;
}

export interface SiteOcpiData {
  location: OCPILocation;
}
