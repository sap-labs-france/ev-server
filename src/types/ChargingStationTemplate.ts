import CreatedUpdatedProps from './CreatedUpdatedProps';
import { RegistrationTokenAuthorizationActions } from './Authorization';
import SiteArea from './SiteArea';

export default interface RegistrationToken extends CreatedUpdatedProps, RegistrationTokenAuthorizationActions {
  id?: string;
  description: string;
  expirationDate: Date;
  revocationDate?: Date;
  siteAreaID?: string;
  siteArea?: SiteArea;
  ocpp15SOAPSecureUrl?: string;
  ocpp16SOAPSecureUrl?: string;
  ocpp16JSONSecureUrl?: string;
}
