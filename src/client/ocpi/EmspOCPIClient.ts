import OCPIClient from './OCPIClient';
import Tenant from '../../types/Tenant';
import OCPIEndpoint from '../../types/OCPIEndpoint';
import Constants from '../../utils/Constants';
import { OcpiSettings } from '../../types/Setting';

export default class EmspOCPIClient extends OCPIClient {
  constructor(tenant: Tenant, settings: OcpiSettings, ocpiEndpoint: OCPIEndpoint) {
    super(tenant, settings, ocpiEndpoint, Constants.OCPI_ROLE.CPO);

    if (ocpiEndpoint.role !== Constants.OCPI_ROLE.EMSP) {
      throw new Error(`CpoOcpiClient requires Ocpi Endpoint with role ${Constants.OCPI_ROLE.EMSP}`);
    }
  }

  async pullLocations() {

  }

  async pullSessions() {

  }

  async pullCdrs() {

  }

  async remoteStartSession() {

  }

  async remoteStopSession() {

  }
}
