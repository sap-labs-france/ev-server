import CreatedUpdatedProps from '../CreatedUpdatedProps';
import { OICPRole } from './OICPRole';
import { OicpBusinessDetails } from '../Setting';

export default interface OICPEndpoint extends CreatedUpdatedProps {
  id: string;
  role: OICPRole;
  name: string;
  baseUrl: string;
  countryCode: string;
  partyId: string;
  backgroundPatchJob: boolean;
  status?: string;
  businessDetails?: OicpBusinessDetails;
  availableEndpoints?: any;
  version: string;
  lastPatchJobOn?: Date;
  lastPatchJobResult?: {
    successNbr: number;
    failureNbr: number;
    totalNbr: number;
    chargeBoxIDsInFailure?: string[];
    chargeBoxIDsInSuccess?: string[];
  };
}
