const Tenant = require('../../entity/Tenant');
const OCPIServerError = require('../../exception/OCPIServerError');
const OCPIUtils = require('./OCPIUtils');
const Constants = require('../../utils/Constants');
const atob = require('atob');
const Logging = require('../../utils/Logging');

const MODULE_NAME = "AbstractOCPIService";

require('source-map-support').install();

class AbstractOCPIService {
  // Create OCPI Service
  constructor(ocpiRestConfig, version = "0.0.0") {
    this._ocpiRestConfig = ocpiRestConfig;
    this._version = version;

    // endpoint as Map
    this._endpoints = {};
  }

  /**
   * Register Endpoint to this service
   * @param {*} endpoint AbstractEndpoint
   */
  registerEndpoint(endpoint) {
    this._endpoints[endpoint.getIdentifier()] = endpoint;
  }

  // Get All Registered Endpoint
  getRegisteredEndpoint() {
    return this._endpoints;
  }

  // Return based URL of OCPI Service
  getServiceUrl(req) {
    const protocol = req.protocol;
    const path = this.getPath();

    // get host from the req in order to handle the tenants
    const host = req.get('host');

    // return Service url
    return `${protocol}://${host}${path}`;
  }

  // Get Relative path of the service
  getPath() {
    const version = this.getVersion();
    return `/ocpi/cpo/${version}/`;
  }

  /**
   * Return Version of OCPI Service
   */
  getVersion() {
    return this._version;
  }

  // Rest Service Implementation
  restService(req, res, next) { // eslint-disable-line
    // Parse the action
    const action = /^\/\w*/g.exec(req.url)[0].substring(1);

    // set default tenant in case of exception
    req.tenantID = Constants.DEFAULT_TENANT;

    // check action
    switch (action) {
      // if empty - return available endpoints
      case "":
        this.getSupportedEndpoints(req, res, next);
        break;
      default:
        this.processEndpointAction(action, req, res, next);
        break;
    }
  }

  /**
   * Send Supported Endpoints
   */
  getSupportedEndpoints(req, res, next) { // eslint-disable-line
    const fullUrl = this.getServiceUrl(req);
    const registeredEndpointsArray = Object.values(this.getRegisteredEndpoint());

    // build payload
    const supportedEndpoints = registeredEndpointsArray.map(endpoint => {
      const identifier = endpoint.getIdentifier();
      return { "identifier": `${identifier}`, "url": `${fullUrl}${identifier}/` };
    })

    // return payload
    res.json(OCPIUtils.success({ "version": this.getVersion(), "endpoints": supportedEndpoints }));
  }

  /**
   * Process Endpoint action
   */
  async processEndpointAction(action, req, res, next) { // eslint-disable-line
    try {
      const registeredEndpoints = this.getRegisteredEndpoint();

      // get token from header
      if (!req.headers || !req.headers.authorization) {
        throw new OCPIServerError(
          'Login',
          `Missing authorization token`, 500,
          MODULE_NAME, 'processEndpointAction', null);
      }

      // log authorization token
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: 'Login',
        message: "Authorization Header",
        source: 'OCPI Server',
        module: MODULE_NAME,
        method: `processEndpointAction`,
        detailedMessages: { "Authorization": req.headers.authorization }
      });

      // get token
      let decodedToken = {};
      try {
        const token = req.headers.authorization.split(" ")[1];

        // log token
        Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          action: 'Login',
          message: "Authorization Token",
          source: 'OCPI Server',
          module: MODULE_NAME,
          method: `processEndpointAction`,
          detailedMessages: { "Token": token }
        });

        decodedToken = JSON.parse(atob(token));
      } catch (error) {
        throw new OCPIServerError(
          'Login',
          `Invalid authorization token`, 500,
          MODULE_NAME, 'processEndpointAction', null);
      }


      // get tenant from the called URL
      const tenantSubdomain = decodedToken.tenant;

      // get tenant from database
      const tenant = await Tenant.getTenantBySubdomain(tenantSubdomain);

      // check if tenant is found
      if (!tenant) {
        throw new OCPIServerError(
          'Login',
          `The Tenant '${tenantSubdomain}' does not exist`, 500,
          MODULE_NAME, 'processEndpointAction', null);
      }

      // pass tenant id to req
      req.tenantID = tenant.getID();

      // check if service is enabled for tenant
      if (!this._ocpiRestConfig.tenantEnabled.includes(tenantSubdomain)) {
        throw new OCPIServerError(
          'Login',
          `The Tenant '${tenantSubdomain}' is not enabled for OCPI`, 500,
          MODULE_NAME, 'processEndpointAction', null);
      }

      // TODO: Temporary properties in config: add eMI3 country_id/party_id
      // TODO: to be moved to database
      if (this._ocpiRestConfig.eMI3id != null &&
        this._ocpiRestConfig.eMI3id[tenantSubdomain] != null &&
        this._ocpiRestConfig.eMI3id[tenantSubdomain].country_id != null &&
        this._ocpiRestConfig.eMI3id[tenantSubdomain].party_id != null) {
        tenant._eMI3 = {};
        tenant._eMI3.country_id = this._ocpiRestConfig.eMI3id[tenantSubdomain].country_id;
        tenant._eMI3.party_id = this._ocpiRestConfig.eMI3id[tenantSubdomain].party_id;
      } else {
        throw new OCPIServerError(
          'Login',
          `The Tenant '${tenantSubdomain}' doesn't have country_id and/or party_id defined`, 500,
          MODULE_NAME, 'processEndpointAction', null);
      }

      // handle request action (endpoint)
      if (registeredEndpoints[action]) {
        registeredEndpoints[action].process(req, res, next, tenant);
      } else {
        // res.sendStatus(501);
        throw new OCPIServerError(
          'Process Endpoint',
          `Endpoint ${action} not implemented`, 501,
          MODULE_NAME, 'processEndpointAction');
      }
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AbstractOCPIService;