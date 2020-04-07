import { Factory } from 'rosie';
import faker from 'faker';

export default Factory.define('tenant')
  .attr('name', () => faker.company.companyName())
  .attr('email', () => faker.internet.email())
  .attr('subdomain', () => faker.random.alphaNumeric(10).toLowerCase())

