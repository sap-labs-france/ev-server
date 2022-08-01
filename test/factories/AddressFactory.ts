import { Factory } from 'rosie';
import Utils from '../../src/utils/Utils';
import { faker } from '@faker-js/faker';
import moment from 'moment-timezone';

export default Factory.define('address')
  .attr('address1', () => faker.address.streetAddress())
  .attr('address2', () => faker.address.secondaryAddress())
  .attr('postalCode', () => faker.address.zipCode())
  .attr('city', () => faker.address.city())
  .attr('region', () => faker.address.state())
  .attr('department', () => faker.address.county())
  .attr('coordinates', () => {
    const coordinates = [12.4963655, 41.9027835];
    const timezone = Utils.getTimezone(coordinates);
    // Some pricing/billing tests are sensitive to the timezone!
    if (moment().tz(timezone).isoWeekday() !== moment().add(2, 'hours').tz(timezone).isoWeekday()) {
      // Rio de Janeiro coordinates
      return [-43.1728965, -22.9068467];
    }
    // Rome coordinates
    return coordinates;
  })
  .attr('country', () => faker.address.country());
