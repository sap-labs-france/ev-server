import faker from 'faker';
import { Factory } from 'rosie';
import Constants from '../../src/utils/Constants';

export default Factory.define('ocpiEndpoint')
  .attr('name', () => faker.name.lastName())
  .attr('baseUrl', () => faker.internet.url())
  .attr('countryCode', 'FR')
  .attr('partyId', '107')
  .attr('role', Constants.OCPI_ROLE.CPO)
  .attr('localToken', () => faker.internet.password())
  .attr('token', () => faker.internet.password());
