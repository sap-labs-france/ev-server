import { Factory } from 'rosie';
import { OCPIRole } from '../../src/types/ocpi/OCPIRole';
import { faker } from '@faker-js/faker';

export default Factory.define('ocpiEndpoint')
  .attr('name', () => faker.name.lastName())
  .attr('baseUrl', () => faker.internet.url())
  .attr('countryCode', 'FR')
  .attr('partyId', '107')
  .attr('role', OCPIRole.CPO)
  .attr('localToken', () => faker.internet.password())
  .attr('token', () => faker.internet.password());
