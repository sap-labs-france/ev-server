const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const CentralServerService = require('./client/CentralServerService');
const Factory = require('../factories/Factory');


describe('Company tests', function() {
  this.timeout(10000);

  it('should create a new company', async () => {
    let response = await CentralServerService.company.create(Factory.company.build());
    expect(response.status).to.equal(200);
    expect(response.data.status).to.eql('Success');
    expect(response.data).to.have.property('id');
    expect(response.data.id).to.match(/^[a-f0-9]+$/);
  });

  it('should find a newly created company from list', async () => {
    const company = Factory.company.build();
    let response = await CentralServerService.company.create(company);
    company.id = response.data.id;

    response = await CentralServerService.company.readAll();
    expect(response.status).to.equal(200);
    expect(response.data).to.have.property('count');

    expect(response.data).to.have.property('result');
    const actualCompany = response.data.result.find((element) => element.name === company.name);
    expect(actualCompany).to.be.an('object');
    expect(actualCompany).to.containSubset(company);
  });

  it('should find a specific company by id', async () => {
    const company = Factory.company.build();

    let response = await CentralServerService.company.create(company);
    company.id = response.data.id;

    response = await CentralServerService.company.readById(company.id);
    expect(response.status).to.equal(200);
    expect(response.data).to.containSubset(company);
  });

});
