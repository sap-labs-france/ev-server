import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import CentralServerService from './client/CentralServerService';
import Factory from '../factories/Factory';
import OCPIService from './ocpi/OCPIService';

chai.use(chaiSubset);

class TestData {
  public pending: any;
  public cpoService: OCPIService;
  public emspService: OCPIService;
  public newOcpiEndpoint: any;
}

const testData: TestData = new TestData();

describe('OCPI Service Tests', function() {
  this.timeout(100000);


  before(() => {
    if (!OCPIService.isConfigAvailable()) {
      testData.pending = 1;
    }

    testData.cpoService = new OCPIService('cpo');
    testData.emspService = new OCPIService('emsp');
  });

  after(async () => {
  });

  /**
   * Test /ocpi/cpo/versions
   */
  describe('Test /ocpi/cpo/versions', () => {
    let response;

    // Check call
    it('should access base url: /ocpi/cpo/versions', async () => {
      // Create
      response = await testData.cpoService.getVersions();
      // Check status
      expect(response.status).to.be.eql(200);
    });

    // Check Response Object
    it('should have correct OCPI Response object', () => {
      // Check structure of OCPI Structure
      testData.cpoService.checkOCPIResponseStructure(response.data);
    });

    // Check Response Value
    it('should have correct OCPI Response success value', () => {
      expect(response.data).to.not.be.empty;
      expect(response.data).to.have.property('status_code', 1000);
      expect(response.data).to.have.property('status_message', 'Success');
      expect(response.data).to.have.property('data').to.be.an('array').that.is.not.empty;
    });

    // Check structure of each version objects
    it('should contains valid Version objects', () => {
      expect(response.data.data, 'Invalid Version Object').to.satisfy((versions) => {
        for (const version of versions) {
          return expect(version).to.have.keys('version', 'url');
        }
      });
    });

    // Check at least version 2.1.1 is implemented
    it('should contains at least implementation version 2.1.1', () => {
      expect(response.data.data, 'OCPI 2.1.1 Not Available').to.satisfy((versions) => {
        let version211exist = false;

        for (const version of versions) {
          if (version.version === '2.1.1') {
            version211exist = true;
          }
        }
        return version211exist;
      });
    });
  });

  /**
   * Test /ocpi/emsp/versions
   */
  describe('Test /ocpi/emsp/versions', () => {
    let response;

    // Check call
    it('should access base url: /ocpi/emsp/versions', async () => {
      // Create
      response = await testData.emspService.getVersions();
      // Check status
      expect(response.status).to.be.eql(200);
    });

    // Check Response Object
    it('should have correct OCPI Response object', () => {
      // Check structure of OCPI Structure
      testData.emspService.checkOCPIResponseStructure(response.data);
    });

    // Check Response Value
    it('should have correct OCPI Response success value', () => {
      expect(response.data).to.not.be.empty;
      expect(response.data).to.have.property('status_code', 1000);
      expect(response.data).to.have.property('status_message', 'Success');
      expect(response.data).to.have.property('data').to.be.an('array').that.is.not.empty;
    });

    // Check structure of each version objects
    it('should contains valid Version objects', () => {
      expect(response.data.data, 'Invalid Version Object').to.satisfy((versions) => {
        for (const version of versions) {
          return expect(version).to.have.keys('version', 'url');
        }
      });
    });

    // Check at least version 2.1.1 is implemented
    it('should contains at least implementation version 2.1.1', () => {
      expect(response.data.data, 'OCPI 2.1.1 Not Available').to.satisfy((versions) => {
        let version211exist = false;

        for (const version of versions) {
          if (version.version === '2.1.1') {
            version211exist = true;
          }
        }
        return version211exist;
      });
    });
  });

  /**
   * Test /ocpi/cpo/2.1.1/
   */
  describe('Test /ocpi/cpo/2.1.1 (Endpoints definition)', () => {
    let response;

    // Check call
    it('should access url: /ocpi/cpo/2.1.1', async () => {
      // Create
      response = await testData.cpoService.getImplementation2_1_1();
      // Check status
      expect(response.status).to.be.eql(200);
    });

    // Check Response Object
    it('should have correct OCPI Response object', () => {
      // Check structure of OCPI Structure
      testData.cpoService.checkOCPIResponseStructure(response.data);
    });

    // Check Response Value
    it('should have correct OCPI Response success value', () => {
      expect(response.data).to.not.be.empty;
      expect(response.data).to.have.property('status_code', 1000);
      expect(response.data).to.have.property('status_message', 'Success');
      expect(response.data).to.have.property('data').to.be.an('object').that.is.not.empty;
    });

    // Check data object for Array of Endpoints
    it('should contains valid data object', () => {
      expect(response.data.data).to.have.keys('version', 'endpoints');
      expect(response.data.data.version, 'Incorrect Version').equal('2.1.1');
      expect(response.data.data.endpoints).to.be.an('array').that.is.not.empty;
    });

    // Check data object for Array of Endpoints
    it('should contains valid Endpoint objects', () => {
      expect(response.data.data.endpoints, 'Invalid Endpoints Object').to.satisfy((endpoints) => {
        let validEndpoints = true;
        for (const endpoint of endpoints) {
          validEndpoints = expect(endpoint).to.have.keys('identifier', 'url') && validEndpoints;
        }
        return validEndpoints;
      });
    });
  });


  /**
  * Test Invalid Enpoint /ocpi/cpo/2.1.1/invalidEndpoint
  */
  describe('Test Invalid Endpoint /ocpi/cpo/2.1.1/invalidEndpoint', () => {
    let response;

    // Check call
    it('should return 501 on url: /ocpi/cpo/2.1.1/invalidEndpoint', async () => {
      // Create
      response = await testData.cpoService.accessPath('GET', '/ocpi/cpo/2.1.1/invalidEndpoint');
      // Check status
      expect(response.status).to.be.eql(501);
    });

    // Check Response Object
    it('should have correct OCPI Error Response object', () => {
      // Check structure of OCPI Structure
      testData.cpoService.checkOCPIErrorResponseStructure(response.data);
    });

    // Check Response Value
    it('should have correct OCPI Error Response value', () => {
      expect(response.data).to.not.be.empty;
      expect(response.data).to.have.property('status_code', 3000);
      expect(response.data).to.have.property('status_message', 'Endpoint invalidEndpoint not implemented');
    });
  });

  /**
   * Test Invalid Enpoint /ocpi/emsp/2.1.1/invalidEndpoint
   */
  describe('Test Invalid Endpoint /ocpi/emsp/2.1.1/invalidEndpoint', () => {
    let response;

    // Check call
    it('should return 501 on url: /ocpi/emsp/2.1.1/invalidEndpoint', async () => {
      // Create
      response = await testData.emspService.accessPath('GET', '/ocpi/emsp/2.1.1/invalidEndpoint');
      // Check status
      expect(response.status).to.be.eql(501);
    });

    // Check Response Object
    it('should have correct OCPI Error Response object', () => {
      // Check structure of OCPI Structure
      testData.emspService.checkOCPIErrorResponseStructure(response.data);
    });

    // Check Response Value
    it('should have correct OCPI Error Response value', () => {
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

      // Check call
      it('should access url: /ocpi/cpo/2.1.1/locations', async () => {
        // Get locations
        response = await testData.cpoService.getLocations2_1_1();
        // Check status
        expect(response.status).to.be.eql(200);
      });

      // Check Response Object
      it('should have correct OCPI Response object', () => {
        // Check structure of OCPI Structure
        testData.cpoService.checkOCPIResponseStructure(response.data);
      });

      // Check Response Value
      it('should have correct OCPI Response success value', () => {
        expect(response.data).to.not.be.empty;
        expect(response.data).to.have.property('status_code', 1000);
        expect(response.data).to.have.property('status_message', 'Success');
        expect(response.data).to.have.property('data').to.be.an('array').that.is.not.empty;
      });

      // Validate content - scan entities: locations/evses/connectors
      it('should have valid OCPI Location Entities', () => {
        expect(response.data.data, 'Invalid Location Object').to.satisfy((locations) => {
          const validLocationsAndSubEntities = true;
          // Loop through location
          for (const location of locations) {
            // Validate location
            testData.cpoService.validateLocationEntity(location);
            // ValidLocationsAndSubEntities = validLocationsAndSubEntities

            // loop through evse
            for (const evse of location.evses) {
              // Validate evse
              testData.cpoService.validateEvseEntity(evse);
              // ValidLocationsAndSubEntities = validLocationsAndSubEntities &&

              // loop through connectors
              for (const connector of evse.connectors) {
                // Validate connector
                testData.cpoService.validateConnectorEntity(connector);
                // ValidLocationsAndSubEntities = validLocationsAndSubEntities && ;
              }
            }
          }
          return validLocationsAndSubEntities;
        });
      });
    });

    /**
     * Access with paging
     */
    describe('Access with paging', () => {
      // Check access for each location
      it('should access url /ocpi/cpo/2.1.1/locations/ and have headers X-Limit and X-Total-Count', async () => {
        // Call
        const locationsResponse = await testData.cpoService.accessPath('GET', '/ocpi/cpo/2.1.1/locations');

        expect(locationsResponse.data).to.not.be.empty;
        expect(locationsResponse.data).to.have.property('status_code', 1000);
        expect(locationsResponse.data).to.have.property('status_message', 'Success');
        expect(locationsResponse.data).to.have.property('data').to.be.an('array').that.is.not.empty;
        expect(locationsResponse.headers).to.have.property('x-limit');
        expect(locationsResponse.headers).to.have.property('x-total-count');
      });

      // Check access for each location
      it('should access url with paging /ocpi/cpo/2.1.1/locations/?offset=0&limit=20', async () => {
        // Call
        const locationsResponse = await testData.cpoService.accessPath('GET', '/ocpi/cpo/2.1.1/locations/?offset=0&limit=20');

        expect(locationsResponse.data).to.not.be.empty;
        expect(locationsResponse.data).to.have.property('status_code', 1000);
        expect(locationsResponse.data).to.have.property('status_message', 'Success');
        expect(locationsResponse.data).to.have.property('data').to.be.an('array').that.is.not.empty;
      });

      // Check limit
      it('should access url with paging /ocpi/cpo/2.1.1/locations/?offset=0&limit=1', async () => {
        // Call
        const locationsResponse = await testData.cpoService.accessPath('GET', '/ocpi/cpo/2.1.1/locations/?offset=0&limit=1');

        expect(locationsResponse.data).to.not.be.empty;
        expect(locationsResponse.data).to.have.property('status_code', 1000);
        expect(locationsResponse.data).to.have.property('status_message', 'Success');
        expect(locationsResponse.data).to.have.property('data').to.be.an('array').and.to.have.length(1);
        expect(locationsResponse.headers).to.have.property('link').to.match(/^<.*:\/\/.*:.*\/ocpi\/cpo\/.*\/locations\/\?offset=1&limit=1>; rel="next"/);
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
    /**
     * Success Cases
     */
    describe('Success cases', () => {
      // Call once agian the GET Locations
      before(async function() {
        // Create
        response = await testData.cpoService.getLocations2_1_1();

        if (response.status !== 200) {
          this.skip();
        }
      });

      // Check access for each location
      it('should access single location entity /ocpi/cpo/2.1.1/locations/{locationId}', async () => {
        for (const location of response.data.data) {
          // Call
          const locationResponse = await testData.cpoService.accessPath('GET', `/ocpi/cpo/2.1.1/locations/${location.id}`);
          // Check status
          expect(locationResponse.status).to.be.eql(200);
          expect(testData.cpoService.validateLocationEntity(locationResponse.data.data));
        }
      });

      // Check access for each evse
      it('should access single EVSE entity /ocpi/cpo/2.1.1/locations/{locationId}/{evseUid}', async () => {
        for (const location of response.data.data) {
          for (const evse of location.evses) {
            // Call
            const evseResponse = await testData.cpoService.accessPath('GET', `/ocpi/cpo/2.1.1/locations/${location.id}/${evse.uid}`);
            // Check status
            expect(evseResponse.status).to.be.eql(200);
            expect(testData.cpoService.validateEvseEntity(evseResponse.data.data));
          }
        }
      });

      // Check access for each evse
      it('should access single Connector entity /ocpi/cpo/2.1.1/locations/{locationId}/{evseUid}/{connectorId}', async () => {
        for (const location of response.data.data) {
          for (const evse of location.evses) {
            for (const connector of evse.connectors) {
              // Call
              const connectorResponse = await testData.cpoService.accessPath('GET', `/ocpi/cpo/2.1.1/locations/${location.id}/${evse.uid}/${connector.id}`);
              // Check status
              expect(connectorResponse.status).to.be.eql(200);
              expect(testData.cpoService.validateConnectorEntity(connectorResponse.data.data));
            }
          }
        }
      });
    });

    /**
     * Failure cases
     */
    describe('Failure cases', () => {
      // Invalid location
      it('should not found this non-existing location  /ocpi/cpo/2.1.1/locations/5abeba9e4bae1457eb565e67', async () => {
        // Call
        const locationResponse = await testData.cpoService.accessPath('GET', '/ocpi/cpo/2.1.1/locations/5abeba9e4bae1457eb565e67');
        // Check status
        expect(locationResponse.status).to.be.eql(500);
        expect(locationResponse.data).to.have.property('timestamp');
        expect(locationResponse.data).to.have.property('status_code', 3000);
        expect(locationResponse.data).to.have.property('status_message', 'Site id \'5abeba9e4bae1457eb565e67\' not found');
      });

      // Invalid evse uid
      it('should not found this non-existing EVSE  /ocpi/cpo/2.1.1/locations/5abeba9e4bae1457eb565e66/NonExistingSite', async () => {
        // Call
        const locationResponse = await testData.cpoService.accessPath('GET', '/ocpi/cpo/2.1.1/locations/5abeba9e4bae1457eb565e66/NonExistingSite');
        // Check status
        expect(locationResponse.status).to.be.eql(500);
        expect(locationResponse.data).to.have.property('timestamp');
        expect(locationResponse.data).to.have.property('status_code', 3000);
        expect(locationResponse.data).to.have.property('status_message', 'EVSE uid not found \'NonExistingSite\' on location id \'5abeba9e4bae1457eb565e66\'');
      });

      // Invalid connector id
      it('should not found this non-existing Connector  /ocpi/cpo/2.1.1/locations/5abeba9e4bae1457eb565e66/SAP-Caen-01*1/0', async () => {
        // Call
        const locationResponse = await testData.cpoService.accessPath('GET', '/ocpi/cpo/2.1.1/locations/5abeba9e4bae1457eb565e66/SAP-Caen-01*1/0');
        // Check status
        expect(locationResponse.status).to.be.eql(500);
        expect(locationResponse.data).to.have.property('timestamp');
        expect(locationResponse.data).to.have.property('status_code', 3000);
        expect(locationResponse.data).to.have.property('status_message', 'Connector id \'0\' not found on EVSE uid \'SAP-Caen-01*1\' and location id \'5abeba9e4bae1457eb565e66\'');
      });
    });
  });

  /**
 * Test single access to location/evse/connector:
 *    - /ocpi/cpo/2.1.1/locations/{locationId}
 *    - /ocpi/cpo/2.1.1/locations/{locationId}/{evseUid}
 *    - /ocpi/cpo/2.1.1/locations/{locationId}/{evseId}/{connectorId}
 */
  describe('Test registration process /ocpi/cpo/2.1.1/credentials/...', () => {
    let response;
    /**
     * Success Cases
     */
    describe('Success cases', () => {
      it('Should create a new ocpiEndpoint', async () => {
        // Check
        expect(testData.newOcpiEndpoint).to.not.be.null;
        // Create the entity
        testData.newOcpiEndpoint = await CentralServerService.DefaultInstance.createEntity(
          CentralServerService.DefaultInstance.ocpiEndpointApi, Factory.ocpiEndpoint.build());
      });


      it('Should update the ocpiEndpoint token', async () => {
        // Change entity
        testData.newOcpiEndpoint.localToken = OCPIService.getToken();
        // Update
        await CentralServerService.DefaultInstance.updateEntity(
          CentralServerService.DefaultInstance.ocpiEndpointApi, testData.newOcpiEndpoint);
      });

      // // Check access for each evse
      // it('should be able to self-register', async () => {
      //   // Define credential object
      //   const credential = {
      //     'url': 'http://localhost:9090/ocpi/cpo/versions',
      //     'token': '12345',
      //     'party_id': 'SLF',
      //     'country_code': 'FR',
      //     'business_details': {
      //       'name': 'SAP Labs France',
      //       'logo': {
      //         'url': 'https://example.sap.com/img/logo.jpg',
      //         'thumbnail': 'https://example.sap.com/img/logo_thumb.jpg',
      //         'category': 'CPO',
      //         'type': 'jpeg',
      //         'width': 512,
      //         'height': 512
      //       },
      //       'website': 'http://sap.com'
      //     }
      //   };

      //   // Create
      //   response = await testData.ocpiService.postCredentials2_1_1(credential);

      //   // Check status
      //   expect(response.status).to.be.eql(200);
      //   testData.ocpiService.checkOCPIResponseStructure(response.data);
      //   expect(response.data.status_code).to.be.eql(1000);
      //   testData.ocpiService.validateCredentialEntity(response.data.data);
      // });

      it('Should delete the created ocpiEndpoint', async () => {
        // Delete the created entity
        await CentralServerService.DefaultInstance.deleteEntity(
          CentralServerService.DefaultInstance.ocpiEndpointApi, testData.newOcpiEndpoint);
      });
    });

    /**
     * Failure cases
     */
    describe('Failure cases', () => {
      // Invalid location
      // It('should not found this non-existing location  /ocpi/cpo/2.1.1/locations/5abeba9e4bae1457eb565e67', async () => {
      //   // Call
      //   const locationResponse = await testData.ocpiService.accessPath('GET', `/ocpi/cpo/2.1.1/locations/5abeba9e4bae1457eb565e67`);
      //   // Check status
      //   expect(locationResponse.status).to.be.eql(500);
      //   expect(locationResponse.data).to.have.property("timestamp");
      //   expect(locationResponse.data).to.have.property("status_code", 3000);
      //   expect(locationResponse.data).to.have.property("status_message", "Site id '5abeba9e4bae1457eb565e67' not found");
      // });
    });
  });
});
