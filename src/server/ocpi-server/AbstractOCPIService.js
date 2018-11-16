const Tenant = require('../../entity/Tenant');
const OCPIServerError = require('./exception/OCPIServerError');
// const OCPIClientError = require('./exception/OCPIClientError');
const OCPIConstants = require('./OCPIConstants');
const OCPIResponse = require('./OCPIResponse');

const MODULE_NAME = "OCPIService";

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
  getServiceUrl() {
    const protocol = this._ocpiRestConfig.protocol;
    const host = this._ocpiRestConfig.host;
    const port = this._ocpiRestConfig.port;
    const path = this.getPath();
    return `${protocol}://${host}:${port}${path}`;
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

  // Rest Service Abstract Method
  // restService(req, res, next) { // eslint-disable-line

  // }

  // Rest Service Implementation
  restService(req, res, next) { // eslint-disable-line
    // Parse the action
    const action = /^\/\w*/g.exec(req.url)[0].substring(1);

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
    const fullUrl = this.getServiceUrl();
    const registeredEndpointsArray = Object.values(this.getRegisteredEndpoint());

    // build payload
    const supportedEndpoints = registeredEndpointsArray.map(endpoint => {
      const identifier = endpoint.getIdentifier();
      return { "identifier": `${identifier}`, "url": `${fullUrl}${identifier}/` };
    })

    // return payload
    res.json({ "version": this.getVersion(), "endpoints": supportedEndpoints });
  }

  /**
   * Process Endpoint action
   */
  async processEndpointAction(action, req, res, next) { // eslint-disable-line
    try {
      const registeredEndpoints = this.getRegisteredEndpoint();

      // get tenant from the called URL
      const tenantSubdomain = req.hostname.split('.')[0];

      // get tenant from database
      const tenant = await Tenant.getTenantBySubdomain(tenantSubdomain);

      // check if tenant is found
      if (!tenant && tenantSubdomain !== '') {
        throw new OCPIServerError(
          OCPIConstants.OCPI_SERVER,
          `The Tenant with subdomain '${tenantSubdomain}' does not exist`, 500,
          MODULE_NAME, 'handleVerifyTenant', null);
      }

      // handle request action (endpoint)
      if (registeredEndpoints[action]) {
        registeredEndpoints[action].process(req, res, next, tenant);
      } else {
        res.sendStatus(501);
      }
    } catch (error) {
      this._handleError(error, req, res, next, action, MODULE_NAME, 'restService');
    }
  }

  /**
   * Handle error and return correct payload
   */
  _handleError(error, req, res, next, action, module, method) { // eslint-disable-line
    // TODO: add logging

    // return response with error
    res.status(error.errorCode).json(OCPIResponse.error(error));
  }

}

module.exports = AbstractOCPIService;