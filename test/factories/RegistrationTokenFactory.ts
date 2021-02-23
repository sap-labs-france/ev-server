import { Factory } from 'rosie';
import faker from 'faker';

export default Factory.define('registrationToken')
  .attr('id', () => faker.random.alphaNumeric(20).toString().toUpperCase())
  .attr('description', () => 'Registration token for unit test')
  .attr('revocationDate', null)
  .attr('siteAreaID', null);
