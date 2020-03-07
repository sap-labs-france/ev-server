import CreatedUpdatedProps from './CreatedUpdatedProps';
import SiteArea from './SiteArea';

export default interface RegistrationToken extends CreatedUpdatedProps {
  id?: string;
  description: string;
  expirationDate: Date;
  revocationDate?: Date;
  siteAreaID?: string;
  siteArea?: SiteArea;
  ocpp15SOAPUrl?: string;
  ocpp16SOAPUrl?: string;
  ocpp16JSONUrl?: string;
}
