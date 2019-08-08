import faker from 'faker';

import { Factory } from 'rosie';
import address from './AddressFactory';

export default Factory.define('site')
  .attr('name', () => faker.company.companyName() + '_' + faker.random.alphaNumeric(8).toUpperCase())
  .attr('companyID', null)
  .attr('address', () => address.build());
