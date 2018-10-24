const Factory = require('rosie').Factory;
const faker = require('faker');

module.exports = Factory.define('siteArea')
  .attr('name', () => faker.company.companyName())
  .attr('siteID', null)
  .attr('accessControl', true);