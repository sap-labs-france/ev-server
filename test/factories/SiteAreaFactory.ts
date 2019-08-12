import faker from 'faker';

import { Factory } from 'rosie';
import address from './AddressFactory';

export default Factory.define('siteArea')
  .attr('name', () => faker.company.companyName())
  .attr('siteID', null)
  .attr('accessControl', true)
  .attr('address',() => address.build());
