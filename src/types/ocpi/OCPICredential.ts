import { OcpiBusinessDetails } from '../Setting';

export default interface OCPICredential {
  url: string;
  token: string;
  party_id: string;
  country_code: string;
  business_details?: OcpiBusinessDetails;
}
