import { Factory } from 'rosie';
import { faker } from '@faker-js/faker';

export default Factory.define('car')
  .attr('vin', () => faker.random.alphaNumeric(17).toUpperCase())
  .attr('licensePlate', faker.random.alphaNumeric(12).toUpperCase())
  .attr('type', 'P')
  .attr('converter', {
    'amperagePerPhase': faker.datatype.number(64),
    'numberOfPhases': faker.datatype.number({ min: 1, max: 4 }),
    'type': 'S',
    'powerWatts': faker.datatype.number(32)
  });
