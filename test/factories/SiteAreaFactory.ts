import { Factory } from 'rosie';
import address from './AddressFactory';
import faker from 'faker';

export default Factory.define('siteArea')
  .attr('name', () => faker.company.companyName())
  .attr('siteID', null)
  .attr('maximumPower', 200000)
  .attr('voltage', 230)
  .attr('numberOfPhases', 3)
  .attr('accessControl', true)
  .attr('address', () => address.build());
