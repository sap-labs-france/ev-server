import { Factory } from 'rosie';
import address from './AddressFactory';
import { faker } from '@faker-js/faker';

export default Factory.define('company')
  .attr('name', () => faker.company.companyName())
  .attr('address', () => address.build());
