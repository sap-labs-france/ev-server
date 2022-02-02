/* eslint-disable max-len */
import AsyncTask, { AsyncTaskStatus } from '../../src/types/AsyncTask';
import { BillingDataTransactionStop, BillingInvoice, BillingInvoiceStatus, BillingStatus, BillingUser } from '../../src/types/Billing';
import { BillingSettings, BillingSettingsType, SettingDB } from '../../src/types/Setting';
import { ChargePointErrorCode, ChargePointStatus, OCPPStatusNotificationRequest } from '../../src/types/ocpp/OCPPServer';
import ChargingStation, { ConnectorType } from '../../src/types/ChargingStation';
import PricingDefinition, { DayOfWeek, PricingDimension, PricingDimensions, PricingEntity, PricingRestriction } from '../../src/types/Pricing';
import chai, { assert, expect } from 'chai';

import AsyncTaskStorage from '../../src/storage/mongodb/AsyncTaskStorage';
import CentralServerService from './client/CentralServerService';
import ChargingStationContext from './context/ChargingStationContext';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Cypher from '../../src/utils/Cypher';
import { DataResult } from '../../src/types/DataResult';
import Decimal from 'decimal.js';
import LoggingStorage from '../../src/storage/mongodb/LoggingStorage';
import OCPPService from '../../src/server/ocpp/services/OCPPService';
import OCPPUtils from '../../src/server/ocpp/utils/OCPPUtils';
import SiteAreaContext from './context/SiteAreaContext';
import SiteContext from './context/SiteContext';
import { StatusCodes } from 'http-status-codes';
import Stripe from 'stripe';
import StripeBillingIntegration from '../../src/integration/billing/stripe/StripeBillingIntegration';
import { TenantComponents } from '../../src/types/Tenant';
import TenantContext from './context/TenantContext';
import TestConstants from './client/utils/TestConstants';
import TestUtils from './TestUtils';
import { TransactionAction } from '../../src/types/Transaction';
import TransactionStorage from '../../src/storage/mongodb/TransactionStorage';
import User from '../../src/types/User';
import Utils from '../../src/utils/Utils';
import chaiSubset from 'chai-subset';
import config from '../config';
import moment from 'moment';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

export default class BillingTestHelper {
  // Tenant: utbilling
  public tenantContext: TenantContext;
  // User Service for action requiring admin permissions (e.g.: set/reset stripe settings)
  public adminUserContext: User;
  public adminUserService: CentralServerService;
  // User Service for common actions
  public userContext: User;
  public userService: CentralServerService;
  // Other test resources
  public siteContext: SiteContext;
  public siteAreaContext: SiteAreaContext;
  public chargingStationContext: ChargingStationContext;
  public createdUsers: User[] = [];
  // Dynamic User for testing billing against an empty STRIPE account
  // Billing Implementation - STRIPE?
  public billingImpl: StripeBillingIntegration;
  public billingUser: BillingUser; // DO NOT CONFUSE - BillingUser is not a User!

