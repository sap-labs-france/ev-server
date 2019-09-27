import AppError from '../exception/AppError';
import Constants from '../utils/Constants';
import Database from '../utils/Database';
import OCPIEndpointStorage from '../storage/mongodb/OCPIEndpointStorage';
import OCPIUtils from '../server/ocpi/OCPIUtils';
import TenantHolder from './TenantHolder';
import User from '../types/User';
import Utils from '../utils/Utils';

export default class OCPIEndpoint extends TenantHolder {
  private _model: any = {};

  constructor(tenantID: any, ocpiEndpoint: any) {
    super(tenantID);
    Database.updateOcpiEndpoint(ocpiEndpoint, this._model);
  }

  static checkIfOcpiEndpointValid(filteredRequest, req) {
    // Update model?
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'The OCPI Endpoint ID is mandatory',
        module: 'OCPIEndpoint',
        method: 'checkIfOcpiEndpointValid'
      });
    }
  }

  static getOcpiEndpoint(tenantID, id) {
    return OCPIEndpointStorage.getOcpiEndpoint(tenantID, id);
  }

  static getOcpiEndpoints(tenantID, params?, limit?, skip?, sort?) {
    return OCPIEndpointStorage.getOcpiEndpoints(tenantID, params, limit, skip, sort);
  }

  static getOcpiEndpointWithToken(tenantID, token) {
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
      ocpiendpoint.setLocalToken('eyAiYSI6IDEgLCAidGVuYW50IjogInNsZiIgfQ==');
      ocpiendpoint = await ocpiendpoint.save();
    }

    return ocpiendpoint;
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
    this._model.lastPatchJobResult = { 'successNbr': successNbr, 'failureNbr': failureNbr, 'totalNbr': totalNbr, 'chargeBoxIDsInFailure': chargeBoxIDsInFailure, 'chargeBoxIDsInSuccess': chargeBoxIDsInSuccess };
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
    newToken.tid = tenant.subdomain;
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
    this._model.businessDetails = businessDetails;
    return this._model.businessDetails;
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
      return this._model.createdBy;
    }
    return null;
  }

  setCreatedBy(user: Partial<User>) {
    this._model.createdBy = user;
  }

  getCreatedOn() {
    return this._model.createdOn;
  }

  setCreatedOn(createdOn) {
    this._model.createdOn = createdOn;
  }

  getLastChangedBy() {
    if (this._model.lastChangedBy) {
      return this._model.lastChangedBy;
    }
    return null;
  }

  setLastChangedBy(user: Partial<User>) {
    this._model.lastChangedBy = user;
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
}
