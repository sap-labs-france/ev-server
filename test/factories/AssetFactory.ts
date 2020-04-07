import faker from 'faker';
import { Factory } from 'rosie';

export default Factory.define('asset')
  .attr('name', () => faker.company.companyName())
  .attr('siteAreaID', null)
