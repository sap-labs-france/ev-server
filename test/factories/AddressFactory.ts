import { Factory } from 'rosie';
import faker from 'faker';

export default Factory.define('address')
  .attr('address1', () => faker.address.streetAddress())
  .attr('address2', () => faker.address.secondaryAddress())
  .attr('postalCode', () => faker.address.zipCode())
  .attr('city', () => faker.address.city())
  .attr('region', () => faker.address.state())
  .attr('department', () => faker.address.county())
  .attr('coordinates', () => [parseFloat(faker.address.longitude()), parseFloat(faker.address.latitude())])
  .attr('country', () => faker.address.country());
