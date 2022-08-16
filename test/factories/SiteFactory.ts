import { Factory } from 'rosie';
import address from './AddressFactory';
import { faker } from '@faker-js/faker';

export default Factory.define('site')
  .attr('name', () => faker.company.companyName() + '_' + faker.random.alphaNumeric(8).toUpperCase())
  .attr('companyID', null)
  .attr('address', () => address.build());
