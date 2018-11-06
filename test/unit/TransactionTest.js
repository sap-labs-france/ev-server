const moment = require('moment');
const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
const Transaction = require('../../src/model/Transaction');
chai.use(chaiSubset);

const Factory = require('rosie').Factory;
const faker = require('faker');

const UserFactory = Factory.define('user')
  .attr('id', () => faker.random.number(100000))
  .attr('firstName', () => faker.name.firstName())
  .attr('name', () => faker.name.lastName());

const TransactionFactory = Factory.define('transaction')
  .attr('id', () => faker.random.number(100000))
  .attr('chargeBoxID', () => faker.random.alphaNumeric(10))
  .attr('connectorId', () => faker.random.number({min: 0, max: 5}))
  .attr('timestamp', () => new Date())
  .attr('tagID', () => faker.random.alphaNumeric(10))
  .attr('user', () => UserFactory.build())
  .attr('meterValues', ['meterValues', 'id', 'connectorId', 'timestamp'], function(meterValues, id, connectorId, timestamp) {
    if (!meterValues) {
      meterValues = [{}, {}];
    }
    return meterValues.map(() => {
      return Factory.attributes('meterValue', {
        transactionId: id,
        connectorId: connectorId,
        timestamp: timestamp,
      });
    });
  });

const EmptyTransactionFactory = Factory.define('empty-transaction').extend('transaction').attr('meterValues', undefined);

const MeterValueFactory = Factory.define('meterValue')
  .attr('id', () => faker.random.number(100000))
  .attr('connectorId', () => faker.random.number({min: 0, max: 5}))
  .attr('value', 0)
  .attr('attribute', {
    unit: 'Wh',
    location: 'Outlet',
    measurand: faker.random.alphaNumeric(10),
    format: 'Raw',
    context: 'Sample.Periodic'
  })
  .attr('timestamp', new Date());

