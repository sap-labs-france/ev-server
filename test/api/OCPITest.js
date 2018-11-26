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
    it('should access url: /ocpi/cpo/2.1.1', async () => {
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
        let validEndpoints = true;
        for (const endpoint of endpoints) {
          validEndpoints = expect(endpoint).to.have.key('identifier', 'url') && validEndpoints;
        }
        return validEndpoints;
      })
    });
  });


  /**
  * Test Invalid Enpoint /ocpi/cpo/2.1.1/invalidEndpoint
  */
  describe('Test Invalid Endpoint /ocpi/cpo/2.1.1/invalidEndpoint', () => {
    let response;

    // check call
    it('should return 501 on url: /ocpi/cpo/2.1.1/invalidEndpoint', async () => {
      // Create
      response = await this.ocpiService.accessPath('GET', "/ocpi/cpo/2.1.1/invalidEndpoint")
      // Check status
      expect(response.status).to.be.eql(501);
    });

    // check Response Object
    it('should have correct OCPI Error Response object', async () => {
      // check structure of OCPI Structure
      this.ocpiService.checkOCPIErrorResponseStructure(response.data);
    });

    // check Response Value
    it('should have correct OCPI Error Response value', async () => {
      expect(response.data).to.not.be.empty;
      expect(response.data).to.have.property('status_code', 3000);
      expect(response.data).to.have.property('status_message', 'Endpoint invalidEndpoint not implemented');
    });
  });

  /**
  * Test /ocpi/cpo/2.1.1/locations
  */
  describe('Test /ocpi/cpo/2.1.1/locations', () => {
    let response;

    /**
      * Access without paging
      */
    describe('Access whithout paging', () => {

      // check call
      it('should access url: /ocpi/cpo/2.1.1/locations', async () => {
        // get locations
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

      // validate content - scan entities: locations/evses/connectors
      let locationsNbr = 0;
      let evsesNbr = 0;
      let connectorsNbr = 0;
      it("should have valid OCPI Location Entities", async () => {
        expect(response.data.data, 'Invalid Location Object').to.satisfy((locations) => {
          let validLocationsAndSubEntities = true;
          // loop through location
          for (const location of locations) {
            // validate location
            validLocationsAndSubEntities = validLocationsAndSubEntities && this.ocpiService.validateLocationEntity(location);
            locationsNbr++;

            // loop through evse
            for (const evse of location.evses) {
              // validate evse
              validLocationsAndSubEntities = validLocationsAndSubEntities && this.ocpiService.validateEvseEntity(evse);
              evsesNbr++;

              // loop through connectors
              for (const connector of evse.connectors) {
                // validate connector
                validLocationsAndSubEntities = validLocationsAndSubEntities && this.ocpiService.validateConnectorEntity(connector);
                connectorsNbr++;
              }
            }
          }
          return validLocationsAndSubEntities;
        });

        // write number of Locations/Evses/Connectors scanned
        // console.log(`${locationsNbr}/${evsesNbr}/${connectorsNbr}`);
      });
    });

    /**
     * Access with paging
     */
    describe('Access with paging', () => {
      // check access for each location
      it('should access url /ocpi/cpo/2.1.1/locations/ and have headers X-Limit and X-Total-Count', async () => {
        // Call 
        const response = await this.ocpiService.accessPath('GET', '/ocpi/cpo/2.1.1/locations/?offset=0&limit=20');

        expect(response.data).to.not.be.empty;
        expect(response.data).to.have.property('status_code', 1000);
        expect(response.data).to.have.property('status_message', 'Success');
        expect(response.data).to.have.property('data').to.be.an('array').that.is.not.empty;
        expect(response.headers).to.have.property('x-limit');
        expect(response.headers).to.have.property('x-total-count');
      });

      // check access for each location
      it('should access url with paging /ocpi/cpo/2.1.1/locations/?offset=0&limit=20', async () => {
        // Call 
        const response = await this.ocpiService.accessPath('GET', '/ocpi/cpo/2.1.1/locations/?offset=0&limit=20');

        expect(response.data).to.not.be.empty;
        expect(response.data).to.have.property('status_code', 1000);
        expect(response.data).to.have.property('status_message', 'Success');
        expect(response.data).to.have.property('data').to.be.an('array').that.is.not.empty;
      });

      // check limit
      it('should access url with paging /ocpi/cpo/2.1.1/locations/?offset=0&limit=1', async () => {
        // Call 
        const response = await this.ocpiService.accessPath('GET', '/ocpi/cpo/2.1.1/locations/?offset=0&limit=1');

        expect(response.data).to.not.be.empty;
        expect(response.data).to.have.property('status_code', 1000);
        expect(response.data).to.have.property('status_message', 'Success');
        expect(response.data).to.have.property('data').to.be.an('array').and.to.have.length(1);
        //,'<http://slf.localhost:9090/ocpi/cpo/2.1.1/locations/?offset=1&limit=1>; rel="next"');
        expect(response.headers).to.have.property('link').to.match(/^<.*:\/\/.*:.*\/ocpi\/cpo\/.*\/locations\/\?offset=1&limit=1>; rel="next"/);
      });

    });

  });

  /**
   * Test single access to location/evse/connector: 
   *    - /ocpi/cpo/2.1.1/locations/{locationId}
   *    - /ocpi/cpo/2.1.1/locations/{locationId}/{evseUid}
   *    - /ocpi/cpo/2.1.1/locations/{locationId}/{evseId}/{connectorId}
   */
  describe('Test single entity /ocpi/cpo/2.1.1/locations/...', () => {
    let response;
    const that = this;

    /**
     * Success Cases
     */
    describe('Success cases', () => {
      // call once agian the GET Locations
      before(async function () {
        // Create
        response = await that.ocpiService.getLocations2_1_1();

        if (response.status != 200) { this.skip(); }
      });

      // check access for each location
      it('should access single location entity /ocpi/cpo/2.1.1/locations/{locationId}', async () => {
        for (const location of response.data.data) {
          // Call 
          const locationResponse = await this.ocpiService.accessPath('GET', `/ocpi/cpo/2.1.1/locations/${location.id}`);
          // Check status
          expect(locationResponse.status).to.be.eql(200);
          expect(that.ocpiService.validateLocationEntity(locationResponse.data.data));
        }
      });

      // check access for each evse
      it('should access single EVSE entity /ocpi/cpo/2.1.1/locations/{locationId}/{evseUid}', async () => {
        for (const location of response.data.data) {
          for (const evse of location.evses) {
            // Call 
            const evseResponse = await this.ocpiService.accessPath('GET', `/ocpi/cpo/2.1.1/locations/${location.id}/${evse.uid}`);
            // Check status
            expect(evseResponse.status).to.be.eql(200);
            expect(that.ocpiService.validateEvseEntity(evseResponse.data.data));
          }
        }
      });

      // check access for each evse
      it('should access single Connector entity /ocpi/cpo/2.1.1/locations/{locationId}/{evseUid}/{connectorId}', async () => {
        for (const location of response.data.data) {
          for (const evse of location.evses) {
            for (const connector of evse.connectors) {
              // Call 
              const connectorResponse = await this.ocpiService.accessPath('GET', `/ocpi/cpo/2.1.1/locations/${location.id}/${evse.uid}/${connector.id}`);
              // Check status
              expect(connectorResponse.status).to.be.eql(200);
              expect(that.ocpiService.validateConnectorEntity(connectorResponse.data.data));
            }
          }
        }
      });
    });

    /**
     * Failure cases
     */
    describe('Failure cases', () => {
      // invalid location
      it('should not found this non-existing location  /ocpi/cpo/2.1.1/locations/5abeba9e4bae1457eb565e67', async () => {
        // call
        const locationResponse = await this.ocpiService.accessPath('GET', `/ocpi/cpo/2.1.1/locations/5abeba9e4bae1457eb565e67`);
        // Check status
        expect(locationResponse.status).to.be.eql(500);
        expect(locationResponse.data).to.have.property("timestamp");
        expect(locationResponse.data).to.have.property("status_code", 3000);
        expect(locationResponse.data).to.have.property("status_message", "Site id '5abeba9e4bae1457eb565e67' not found");
      });

      // invalid evse uid
      it('should not found this non-existing EVSE  /ocpi/cpo/2.1.1/locations/5abeba9e4bae1457eb565e66/NonExistingSite', async () => {
        // call
        const locationResponse = await this.ocpiService.accessPath('GET', `/ocpi/cpo/2.1.1/locations/5abeba9e4bae1457eb565e66/NonExistingSite`);
        // Check status
        expect(locationResponse.status).to.be.eql(500);
        expect(locationResponse.data).to.have.property("timestamp");
        expect(locationResponse.data).to.have.property("status_code", 3000);
        expect(locationResponse.data).to.have.property("status_message", "EVSE uid not found 'NonExistingSite' on location id '5abeba9e4bae1457eb565e66'");
      });

      // invalid connector id
      it('should not found this non-existing Connector  /ocpi/cpo/2.1.1/locations/5abeba9e4bae1457eb565e66/SAP-Caen-01*1/0', async () => {
        // call
        const locationResponse = await this.ocpiService.accessPath('GET', `/ocpi/cpo/2.1.1/locations/5abeba9e4bae1457eb565e66/SAP-Caen-01*1/0`);
        // Check status
        expect(locationResponse.status).to.be.eql(500);
        expect(locationResponse.data).to.have.property("timestamp");
        expect(locationResponse.data).to.have.property("status_code", 3000);
        expect(locationResponse.data).to.have.property("status_message", "Connector id '0' not found on EVSE uid 'SAP-Caen-01*1' and location id '5abeba9e4bae1457eb565e66'");
      });


    });

  });
});