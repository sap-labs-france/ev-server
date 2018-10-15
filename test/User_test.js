const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const CentralServerService = require('./api/client/CentralServerService');
const Factory = require('./factories/Factory');

describe('User tests', function() {
  this.timeout(10000);
  const centralServerService = new CentralServerService();

  before(async () => {
  });

  it('should create a new user', async () => {
    await centralServerService.user.create(Factory.user.build(), (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
      expect(response).to.have.property('id');
      expect(response.id).to.match(/^[a-f0-9]+$/);
    });
  });

  it('should find a newly created user from list', async () => {
    const user = Factory.user.build();

    await centralServerService.user.create(user, ((message, response) => {
      user.id = response.id;
    }));

    delete user.acceptEula;
    delete user.captcha;
    delete user.passwords;

    await centralServerService.user.readAll({}, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.have.property('count');
      expect(response).to.have.property('result');
      expect(response.result).to.have.lengthOf(response.count);
      const actualUser = response.result.find((element) => element.email === user.email);
      expect(actualUser).to.be.a('object');
      expect(actualUser).to.containSubset(user);
    });
  });

  it('should find a specific user by id', async () => {
    const user = Factory.user.build();
    await centralServerService.user.create(user, ((message, response) => {
      user.id = response.id;
    }));

    delete user.acceptEula;
    delete user.captcha;
    delete user.passwords;

    await centralServerService.user.readById(user.id, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.containSubset(user);
    });
  });

});
