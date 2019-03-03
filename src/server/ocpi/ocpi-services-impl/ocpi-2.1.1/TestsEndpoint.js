const AbstractEndpoint = require('../AbstractEndpoint');
const OCPIEndpoint = require('../../../../entity/OCPIEndpoint');
const Setting = require('../../../../entity/Setting');

require('source-map-support').install();

const EP_IDENTIFIER = "tests";
const EP_VERSION = "2.1.1";

/**
 * Tests Endpoint
 */
class TestsEndpoint extends AbstractEndpoint {
  constructor(ocpiService) {
    super(ocpiService,EP_IDENTIFIER, EP_VERSION);
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
    let activeFlag = tenant.isComponentActive('ocpi');
    tenant.activateComponent('ocpi');
    activeFlag = tenant.isComponentActive('ocpi');
    tenant.deactivateComponent('ocpi');
    await tenant.save();
    activeFlag = tenant.isComponentActive('test');
    tenant.activateComponent('test');
    await tenant.save();


    // test setting handling
    let setting = await Setting.getSettingByIdentifier(tenant.getID(),'ocpi');

    if (!setting) {
      setting = new Setting(tenant.getID(), {});
      setting.setIdentifier('ocpi');
    }

    setting.setContent({
      "party_id": "SLF",
      "country_code": "FR",
      "business_details": {
        "name": "SAP Labs France",
        "logo": {
          "url": "https://example.sap.com/img/logo.jpg",
          "thumbnail": "https://example.sap.com/img/logo_thumb.jpg",
          "category": "CPO",
          "type": "jpeg",
          "width": 512,
          "height": 512
        },
        "website": "http://sap.com"
      }
    });
    const settingSaved = await setting.save();

    let testsetting = await Setting.getSettingByIdentifier(tenant.getID(),'test');

    if (testsetting) {
      // delete
      await testsetting.delete();
    }

    // recreate it
    testsetting = new Setting(tenant.getID(), {});
    testsetting.setIdentifier('test');
    testsetting.setContent({'test': true});
    await testsetting.save();

    // test ocpiEndpoint entity
    const ocpiEndpoint = await OCPIEndpoint.getDefaultOcpiEndpoint(tenant.getID());

    const localToken = 'eyJhayI6NDEsInRpZCI6InNsZiIsInprIjozOX0=';
    const ocpiEndpoint2 = await OCPIEndpoint.getOcpiendpointWithToken(tenant.getID(), localToken);

    let localToken3;
    const ocpiEndpoint3 = await OCPIEndpoint.getOcpiendpointWithToken(tenant.getID(), localToken3);
    // if (ocpiEndpoint) {
    //   ocpiEndpoint.setName('Gireve');
    //   ocpiEndpoint.setBaseUrl('https://ocpi-pp-iop.gireve.com/ocpi/emsp/versions');
    //   ocpiEndpoint.setStatus('NEW');
    //   ocpiEndpoint.setVersion("2.1.1");
    //   ocpiEndpoint.setVersionUrl('https://ocpi-pp-iop.gireve.com/ocpi/emsp/2.1.1');
    //   ocpiEndpoint.setAvailableEndpoints({ "version": "2.1.1", "endpoints": [{ "identifier": "credentials", "url": "http://localhost:9090/ocpi/cpo/2.1.1/credentials/" }, { "identifier": "locations", "url": "http://localhost:9090/ocpi/cpo/2.1.1/locations/" }] });
    //   ocpiEndpoint.setLocalToken("eyAiYSI6IDEgLCAidGVuYW50IjogInNsZiIgfQ==");
    //   ocpiEndpoint.setToken("2b383fd3-7179-45ad-a84b-cef97fcc184a");
    //   ocpiEndpoint.setBusinessDetails({ "name": "Example Operator", "logo": { "url": "https://example.com/img/logo.jpg", "thumbnail": "https://example.com/img/logo_thumb.jpg", "category": "OPERATOR", "type": "jpeg", "width": 512, "height": 512 }, "website": "http://example.com" });

    //   const name = ocpiEndpoint.getName();
    //   const id = ocpiEndpoint.getID();
    //   ocpiEndpoint.save();
    // }

    res.sendStatus(200);



  }

}


module.exports = TestsEndpoint;