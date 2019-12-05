import OCPIClient from './OCPIClient';
import Tenant from '../../types/Tenant';
import OCPIEndpoint from '../../types/OCPIEndpoint';
import Constants from '../../utils/Constants';
import { OcpiSettings } from '../../types/Setting';
import Logging from '../../utils/Logging';
import axios from 'axios';

export default class EmspOCPIClient extends OCPIClient {
  constructor(tenant: Tenant, settings: OcpiSettings, ocpiEndpoint: OCPIEndpoint) {
    super(tenant, settings, ocpiEndpoint, Constants.OCPI_ROLE.EMSP);

    if (ocpiEndpoint.role !== Constants.OCPI_ROLE.EMSP) {
      throw new Error(`EmspOCPIClient requires Ocpi Endpoint with role ${Constants.OCPI_ROLE.EMSP}`);
    }
  }

  async pullLocations() {
    // Get locations endpoint url
    const locationsUrl = this.getEndpointUrl('locations');

    // Log
    Logging.logDebug({
      tenantID: this.tenant.id,
      action: 'OCPIPullLocations',
      message: `Retrieve locations at ${locationsUrl}`,
      source: 'OCPI Client',
      module: 'OCPIClient',
      method: 'patchEVSEStatus'
    });

    // Call IOP
    const response = await axios.get(locationsUrl,
      {
        headers: {
          Authorization: `Token ${this.ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

    // Check response
    if (!response.data) {
      throw new Error('Invalid response from Get locations');
    }

    for (const location of response.data) {
      Logging.logDebug({
        tenantID: this.tenant.id,
        action: 'OCPIPullLocations',
        message: `Found location ${location.name}`,
        source: 'OCPI Client',
        module: 'OCPIClient',
        method: 'patchEVSEStatus',
        detailedMessage: location
      });
    }
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
