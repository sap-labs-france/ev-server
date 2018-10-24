const Factory = require('rosie').Factory;
const faker = require('faker');

module.exports = Factory.define('address')
  .attr('firstName', () => faker.name.firstName())
  .attr('name', () => faker.name.lastName())
  .attr('email', () => faker.internet.email())
  .attr('passwords', () => {
    const password = faker.internet.password() + "@1Aa";
    return {
      password: password,
      repeatPassword: password
    }
  })
  .attr('role', 'B')
  .attr('status', 'A')
  .attr('tagIDs',() =>  [faker.random.alphaNumeric(8).toUpperCase()]);
