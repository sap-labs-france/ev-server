const AbstractEndpoint = require('../AbstractEndpoint');
const OcpiEndpoint = require('../../../../entity/OcpiEndpoint');

require('source-map-support').install();

const EP_IDENTIFIER = "tests";

/**
 * Tests Endpoint
 */
class TestsEndpoint extends AbstractEndpoint {
  constructor() {
    super(EP_IDENTIFIER);
  }

  /**
   * Main Process Method for the endpoint
   */
  async process(req, res, next, tenant) { // eslint-disable-line
    try {
      switch (req.method) {
        case "GET":
          // call method
          await this.test(req, res, next, tenant);
          break;
        default:
          res.sendStatus(501);
          break;
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * TODO: Test
   */
  async test(req, res, next, tenant) { // eslint-disable-line
    // test tenant service with 
    const ocpiService = tenant.getService("ocpi");
    const ocpiServiceActive = tenant.isServiceActive("ocpi");
    tenant.setService("ocpi", true, {"countryId": "FR", "partyId": "SLF"});
    const ocpiServiceAfter = tenant.getService("ocpi");
    const ocpiServiceActiveAfter = tenant.isServiceActive("ocpi");
    tenant.save();
    tenant.setService("ocpi", false);
    tenant.save();

    // test ocpiEndpoint entity
    const ocpiEndpoint = new OcpiEndpoint(tenant.getID(), {});
    ocpiEndpoint.setName('Gireve');
    ocpiEndpoint.setBaseUrl('https://ocpi-pp-iop.gireve.com/ocpi/emsp/versions');
    ocpiEndpoint.setVersionUrl('https://ocpi-pp-iop.gireve.com/ocpi/emsp/2.1.1');
    ocpiEndpoint.setAvailableEndpoints({"version":"2.1.1","endpoints":[{"identifier":"credentials","url":"http://localhost:9090/ocpi/cpo/2.1.1/credentials/"},{"identifier":"locations","url":"http://localhost:9090/ocpi/cpo/2.1.1/locations/"}]});
    ocpiEndpoint.setLocalToken("eyAiYSI6IDEgLCAidGVuYW50IjogInNsZiIgfQ==");
    ocpiEndpoint.setToken("2b383fd3-7179-45ad-a84b-cef97fcc184a");
    ocpiEndpoint.setBusinessDetails({"name":"Example Operator","logo":{"url":"https://example.com/img/logo.jpg","thumbnail":"https://example.com/img/logo_thumb.jpg","category":"OPERATOR","type":"jpeg","width":512,"height":512},"website":"http://example.com"});
    
    const name = ocpiEndpoint.getName();
    const id = ocpiEndpoint.getID();
    ocpiEndpoint.save();



  }

}


module.exports = TestsEndpoint;