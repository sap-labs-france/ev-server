import { Factory } from 'rosie';
import { Voltage } from '../../src/types/ChargingStation';
import address from './AddressFactory';
import { faker } from '@faker-js/faker';

export default Factory.define('siteArea')
  .attr('name', () => faker.company.companyName())
  .attr('siteID', null)
  .attr('maximumPower', 200000)
  .attr('voltage', Voltage.VOLTAGE_230)
  .attr('numberOfPhases', 3)
  .attr('accessControl', true)
  .attr('address', () => address.build());
