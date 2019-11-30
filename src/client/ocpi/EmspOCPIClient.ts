import OCPIClient from './OCPIClient';
import Tenant from '../../types/Tenant';
import OCPIEndpoint from '../../types/OCPIEndpoint';
import Constants from '../../utils/Constants';
import { OcpiSettings } from '../../types/Setting';

export default class EmspOCPIClient extends OCPIClient {
  constructor(tenant: Tenant, settings: OcpiSettings, ocpiEndpoint: OCPIEndpoint) {
    super(tenant, settings, ocpiEndpoint, Constants.OCPI_ROLE.EMSP);

    if (ocpiEndpoint.role !== Constants.OCPI_ROLE.CPO) {
      throw new Error(`EmspOCPIClient requires Ocpi Endpoint with role ${Constants.OCPI_ROLE.CPO}`);
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
