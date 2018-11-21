const OCPIService = require('./ocpi/OCPIService');
// const config = require('../config');
const { expect } = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);

describe('OCPI tests', function () {
  this.timeout(100000);

  before(async () => {
    this.ocpiService = new OCPIService();
  });

  after(async () => {

  });

  /**
   * Test /ocpi/cpo/versions
   */
  describe('Test /ocpi/cpo/versions', () => {
    let response;

    // check call
    it('should access base url: /ocpi/cpo/versions', async () => {
      // Create
      response = await this.ocpiService.getVersions();

      // Check status
      expect(response.status).to.be.eql(200);
    });

    // check Response Object
    it('should have correct OCPI Response object', async () => {
      // check structure of OCPI Structure
      this.ocpiService.checkOCPIResponseStructure(response.data);
    });

    // check Response Value
    it('should have correct OCPI Response success value', async () => {
      expect(response.data).to.not.be.empty;
      expect(response.data).to.have.property('status_code', 1000);
      expect(response.data).to.have.property('status_message', 'Success');
      expect(response.data).to.have.property('data').to.be.an('array').that.is.not.empty;
    });

    // check structure of each version objects
    it('should contains valid Version objects', async () => {
      expect(response.data.data, 'Invalid Version Object').to.satisfy((versions) => {
        for (const version of versions) {
          return expect(version).to.have.key('version', 'url');
        }
      })
    });

    // check at least version 2.1.1 is implemented
    it('should contains at least implementation version 2.1.1', async () => {
      expect(response.data.data, 'OCPI 2.1.1 Not Available').to.satisfy((versions) => {
        let version2_1_1_exist = false;

        for (const version of versions) {
          if (version.version === '2.1.1') {
            version2_1_1_exist = true;
          }
        }
        return version2_1_1_exist;
      })
    });
  });

  /**
   * Test /ocpi/cpo/2.1.1/
   */
  describe('Test /ocpi/cpo/2.1.1 (Endpoints definition)', () => {
    let response;

    // check call
    it('should access base url: /ocpi/cpo/2.1.1', async () => {
      // Create
      response = await this.ocpiService.getImplementation2_1_1();
      // Check status
      expect(response.status).to.be.eql(200);
    });

    // check Response Object
    it('should have correct OCPI Response object', async () => {
      // check structure of OCPI Structure
      this.ocpiService.checkOCPIResponseStructure(response.data);
    });

    // check Response Value
    it('should have correct OCPI Response success value', async () => {
      expect(response.data).to.not.be.empty;
      expect(response.data).to.have.property('status_code', 1000);
      expect(response.data).to.have.property('status_message', 'Success');
      expect(response.data).to.have.property('data').to.be.an('object').that.is.not.empty;
    });

    // check data object for Array of Endpoints
    it('should contains valid data object', async () => {
      expect(response.data.data).to.have.key('version', 'endpoints');
      expect(response.data.data.version, 'Incorrect Version').equal("2.1.1");
      expect(response.data.data.endpoints).to.be.an('array').that.is.not.empty;
    });

    //check data object for Array of Endpoints
    it('should contains valid Endpoint objects', async () => {
      expect(response.data.data.endpoints, 'Invalid Endpoints Object').to.satisfy((endpoints) => {
        for (const endpoint of endpoints) {
          return expect(endpoint).to.have.key('identifier', 'url');
        }
      })
    });
  });


  /**
  * Test /ocpi/cpo/2.1.1/locations
  */
  describe('Test /ocpi/cpo/2.1.1/locations', () => {
    let response;

    // check call
    it('should access base url: /ocpi/cpo/2.1.1/locations', async () => {
      // Create
      response = await this.ocpiService.getLocations2_1_1();
      // Check status
      expect(response.status).to.be.eql(200);
    });

    // check Response Object
    it('should have correct OCPI Response object', async () => {
      // check structure of OCPI Structure
      this.ocpiService.checkOCPIResponseStructure(response.data);
    });

    // check Response Value
    it('should have correct OCPI Response success value', async () => {
      expect(response.data).to.not.be.empty;
      expect(response.data).to.have.property('status_code', 1000);
      expect(response.data).to.have.property('status_message', 'Success');
      expect(response.data).to.have.property('data').to.be.an('array').that.is.not.empty;
    });
  });
});