import CreatedUpdatedProps from '../CreatedUpdatedProps';

export default interface OCPIEndpoint extends CreatedUpdatedProps {
  id: string;
  role: string;
  name: string;
  baseUrl: string;
  localToken: string;
  token: string;
  countryCode: string;
  partyId: string;
  backgroundPatchJob: boolean;
  status?: string;
  version?: string;
  businessDetails?: any;
  availableEndpoints?: any;
  versionUrl?: string;
  lastPatchJobOn?: Date;
  lastPatchJobResult?: any;
}
