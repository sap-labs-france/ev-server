import { Factory } from 'rosie';
import { faker } from '@faker-js/faker';

export default Factory.define('setting')
  .attr('identifier', () => faker.lorem.word())
  .attr('content', JSON.parse('{ "property": "value" }'));
