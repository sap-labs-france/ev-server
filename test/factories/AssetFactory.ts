import { Factory } from 'rosie';
import { faker } from '@faker-js/faker';

export default Factory.define('asset')
  .attr('name', () => faker.company.companyName())
  .attr('siteAreaID', null)
  .attr('assetType', null)
  .attr('fluctuationPercent', faker.datatype.number({ min: 1, max: 100 }))
  .attr('staticValueWatt', 0)
  .attr('excludeFromSmartCharging', false);
