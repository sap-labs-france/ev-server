import { Factory } from 'rosie';
import { attempt } from 'bluebird';
import faker from 'faker';


const chargingScheduleFactory = Factory.define('chargingSchedule')
  .attr('chargingRateUnit', () => 'A')
  .attr('startSchedule', () => new Date)
  .attr('duration', () => 2700)
  .attr('chargingSchedulePeriod', () => [
    {
      startPeriod: 0,
      limit: 96
    },
    {
      startPeriod: 900,
      limit: 96
    },
    {
      startPeriod: 1800,
      limit: 96
    }
  ]);

const profileFactory = Factory.define('profile')
  .attr('chargingProfileId', () => 1)
  .attr('chargingProfileKind', () => 'Absolute')
  .attr('chargingProfilePurpose', () => 'TxProfile')
  .attr('transactionId', () => '')
  .attr('stackLevel', () => 2)
  .attr('chargingSchedule', () => chargingScheduleFactory.build());

export default Factory.define('chargingProfile')
  .attr('chargePointID', () => 1)
  .attr('chargingStationID', () => faker.random.alphaNumeric(25))
  .attr('connectorID', () => 1)
  .attr('profile', () => profileFactory.build());
