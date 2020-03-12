import faker from 'faker';
import { Factory } from 'rosie';
import address from './AddressFactory';
import { ObjectID } from 'mongodb';

export default Factory.define('building')
  .attr('name', () => faker.company.companyName())
  .attr('siteAreaID', () => new ObjectID().toHexString())
  .attr('address', () => address.build());
