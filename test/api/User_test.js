const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const CentralServerService = require('./client/CentralServerService');
const Factory = require('../factories/Factory');

describe('User tests', function() {
  this.timeout(10000);
  before(async () => {
  });

  it('should create a new user', async () => {
    await CentralServerService.user.create(Factory.user.build(), (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
      expect(response).to.have.property('id');
      expect(response.id).to.match(/^[a-f0-9]+$/);
    });
  });

  it('should find a newly created user from list', async () => {
    const user = Factory.user.build();

    await CentralServerService.user.create(user, ((message, response) => {
      user.id = response.id;
    }));

    delete user.acceptEula;
    delete user.captcha;
    delete user.passwords;

    await CentralServerService.user.readAll({}, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.have.property('count');
      expect(response).to.have.property('result');
      expect(response.result).to.have.lengthOf(response.count);
      const actualUser = response.result.find((element) => element.email === user.email);
      expect(actualUser).to.be.an('object');
      expect(actualUser).to.containSubset(user);
    });
  });

  it('should find a specific user by id', async () => {
    const user = Factory.user.build();
    await CentralServerService.user.create(user, ((message, response) => {
      user.id = response.id;
    }));

    delete user.acceptEula;
    delete user.captcha;
    delete user.passwords;

    await CentralServerService.user.readById(user.id, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.containSubset(user);
    });
  });

});
