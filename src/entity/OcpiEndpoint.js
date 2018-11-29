const AbstractTenantEntity = require('./AbstractTenantEntity');
const Database = require('../utils/Database');
const Constants = require('../utils/Constants');
const AppError = require('../exception/AppError');
const OcpiEndpointStorage = require('../storage/mongodb/OcpiEndpointStorage');
const User = require('./User');

class OcpiEndpoint extends AbstractTenantEntity {
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
   * available endpoints - store payload information as return by version url: eg: /ocpi/emsp/2.1.1
   */
  getAvailableEndpoints() {
    return this._model.availableEndpoints;
  }

  setAvailableEndpoints(availableEndpoints) {
    this._model.availableEndpoints = availableEndpoints;
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
    return OcpiEndpointStorage.saveOcpiEndpoint(this.getTenantID(), this.getModel());
  }

  delete() {
    return OcpiEndpointStorage.deleteOcpiEndpoint(this.getTenantID(), this.getID());
  }

  static checkIfOcpiEndpointValid(request, httpRequest) {
    // Update model?
    if (httpRequest.method !== 'POST' && !request.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The OCPI Endpoint ID is mandatory`, 500,
        'OCPIEndpoint', 'checkIfOcpiEndpointValid');
    }
  }

  static getOcpiEndpoint(tenantID, id) {
    return OcpiEndpointStorage.getOcpiEndpoint(tenantID, id);
  }

  // static getVehicles(tenantID, params, limit, skip, sort) {
  //   return VehicleStorage.getVehicles(tenantID, params, limit, skip, sort)
  // }

}

module.exports = OcpiEndpoint;
