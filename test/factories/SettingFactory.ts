import faker from 'faker';

import { Factory } from 'rosie';

export default Factory.define('setting')
  .attr('identifier', () => faker.lorem.word())
  .attr('content', JSON.parse('{ "property": "value" }'));
