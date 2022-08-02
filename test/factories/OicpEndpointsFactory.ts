import { Factory } from 'rosie';
import { OICPRole } from '../../src/types/oicp/OICPRole';
import { faker } from '@faker-js/faker';

export default Factory.define('oicpEndpoint')
  .attr('name', () => faker.name.lastName())
  .attr('baseUrl', () => faker.internet.url())
  .attr('countryCode', 'FR')
  .attr('partyId', '107')
  .attr('role', OICPRole.CPO);
