const moment = require('moment');
const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
const Transaction = require('../../src/entity/Transaction');
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
    measurand: 'Energy.Active.Import.Register',
    format: 'Raw',
    context: 'Sample.Periodic'
  })
  .attr('timestamp', new Date());

const SoCValueFactory = Factory.define('soc-meterValue').extend('meterValue').attr('attribute', {
  measurand: 'SoC',
  format: 'Raw',
  context: 'Sample.Periodic'
});

describe('Transaction entity tests', () => {

  it('Should be an active transaction', () => {
    const transaction = new Transaction("1234", {});
    expect(transaction.isActive()).to.equal(true);
  });
  it('Should not be an active transaction', () => {
    const transaction = new Transaction("1234", {stop: {att: null}});
    expect(transaction.isActive()).to.equal(false);
  });
  describe('test hasStateOfCharges', () => {
    it('without stateOfCharges', () => {
      const transaction = new Transaction("1234", EmptyTransactionFactory.build());
      expect(transaction.hasStateOfCharges()).to.equal(false);
    });
    it('with meterValues but withtout stateOfCharges', () => {
      const transaction = new Transaction("1234", TransactionFactory.build());
      expect(transaction.hasStateOfCharges()).to.equal(false);
    });
    it('with stateOfCharges', () => {
      const socAtStart = SoCValueFactory.build();
      const model = EmptyTransactionFactory.build();
      model.meterValues = [];
      model.meterValues.push(socAtStart);
      const transaction = new Transaction("1234", model);
      expect(transaction.hasStateOfCharges()).to.equal(true);
    });
  });
  describe('test stateOfCharge', () => {
    it('without state', () => {
      const model = EmptyTransactionFactory.build();
      model.meterValues = [];
      const transaction = new Transaction("1234", model);
      expect(transaction.getStateOfCharge()).to.not.be.an('object');
    });
    it('with state', () => {
      const socAtStart = SoCValueFactory.build();
      const model = EmptyTransactionFactory.build();
      model.meterValues = [];
      model.meterValues.push(socAtStart);
      const transaction = new Transaction("1234", model);
      expect(transaction.getStateOfCharge()).to.equal(socAtStart.value);
    });
  });
  describe('test _hasMeterValues', () => {
    it('without meterValues', () => {
      const transaction = new Transaction("1234", EmptyTransactionFactory.build());
      expect(transaction._hasMeterValues()).to.equal(false);
    });
    it('with meterValues', () => {
      const transaction = new Transaction("1234", TransactionFactory.build());
      expect(transaction._hasMeterValues()).to.equal(true);
    });
  });
  describe('test _firstMeterValue', () => {
    it('without meterValues', () => {
      const transaction = new Transaction("1234", EmptyTransactionFactory.build({meterStart: 10}));
      expect(transaction._getFirstMeterValue()).to.deep.equal(
        {
          attribute: {
            context: 'Sample.Periodic',
            format: 'Raw',
            location: 'Outlet',
            measurand: 'Energy.Active.Import.Register',
            unit: 'Wh'
          },
          id: '666',
          connectorId: transaction.getConnectorId(),
          timestamp: transaction.getStartDate(),
          transactionId: transaction.getID(),
          value: 10
        }
      );
    });
    it('with meterValues', () => {
      const transaction = new Transaction("1234", TransactionFactory.build({meterStart: 10}));
      expect(transaction._getFirstMeterValue()).to.containSubset(
        {
          attribute: {
            context: 'Sample.Periodic',
            format: 'Raw',
            location: 'Outlet',
            unit: 'Wh'
          },
          id: '666',
          connectorId: transaction.getConnectorId(),
          timestamp: transaction.getStartDate(),
          transactionId: transaction.getID(),
          value: 10
        }
      );
    });
  });

  describe('test _lastMeterValue', () => {
    it('without meterValues', () => {
      const transaction = new Transaction("1234", EmptyTransactionFactory.build({
        stop: {meterStop: 10, timestamp: new Date()}
      }));
      expect(transaction._getLastMeterValue()).to.deep.equal(
        {
          attribute: {
            context: 'Sample.Periodic',
            format: 'Raw',
            location: 'Outlet',
            measurand: 'Energy.Active.Import.Register',
            unit: 'Wh'
          },
          id: '6969',
          connectorId: transaction.getConnectorId(),
          timestamp: transaction.getEndDate(),
          transactionId: transaction.getID(),
          value: 10
        }
      );
    });
    it('with meterValues', () => {
      const transaction = new Transaction("1234", TransactionFactory.build({
        stop: {
          meterStop: 10,
          timestamp: new Date()
        }
      }));
      expect(transaction._getLastMeterValue()).to.containSubset(
        {
          attribute: {
            context: 'Sample.Periodic',
            format: 'Raw',
            location: 'Outlet',
            unit: 'Wh'
          },
          id: '6969',
          connectorId: transaction.getConnectorId(),
          timestamp: transaction.getEndDate(),
          transactionId: transaction.getID(),
          value: 10
        }
      );
    });
  });

  describe('test consumption computation', () => {
    it('without meterValues', () => {
      const transaction = new Transaction("1234", EmptyTransactionFactory.build({}));
      expect(transaction.getConsumptions()).to.deep.equal([]);
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

      const transaction = new Transaction("1234", model);
      expect(transaction.getConsumptions()).to.deep.equal(
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

      const transaction = new Transaction("1234", model);
      expect(transaction.getConsumptions()).to.deep.equal(
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

      const transaction = new Transaction("1234", model);
      expect(transaction.getConsumptions()).to.deep.equal(
        [
          {
            cumulated: 200,
            date: model.meterValues[0].timestamp,
            value: 200
          },
          {
            cumulated: 250,
            date: model.meterValues[1].timestamp,
            value: 50 * 60
          },
          {
            cumulated: 350,
            date: model.meterValues[2].timestamp,
            value: 100 * 60
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

      const transaction = new Transaction("1234", model);
      expect(transaction.getConsumptions()).to.deep.equal(
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

      const transaction = new Transaction("1234", model);
      transaction.stopTransaction(transaction.getUser(), transaction.getTagID(), 11, timestamp.add(1, 'minutes').toDate());
      expect(transaction.getConsumptions()).to.deep.equal(
        [
          {
            cumulated: 1,
            date: transaction.getMeterValues()[1].timestamp,
            value: 60
          },
          {
            cumulated: 4,
            date: transaction.getMeterValues()[2].timestamp,
            value: 180
          },
          {
            cumulated: 10,
            date: transaction.getMeterValues()[3].timestamp,
            value: 360
          },
          {
            cumulated: 11,
            date: transaction.getMeterValues()[4].timestamp,
            value: 60
          }
        ]
      );
    });

    it('a stopped transaction with multiple meterValues and some reset do 0', () => {
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
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 0
        }
      ));
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 0
        }
      ));

      const transaction = new Transaction("1234", model);
      transaction.stopTransaction(transaction.getUser(), transaction.getTagID(), 0, timestamp.add(1, 'minutes').toDate());
      expect(transaction.getConsumptions()).to.deep.equal(
        [
          {
            cumulated: 1,
            date: transaction.getMeterValues()[1].timestamp,
            value: 60
          },
          {
            cumulated: 4,
            date: transaction.getMeterValues()[2].timestamp,
            value: 180
          },
          {
            cumulated: 10,
            date: transaction.getMeterValues()[3].timestamp,
            value: 360
          },
          {
            cumulated: 10,
            date: transaction.getMeterValues()[4].timestamp,
            value: 0
          },
          {
            cumulated: 10,
            date: transaction.getMeterValues()[5].timestamp,
            value: 0
          },
          {
            cumulated: 10,
            date: transaction.getMeterValues()[6].timestamp,
            value: 0
          }
        ]
      );
    });
    it('a stopped transaction with multiple meterValues and a reset of the meter value in between', () => {
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
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 0
        }
      ));
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 5
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
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: timestamp.add(1, 'minutes').toDate(),
          value: 2
        }
      ));

      const transaction = new Transaction("1234", model);
      transaction.stopTransaction(transaction.getUser(), transaction.getTagID(), 4, timestamp.add(1, 'minutes').toDate());
      let i = 1;
      expect(transaction.getConsumptions()).to.deep.equal(
        [
          {
            cumulated: 1,
            date: transaction.getMeterValues()[i++].timestamp,
            value: 60
          },
          {
            cumulated: 4,
            date: transaction.getMeterValues()[i++].timestamp,
            value: 180
          },
          {
            cumulated: 10,
            date: transaction.getMeterValues()[i++].timestamp,
            value: 360
          },
          {
            cumulated: 10,
            date: transaction.getMeterValues()[i++].timestamp,
            value: 0
          },
          {
            cumulated: 15,
            date: transaction.getMeterValues()[i++].timestamp,
            value: 300
          },
          {
            cumulated: 20,
            date: transaction.getMeterValues()[i++].timestamp,
            value: 300
          },
          {
            cumulated: 22,
            date: transaction.getMeterValues()[i++].timestamp,
            value: 120
          },
          {
            cumulated: 24,
            date: transaction.getMeterValues()[i++].timestamp,
            value: 120
          }
        ]
      );
    });
  });

  describe('test consumption computation', () => {
    it('without meterValues with pricing', () => {
      const transaction = new Transaction("1234", EmptyTransactionFactory.build({pricing: {priceKWH: 1.5}}));
      expect(transaction.getPrice()).to.equal(0);
    });
    it('a started transaction with 1 meterValue at 60wh with pricing', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0, pricing: {priceKWH: 1.5}});
      model.meterValues = [];
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: moment(model.timestamp).add(1, 'minutes').toDate(),
          value: 1
        }
      ));

      const transaction = new Transaction("1234", model);
      expect(transaction.getConsumptions()).to.deep.equal(
        [{
          cumulated: 1,
          date: model.meterValues[0].timestamp,
          value: 60,
          price: 0.0015
        }]
      );

      expect(transaction.getPrice()).to.equal(0.0015);
    });

    it('a started transaction with 1 meterValue at 30wh with pricing', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0, pricing: {priceKWH: 1.5}});
      model.meterValues = [];
      model.meterValues.push(MeterValueFactory.build(
        {
          transactionId: model.id,
          connectorId: model.connectorId,
          timestamp: moment(model.timestamp).add(2, 'minutes').toDate(),
          value: 1
        }
      ));

      const transaction = new Transaction("1234", model);
      expect(transaction.getConsumptions()).to.deep.equal(
        [{
          cumulated: 1,
          date: model.meterValues[0].timestamp,
          value: 30,
          price: 0.0015
        }]
      );

      expect(transaction.getPrice()).to.equal(0.0015);
    });

    it('a started transaction with multiple meterValues with pricing', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0, pricing: {priceKWH: 1.5}});
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

      const transaction = new Transaction("1234", model);
      expect(transaction.getConsumptions()).to.deep.equal(
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
            price: 0.0045
          },
          {
            cumulated: 10,
            date: model.meterValues[2].timestamp,
            value: 360,
            price: 0.009
          }
        ]
      );
      expect(transaction.getPrice()).to.equal(0.015);
    });
    it('a stopped transaction with multiple meterValues with pricing', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0, pricing: {priceKWH: 1.5}});
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

      const transaction = new Transaction("1234", model);
      transaction.stopTransaction(transaction.getUser(), transaction.getTagID(), 11, timestamp.add(1, 'minutes').toDate());
      expect(transaction.getConsumptions()).to.deep.equal(
        [
          {
            cumulated: 1,
            date: transaction.getMeterValues()[1].timestamp,
            value: 60,
            price: 0.0015
          },
          {
            cumulated: 4,
            date: transaction.getMeterValues()[2].timestamp,
            value: 180,
            price: 0.0045
          },
          {
            cumulated: 10,
            date: transaction.getMeterValues()[3].timestamp,
            value: 360,
            price: 0.009
          },
          {
            cumulated: 11,
            date: transaction.getMeterValues()[4].timestamp,
            value: 60,
            price: 0.0015
          }
        ]
      );
      expect(transaction.getPrice()).to.equal(0.0165);
    });
  });

  describe('test totalInactivitySecs', () => {
    it('without meterValues', () => {
      const transaction = new Transaction("1234", EmptyTransactionFactory.build({}));
      expect(transaction.getTotalInactivitySecs()).to.deep.equal(0);
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

      const transaction = new Transaction("1234", model);
      expect(transaction.getTotalInactivitySecs()).to.equal(0);
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

      const transaction = new Transaction("1234", model);
      expect(transaction.getTotalInactivitySecs()).to.deep.equal(60);
    });
  });

  describe('test currentConsumption', () => {
    it('without meterValues', () => {
      const transaction = new Transaction("1234", EmptyTransactionFactory.build({}));
      expect(transaction.getCurrentConsumption()).to.deep.equal(0);
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

      const transaction = new Transaction("1234", model);
      expect(transaction.getCurrentConsumption()).to.equal(60);
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
      const transaction = new Transaction("1234", model);
      expect(transaction.getCurrentConsumption()).to.equal(180);

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
      const transaction = new Transaction("1234", model);
      transaction.stopTransaction(transaction.getUser(), transaction.getTagID(), 11, timestamp.add(1, 'minutes').toDate());
      expect(transaction.getCurrentConsumption()).to.equal(0);
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
      const transaction = new Transaction("1234", model);
      transaction.startTransaction(user, tagId, 555, now);
      expect(transaction.getModel()).to.deep.equal(
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
      const transaction = new Transaction("1234", model);
      transaction.startTransaction(user, tagId, 555, now);
      transaction.startTransaction(user, tagId, 555, now);
      transaction.startTransaction(user, tagId, 555, now);
      expect(transaction.getModel()).to.deep.equal(
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
      transaction.startTransaction(user, tagId, 565, now);
      expect(transaction.getModel()).to.deep.equal(
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
      const transaction = new Transaction("1234", model);
      transaction.startTransaction(user, tagId, 555, now);
      expect(transaction.getModel()).to.deep.equal(
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
      const transaction = new Transaction("1234", model);
      transaction.startTransaction(user, tagId, 555, now);
      expect(transaction.getModel()).to.deep.equal(
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

      const transaction = new Transaction("1234", model);
      expect(transaction.getModel()).to.deep.equal(
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
      const transaction = new Transaction("1234", model);
      expect(transaction.getModel()).to.deep.equal(
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
      const transaction = new Transaction("1234", model);
      transaction.stopTransaction(transaction.getUser(), transaction.getTagID(), 11, timestamp.add(1, 'minutes').toDate());
      expect(transaction.getModel()).to.deep.equal(
        {
          id: model.id,
          chargeBoxID: model.chargeBoxID,
          connectorId: model.connectorId,
          meterStart: model.meterStart,
          timestamp: model.timestamp,
          user: model.user,
          userID: model.user.id,
          tagID: model.tagID,
          stop: {
            meterStop: 11,
            totalConsumption: 11,
            totalDurationSecs: 180,
            totalInactivitySecs: 0,
            timestamp: timestamp.toDate(),
            user: model.user,
            userID: model.user.id,
            tagID: model.tagID,
          }
        }
      );
    });
  });

  describe('test totalDurationSecs', () => {
    it('test on stopped transaction', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      const timestamp = moment(model.timestamp);
      const transaction = new Transaction("1234", model);
      transaction.stopTransaction(transaction.getUser(), transaction.getTagID(), 11, timestamp.add(1, 'minutes').toDate());
      expect(transaction.getTotalDurationSecs()).to.equal(60);
    });
    it('test on active transaction', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0});
      model.meterValues = [];
      const transaction = new Transaction("1234", model);
      expect(transaction.getTotalDurationSecs()).to.equal(0);
    });
  });
  describe('test prices', () => {
    it('test on stopped transaction with price and meter values', () => {
      const model = EmptyTransactionFactory.build({meterStart: 0, pricing: {priceKWH: 1.5, priceUnit: 'EUR'}});
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
      const transaction = new Transaction("1234", model);
      transaction.stopTransaction(transaction.getUser(), transaction.getTagID(), 11, timestamp.add(1, 'minutes').toDate());
      expect(transaction.getModel()).to.deep.equal(
        {
          id: model.id,
          chargeBoxID: model.chargeBoxID,
          connectorId: model.connectorId,
          meterStart: model.meterStart,
          timestamp: model.timestamp,
          price: 11 / 1000 * 1.5,
          priceUnit: 'EUR',
          user: model.user,
          userID: model.user.id,
          tagID: model.tagID,
          stop: {
            meterStop: 11,
            totalConsumption: 11,
            totalDurationSecs: 180,
            totalInactivitySecs: 0,
            timestamp: timestamp.toDate(),
            user: model.user,
            userID: model.user.id,
            tagID: model.tagID,
          }
        }
      );
      expect(transaction.getConsumptions()).to.containSubset(
        [
          {
            cumulated: 1,
            price: 1 / 1000 * 1.5,
            value: 60
          },
          {
            cumulated: 4,
            price: +(3 / 1000 * 1.5).toFixed(6),
            value: 180
          },
          {
            cumulated: 11,
            price: 7 / 1000 * 1.5,
            value: 420
          }
        ]
      );
    });
  });
});