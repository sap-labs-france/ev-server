import { Factory } from 'rosie';
import { faker } from '@faker-js/faker';

export default Factory.define('tenant')
  .attr('name', () => faker.company.companyName())
  .attr('email', () => faker.internet.email().toLowerCase())
  .attr('subdomain', () => faker.random.alphaNumeric(10).toLowerCase())
  .attr('components', {})
  .attr('address', {
    address1: faker.address.streetAddress(false),
    address2: faker.address.streetAddress(true),
    postalCode: faker.address.zipCode(),
    city: faker.address.city(),
    department: faker.random.alphaNumeric(20),
    region: faker.random.alphaNumeric(20),
    country: faker.address.country(),
    coordinates: [
      +faker.address.longitude(),
      +faker.address.latitude()
    ]
  });

