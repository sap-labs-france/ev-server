import CreatedUpdatedProps from '../CreatedUpdatedProps';
import { OicpBusinessDetails } from '../Setting';

export default interface OICPEndpoint extends CreatedUpdatedProps {
  id: string;
  role: string;
  name: string;
  baseUrl: string;
  localToken?: string; // Not needed.
  token?: string; // Not needed.
  countryCode: string;
  partyId: string;
  backgroundPatchJob: boolean;
  status?: string;
  version?: string; // Not needed.
  businessDetails?: OicpBusinessDetails;
  availableEndpoints?: OICPEndpoint[];
  versionUrl?: string;
  lastPatchJobOn?: Date;
  lastPatchJobResult?: {
    successNbr: number;
    failureNbr: number;
    totalNbr: number;
    chargeBoxIDsInFailure?: string[];
    chargeBoxIDsInSuccess?: string[];
    tokenIDsInFailure?: string[]; // Not needed.
    tokenIDsInSuccess?: string[]; // Not needed.
  };
}

