const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const CentralServerService = require('./client/CentralServerService');
const Constants = require('./client/utils/Constants');
const Factory = require('../factories/Factory');


describe('Company tests', function() {
  this.timeout(10000);

  it('should create a new company', async () => {
    // Generate a new object
    let company = Factory.company.build();
    // Create it in the backend
    let response = await CentralServerService.company.create(company);
    // Check
    expect(response.status).to.equal(200);
    expect(response.data.status).to.eql('Success');
    expect(response.data).to.have.property('id');
    expect(response.data.id).to.match(/^[a-f0-9]+$/);
    // Set the id
    company.id = response.data.id;
    // Keep it
    this.newCompany = company;
  });

  it('should find a specific company by id', async () => {
    // Check first if created
    expect(this.newCompany).to.not.be.null;
    // Create it in the backend
    let response = await CentralServerService.company.readById(this.newCompany.id);
    // Check if ok
    expect(response.status).to.equal(200);
    expect(response.data.id).is.eql(this.newCompany.id);
    // Keep the one retrieved from the backend (with params like created by/on...)
    this.newCompany = response.data;
  });

  it('should find a newly created company from list', async () => {
    // Check first if created
    expect(this.newCompany).to.not.be.null;
    // Retrieve from the backend
    response = await CentralServerService.company.readAll({}, { limit: Constants.UNLIMITED, skip: 0 });
    // Check
    expect(response.status).to.equal(200);
    // Contains props
    expect(response.data).to.have.property('count');
    expect(response.data).to.have.property('result');
    // All record retrieved
    expect(response.data.count).to.eql(response.data.result.length);
    // Check created company
    expect(response.data.result).to.containSubset([this.newCompany]);  
  });
});