  public async initialize() : Promise<void> {
    this.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING);
    this.adminUserContext = this.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
    this.adminUserService = new CentralServerService(
      this.tenantContext.getTenant().subdomain,
      this.adminUserContext
    );
  }

  public async assignPaymentMethod(user: BillingUser, stripe_test_token: string) : Promise<Stripe.CustomerSource> {
    // Assign a source using test tokens (instead of test card numbers)
    // c.f.: https://stripe.com/docs/testing#cards
    const concreteImplementation : StripeBillingIntegration = this.billingImpl ;
    const stripeInstance = await concreteImplementation.getStripeInstance();
    const customerID = user.billingData?.customerID;
    assert(customerID, 'customerID should not be null');
    // TODO - rethink that part - the concrete billing implementation should be called instead
    const source = await stripeInstance.customers.createSource(customerID, {
      source: stripe_test_token // e.g.: tok_visa, tok_amex, tok_fr
    });
    assert(source, 'Source should not be null');
    // TODO - rethink that part - the concrete billing implementation should be called instead
    const customer = await stripeInstance.customers.update(customerID, {
      default_source: source.id
    });
    assert(customer, 'Customer should not be null');
    return source;
  }

  public initUserContextAsAdmin() : void {
    expect(this.userContext).to.not.be.null;
    this.userContext = this.adminUserContext;
    assert(this.userContext, 'User context cannot be null');
    this.userService = this.adminUserService;
    assert(!!this.userService, 'User service cannot be null');
  }

  public async initChargingStationContext() : Promise<ChargingStationContext> {
    this.siteContext = this.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION);
    this.siteAreaContext = this.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);
    this.chargingStationContext = this.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
    assert(!!this.chargingStationContext, 'Charging station context should not be null');
    // -------------------------------------------------
    // No pricing definition here!
    // -------------------------------------------------
    // await this.createTariff4ChargingStation(this.chargingStationContext.getChargingStation());
    return Promise.resolve(this.chargingStationContext);
  }

  public async initChargingStationContext2TestChargingTime() : Promise<ChargingStationContext> {
    this.siteContext = this.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
    this.siteAreaContext = this.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_THREE_PHASED);
    this.chargingStationContext = this.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16 + '-' + ContextDefinition.SITE_CONTEXTS.SITE_BASIC + '-' + ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_THREE_PHASED + '-singlePhased');
    assert(!!this.chargingStationContext, 'Charging station context should not be null');
    const dimensions = {
      flatFee: {
        price: 1,
        active: true
      },
      chargingTime: {
        price: 0.4,
        active: true
      }
    };
    await this.createTariff4ChargingStation('FF+CT', this.chargingStationContext.getChargingStation(), new Date(), dimensions);
    return this.chargingStationContext;
  }

  public async initChargingStationContext2TestCS3Phased(testMode = 'FF+E') : Promise<ChargingStationContext> {
    this.siteContext = this.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
    this.siteAreaContext = this.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_THREE_PHASED);
    this.chargingStationContext = this.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16 + '-' + ContextDefinition.SITE_CONTEXTS.SITE_BASIC + '-' + ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_THREE_PHASED);
    assert(!!this.chargingStationContext, 'Charging station context should not be null');
    let dimensions: PricingDimensions;
    if (testMode === 'FF+E(STEP)') {
      dimensions = {
        flatFee: {
          price: 2,
          active: true
        },
        energy: {
          price: 0.25, // 25 cents per kWh
          stepSize: 5000, // Step Size - 5 kWh
          active: true
        }
      };
    } else {
      dimensions = {
        flatFee: {
          price: 2,
          active: true
        },
        energy: {
          price: 0.25,
          active: true
        },
        chargingTime: {
          price: 777, // THIS IS OFF
          active: false
        }
      };
    }
    await this.createTariff4ChargingStation(testMode, this.chargingStationContext.getChargingStation(), new Date(), dimensions);
    return this.chargingStationContext;
  }

  public async initChargingStationContext2TestFastCharger(testMode = 'E', expectedStartDate = new Date()) : Promise<ChargingStationContext> {
    this.siteContext = this.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
    this.siteAreaContext = this.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_DC);
    this.chargingStationContext = this.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16 + '-' + ContextDefinition.SITE_CONTEXTS.SITE_BASIC + '-' + ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_DC);
    assert(!!this.chargingStationContext, 'Charging station context should not be null');

    let dimensions: PricingDimensions;
    let restrictions: PricingRestriction;
    if (testMode === 'FF+CT+PT') {
      dimensions = {
        flatFee: {
          price: 1, // Euro
          active: true
        },
        chargingTime: {
          price: 5, // Euro per hour
          active: true
        },
        parkingTime: {
          price: 10, // Euro per hour
          active: true
        }
      };
    } else if (testMode === 'CT(STEP)+PT(STEP)') {
      dimensions = {
        chargingTime: {
          price: 12, // Euro per hour
          stepSize: 300, // 300 seconds == 5 minutes
          active: true
        },
        parkingTime: {
          price: 20, // Euro per hour
          stepSize: 3 * 60, // 3 minutes
          active: true
        }
      };
    } else if (testMode === 'E+PT(STEP)') {
      dimensions = {
        energy: {
          price: 0.50,
          active: true
        },
        parkingTime: {
          price: 20, // Euro per hour
          stepSize: 120, // 120 seconds == 2 minutes
          active: true
        }
      };
    } else if (testMode === 'E-After30mins+PT') {
      // Create a second tariff with a different pricing strategy
      dimensions = {
        energy: {
          price: 0.70,
          active: true
        },
        parkingTime: {
          price: 20, // Euro per hour
          active: true
        }
      };
      restrictions = {
        minDurationSecs: 30 * 60 // Apply this tariff after 30 minutes
      };
    } else if (testMode === 'FF+E(STEP)-MainTariff') {
      dimensions = {
        flatFee: {
          price: 2,
          active: true
        },
        energy: {
          price: 1, // 25 cents per kWh
          stepSize: 3000, // Step Size - 3kWh
          active: true
        }
      };
    } else if (testMode === 'E(STEP)-After30mins') {
      // Create a second tariff with a different pricing strategy
      dimensions = {
        energy: {
          price: 0.5,
          stepSize: 4000, // Step Size - 4kWh
          active: true
        }
      };
      restrictions = {
        minDurationSecs: 30 * 60 // Apply this tariff after 30 minutes
      };
    } else if (testMode === 'FF+E') {
      dimensions = {
        flatFee: {
          price: 1.5, // Euro
          active: true
        },
        energy: {
          price: 0.50,
          active: true
        }
      };
    } else {
      dimensions = {
        energy: {
          price: 0.50,
          active: true
        }
      };
    }
    await this.createTariff4ChargingStation(testMode, this.chargingStationContext.getChargingStation(), expectedStartDate, dimensions, ConnectorType.COMBO_CCS, restrictions);
    return this.chargingStationContext;
  }

  public async initChargingStationContext2TestDaysOfTheWeek(testMode = 'E') : Promise<ChargingStationContext> {
    // Charging Station Context
    this.siteContext = this.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
    this.siteAreaContext = this.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_DC);
    this.chargingStationContext = this.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16 + '-' + ContextDefinition.SITE_CONTEXTS.SITE_BASIC + '-' + ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_DC);
    assert(!!this.chargingStationContext, 'Charging station context should not be null');
    // Take into account the Charging Station location and its timezone
    const timezone = Utils.getTimezone(this.chargingStationContext.getChargingStation().coordinates);
    let dimensions: PricingDimensions;
    let restrictions: PricingRestriction;
    if (testMode === 'TODAY') {
      dimensions = {
        flatFee: {
          price: 1.5, // Euro
          active: true
        },
        energy: {
          price: 1,
          active: true
        }
      };
      restrictions = {
        daysOfWeek: [ moment().tz(timezone).isoWeekday() ] // Sets today as the only day allowed for this pricing definition
      };
    } else { // 'OTHER_DAYS')
      dimensions = {
        flatFee: {
          price: 666, // Euro
          active: true
        },
        energy: {
          price: 666,
          active: true
        }
      };
      restrictions = {
        // Sets all other days as the days allowed for this pricing definition
        daysOfWeek: [ DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY, DayOfWeek.SUNDAY ].filter((day) => day !== moment().tz(timezone).isoWeekday())
      };
    }
    await this.createTariff4ChargingStation(testMode, this.chargingStationContext.getChargingStation(), new Date(), dimensions, ConnectorType.COMBO_CCS, restrictions);
    return this.chargingStationContext;
  }

  public async initChargingStationContext2TestTimeRestrictions(testMode = 'E', aParticularMoment: moment.Moment) : Promise<ChargingStationContext> {
    // Charging Station Context
    this.siteContext = this.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
    this.siteAreaContext = this.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_DC);
    this.chargingStationContext = this.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16 + '-' + ContextDefinition.SITE_CONTEXTS.SITE_BASIC + '-' + ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_DC);
    assert(!!this.chargingStationContext, 'Charging station context should not be null');
    // Take into account the Charging Station location and its timezone
    const timezone = Utils.getTimezone(this.chargingStationContext.getChargingStation().coordinates);
    // The moment has to be cloned to have stable tests results!
    const atThatMoment = aParticularMoment.clone().tz(timezone);
    // Let's create a pricing definition
    let dimensions: PricingDimensions;
    let restrictions: PricingRestriction;
    if (testMode === 'FROM_23:59') {
      dimensions = {
        energy: {
          price: 0.50,
          active: true
        }
      };
      restrictions = {
        daysOfWeek: [ atThatMoment.isoWeekday() ], // Sets today as the only day allowed for this pricing definition
        timeFrom: '23:59', // Specific test to check the behavior when timeFrom is lower than timeTo
        timeTo: atThatMoment.add(60 + 30, 'minutes').format('HH:mm'), // Validity for the whole session
      };
    } else if (testMode === 'FOR_HALF_AN_HOUR') {
      dimensions = {
        energy: {
          price: 3,
          active: true
        }
      };
      restrictions = {
        daysOfWeek: [ atThatMoment.isoWeekday() ], // Sets today as the only day allowed for this pricing definition
        timeFrom: atThatMoment.format('HH:mm'), // From this hour
        timeTo: atThatMoment.add(30, 'minutes').format('HH:mm'), // Validity for half an hour
      };
    } else if (testMode === 'NEXT_HOUR') {
      dimensions = {
        chargingTime: {
          price: 30, // Euro per hour
          active: true
        },
      };
      restrictions = {
        daysOfWeek: [ atThatMoment.isoWeekday() ], // Sets today as the only day allowed for this pricing definition
        timeFrom: atThatMoment.add(30, 'minutes').format('HH:mm'), // Valid in half an hour
        timeTo: atThatMoment.add(30 + 60, 'minutes').format('HH:mm'), // for one hour
      };
    } else { /* if (testMode === 'OTHER_HOURS') */
      dimensions = {
        flatFee: {
          price: 0,
          active: true
        },
        energy: {
          price: 666, // Weird value used to detect inconsistent pricing context resolution
          active: true
        },
        chargingTime: {
          price: 666, // Weird value used to detect inconsistent pricing context resolution
          active: true
        },
      };
      restrictions = {
        daysOfWeek: [ atThatMoment.isoWeekday() ], // Sets today as the only day allowed for this pricing definition
      };
    }
    await this.createTariff4ChargingStation(testMode, this.chargingStationContext.getChargingStation(), new Date(), dimensions, ConnectorType.COMBO_CCS, restrictions);
    return this.chargingStationContext;
  }

  public async setBillingSystemValidCredentials(activateTransactionBilling = true, immediateBillingAllowed = false) : Promise<StripeBillingIntegration> {
    const billingSettings = this.getLocalSettings(immediateBillingAllowed);
    // Here we switch ON or OFF the billing of charging sessions
    billingSettings.billing.isTransactionBillingActivated = activateTransactionBilling;
    // Invoke the generic setting service API to properly persist this information
    await this.saveBillingSettings(billingSettings);
    const tenant = this.tenantContext?.getTenant();
    assert(!!tenant, 'Tenant cannot be null');
    billingSettings.stripe.secretKey = await Cypher.encrypt(tenant, billingSettings.stripe.secretKey);
    const billingImpl = StripeBillingIntegration.getInstance(tenant, billingSettings);
    assert(billingImpl, 'Billing implementation should not be null');
    return billingImpl;
  }

  public async setBillingSystemInvalidCredentials() : Promise<StripeBillingIntegration> {
    const billingSettings = this.getLocalSettings(false);
    const tenant = this.tenantContext?.getTenant();
    assert(!!tenant, 'Tenant cannot be null');
    billingSettings.stripe.secretKey = await Cypher.encrypt(tenant, 'sk_test_' + 'invalid_credentials');
    await this.saveBillingSettings(billingSettings);
    const billingImpl = StripeBillingIntegration.getInstance(tenant, billingSettings);
    assert(billingImpl, 'Billing implementation should not be null');
    return billingImpl;
  }

  public getLocalSettings(immediateBillingAllowed: boolean): BillingSettings {
    // ---------------------------------------------------------------------
    // ACHTUNG: Our test may need the immediate billing to be switched off!
    // Because we want to check the DRAFT state of the invoice
    // ---------------------------------------------------------------------
    const billingProperties = {
      isTransactionBillingActivated: true, // config.get('billing.isTransactionBillingActivated'),
      immediateBillingAllowed: immediateBillingAllowed, // config.get('billing.immediateBillingAllowed'),
      periodicBillingAllowed: !immediateBillingAllowed, // config.get('billing.periodicBillingAllowed'),
      taxID: config.get('billing.taxID')
    };
    const stripeProperties = {
      url: config.get('stripe.url'),
      publicKey: config.get('stripe.publicKey'),
      secretKey: config.get('stripe.secretKey'),
    };
    const settings: BillingSettings = {
      identifier: TenantComponents.BILLING,
      type: BillingSettingsType.STRIPE,
      billing: billingProperties,
      stripe: stripeProperties,
    };
    return settings;
  }

  public async saveBillingSettings(billingSettings: BillingSettings) : Promise<void> {
    // TODO - rethink that part
    const tenantBillingSettings = await this.adminUserService.settingApi.readByIdentifier({ 'Identifier': 'billing' });
    expect(tenantBillingSettings.data).to.not.be.null;
    const componentSetting: SettingDB = tenantBillingSettings.data;
    componentSetting.content.type = BillingSettingsType.STRIPE;
    componentSetting.content.billing = billingSettings.billing;
    componentSetting.content.stripe = billingSettings.stripe;
    componentSetting.sensitiveData = ['content.stripe.secretKey'];
    await this.adminUserService.settingApi.update(componentSetting);
  }

  public async checkTransactionBillingData(transactionId: number, expectedInvoiceStatus: BillingInvoiceStatus, expectedPrice: number = null) : Promise<void> {
    // Check the transaction status
    const transactionResponse = await this.adminUserService.transactionApi.readById(transactionId);
    expect(transactionResponse.status).to.equal(StatusCodes.OK);
    assert(transactionResponse.data?.billingData, 'Billing Data should be set');
    const billingDataStop: BillingDataTransactionStop = transactionResponse.data.billingData.stop;
    expect(billingDataStop?.status).to.equal(BillingStatus.BILLED);
    assert(billingDataStop?.invoiceID, 'Invoice ID should be set');
    assert(billingDataStop?.invoiceStatus === expectedInvoiceStatus, `The invoice status should be ${expectedInvoiceStatus}`);
    if (expectedInvoiceStatus !== BillingInvoiceStatus.DRAFT) {
      assert(billingDataStop?.invoiceNumber, 'Invoice Number should be set');
    } else {
      assert(billingDataStop?.invoiceNumber === null, `Invoice Number should not yet been set - Invoice Number is: ${billingDataStop?.invoiceNumber}`);
    }
    if (expectedPrice) {
      // --------------------------------
      // Check transaction rounded price
      // --------------------------------
      const roundedPrice = Utils.createDecimal(transactionResponse.data.stop.roundedPrice);
      assert(roundedPrice.equals(expectedPrice), `The rounded price should be: ${expectedPrice} - actual value: ${roundedPrice.toNumber()}`);
      // ---------------------------
      // Check priced dimensions
      // ---------------------------
      const billedPrice = this.getBilledRoundedPrice(billingDataStop);
      assert(billedPrice.equals(expectedPrice), `The billed price should be: ${expectedPrice} - actual value: ${billedPrice.toNumber()}`);
    }
  }

  public getBilledRoundedPrice(billingDataStop: BillingDataTransactionStop): Decimal {
    let roundedPrice = Utils.createDecimal(0);
    const invoiceItem = billingDataStop.invoiceItem;
    if (invoiceItem) {
      invoiceItem.pricingData.forEach((pricedConsumptionData) => {
        roundedPrice = roundedPrice.plus(pricedConsumptionData.flatFee?.roundedAmount || 0);
        roundedPrice = roundedPrice.plus(pricedConsumptionData.energy?.roundedAmount || 0);
        roundedPrice = roundedPrice.plus(pricedConsumptionData.parkingTime?.roundedAmount || 0);
        roundedPrice = roundedPrice.plus(pricedConsumptionData.chargingTime?.roundedAmount || 0);
      });
    }
    return roundedPrice;
  }

  public async sendStatusNotification(connectorId: number, timestamp: Date, status: ChargePointStatus): Promise<void> {
    const occpStatusFinishing: OCPPStatusNotificationRequest = {
      connectorId,
      status,
      errorCode: ChargePointErrorCode.NO_ERROR,
      timestamp: timestamp.toISOString()
    };
    await this.chargingStationContext.setConnectorStatus(occpStatusFinishing);
  }

  public async dumpLastErrors(): Promise<void> {
    const params = { levels: ['E'] };
    const dbParams = { limit: 2, skip: 0, sort: { timestamp: -1 } }; // the 2 last errors
    const loggedErrors = await LoggingStorage.getLogs(this.tenantContext.getTenant(), params, dbParams, null);
    if (loggedErrors?.result.length > 0) {
      for (const loggedError of loggedErrors.result) {
        console.error(
          '-----------------------------------------------\n' +
          'Logged Error: \n' +
          '-----------------------------------------------\n' +
          JSON.stringify(loggedError));
      }
    }
  }

  public async generateTransaction(user: any, expectedStatus = 'Accepted', expectedStartDate = new Date(), withSoftStopSimulation = false): Promise<number> {
    const meterStart = 0;
    const meterStop = 32325; // Unit: Wh
    const meterValueRampUp = Utils.createDecimal(meterStop).divToInt(80).toNumber();
    const meterValueHighConsumption = Utils.createDecimal(meterStop).divToInt(30).toNumber();
    const meterValuePoorConsumption = 0; // Simulate a gap in the energy provisioning
    const meterValuePhaseOut = Utils.createDecimal(meterStop).divToInt(60).toNumber();
    // const user:any = this.userContext;
    const connectorId = 1;
    assert((user.tags && user.tags.length), 'User must have a valid tag');
    const tagId = user.tags[0].id;
    // # Begin
    const startDate = moment(expectedStartDate);
    // Let's send an OCCP status notification to simulate some extra inactivities
    await this.sendStatusNotification(connectorId, startDate.toDate(), ChargePointStatus.PREPARING);
    const startTransactionResponse = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate.toDate());
    if (expectedStatus === 'Accepted' && startTransactionResponse.idTagInfo.status !== expectedStatus) {
      await this.dumpLastErrors();
    }
    expect(startTransactionResponse).to.be.transactionStatus(expectedStatus);
    const transactionId = startTransactionResponse.transactionId;
    const currentTime = startDate.clone();
    let cumulated = 0;
    // Phase #0 - not charging yet
    for (let index = 0; index < 5; index++) {
      // cumulated += meterValueRampUp;
      await this.sendConsumptionMeterValue(connectorId, transactionId, currentTime, cumulated);
    }
    // Phase #1 - warm up
    for (let index = 0; index < 15; index++) {
      cumulated += meterValueRampUp;
      await this.sendConsumptionMeterValue(connectorId, transactionId, currentTime, cumulated);
    }
    // Phase #2 - high consumption - 3 minutes
    for (let index = 0; index < 3; index++) {
      cumulated += meterValueHighConsumption;
      await this.sendConsumptionMeterValue(connectorId, transactionId, currentTime, cumulated);
    }
    // Phase #2 - high consumption - a single consumption for 14 minutes (sent in one shot to simulate charge@home network issues)
    const minutes = 14;
    cumulated += Utils.createDecimal(meterValueHighConsumption).mul(minutes).toNumber();
    await this.sendConsumptionMeterValue(connectorId, transactionId, currentTime, cumulated, minutes);
    // Phase #2 - high consumption - 3 minutes
    for (let index = 0; index < 3; index++) {
      cumulated += meterValueHighConsumption;
      await this.sendConsumptionMeterValue(connectorId, transactionId, currentTime, cumulated);
    }
    // Phase #4 - no consumption
    for (let index = 0; index < 5; index++) {
      cumulated += meterValuePoorConsumption;
      await this.sendConsumptionMeterValue(connectorId, transactionId, currentTime, cumulated);
    }
    // Phase #5 - phase out
    for (let index = 0; index < 10; index++) {
      cumulated = Math.min(meterStop, cumulated += meterValuePhaseOut);
      await this.sendConsumptionMeterValue(connectorId, transactionId, currentTime, cumulated);
    }
    assert(cumulated === meterStop, 'Inconsistent meter values - cumulated energy should equal meterStop - ' + cumulated);
    // Phase #6 - parking time
    for (let index = 0; index < 4; index++) {
      // cumulated += 0; // Parking time - not charging anymore
      await this.sendConsumptionMeterValue(connectorId, transactionId, currentTime, meterStop);
    }
    const stopDate = startDate.clone().add(1, 'hour');
    if (expectedStatus === 'Accepted') {
      if (withSoftStopSimulation) {
        const tenant = this.tenantContext.getTenant();
        // #end - simulating the situation where the stop is not received
        await this.sendConsumptionMeterValue(connectorId, transactionId, currentTime, meterStop);
        await this.sendStatusNotification(connectorId, stopDate.clone().add(29, 'minutes').toDate(), ChargePointStatus.FINISHING);
        await this.sendStatusNotification(connectorId, stopDate.clone().add(30, 'minutes').toDate(), ChargePointStatus.AVAILABLE);
        // SOFT STOP TRANSACTION
        const chargingStation = this.chargingStationContext.getChargingStation();
        let transaction = await TransactionStorage.getTransaction(tenant, transactionId);
        const siteArea = this.siteAreaContext.getSiteArea();
        const done = await OCPPService.softStopTransaction(tenant, transaction, chargingStation, siteArea);
        expect(done).to.be.true;
        // Force the billing as this is normally done by a job every 15 minutes
        transaction = await TransactionStorage.getTransaction(tenant, transactionId, { withUser: true, withChargingStation: true });
        transaction.stop.extraInactivityComputed = true;
        transaction.stop.extraInactivitySecs = 0;
        await OCPPUtils.processTransactionBilling(tenant, transaction, TransactionAction.END);
      } else {
        // #end
        const stopTransactionResponse = await this.chargingStationContext.stopTransaction(transactionId, tagId, meterStop, stopDate.toDate());
        if (expectedStatus === 'Accepted' && stopTransactionResponse.idTagInfo.status !== expectedStatus) {
          await this.dumpLastErrors();
        }
        expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
        // Let's send an OCCP status notification to simulate some extra inactivities
        await this.sendStatusNotification(connectorId, stopDate.clone().add(29, 'minutes').toDate(), ChargePointStatus.FINISHING);
        await this.sendStatusNotification(connectorId, stopDate.clone().add(30, 'minutes').toDate(), ChargePointStatus.AVAILABLE);
      }
      // Give some time to the asyncTask to bill the transaction
      await this.waitForAsyncTasks();
    }
    return transactionId;
  }

  public async sendConsumptionMeterValue(connectorId: number, transactionId: number, currentTime: moment.Moment, energyActiveImportMeterValue: number, interval = 1): Promise<void> {
    currentTime.add(interval, 'minute');
    const meterValueResponse = await this.chargingStationContext.sendConsumptionMeterValue(
      connectorId,
      transactionId,
      currentTime.toDate(), {
        energyActiveImportMeterValue
      }
    );
    expect(meterValueResponse).to.eql({});
  }

  public async waitForAsyncTasks(): Promise<void> {
    let counter = 0, pending: DataResult<AsyncTask>, running: DataResult<AsyncTask>;
    while (counter++ <= 10) {
      // Get the number of pending tasks
      pending = await AsyncTaskStorage.getAsyncTasks({ status: AsyncTaskStatus.PENDING }, Constants.DB_PARAMS_COUNT_ONLY);
      running = await AsyncTaskStorage.getAsyncTasks({ status: AsyncTaskStatus.RUNNING }, Constants.DB_PARAMS_COUNT_ONLY);
      if (!pending.count && !running.count) {
        break;
      }
      // Give some time to the asyncTask to bill the transaction
      console.log(`Waiting for async tasks - pending tasks: ${pending.count} - running tasks: ${running.count}`);
      await TestUtils.sleep(1000);
    }
    if (!pending.count && !running.count) {
      console.log('Async tasks have been completed');
    } else {
      console.warn(`Gave up after more than 10 seconds - pending tasks: ${pending.count} - running tasks: ${running.count}`);
    }
  }

  public async checkForDraftInvoices(userId?: string): Promise<number> {
    const result = await this.getDraftInvoices(userId);
    return result.length;
  }

  public async getDraftInvoices(userId?: string) : Promise<any> {
    let params;
    if (userId) {
      params = { Status: BillingInvoiceStatus.DRAFT, UserID: [this.userContext.id] };
    } else {
      params = { Status: BillingInvoiceStatus.DRAFT };
    }

    const paging = TestConstants.DEFAULT_PAGING;
    const ordering = [{ field: '-createdOn' }];
    const response = await this.adminUserService.billingApi.readInvoices(params, paging, ordering);
    return response?.data?.result;
  }

  public isBillingProperlyConfigured(): boolean {
    const billingSettings = this.getLocalSettings(false);
    // Check that the mandatory settings are properly provided
    return (!!billingSettings.stripe.publicKey
      && !!billingSettings.stripe.secretKey
      && !!billingSettings.stripe.url);
  }

  public async getLatestDraftInvoice(userId?: string): Promise<BillingInvoice> {
    // ACHTUNG: There is no data after running: npm run mochatest:createContext
    // In that situation we return 0!
    const draftInvoices = await this.getDraftInvoices(userId);
    return (draftInvoices && draftInvoices.length > 0) ? draftInvoices[0] : null;
  }

  public async getNumberOfSessions(userId?: string): Promise<number> {
    // ACHTUNG: There is no data after running: npm run mochatest:createContext
    // In that situation we return 0!
    const draftInvoice = await this.getLatestDraftInvoice(userId);
    return (draftInvoice) ? draftInvoice.sessions?.length : 0;
  }

  public async createTariff4ChargingStation(
      testMode: string,
      chargingStation: ChargingStation,
      expectedStartDate: Date,
      dimensions: PricingDimensions,
      connectorType: ConnectorType = null,
      restrictions: PricingRestriction = null): Promise<void> {

    // Set a default value
    expectedStartDate = expectedStartDate || new Date();
    connectorType = connectorType || ConnectorType.TYPE_2;

    const tariffName = testMode;
    const tariff: Partial<PricingDefinition> = {
      entityID: chargingStation.id, // a pricing model for the site
      entityType: PricingEntity.CHARGING_STATION,
      name: tariffName,
      description: 'Tariff for CS ' + chargingStation.id + ' - ' + tariffName + ' - ' + connectorType,
      staticRestrictions: {
        connectorType,
        validFrom: expectedStartDate,
        validTo: moment(expectedStartDate).add(10, 'minutes').toDate()
      },
      restrictions,
      dimensions
    };

    let response = await this.adminUserService.pricingApi.createPricingDefinition(tariff);
    assert(response?.data?.status === 'Success', 'The operation should succeed');
    assert(response?.data?.id, 'The ID should not be null');

    const pricingDefinitionId = response?.data?.id;
    response = await this.adminUserService.pricingApi.readPricingDefinition(pricingDefinitionId);
    assert(response?.data?.id === pricingDefinitionId, 'The ID should be: ' + pricingDefinitionId);
    assert(response?.data?.entityName === chargingStation.id);

    // Create a 2nd one valid in the future with a stupid flat fee
    tariff.name = tariffName + ' - In the future';
    tariff.staticRestrictions = {
      connectorType,
      validFrom: moment(expectedStartDate).add(10, 'years').toDate(),
    },
    tariff.dimensions.flatFee = {
      active: true,
      price: 111
    };
    response = await this.adminUserService.pricingApi.createPricingDefinition(tariff);
    assert(response?.data?.status === 'Success', 'The operation should succeed');
    assert(response?.data?.id, 'The ID should not be null');

    // Create a 3rd one valid in the past
    tariff.name = tariffName + ' - In the past';
    tariff.staticRestrictions = {
      connectorType,
      validTo: moment(expectedStartDate).add(-1, 'hours').toDate(),
    },
    tariff.dimensions.flatFee = {
      active: true,
      price: 222
    };
    response = await this.adminUserService.pricingApi.createPricingDefinition(tariff);
    assert(response?.data?.status === 'Success', 'The operation should succeed');
    assert(response?.data?.id, 'The ID should not be null');
  }

  public async checkPricingDefinitionEndpoints(): Promise<void> {

    this.siteContext = this.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
    this.siteAreaContext = this.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);

    const siteArea = this.siteAreaContext.getSiteArea();

    const parkingPrice: PricingDimension = {
      price: 0.75,
      active: true
    };
    const tariffForSiteArea: Partial<PricingDefinition> = {
      entityID: siteArea?.id, // a pricing model for the tenant
      entityType: PricingEntity.SITE_AREA,
      name: 'Tariff for Site Area: ' + siteArea?.name,
      description : 'Tariff for Site Area: ' + siteArea?.name,
      staticRestrictions: {
        connectorPowerkW: 40,
        validFrom: new Date(),
        validTo: moment().add(10, 'minutes').toDate(),
      },
      dimensions: {
        chargingTime: parkingPrice,
        // energy: price4TheEnergy, // do not bill the energy - bill the parking time instead
        parkingTime: parkingPrice,
      }
    };
    let response = await this.adminUserService.pricingApi.createPricingDefinition(tariffForSiteArea);
    assert(response?.data?.status === 'Success', 'The operation should succeed');
    assert(response?.data?.id, 'The ID should not be null');

    const pricingDefinitionId = response?.data?.id;
    response = await this.adminUserService.pricingApi.readPricingDefinition(pricingDefinitionId);
    assert(response?.data?.id === pricingDefinitionId, 'The ID should be: ' + pricingDefinitionId);
    assert(response?.data?.entityName === siteArea.name, 'The Site Area data should be retrieved as well');
  }
}