describe('Transaction entity tests', () => {

  it('Should be an active transaction', () => {
    const transaction = new Transaction({});
    expect(transaction.isActive()).to.equal(true);
  });
  it('Should not be an active transaction', () => {
    const transaction = new Transaction({stop: {}});
    expect(transaction.isActive()).to.equal(false);
  });
  describe('test _hasMeterValues', () => {
    it('without meterValues', () => {
      const transaction = new Transaction(EmptyTransactionFactory.build());
      expect(transaction._hasMeterValues()).to.equal(false);
    });
    it('with meterValues', () => {
      const transaction = new Transaction(TransactionFactory.build());
      expect(transaction._hasMeterValues()).to.equal(true);
    });
  });
  describe('test _firstMeterValue', () => {
    it('without meterValues', () => {
      const transaction = new Transaction(EmptyTransactionFactory.build({meterStart: 10}));
      expect(transaction._firstMeterValue).to.deep.equal(
        {
          attribute: {
            context: 'Sample.Periodic',
            format: 'Raw',
            location: 'Outlet',
            measurand: 'Energy.Active.Import.Register',
            unit: 'Wh'
          },
          id: '666',
          connectorId: transaction.connectorId,
          timestamp: transaction.startDate,
          transactionId: transaction.id,
          value: 10
        }
      );
    });
    it('with meterValues', () => {
      const transaction = new Transaction(TransactionFactory.build({meterStart: 10}));
      expect(transaction._firstMeterValue).to.containSubset(
        {
          attribute: {
            context: 'Sample.Periodic',
            format: 'Raw',
            location: 'Outlet',
            unit: 'Wh'
          },
          id: '666',
          connectorId: transaction.connectorId,
          timestamp: transaction.startDate,
          transactionId: transaction.id,
          value: 10
        }
      );
      expect(transaction._firstMeterValue.attribute.measurand).to.not.equal('Energy.Active.Import.Register');
    });
  });

  describe('test _lastMeterValue', () => {
    it('without meterValues', () => {
      const transaction = new Transaction(EmptyTransactionFactory.build({stop: {meterStop: 10}}));
      expect(transaction._lastMeterValue).to.deep.equal(
        {
          attribute: {
            context: 'Sample.Periodic',
            format: 'Raw',
            location: 'Outlet',
            measurand: 'Energy.Active.Import.Register',
            unit: 'Wh'
          },
          id: '6969',
          connectorId: transaction.connectorId,
          timestamp: transaction.endDate,
          transactionId: transaction.id,
          value: 10
        }
      );
    });
    it('with meterValues', () => {
      const transaction = new Transaction(TransactionFactory.build({stop: {meterStop: 10}}));
      expect(transaction._lastMeterValue).to.containSubset(
        {
          attribute: {
            context: 'Sample.Periodic',
            format: 'Raw',
            location: 'Outlet',
            unit: 'Wh'
          },
          id: '6969',
          connectorId: transaction.connectorId,
          timestamp: transaction.endDate,
          transactionId: transaction.id,
          value: 10
        }
      );
      expect(transaction._lastMeterValue.attribute.measurand).to.not.equal('Energy.Active.Import.Register');
    });
  });

  describe('test consumption computation', () => {
    it('without meterValues', () => {
      const transaction = new Transaction(EmptyTransactionFactory.build({}));
      expect(transaction.consumptions).to.deep.equal([]);
    });
    it('a started transaction with 1 meterValue at 60wh', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: moment(model.timestamp).add(1, 'minutes').toDate(),
          value: 1
        }
      ));

      const transaction = new Transaction(model);
      expect(transaction.consumptions).to.deep.equal(
        [{
          cumulated: 1,
          date: model.meterValues[0].timestamp,
          value: 60
        }]
      );
    });

    it('a started transaction with 1 meterValue at 30wh', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: moment(model.timestamp).add(2, 'minutes').toDate(),
          value: 1
        }
      ));

      const transaction = new Transaction(model);
      expect(transaction.consumptions).to.deep.equal(
        [{
          cumulated: 1,
          date: model.meterValues[0].timestamp,
          value: 30
        }]
      );
    });
    it('a started transaction with multiple meterValues', () => {
      const model = EmptyTransactionFactory.build({meterStart: 10000});
      model.meterValues = [];
      const timestamp = moment(model.timestamp);
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'hours').toDate(),
          value: 10200
        }
      ));
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 10250
        }
      ));
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 10350
        }
      ));

      const transaction = new Transaction(model);
      expect(transaction.consumptions).to.deep.equal(
        [
          {
            cumulated: 200,
            date: model.meterValues[0].timestamp,
            value: 200
          },
          {
            cumulated: 250,
            date: model.meterValues[1].timestamp,
            value: 50*60
          },
          {
            cumulated: 350,
            date: model.meterValues[2].timestamp,
            value: 100*60
          }
        ]
      );
    });
    it('a started transaction with multiple meterValues', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      const timestamp = moment(model.timestamp);
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 1
        }
      ));
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 4
        }
      ));
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 10
        }
      ));

      const transaction = new Transaction(model);
      expect(transaction.consumptions).to.deep.equal(
        [
          {
            cumulated: 1,
            date: model.meterValues[0].timestamp,
            value: 60
          },
          {
            cumulated: 4,
            date: model.meterValues[1].timestamp,
            value: 180
          },
          {
            cumulated: 10,
            date: model.meterValues[2].timestamp,
            value: 360
          }
        ]
      );
    });

    it('a stopped transaction with multiple meterValues', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      const timestamp = moment(model.timestamp);
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 1
        }
      ));
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 4
        }
      ));
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 10
        }
      ));

      const transaction = new Transaction(model);
      transaction.stop(transaction.initiator, transaction.tagID, 11, timestamp.add(1, 'minutes').toDate());
      expect(transaction.consumptions).to.deep.equal(
        [
          {
            cumulated: 1,
            date: transaction.meterValues[1].timestamp,
            value: 60
          },
          {
            cumulated: 4,
            date: transaction.meterValues[2].timestamp,
            value: 180
          },
          {
            cumulated: 10,
            date: transaction.meterValues[3].timestamp,
            value: 360
          },
          {
            cumulated: 11,
            date: transaction.meterValues[4].timestamp,
            value: 60
          }
        ]
      );
    });
  });

  describe('test consumption computation', () => {
    it('without meterValues with pricing', () => {
      const transaction = new Transaction(EmptyTransactionFactory.build({}));
      expect(transaction.totalPrice).to.equal(0);
    });
    it('a started transaction with 1 meterValue at 60wh with pricing', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: moment(model.timestamp).add(1, 'minutes').toDate(),
          value: 1
        }
      ));

      const transaction = new Transaction(model, {priceKWH: 1.5});
      expect(transaction.consumptions).to.deep.equal(
        [{
          cumulated: 1,
          date: model.meterValues[0].timestamp,
          value: 60,
          price: 0.0015
        }]
      );

      expect(transaction.totalPrice).to.equal(0.0015);
    });

    it('a started transaction with 1 meterValue at 30wh with pricing', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: moment(model.timestamp).add(2, 'minutes').toDate(),
          value: 1
        }
      ));

      const transaction = new Transaction(model, {priceKWH: 1.5});
      expect(transaction.consumptions).to.deep.equal(
        [{
          cumulated: 1,
          date: model.meterValues[0].timestamp,
          value: 30,
          price: 0.0015
        }]
      );

      expect(transaction.totalPrice).to.equal(0.0015);
    });

    it('a started transaction with multiple meterValues with pricing', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      const timestamp = moment(model.timestamp);
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 1
        }
      ));
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 4
        }
      ));
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 10
        }
      ));

      const transaction = new Transaction(model, {priceKWH: 1.5});
      expect(transaction.consumptions).to.deep.equal(
        [
          {
            cumulated: 1,
            date: model.meterValues[0].timestamp,
            value: 60,
            price: 0.0015
          },
          {
            cumulated: 4,
            date: model.meterValues[1].timestamp,
            value: 180,
            price: 0.0045000000000000005
          },
          {
            cumulated: 10,
            date: model.meterValues[2].timestamp,
            value: 360,
            price: 0.009000000000000001
          }
        ]
      );
      expect(transaction.totalPrice).to.equal(0.015000000000000001);
    });
    it('a stopped transaction with multiple meterValues with pricing', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      const timestamp = moment(model.timestamp);
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 1
        }
      ));
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 4
        }
      ));
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 10
        }
      ));

      const transaction = new Transaction(model, {priceKWH: 1.5});
      transaction.stop(transaction.initiator, transaction.tagID, 11, timestamp.add(1, 'minutes').toDate());
      expect(transaction.consumptions).to.deep.equal(
        [
          {
            cumulated: 1,
            date: transaction.meterValues[1].timestamp,
            value: 60,
            price: 0.0015
          },
          {
            cumulated: 4,
            date: transaction.meterValues[2].timestamp,
            value: 180,
            price: 0.0045000000000000005
          },
          {
            cumulated: 10,
            date: transaction.meterValues[3].timestamp,
            value: 360,
            price: 0.009000000000000001
          },
          {
            cumulated: 11,
            date: transaction.meterValues[4].timestamp,
            value: 60,
            price: 0.0015
          }
        ]
      );
      expect(transaction.totalPrice).to.equal(0.0165);
    });
  });

  describe('test totalInactivitySecs', () => {
    it('without meterValues', () => {
      const transaction = new Transaction(EmptyTransactionFactory.build({}));
      expect(transaction.totalInactivitySecs).to.deep.equal(0);
    });
    it('a started transaction with 1 meterValue', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: moment(model.timestamp).add(1, 'minutes').toDate(),
          value: 1
        }
      ));

      const transaction = new Transaction(model);
      expect(transaction.totalInactivitySecs).to.equal(0);
    });

    it('a started transaction with multiple meterValues', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      const timestamp = moment(model.timestamp);
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 1
        }
      ));
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 4
        }
      ));
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 4
        }
      ));
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 4
        }
      ));

      const transaction = new Transaction(model);
      expect(transaction.totalInactivitySecs).to.deep.equal(60);
    });
  });

  describe('test currentConsumption', () => {
    it('without meterValues', () => {
      const transaction = new Transaction(EmptyTransactionFactory.build({}));
      expect(transaction.currentConsumption).to.deep.equal(0);
    });
    it('a started transaction with 1 meterValue', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: moment(model.timestamp).add(1, 'minutes').toDate(),
          value: 1
        }
      ));

      const transaction = new Transaction(model);
      expect(transaction.currentConsumption).to.equal(60);
    });

    it('a started transaction with multiple meterValues', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      const timestamp = moment(model.timestamp);
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 1
        }
      ));
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 4
        }
      ));
      const transaction = new Transaction(model);
      expect(transaction.currentConsumption).to.equal(180);

    });
    it('a stopped transaction with multiple meterValues', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      const timestamp = moment(model.timestamp);
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 1
        }
      ));
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 4
        }
      ));
      const transaction = new Transaction(model);
      transaction.stop(transaction.initiator, transaction.tagID, 11, timestamp.add(1, 'minutes').toDate());
      expect(transaction.currentConsumption).to.equal(0);
    });
  });

  describe('test start transaction', () => {
    it('without meterValues', () => {
      const user = UserFactory.build();
      const tagId = faker.random.alphaNumeric(10);
      const now = new Date();
      const model = {
        id: faker.random.number(100000),
        chargeBoxID: faker.random.alphaNumeric(10),
        connectorId: faker.random.number({min: 0, max: 5})
      };
      const transaction = new Transaction(model);
      transaction.start(user, tagId, 555, now);
      expect(transaction.model).to.deep.equal(
        {
          id: model.id,
          chargeBoxID: model.chargeBoxID,
          connectorId: model.connectorId,
          currentConsumption: 0,
          meterStart: 555,
          timestamp: now,
          totalConsumption: 0,
          user: user,
          userID: user.id,
          tagID: tagId
        }
      );
    });
    it('start multiple times', () => {
      let user = UserFactory.build();
      let tagId = faker.random.alphaNumeric(10);
      let now = new Date();
      const model = {
        id: faker.random.number(100000),
        chargeBoxID: faker.random.alphaNumeric(10),
        connectorId: faker.random.number({min: 0, max: 5})
      };
      const transaction = new Transaction(model);
      transaction.start(user, tagId, 555, now);
      transaction.start(user, tagId, 555, now);
      transaction.start(user, tagId, 555, now);
      expect(transaction.model).to.deep.equal(
        {
          id: model.id,
          chargeBoxID: model.chargeBoxID,
          connectorId: model.connectorId,
          currentConsumption: 0,
          meterStart: 555,
          timestamp: now,
          totalConsumption: 0,
          user: user,
          userID: user.id,
          tagID: tagId
        }
      );
      user = UserFactory.build();
      tagId = faker.random.alphaNumeric(10);
      now = new Date();
      transaction.start(user, tagId, 565, now);
      expect(transaction.model).to.deep.equal(
        {
          id: model.id,
          chargeBoxID: model.chargeBoxID,
          connectorId: model.connectorId,
          currentConsumption: 0,
          meterStart: 565,
          timestamp: now,
          totalConsumption: 0,
          user: user,
          userID: user.id,
          tagID: tagId
        }
      );
    });
    it('start a transaction with meterValues', () => {
      let user = UserFactory.build();
      let tagId = faker.random.alphaNumeric(10);
      let now = new Date();
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: moment(model.timestamp).add(1, 'minutes').toDate(),
          value: 1000
        }
      ));
      const transaction = new Transaction(model);
      transaction.start(user, tagId, 555, now);
      expect(transaction.model).to.deep.equal(
        {
          id: model.id,
          chargeBoxID: model.chargeBoxID,
          connectorId: model.connectorId,
          currentConsumption: 26700,
          meterStart: 555,
          timestamp: now,
          totalConsumption: 445,
          user: user,
          userID: user.id,
          tagID: tagId
        }
      );
    });
  });

  describe('test get model', () => {
    it('without meterValues', () => {
      const user = UserFactory.build();
      const now = new Date();
      const tagId = faker.random.alphaNumeric(10);
      const model = {
        id: faker.random.number(100000),
        chargeBoxID: faker.random.alphaNumeric(10),
        connectorId: faker.random.number({min: 0, max: 5})
      };
      const transaction = new Transaction(model);
      transaction.start(user, tagId, 555, now);
      expect(transaction.model).to.deep.equal(
        {
          id: model.id,
          chargeBoxID: model.chargeBoxID,
          connectorId: model.connectorId,
          currentConsumption: 0,
          meterStart: 555,
          timestamp: now,
          totalConsumption: 0,
          user: user,
          userID: user.id,
          tagID: tagId

        }
      );
    });
    it('a started transaction with 1 meterValue', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: moment(model.timestamp).add(1, 'minutes').toDate(),
          value: 1
        }
      ));

      const transaction = new Transaction(model);
      expect(transaction.model).to.deep.equal(
        {
          id: model.id,
          chargeBoxID: model.chargeBoxID,
          connectorId: model.connectorId,
          currentConsumption: 60,
          meterStart: model.meterStart,
          timestamp: model.timestamp,
          totalConsumption: 1,
          user: model.user,
          userID: model.user.id,
          tagID: model.tagID
        }
      );
    });

    it('a started transaction with multiple meterValues', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      const timestamp = moment(model.timestamp);
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 1
        }
      ));
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 4
        }
      ));
      const transaction = new Transaction(model);
      expect(transaction.model).to.deep.equal(
        {
          id: model.id,
          chargeBoxID: model.chargeBoxID,
          connectorId: model.connectorId,
          currentConsumption: 180,
          meterStart: model.meterStart,
          timestamp: model.timestamp,
          totalConsumption: 4,
          user: model.user,
          userID: model.user.id,
          tagID: model.tagID
        }
      );
    });
    it('a stopped transaction with multiple meterValues', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      const timestamp = moment(model.timestamp);
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 1
        }
      ));
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 4
        }
      ));
      const transaction = new Transaction(model);
      transaction.stop(transaction.initiator, transaction.tagID, 11, timestamp.add(1, 'minutes').toDate());
      expect(transaction.model).to.deep.equal(
        {
          id: model.id,
          chargeBoxID: model.chargeBoxID,
          connectorId: model.connectorId,
          currentConsumption: 0,
          meterStart: model.meterStart,
          meterStop: 11,
          timestamp: model.timestamp,
          totalConsumption: 11,
          totalDurationInSecs: 180,
          user: model.user,
          userID: model.user.id,
          tagID: model.tagID,
          stop: {
            meterStop: 11,
            timestamp: timestamp.toDate(),
            totalConsumption: 11,
            totalInactivitySecs: 0,
            user: model.user,
            userID: model.user.id,
            tagID: model.tagID,
          }
        }
      );
    });
  });

  describe('test totalDurationInSecs', () => {
    it('test on stopped transaction', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      const timestamp = moment(model.timestamp);
      const transaction = new Transaction(model);
      transaction.stop(transaction.initiator, transaction.tagID, 11, timestamp.add(1, 'minutes').toDate());
      expect(transaction.totalDurationInSecs).to.equal(60);
    });
    it('test on active transaction', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      const transaction = new Transaction(model);
      expect(transaction.totalDurationInSecs).to.equal(undefined);
    });
  });

});