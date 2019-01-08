const AbstractTenantEntity = require('./AbstractTenantEntity');
const Database = require('../utils/Database');
const Constants = require('../utils/Constants');
const AppError = require('../exception/AppError');
const OCPIEndpointStorage = require('../storage/mongodb/OCPIEndpointStorage');
const OCPIUtils = require('../server/ocpi/OCPIUtils');
const User = require('./User');

class OCPIEndpoint extends AbstractTenantEntity {
  constructor(tenantID, ocpiEndpoint) {
    super(tenantID);
    // Set it
    Database.updateOcpiEndpoint(ocpiEndpoint, this._model);
  }

  getID() {
    return this._model.id;
  }

  /**
   * Name of eMSP/IOP - could be provided by credential object from OCPI
   */
  getName() {
    return this._model.name;
  }

  setName(name) {
    this._model.name = name;
  }

  /**
   * Base Url - should point to the eMSP/IOP versions OCPI endpoint - eg: /ocpi/emsp/versions
   */
  getBaseUrl() {
    return this._model.baseUrl;
  }

  setBaseUrl(url) {
    this._model.baseUrl = url;
  }

  /**
   * verion Url - should point to the eMSP/IOP version in use - eg: /ocpi/emsp/2.1.1
   */
  getVersionUrl() {
    return this._model.versionUrl;
  }

  setVersionUrl(url) {
    this._model.versionUrl = url;
  }

  /**
   * Set Ocpi version
   */
  getVersion() {
    return this._model.version
  }

  setVersion(version) {
    this._model.version = version;
  }

  /**
   * manage endpoint status
   */
  getStatus() {
    return this._model.status;
  }

  setStatus(status) {
    this._model.status = status;
  }

  /**
   * available endpoints - store payload information as return by version url: eg: /ocpi/emsp/2.1.1
   * The payload should be converted using OCPIMapping.convertEndpoints
   */
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

  /**
   * localToken - token sent to eMSP/IOP to access this system
   */
  getLocalToken() {
    return this._model.localToken;
  }

  setLocalToken(token) {
    this._model.localToken = token;
  }

  // generate token based on tenant information.
  async generateLocalToken() {
    const newToken = {};

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
    return this._model.businessDetails;
  }

  setBusinessDetails(businessDetails) {
    return this._model.businessDetails = businessDetails;
  }

  /**
   * token - token use to access remote system eMSP/IOP
   */
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

  static checkIfOcpiendpointValid(request, httpRequest) {
    // Update model?
    if (httpRequest.method !== 'POST' && !request.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The OCPI Endpoint ID is mandatory`, 500,
        'OCPIEndpoint', 'checkIfOcpiEndpointValid');
    }
  }

  static getOcpiendpoint(tenantID, id) {
    return OCPIEndpointStorage.getOcpiEndpoint(tenantID, id);
  }
  
  static getOcpiendpoints(tenantID, params, limit, skip, sort) {
    return OCPIEndpointStorage.getOcpiEndpoints(tenantID, params, limit, skip, sort)
  }

  // Get ocpiendpoints with token
  static async getOcpiendpointWithToken(tenantID, token) {
    return OCPIEndpointStorage.getOcpiEndpointWithToken(tenantID, token);
  }

  // get Default Ocpi Endpoint
  // currently only one endpoint could be defined by tenant - but the scope may change keep it open
  static async getDefaultOcpiEndpoint(tenantID) {
    // check if default endpoint exist
    let ocpiendpoint = await OCPIEndpointStorage.getDefaultOcpiEndpoint(tenantID);

    if (!ocpiendpoint) {
      // create new endpoint
      ocpiendpoint = new OcpiEndpoint(tenantID, {});
      ocpiendpoint.setName('default');
      ocpiendpoint.setStatus(Constants.OCPI_REGISTERING_STATUS.NEW);
      ocpiendpoint.setLocalToken("eyAiYSI6IDEgLCAidGVuYW50IjogInNsZiIgfQ==");
      ocpiendpoint = await ocpiendpoint.save();
    }

    return ocpiendpoint;
  }
}

module.exports = OCPIEndpoint;
