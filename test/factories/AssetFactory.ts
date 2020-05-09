import { Factory } from 'rosie';
import faker from 'faker';

export default Factory.define('asset')
  .attr('name', () => faker.company.companyName())
  .attr('siteAreaID', null)
  .attr('assetType', null);
