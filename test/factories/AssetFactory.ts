import { Factory } from 'rosie';
import faker from 'faker';

export default Factory.define('asset')
  .attr('name', () => faker.company.companyName())
  .attr('siteAreaID', null)
  .attr('assetType', null)
  .attr('fluctuationPercent', faker.random.number({ min: 1, max: 100 }))
  .attr('staticValueWatt', 0);
