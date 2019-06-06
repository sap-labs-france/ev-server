import TenantHolder from './TenantHolder';
import Database from '../utils/Database';
import Constants from '../utils/Constants';
import AppError from '../exception/AppError';
import OCPIEndpointStorage from '../storage/mongodb/OCPIEndpointStorage';
import OCPIUtils from '../server/ocpi/OCPIUtils';
import User from './User';

export default class OCPIEndpoint extends TenantHolder {

	public getTenant: any;
	public getTenantID: any;
	public getModel: any;
  private model: any;

  constructor(tenantID, ocpiEndpoint) {
    super(tenantID);
    // Set it
    Database.updateOcpiEndpoint(ocpiEndpoint, this.model);
  }

  getID() {
    return this.model.id;
  }

  /**
   * Name of eMSP/IOP - could be provided by credential object from OCPI
   */
  getName() {
    return this.model.name;
  }

  setName(name) {
    this.model.name = name;
  }

  /**
   * Base Url - should point to the eMSP/IOP versions OCPI endpoint - eg: /ocpi/emsp/versions
   */
  getBaseUrl() {
    return this.model.baseUrl;
  }

  setBaseUrl(url) {
    this.model.baseUrl = url;
  }

  /**
   * verion Url - should point to the eMSP/IOP version in use - eg: /ocpi/emsp/2.1.1
   */
  getVersionUrl() {
    return this.model.versionUrl;
  }

  setVersionUrl(url) {
    this.model.versionUrl = url;
  }

  /**
   * Set Ocpi version
   */
  getVersion() {
    return this.model.version;
  }

  setVersion(version) {
    this.model.version = version;
  }

  // background job flag
  setBackgroundPatchJobFlag(active) {
    this.model.backgroundPatchJob = active;
  }

  isBackgroundPatchJobActive() {
    return this.model.backgroundPatchJob ? this.model.backgroundPatchJob : false;
  }

  getLastPatchJobOn() {
    return this.model.lastPatchJobOn;
  }

  setLastPatchJobOn(lastPatchJobOn) {
    this.model.lastPatchJobOn = lastPatchJobOn;
  }

  setLastPatchJobResult(successNbr, failureNbr, totalNbr, chargeBoxIDsInFailure = [], chargeBoxIDsInSuccess = []) {
    this.model.lastPatchJobResult = { "successNbr": successNbr, "failureNbr": failureNbr, "totalNbr": totalNbr, "chargeBoxIDsInFailure": chargeBoxIDsInFailure, "chargeBoxIDsInSuccess": chargeBoxIDsInSuccess };
  }

  getLastPatchJobResult() {
    return this.model.lastPatchJobResult;
  }

  /**
   * manage endpoint status
   */
  getStatus() {
    return this.model.status;
  }

  setStatus(status) {
    this.model.status = status;
  }

  /**
   * available endpoints - store payload information as return by version url: eg: /ocpi/emsp/2.1.1
   * The payload should be converted using OCPIMapping.convertEndpoints
   */
  setAvailableEndpoints(availableEndpoints) {
    this.model.availableEndpoints = availableEndpoints;
  }

  getAvailableEndpoints() {
    return this.model.availableEndpoints;
  }

  getEndpointUrl(service) {
    if (this.model.availableEndpoints && this.model.availableEndpoints.hasOwnProperty(service)) {
      return this.model.availableEndpoints[service];
    }
  }

  /**
   * localToken - token sent to eMSP/IOP to access this system
   */
  getLocalToken() {
    return this.model.localToken;
  }

  setLocalToken(token) {
    this.model.localToken = token;
  }

  // generate token based on tenant information.
  async generateLocalToken() {
    const newToken:any = {};

    // get tenant
    const tenant = await this.getTenant();

    // generate random
    newToken.ak = Math.floor(Math.random() * 100);

    // fill new Token with tenant subdmain
    newToken.tid = tenant.getSubdomain();

    // generate random
    newToken.zk = Math.floor(Math.random() * 100);

    // Base64 encoding
    const localToken = OCPIUtils.btoa(JSON.stringify(newToken));

    // set local token
    this.setLocalToken(localToken);

    // return
    return localToken;
  }

  /**
   * Business Details as provided by credential object
   */
  getBusinessDetails() {
    return this.model.businessDetails;
  }

  setBusinessDetails(businessDetails) {
    return this.model.businessDetails = businessDetails;
  }

  /**
   * token - token use to access remote system eMSP/IOP
   */
  getToken() {
    return this.model.token;
  }

  setToken(token) {
    this.model.token = token;
  }

  getCountryCode() {
    return this.model.countryCode;
  }

  setCountryCode(countryCode) {
    this.model.countryCode = countryCode;
  }

  getPartyId() {
    return this.model.partyId;
  }

  setPartyId(partyId) {
    this.model.partyId = partyId;
  }

  getCreatedBy() {
    if (this.model.createdBy) {
      return new User(this.getTenantID(), this.model.createdBy);
    }
    return null;
  }

  setCreatedBy(user) {
    this.model.createdBy = user.getModel();
  }

  getCreatedOn() {
    return this.model.createdOn;
  }

  setCreatedOn(createdOn) {
    this.model.createdOn = createdOn;
  }

  getLastChangedBy() {
    if (this.model.lastChangedBy) {
      return new User(this.getTenantID(), this.model.lastChangedBy);
    }
    return null;
  }

  setLastChangedBy(user) {
    this.model.lastChangedBy = user.getModel();
  }

  getLastChangedOn() {
    return this.model.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn) {
    this.model.lastChangedOn = lastChangedOn;
  }

  save() {
    return OCPIEndpointStorage.saveOcpiEndpoint(this.getTenantID(), this.getModel());
  }

  delete() {
    return OCPIEndpointStorage.deleteOcpiEndpoint(this.getTenantID(), this.getID());
  }

  static checkIfOcpiEndpointValid(filteredRequest, req) {
    // Update model?
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The OCPI Endpoint ID is mandatory`, 500,
        'OCPIEndpoint', 'checkIfOcpiEndpointValid',
        req.user.id);
    }
  }

  static getOcpiEndpoint(tenantID, id) {
    return OCPIEndpointStorage.getOcpiEndpoint(tenantID, id);
  }

  static getOcpiEndpoints(tenantID, params?, limit?, skip?, sort?) {
    return OCPIEndpointStorage.getOcpiEndpoints(tenantID, params, limit, skip, sort);
  }

  // Get ocpiendpoints with token
  static async getOcpiEndpointWithToken(tenantID, token) {
    return OCPIEndpointStorage.getOcpiEndpointWithToken(tenantID, token);
  }

  // get Default Ocpi Endpoint
  // currently only one endpoint could be defined by tenant - but the scope may change keep it open
  static async getDefaultOcpiEndpoint(tenantID) {
    // check if default endpoint exist
    let ocpiendpoint = await OCPIEndpointStorage.getDefaultOcpiEndpoint(tenantID);

    if (!ocpiendpoint) {
      // create new endpoint
      ocpiendpoint = new OCPIEndpoint(tenantID, {});
      ocpiendpoint.setName('default');
      ocpiendpoint.setStatus(Constants.OCPI_REGISTERING_STATUS.OCPI_NEW);
      ocpiendpoint.setLocalToken("eyAiYSI6IDEgLCAidGVuYW50IjogInNsZiIgfQ==");
      ocpiendpoint = await ocpiendpoint.save();
    }

    return ocpiendpoint;
  }
}
