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


  // Send Supported Endpoints
  getSupportedEndpoints(req, res, next) { // eslint-disable-line
    const supportedEndpoints = [];
    const fullUrl = this.getServiceUrl();
    const registeredEndpointsArray = Object.values(this.getRegisteredEndpoint());

    // build payload
    registeredEndpointsArray.forEach(endpoint => {
      const identifier = endpoint.getIdentifier();
      supportedEndpoints.push({ "identifier": `${identifier}`, "url": `${fullUrl}${identifier}/` });
    })

    // return payload
    res.json({ "version": this.getVersion(), "endpoints": supportedEndpoints });
  }

  // Process Endpoint action
  processEndpointAction(action, req, res, next) { // eslint-disable-line
    const registeredEndpoints = this.getRegisteredEndpoint();

    if (registeredEndpoints[action]) {
      registeredEndpoints[action].process(req,res,next);
    } else {
      res.sendStatus(501);
    }
  }



}

module.exports = AbstractOCPIService;