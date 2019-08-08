import faker from 'faker';

import { Factory } from 'rosie';

export default  Factory.define('ocpiEndpoint')
  .attr('name', () => faker.name.lastName())
  .attr('baseUrl', () => faker.internet.url())
  .attr('countryCode', 'FR')
  .attr('partyId', '107')
  .attr('localToken', () => faker.internet.password())
  .attr('token', () => faker.internet.password());
