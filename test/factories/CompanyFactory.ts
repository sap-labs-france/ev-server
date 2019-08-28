import faker from 'faker';
import { Factory } from 'rosie';
import address from './AddressFactory';

export default Factory.define('company')
  .attr('name', () => faker.company.companyName())
  .attr('address', () => address.build());
