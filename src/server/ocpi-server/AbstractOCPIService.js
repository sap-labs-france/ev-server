require('source-map-support').install();

// let VERSION = "0.0.0";
let _ocpiRestConfig;

class AbstractOCPIService {
  // Create OCPI Service
  constructor(ocpiRestConfig, version = "0.0.0") {
    _ocpiRestConfig = ocpiRestConfig;
    this._version = version;

    // endpoint as Map
    this._endpoints = [];
  }


  /**
   * Register Endpoint to this service
   * @param {*} endpoint AbstractEndpoint
   */
  registerEndpoint(endpoint) {
    this._endpoints.push(endpoint);
  }

  // Get All Registered Endpoint
  getRegisteredEndpoint() {
    const tests = this._endpoints.map((endpoint) => {
      return { "id": endpoint.getIdentifier(), "endpoint": endpoint };
    });

    return this._endpoints;
  }

  // Return based URL of OCPI Service
  getServiceUrl() {
    const protocol = _ocpiRestConfig.protocol;
    const host = _ocpiRestConfig.host;
    const port = _ocpiRestConfig.port;
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
        res.sendStatus(200);
        break;
    }


  }

  // Send Supported Endpoints
  getSupportedEndpoints(req, res, next) { // eslint-disable-line
    const supportedEndpoints = [];
    const fullUrl = this.getServiceUrl();

    this.getRegisteredEndpoint().forEach(endpoint => {
      const identifier = endpoint.getIdentifier();
      supportedEndpoints.push({ "identifier": `${identifier}`, "url": `${fullUrl}${identifier}/` });
    })
    // this._endpoints.forEach(endpoint => {
    //   const identifier = endpoint.getIdentifier();
    //   supportedEndpoints.push({ "identifier": `${identifier}`, "url": `${fullUrl}${identifier}/`});
    // })

    res.json({ "version": this.getVersion(), "endpoints": supportedEndpoints });
  }
}

module.exports = AbstractOCPIService;