import CreatedUpdatedProps from './CreatedUpdatedProps';
import SiteArea from './SiteArea';

export default interface RegistrationToken extends CreatedUpdatedProps {
  id?: string;
  expirationDate: Date;
  siteAreaID?: string;
  siteArea?: SiteArea;
  ocpp15Url?: string;
  ocpp16Url?: string;
}
