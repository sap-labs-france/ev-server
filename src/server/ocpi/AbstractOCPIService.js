const Tenant = require('../../entity/Tenant');
const OCPIServerError = require('../../exception/OCPIServerError');
const OCPIClientError = require('../../exception/OCPIClientError');
const OCPIUtils = require('./OCPIUtils');

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
    const protocol = this._ocpiRestConfig.protocol;
    const port = this._ocpiRestConfig.port;
    const path = this.getPath();

    // get host from the req in order to handle the tenants
    const host = req.hostname;

    // return Service url
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

      // get tenant from the called URL
      const tenantSubdomain = req.hostname.split('.')[0];

      // get tenant from database
      const tenant = await Tenant.getTenantBySubdomain(tenantSubdomain);

      // check if tenant is found
      if (!tenant && tenantSubdomain !== '') {
        throw new OCPIServerError(
          'default',
          'Login',
          `The Tenant with subdomain '${tenantSubdomain}' does not exist`, 500,
          MODULE_NAME, 'handleVerifyTenant', null);
      }

      // check if service is enabled for tenant
      if (!this._ocpiRestConfig.tenantEnabled.includes(tenantSubdomain)) {
        throw new OCPIServerError(
          tenant.getID(),
          'Login',
          `The Tenant with subdomain '${tenantSubdomain}' is not enabled for OCPI`, 500,
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
          tenant.getID(),
          'Login',
          `The Tenant with subdomain '${tenantSubdomain}' doesn't have country_id and/or party_id defined`, 500,
          MODULE_NAME, 'processEndpointAction', null);
      }

      // check token
      // TODO: remove temporary checkToken in futur - only use to test in chrome without token
      if (this._ocpiRestConfig.eMI3id[tenantSubdomain].checkToken) {
        if (req.headers == null || `Token ${this._ocpiRestConfig.eMI3id[tenantSubdomain].token}` != req.headers.authorization) {
          throw new OCPIClientError(
            tenant.getID(),
            'Login',
            "Unauthorized : Check credentials failed", 401,
            MODULE_NAME, 'processEndpointAction');
        }
      }

      // handle request action (endpoint)
      if (registeredEndpoints[action]) {
        registeredEndpoints[action].process(req, res, next, tenant);
      } else {
        // res.sendStatus(501);
        throw new OCPIServerError(
          tenant.getID(),
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