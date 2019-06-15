import TenantHolder from './TenantHolder';
import Database from '../utils/Database';
import Constants from '../utils/Constants';
import AppError from '../exception/AppError';
import OCPIEndpointStorage from '../storage/mongodb/OCPIEndpointStorage';
import OCPIUtils from '../server/ocpi/OCPIUtils';
import User from './User';

export default class OCPIEndpoint extends TenantHolder {
  private _model: any = {};

  constructor(tenantID: any, ocpiEndpoint: any) {
    super(tenantID);
    Database.updateOcpiEndpoint(ocpiEndpoint, this._model);
  }

  public getModel(): any {
    return this._model;
  }

  getID() {
    return this._model.id;
  }

  getName() {
    return this._model.name;
  }

  setName(name) {
    this._model.name = name;
  }

  getBaseUrl() {
    return this._model.baseUrl;
  }

  setBaseUrl(url) {
    this._model.baseUrl = url;
  }

  getVersionUrl() {
    return this._model.versionUrl;
  }

  setVersionUrl(url) {
    this._model.versionUrl = url;
  }

  getVersion() {
    return this._model.version;
  }

  setVersion(version) {
    this._model.version = version;
  }

  setBackgroundPatchJobFlag(active) {
    this._model.backgroundPatchJob = active;
  }

  isBackgroundPatchJobActive() {
    return this._model.backgroundPatchJob ? this._model.backgroundPatchJob : false;
  }

  getLastPatchJobOn() {
    return this._model.lastPatchJobOn;
  }

  setLastPatchJobOn(lastPatchJobOn) {
    this._model.lastPatchJobOn = lastPatchJobOn;
  }

  setLastPatchJobResult(successNbr, failureNbr, totalNbr, chargeBoxIDsInFailure = [], chargeBoxIDsInSuccess = []) {
    this._model.lastPatchJobResult = { "successNbr": successNbr, "failureNbr": failureNbr, "totalNbr": totalNbr, "chargeBoxIDsInFailure": chargeBoxIDsInFailure, "chargeBoxIDsInSuccess": chargeBoxIDsInSuccess };
  }

  getLastPatchJobResult() {
    return this._model.lastPatchJobResult;
  }

  getStatus() {
    return this._model.status;
  }

  setStatus(status) {
    this._model.status = status;
  }

  setAvailableEndpoints(availableEndpoints) {
    this._model.availableEndpoints = availableEndpoints;
  }

  getAvailableEndpoints() {
    return this._model.availableEndpoints;
  }

  getEndpointUrl(service) {
    if (this._model.availableEndpoints && this._model.availableEndpoints.hasOwnProperty(service)) {
      return this._model.availableEndpoints[service];
    }
  }

  getLocalToken() {
    return this._model.localToken;
  }

  setLocalToken(token) {
    this._model.localToken = token;
  }

  async generateLocalToken() {
    const newToken: any = {};
    // Get tenant
    const tenant = await this.getTenant();
    // Generate random
    newToken.ak = Math.floor(Math.random() * 100);
    // Fill new Token with tenant subdmain
    newToken.tid = tenant.getSubdomain();
    // Generate random
    newToken.zk = Math.floor(Math.random() * 100);
    // Base64 encoding
    const localToken = OCPIUtils.btoa(JSON.stringify(newToken));
    // Set local token
    this.setLocalToken(localToken);
    // Return
    return localToken;
  }

  getBusinessDetails() {
    return this._model.businessDetails;
  }

  setBusinessDetails(businessDetails) {
    return this._model.businessDetails = businessDetails;
  }

  getToken() {
    return this._model.token;
  }

  setToken(token) {
    this._model.token = token;
  }

  getCountryCode() {
    return this._model.countryCode;
  }

  setCountryCode(countryCode) {
    this._model.countryCode = countryCode;
  }

  getPartyId() {
    return this._model.partyId;
  }

  setPartyId(partyId) {
    this._model.partyId = partyId;
  }

  getCreatedBy() {
    if (this._model.createdBy) {
      return new User(this.getTenantID(), this._model.createdBy);
    }
    return null;
  }

  setCreatedBy(user) {
    this._model.createdBy = user.getModel();
  }

  getCreatedOn() {
    return this._model.createdOn;
  }

  setCreatedOn(createdOn) {
    this._model.createdOn = createdOn;
  }

  getLastChangedBy() {
    if (this._model.lastChangedBy) {
      return new User(this.getTenantID(), this._model.lastChangedBy);
    }
    return null;
  }

  setLastChangedBy(user) {
    this._model.lastChangedBy = user.getModel();
  }

  getLastChangedOn() {
    return this._model.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn) {
    this._model.lastChangedOn = lastChangedOn;
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

  static async getOcpiEndpointWithToken(tenantID, token) {
    return OCPIEndpointStorage.getOcpiEndpointWithToken(tenantID, token);
  }

  static async getDefaultOcpiEndpoint(tenantID) {
    // Check if default endpoint exist
    let ocpiendpoint = await OCPIEndpointStorage.getDefaultOcpiEndpoint(tenantID);

    if (!ocpiendpoint) {
      // Create new endpoint
      ocpiendpoint = new OCPIEndpoint(tenantID, {});
      ocpiendpoint.setName('default');
      ocpiendpoint.setStatus(Constants.OCPI_REGISTERING_STATUS.OCPI_NEW);
      ocpiendpoint.setLocalToken("eyAiYSI6IDEgLCAidGVuYW50IjogInNsZiIgfQ==");
      ocpiendpoint = await ocpiendpoint.save();
    }

    return ocpiendpoint;
  }
}
