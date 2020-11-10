import { Factory } from 'rosie';
import faker from 'faker';

export default Factory.define('car')
  .attr('vin', () => faker.random.alphaNumeric(17).toUpperCase())
  .attr('licensePlate', faker.random.alphaNumeric(12).toUpperCase())
  .attr('carCatalogID', 1004)
  .attr('type', 'P')
  .attr('usersUpserted', [])
  .attr('usersRemoved', [])
  .attr('converter', {
    'amperagePerPhase': faker.random.number(64),
    'numberOfPhases': faker.random.number({ min: 1, max: 4 }),
    'type': 'S',
    'powerWatts': faker.random.number(32)
  });
