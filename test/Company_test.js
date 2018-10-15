const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const CentralServerService = require('./api/client/CentralServerService');
const Factory = require('./factories/Factory');


describe('Company tests', function() {
  this.timeout(10000);

  it('should create a new company', async () => {
    await CentralServerService.company.create(Factory.company.build(), (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
      expect(response).to.have.property('id');
      expect(response.id).to.match(/^[a-f0-9]+$/);
    });
  });

  it('should find a newly created company from list', async () => {
    const company = Factory.company.build();
    await CentralServerService.company.create(company, ((message, response) => {
      company.id = response.id;
    }));

    await CentralServerService.company.readAll({}, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.have.property('count');

      expect(response).to.have.property('result');
      const actualCompany = response.result.find((element) => element.name === company.name);
      expect(actualCompany).to.be.an('object');
      expect(actualCompany).to.containSubset(company);
    });
  });

  it('should find a specific company by id', async () => {
    const company = Factory.company.build();

    let message = await CentralServerService.company.create(company);
    company.id = message.response.id;

    await centralServerService.company.create(company, ((message, response) => {
      company.id = response.id;
    }));


    await CentralServerService.company.readById(company.id, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.containSubset(company);
    });
  });

});
