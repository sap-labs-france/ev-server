import { Factory } from 'rosie';
import faker from 'faker';

export default Factory.define('tag')
  .attr('id', () => faker.random.alphaNumeric(20).toString())
  .attr('active', true)
  .attr('issuer', () => true)
  .attr('description', () => 'Tag for unit test');
