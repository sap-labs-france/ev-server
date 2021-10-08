/* eslint-disable max-len */
import AsyncTask, { AsyncTaskStatus } from '../../src/types/AsyncTask';
import { BillingChargeInvoiceAction, BillingDataTransactionStop, BillingInvoiceItem, BillingInvoiceStatus, BillingStatus, BillingUser } from '../../src/types/Billing';
import { BillingSettings, BillingSettingsType, SettingDB } from '../../src/types/Setting';
import ChargingStation, { ConnectorType } from '../../src/types/ChargingStation';
import FeatureToggles, { Feature } from '../../src/utils/FeatureToggles';
import PricingDefinition, { PricingDimensions, PricingEntity, PricingRestriction } from '../../src/types/Pricing';
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
import Factory from '../factories/Factory';
import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import { ObjectId } from 'mongodb';
import SiteAreaContext from './context/SiteAreaContext';
import SiteContext from './context/SiteContext';
import { StatusCodes } from 'http-status-codes';
import Stripe from 'stripe';
import StripeBillingIntegration from '../../src/integration/billing/stripe/StripeBillingIntegration';
import { TenantComponents } from '../../src/types/Tenant';
import TenantContext from './context/TenantContext';
import TestConstants from './client/utils/TestConstants';
import TestUtils from './TestUtils';
import User from '../../src/types/User';
import { UserInErrorType } from '../../src/types/InError';
import Utils from '../../src/utils/Utils';
import chaiSubset from 'chai-subset';
import config from '../config';
import global from '../../src/types/GlobalType';
import moment from 'moment';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

class TestData {
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

  public async initialize() {
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
    await this.createTariff4ChargingStation('FF+CT', this.chargingStationContext.getChargingStation(), {
      flatFee: {
        price: 1,
        active: true
      },
      chargingTime: {
        price: 0.4,
        active: true
      }
    });
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
    await this.createTariff4ChargingStation(testMode, this.chargingStationContext.getChargingStation(), dimensions);
    return this.chargingStationContext;
  }

  public async initChargingStationContext2TestFastCharger(testMode = 'E') : Promise<ChargingStationContext> {
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
    } else if (testMode === 'E-After30mins') {
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
    await this.createTariff4ChargingStation(testMode, this.chargingStationContext.getChargingStation(), dimensions, ConnectorType.COMBO_CCS, restrictions);
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

  public async saveBillingSettings(billingSettings: BillingSettings) {
    // TODO - rethink that part
    const tenantBillingSettings = await this.adminUserService.settingApi.readAll({ 'Identifier': 'billing' });
    expect(tenantBillingSettings.data.count).to.be.eq(1);
    const componentSetting: SettingDB = tenantBillingSettings.data.result[0];
    componentSetting.content.type = BillingSettingsType.STRIPE;
    componentSetting.content.billing = billingSettings.billing;
    componentSetting.content.stripe = billingSettings.stripe;
    componentSetting.sensitiveData = ['content.stripe.secretKey'];
    await this.adminUserService.settingApi.update(componentSetting);
  }

  public async checkTransactionBillingData(transactionId: number, expectedInvoiceStatus: BillingInvoiceStatus, expectedPrice: number = null) {
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

  public getBilledRoundedPrice(billingDataStop): Decimal {
    let roundedPrice = Utils.createDecimal(0);
    const invoiceItem = billingDataStop.invoiceItem as BillingInvoiceItem;
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

  public async generateTransaction(user: any, expectedStatus = 'Accepted'): Promise<number> {

    const meterStart = 0;
    const meterStop = 32325; // Unit: Wh
    const meterValue1 = Utils.createDecimal(meterStop).divToInt(80).toNumber();
    const meterValue2 = Utils.createDecimal(meterStop).divToInt(30).toNumber();
    const meterValue3 = Utils.createDecimal(meterStop).divToInt(60).toNumber();

    // const user:any = this.userContext;
    const connectorId = 1;
    assert((user.tags && user.tags.length), 'User must have a valid tag');
    const tagId = user.tags[0].id;
    // # Begin
    const startDate = moment();
    const startTransactionResponse = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate.toDate());
    expect(startTransactionResponse).to.be.transactionStatus(expectedStatus);
    const transactionId = startTransactionResponse.transactionId;

    const currentTime = startDate.clone();
    let cumulated = 0;
    // Phase #0
    for (let index = 0; index < 5; index++) {
      // cumulated += meterValue1; - not charging yet!
      await this.sendConsumptionMeterValue(connectorId, transactionId, currentTime, cumulated);
    }
    // Phase #1
    for (let index = 0; index < 15; index++) {
      cumulated += meterValue1;
      await this.sendConsumptionMeterValue(connectorId, transactionId, currentTime, cumulated);
    }
    // Phase #2
    for (let index = 0; index < 20; index++) {
      cumulated += meterValue2;
      await this.sendConsumptionMeterValue(connectorId, transactionId, currentTime, cumulated);
    }
    // Phase #3
    for (let index = 0; index < 15; index++) {
      cumulated = Math.min(meterStop, cumulated += meterValue3);
      await this.sendConsumptionMeterValue(connectorId, transactionId, currentTime, cumulated);
    }
    assert(cumulated === meterStop, 'Inconsistent meter values - cumulated energy should equal meterStop - ' + cumulated);
    // Phase #4 - parking time
    for (let index = 0; index < 4; index++) {
      // cumulated += 0; // Parking time - not charging anymore
      await this.sendConsumptionMeterValue(connectorId, transactionId, currentTime, meterStop);
    }

    // #end
    const stopDate = startDate.clone().add(1, 'hour');
    if (expectedStatus === 'Accepted') {
      const stopTransactionResponse = await this.chargingStationContext.stopTransaction(transactionId, tagId, meterStop, stopDate.toDate());
      expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    }
    // Give some time to the asyncTask to bill the transaction
    await this.waitForAsyncTasks();
    return transactionId;
  }

  public async sendConsumptionMeterValue(connectorId: number, transactionId: number, currentTime: moment.Moment, energyActiveImportMeterValue: number): Promise<void> {
    currentTime.add(1, 'minute');
    const meterValueResponse = await this.chargingStationContext.sendConsumptionMeterValue(
      connectorId,
      transactionId,
      currentTime.toDate(), {
        energyActiveImportMeterValue
      }
    );
    expect(meterValueResponse).to.eql({});
  }

  public async waitForAsyncTasks() {
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

  public async getDraftInvoices(userId?: string) {
    let params;
    if (userId) {
      params = { Status: BillingInvoiceStatus.DRAFT, UserID: [this.userContext.id] };
    } else {
      params = { Status: BillingInvoiceStatus.DRAFT };
    }

    const paging = TestConstants.DEFAULT_PAGING;
    const ordering = [{ field: '-createdOn' }];
    const response = await testData.adminUserService.billingApi.readInvoices(params, paging, ordering);
    return response?.data?.result;
  }

  public isBillingProperlyConfigured(): boolean {
    const billingSettings = this.getLocalSettings(false);
    // Check that the mandatory settings are properly provided
    return (!!billingSettings.stripe.publicKey
      && !!billingSettings.stripe.secretKey
      && !!billingSettings.stripe.url);
  }

  public async getLatestDraftInvoice(userId?: string) {
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

  public async initializePricingDefinitions(): Promise<void> {
    // const company = (await this.adminUserService.companyApi.readAll({}, { limit: 0, skip: 0 }))?.data?.result?.[0];
    // assert(company, 'The Company should not be null');
    // await this.createTariff4Company(company.id);

    // const sites = (await this.adminUserService.siteApi.readAll({}, { limit: 0, skip: 0 }))?.data?.result;
    // const selectedSites = sites.filter((site) => site.name === 'ut-site-stop');
    // assert(selectedSites, 'Sites should not be null');
    // assert(selectedSites[0], 'The Site should not be null');
    // await this.createTariff4Site(selectedSites[0].id);

    // const chargingStations: ChargingStation[] = (await this.adminUserService.chargingStationApi.readAll({}, { limit: 0, skip: 0 }))?.data?.result;
    // let selectedChargingStations = chargingStations.filter((chargingStation) => chargingStation.id === 'cs-16-ut-site-withSmartChargingDC');
    // await this.createTariff4ChargingStation(selectedChargingStations[0], null, ConnectorType.COMBO_CCS);

    // selectedChargingStations = chargingStations.filter((chargingStation) => chargingStation.id === 'cs-16-ut-site-withSmartChargingSinglePhased');
    // await this.createTariff4ChargingStation(selectedChargingStations[0]);

    // selectedChargingStations = chargingStations.filter((chargingStation) => chargingStation.id === 'cs-16-ut-site-withSmartChargingThreePhased');
    // await this.createTariff4ChargingStation(selectedChargingStations[0], {
    //   flatFee: {
    //     price: 2,
    //     active: true
    //   },
    //   energy: {
    //     price: 0.25,
    //     active: true
    //   },
    //   chargingTime: {
    //     price: 0.4,
    //     active: false // THIS IS OFF
    //   }
    // });

    // selectedChargingStations = chargingStations.filter((chargingStation) => chargingStation.id === 'cs-16-ut-site-withSmartChargingThreePhased-singlePhased');
    // await this.createTariff4ChargingStation(selectedChargingStations[0], {
    //   flatFee: {
    //     price: 1,
    //     active: true
    //   },
    //   chargingTime: {
    //     price: 0.4,
    //     active: true
    //   }
    // });
  }

  // public async createTariff4Company(companyID: string): Promise<void> {
  //   const tariff: Partial<PricingDefinition> = {
  //     entityID: companyID, // a pricing model for the Company
  //     entityType: PricingEntity.COMPANY,
  //     name: 'GREEN Tariff',
  //     description: 'Tariff for slow chargers',
  //     staticRestrictions: {
  //       connectorPowerkW: 40,
  //     },
  //     dimensions: {
  //       flatFee: {
  //         price: 1.25,
  //         active: true
  //       },
  //       chargingTime: {
  //         price: 0.15,
  //         active: true
  //       },
  //       energy: {
  //         price: 0.35,
  //         active: true
  //       },
  //       parkingTime: {
  //         price: 0.75,
  //         active: true
  //       },
  //     }
  //   };

  //   let response = await this.adminUserService.pricingApi.createPricingDefinition(tariff);
  //   assert(response?.data?.status === 'Success', 'The operation should succeed');
  //   assert(response?.data?.id, 'The ID should not be null');

  //   const pricingDefinitionId = response?.data?.id;
  //   response = await this.adminUserService.pricingApi.readPricingDefinition(pricingDefinitionId);
  //   assert(response?.data?.id === pricingDefinitionId, 'The ID should be: ' + pricingDefinitionId);
  // }

  // public async createTariff4Site(siteID: string): Promise<void> {
  //   const tariff: Partial<PricingDefinition> = {
  //     entityID: siteID, // a pricing model for the site
  //     entityType: PricingEntity.SITE,
  //     name: 'RED Tariff',
  //     description: 'Tariff for fast chargers',
  //     staticRestrictions: {
  //       connectorPowerkW: 40,
  //     },
  //     dimensions: {
  //       flatFee: {
  //         price: 2.25,
  //         active: true
  //       },
  //       chargingTime: {
  //         price: 0,
  //         active: false
  //       },
  //       energy: {
  //         price: 0.75,
  //         active: true
  //       },
  //       parkingTime: {
  //         price: 0,
  //         active: true
  //       },
  //     }
  //   };

  //   let response = await this.adminUserService.pricingApi.createPricingDefinition(tariff);
  //   assert(response?.data?.status === 'Success', 'The operation should succeed');
  //   assert(response?.data?.id, 'The ID should not be null');

  //   const pricingDefinitionId = response?.data?.id;
  //   response = await this.adminUserService.pricingApi.readPricingDefinition(pricingDefinitionId);
  //   assert(response?.data?.id === pricingDefinitionId, 'The ID should be: ' + pricingDefinitionId);
  // }

  public async createTariff4ChargingStation(
      testMode: string,
      chargingStation: ChargingStation,
      dimensions: PricingDimensions,
      connectorType: ConnectorType = null,
      restrictions: PricingRestriction = null): Promise<void> {

    // Set a default value
    connectorType = connectorType || ConnectorType.TYPE_2;

    const tariff: Partial<PricingDefinition> = {
      entityID: chargingStation.id, // a pricing model for the site
      entityType: PricingEntity.CHARGING_STATION,
      name: testMode,
      description: 'Tariff for CS ' + chargingStation.id + ' - ' + testMode + ' - ' + connectorType,
      staticRestrictions: {
        connectorType,
        validFrom: new Date(),
        validTo: moment().add(10, 'minutes').toDate()
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

    // Create a 2nd one valid in the future with a stupid flat fee
    tariff.name = tariff.name + ' - In the future';
    tariff.staticRestrictions = {
      connectorType,
      validFrom: moment().add(10, 'years').toDate(),
    },
    tariff.dimensions.flatFee = {
      active: true,
      price: 111
    };
    response = await this.adminUserService.pricingApi.createPricingDefinition(tariff);
    assert(response?.data?.status === 'Success', 'The operation should succeed');
    assert(response?.data?.id, 'The ID should not be null');

    // Create a 3rd one valid in the past
    tariff.name = tariff.name + ' - In the past';
    tariff.staticRestrictions = {
      connectorType,
      validTo: moment().add(-1, 'hours').toDate(),
    },
    tariff.dimensions.flatFee = {
      active: true,
      price: 222
    };
    response = await this.adminUserService.pricingApi.createPricingDefinition(tariff);
    assert(response?.data?.status === 'Success', 'The operation should succeed');
    assert(response?.data?.id, 'The ID should not be null');
  }
}

const testData: TestData = new TestData();

describe('Billing Settings', function() {
  // Do not run the tests when the settings are not properly set
  this.pending = !testData.isBillingProperlyConfigured();
  this.timeout(1000000);

  describe('With component Billing (utbilling)', () => {
    before(async () => {
      global.database = new MongoDBStorage(config.get('storage'));
      await global.database.start();
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING);
      testData.adminUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.adminUserService = new CentralServerService(
        testData.tenantContext.getTenant().subdomain,
        testData.adminUserContext
      );
      expect(testData.userContext).to.not.be.null;
    });

    describe('As an admin - with transaction billing OFF', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      before(async () => {
        testData.initUserContextAsAdmin();
        // Initialize the Billing module with transaction billing ON
        testData.billingImpl = await testData.setBillingSystemValidCredentials(false);
      });

      it('Should be able to invoke Billing Settings endpoints', async () => {
        // Get the Billing settings
        let response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        const billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(billingSettings.type === BillingSettingsType.STRIPE, 'Billing Setting Type should not be set to STRIPE');
        assert(billingSettings.stripe, 'Stripe Properties should not be null');
        assert(billingSettings.stripe.secretKey, 'Secret Key should not be null');
        assert(billingSettings.id, 'ID should not be null');
        // Check billing connection to STRIPE
        response = await testData.userService.billingApi.checkBillingConnection();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        assert(response.data, 'Response data should not be null');
        assert(response.data.connectionIsValid === true, 'Connection should be valid');
      });

      it('Should be able to update the secret key', async () => {
        // Get the Billing settings
        let response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        let billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(!billingSettings.billing.isTransactionBillingActivated, 'Transaction Billing should be OFF');
        assert(billingSettings.stripe.secretKey, 'Hash of the secret key should not be null');
        const keyHash = billingSettings.stripe.secretKey;
        // Let's attempt to update the secret key
        billingSettings.stripe.secretKey = config.get('stripe.secretKey'),
        response = await testData.userService.billingApi.updateBillingSetting(billingSettings);
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        // Check that the hash is still correct
        response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(keyHash !== billingSettings.stripe.secretKey, 'Hash of the secret key should be different');
      });

      it('Should check prerequisites when switching Transaction Billing ON', async () => {
        let response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        const billingSettings = response.data as BillingSettings ;
        // Let's attempt to switch ON the billing of transactions
        billingSettings.billing.isTransactionBillingActivated = true;
        response = await testData.userService.billingApi.updateBillingSetting(billingSettings);
        // taxID is not set - so the prerequisites are not met
        assert(response.status !== StatusCodes.OK, 'Response status should not be 200');
        // Check again the billing connection to STRIPE
        response = await testData.userService.billingApi.checkBillingConnection();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        assert(response.data, 'Response data should not be null');
        assert(response.data.connectionIsValid === true, 'Connection should be valid');
      });
    });

    describe('As an admin - with transaction billing ON', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      before(async () => {
        testData.initUserContextAsAdmin();
        // Initialize the Billing module with transaction billing ON
        testData.billingImpl = await testData.setBillingSystemValidCredentials();
      });

      it('Should be able to invoke Billing Settings endpoints', async () => {
        // Get the Billing settings
        let response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        const billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(billingSettings.type === BillingSettingsType.STRIPE, 'Billing Setting Type should not be set to STRIPE');
        assert(billingSettings.stripe, 'Stripe Properties should not be null');
        assert(billingSettings.stripe.secretKey, 'Secret Key should not be null');
        assert(billingSettings.id, 'ID should not be null');
        // Check billing connection to STRIPE
        response = await testData.userService.billingApi.checkBillingConnection();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        assert(response.data, 'Response data should not be null');
        assert(response.data.connectionIsValid === true, 'Connection should be valid');
      });

      it('Should not be able to alter the secretKey when transaction billing is ON', async () => {
        // Get the Billing settings
        let response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        let billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(billingSettings.billing.isTransactionBillingActivated, 'Transaction Billing should be ON');
        assert(billingSettings.stripe.secretKey, 'Hash of the secret key should not be null');
        const keyHash = billingSettings.stripe.secretKey;
        // Let's attempt to alter the secret key while transaction billing is ON
        billingSettings.stripe.secretKey = '1234567890';
        response = await testData.userService.billingApi.updateBillingSetting(billingSettings);
        // Here it does not fail - but the initial secret key should have been preserved!
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        // Check that the secret key was preserved
        response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(keyHash === billingSettings.stripe.secretKey, 'Hash of the secret key should not have changed');
        // Check again the billing connection to STRIPE
        response = await testData.userService.billingApi.checkBillingConnection();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        assert(response.data, 'Response data should not be null');
        assert(response.data.connectionIsValid === true, 'Connection should be valid');
      });

      it('Should not be able to switch the transaction billing OFF', async () => {
        // Get the Billing settings
        let response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        const billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(billingSettings.billing.isTransactionBillingActivated, 'Transaction Billing should be ON');
        // Let's attempt to switch the transaction billing OFF
        billingSettings.billing.isTransactionBillingActivated = false;
        response = await testData.userService.billingApi.updateBillingSetting(billingSettings);
        assert(response.status === StatusCodes.METHOD_NOT_ALLOWED, 'Response status should be 405');
        // Check again the billing connection to STRIPE
        response = await testData.userService.billingApi.checkBillingConnection();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        assert(response.data, 'Response data should not be null');
        assert(response.data.connectionIsValid === true, 'Connection should be valid');
      });
    });
  });
});

describe('Billing Service', function() {
  // Do not run the tests when the settings are not properly set
  this.pending = !testData.isBillingProperlyConfigured();
  this.timeout(1000000);

  describe('With component Billing (utbilling)', () => {
    before(async () => {
      global.database = new MongoDBStorage(config.get('storage'));
      await global.database.start();
      await testData.initialize();
    });

    describe('Pricing Model', () => {
      before(async () => {
      });

      after(async () => {
      });

      it('Initialize the Pricing Models', async () => {
        await testData.initializePricingDefinitions();
      });
    });

    describe('with Transaction Billing ON', () => {
      before(async () => {
        // Initialize the charing station context
        await testData.initChargingStationContext();
        // Initialize the Billing module
        testData.billingImpl = await testData.setBillingSystemValidCredentials();
        // Make sure the required users are in sync
        const adminUser: User = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
        const basicUser: User = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        // Synchronize at least these 2 users - this creates a customer on the STRIPE side
        await testData.billingImpl.forceSynchronizeUser(adminUser);
        await testData.billingImpl.forceSynchronizeUser(basicUser);
      });

      xdescribe('Tune user profiles', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          testData.initUserContextAsAdmin();
        });

        it('Should change admin user locale to fr_FR', async () => {
          const user: User = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
          const { id, email, name, firstName } = user;
          await testData.userService.updateEntity(testData.userService.userApi, { id, email, name, firstName, locale: 'fr_FR' }, true);
        });

        it('Should change basic user locale to es_ES', async () => {
          const user: User = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
          const { id, email, name, firstName } = user;
          await testData.userService.updateEntity(testData.userService.userApi, { id, email, name, firstName, locale: 'es_ES' }, true);
        });
      });

      describe('Where admin user (essential)', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          testData.initUserContextAsAdmin();
        });

        it('should add an item to a DRAFT invoice after a transaction', async () => {
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const itemsBefore = await testData.getNumberOfSessions(testData.userContext.id);
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // await testData.checkTransactionBillingData(transactionID); // TODO - Check not yet possible!
          // await testData.userService.billingApi.synchronizeInvoices({});
          const itemsAfter = await testData.getNumberOfSessions(testData.userContext.id);
          expect(itemsAfter).to.be.gt(itemsBefore);
        });
      });

      describe('Where admin user', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          testData.initUserContextAsAdmin();
        });

        it('Should connect to Billing Provider', async () => {
          const response = await testData.userService.billingApi.testConnection({}, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING);
          expect(response.data.connectionIsValid).to.be.true;
          expect(response.data).containSubset(Constants.REST_RESPONSE_SUCCESS);
        });

        it('Should create/update/delete a user', async () => {
          const fakeUser = {
            ...Factory.user.build(),
          } as User;
          fakeUser.issuer = true;
          // Let's create a user
          await testData.userService.createEntity(
            testData.userService.userApi,
            fakeUser
          );
          testData.createdUsers.push(fakeUser);
          // Let's check that the corresponding billing user exists as well (a Customer in the STRIPE DB)
          let billingUser = await testData.billingImpl.getUser(fakeUser);
          expect(billingUser).to.be.not.null;
          // Let's update the new user
          fakeUser.firstName = 'Test';
          fakeUser.name = 'NAME';
          fakeUser.issuer = true;
          await testData.userService.updateEntity(
            testData.userService.userApi,
            fakeUser,
            false
          );
          // Let's check that the corresponding billing user was updated as well
          billingUser = await testData.billingImpl.getUser(fakeUser);
          expect(billingUser.name).to.be.eq(fakeUser.firstName + ' ' + fakeUser.name);
          // Let's delete the user
          await testData.userService.deleteEntity(
            testData.userService.userApi,
            { id: testData.createdUsers[0].id }
          );
          // Verify that the corresponding billing user is gone
          const exists = await testData.billingImpl.isUserSynchronized(testData.createdUsers[0]);
          expect(exists).to.be.false;
          testData.createdUsers.shift();
        });

        it('should add an item to the existing invoice after a transaction', async () => {
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const itemsBefore = await testData.getNumberOfSessions(testData.userContext.id);
          const transactionID = await testData.generateTransaction(testData.userContext);
          expect(transactionID).to.not.be.null;
          // await testData.userService.billingApi.synchronizeInvoices({});
          const itemsAfter = await testData.getNumberOfSessions(testData.userContext.id);
          expect(itemsAfter).to.be.eq(itemsBefore + 1);
        });

        xit('should synchronize 1 invoice after a transaction', async () => {
        // Synchronize Invoices is now deprecated
          await testData.userService.billingApi.synchronizeInvoices({});
          const transactionID = await testData.generateTransaction(testData.userContext);
          expect(transactionID).to.not.be.null;
          const response = await testData.userService.billingApi.synchronizeInvoices({});
          expect(response.data).containSubset(Constants.REST_RESPONSE_SUCCESS);
          expect(response.data.inSuccess).to.be.eq(1);
        });

        it('Should list invoices', async () => {
          const response = await testData.userService.billingApi.readInvoices({}, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING);
          expect(response.status).to.be.eq(StatusCodes.OK);
          expect(response.data.result.length).to.be.gt(0);
        });

        xit('Should list filtered invoices', async () => {
          const response = await testData.userService.billingApi.readInvoices({ Status: BillingInvoiceStatus.OPEN }, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING);
          expect(response.data.result.length).to.be.gt(0);
          for (const invoice of response.data.result) {
            expect(invoice.status).to.be.eq(BillingInvoiceStatus.OPEN);
          }
        });

        xit('Should synchronize invoices', async () => {
          const response = await testData.userService.billingApi.synchronizeInvoices({});
          expect(response.data).containSubset(Constants.REST_RESPONSE_SUCCESS);
        });

        xit('Should force a user synchronization', async () => {
          const fakeUser = {
            ...Factory.user.build(),
          } as User;
          fakeUser.issuer = true;
          testData.billingImpl = await testData.setBillingSystemValidCredentials();
          await testData.userService.createEntity(
            testData.userService.userApi,
            fakeUser
          );
          testData.createdUsers.push(fakeUser);
          fakeUser.billingData = {
            customerID: 'cus_utbilling_fake_user',
            liveMode: false,
            lastChangedOn: new Date(),
          }; // TODO - not supported anymore
          await testData.userService.updateEntity(
            testData.userService.userApi,
            fakeUser
          );
          await testData.userService.billingApi.forceSynchronizeUser({ id: fakeUser.id });
          const billingUserAfter = await testData.billingImpl.getUser(fakeUser);
          expect(fakeUser.billingData.customerID).to.not.be.eq(billingUserAfter.billingData.customerID);
        });
      });

      describe('Where basic user', () => {

        before(async () => {
          testData.billingImpl = await testData.setBillingSystemValidCredentials();
          testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
          assert(!!testData.userService, 'User service cannot be null');
          testData.userService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            testData.userContext
          );
          expect(testData.userService).to.not.be.null;
        });

        it('Should not be able to test connection to Billing Provider', async () => {
          const response = await testData.userService.billingApi.testConnection({}, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING);
          expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
        });

        it('Should not delete a user', async () => {
          const response = await testData.userService.deleteEntity(
            testData.userService.userApi,
            { id: new ObjectId().toHexString() },
            false
          );
          expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
        });

        it('Should not create a user', async () => {
          const fakeUser = {
            ...Factory.user.build(),
          } as User;

          const response = await testData.userService.createEntity(
            testData.userService.userApi,
            fakeUser,
            false
          );
          testData.createdUsers.push(fakeUser);
          expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
        });

        it('Should not update a user', async () => {
          const fakeUser = {
            id: new ObjectId(),
            ...Factory.user.build(),
          } as User;
          fakeUser.firstName = 'Test';
          fakeUser.name = 'Name';
          const response = await testData.userService.updateEntity(
            testData.userService.userApi,
            fakeUser,
            false
          );
          expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
        });

        it('Should not delete a user', async () => {
          const response = await testData.userService.deleteEntity(
            testData.userService.userApi,
            { id: 0 },
            false
          );
          expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
        });

        it('Should not synchronize a user', async () => {
          const fakeUser = {
            ...Factory.user.build(),
          } as User;
          const response = await testData.userService.billingApi.synchronizeUser({ id: fakeUser.id });
          expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
        });

        it('Should not force synchronization of a user', async () => {
          const fakeUser = {
            ...Factory.user.build(),
          } as User;
          const response = await testData.userService.billingApi.forceSynchronizeUser({ id: fakeUser.id });
          expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
        });

        xit('Should list invoices', async () => {
          const basicUser: User = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);

          // Set back userContext to BASIC to consult invoices
          testData.userService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            basicUser
          );
          const response = await testData.userService.billingApi.readInvoices({}, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING);
          expect(response.data.result.length).to.be.eq(2);
        });

        it('should create an invoice after a transaction', async () => {
          const adminUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
          const basicUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
          // Connect as Admin to Force synchronize basic user
          testData.userContext = adminUser;
          testData.userService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            testData.userContext
          );
          await testData.userService.billingApi.forceSynchronizeUser({ id: basicUser.id });
          // Reconnect as Basic user
          testData.userContext = basicUser;
          testData.userService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            testData.userContext
          );
          // await testData.userService.billingApi.synchronizeInvoices({});
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const itemsBefore = await testData.getNumberOfSessions(basicUser.id);
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // await testData.userService.billingApi.synchronizeInvoices({});
          const itemsAfter = await testData.getNumberOfSessions(basicUser.id);
          expect(itemsAfter).to.be.eq(itemsBefore + 1);
        });
      });

      describe('Negative tests as an admin user', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          testData.initUserContextAsAdmin();
        });

        it('should not delete a transaction linked to an invoice', async () => {
          const transactionID = await testData.generateTransaction(testData.userContext);
          expect(transactionID).to.not.be.null;
          const transactionDeleted = await testData.userService.transactionApi.delete(transactionID);
          expect(transactionDeleted.data.inError).to.be.eq(1);
          expect(transactionDeleted.data.inSuccess).to.be.eq(0);
        });
      });

      describe('Recovery Scenarios', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          testData.initUserContextAsAdmin();
        });

        after(async () => {
        // Restore VALID STRIPE credentials
          testData.billingImpl = await testData.setBillingSystemValidCredentials();
        });

        it('Should recover after a synchronization issue', async () => {
          const fakeUser = {
            ...Factory.user.build(),
          } as User;
          fakeUser.issuer = true;
          testData.billingImpl = await testData.setBillingSystemInvalidCredentials();
          assert(testData.billingImpl, 'Billing implementation should not be null');
          await testData.userService.createEntity(
            testData.userService.userApi,
            fakeUser
          );
          testData.createdUsers.push(fakeUser);
          testData.billingImpl = await testData.setBillingSystemValidCredentials();
          await testData.userService.billingApi.synchronizeUser({ id: fakeUser.id });
          const userExists = await testData.billingImpl.isUserSynchronized(fakeUser);
          expect(userExists).to.be.true;
        });
      });

      describe('Negative tests - Wrong Billing Settings', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          testData.initUserContextAsAdmin();
          // Force INVALID STRIPE credentials
          testData.billingImpl = await testData.setBillingSystemInvalidCredentials();
          assert(testData.billingImpl, 'Billing implementation should not be null');
        });

        after(async () => {
        // Restore VALID STRIPE credentials
          testData.billingImpl = await testData.setBillingSystemValidCredentials();
        });

        it('Should not be able to start a transaction', async () => {
          const transactionID = await testData.generateTransaction(testData.userContext, 'Invalid');
          assert(!transactionID, 'Transaction ID should not be set');
        });

        it('Should set in error users without Billing data', async () => {
          const fakeUser = {
            ...Factory.user.build()
          } as User;
          fakeUser.issuer = true;
          // Creates user without billing data
          await testData.userService.createEntity(
            testData.userService.userApi,
            fakeUser
          );
          testData.createdUsers.push(fakeUser);
          // Check if user is in Users In Error
          const response = await testData.userService.userApi.readAllInError({ ErrorType: UserInErrorType.NO_BILLING_DATA }, {
            limit: 100,
            skip: 0
          });
          let userFound = false;
          for (const user of response.data.result) {
            if (user.id === fakeUser.id) {
              userFound = true;
              break;
            }
          }
          if (FeatureToggles.isFeatureActive(Feature.BILLING_SYNC_USERS)) {
            assert(userFound, 'User with no billing data should be listed as a User In Error');
          } else {
          // LAZY User Sync - The billing data will be created on demand (i.e.: when entering a payment method)
            assert(!userFound, 'User with no billing data should not be listed as a User In Error');
          }
        });

      });

      describe('Negative tests', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          testData.initUserContextAsAdmin();
          // Set STRIPE credentials
          testData.billingImpl = await testData.setBillingSystemInvalidCredentials();
        });

        after(async () => {
        });

        xit('Should set a transaction in error', async () => {
          const transactionID = await testData.generateTransaction(testData.userContext);
          const transactions = await testData.userService.transactionApi.readAllInError({});
          expect(transactions.data.result.find((transaction) => transaction.id === transactionID)).to.not.be.null;
        });

      });

    });

    describe('with Transaction Billing OFF', () => {
      before(async () => {
        expect(testData.userContext).to.not.be.null;
        await testData.initChargingStationContext();
        // Initialize the Billing module
        testData.billingImpl = await testData.setBillingSystemValidCredentials(false);
      });

      describe('Where admin user', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          testData.initUserContextAsAdmin();
        });

        it('should NOT add an item to a DRAFT invoice after a transaction', async () => {
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          // const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          // await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const itemsBefore = await testData.getNumberOfSessions(testData.userContext.id);
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // await testData.userService.billingApi.synchronizeInvoices({});
          const itemsAfter = await testData.getNumberOfSessions(testData.userContext.id);
          expect(itemsAfter).to.be.eq(itemsBefore);
        });

      });
    });


    describe('with Pricing + Billing', () => {
      before(async () => {
        testData.initUserContextAsAdmin();
        // Initialize the Billing module
        testData.billingImpl = await testData.setBillingSystemValidCredentials(true, true /* immediateBillingAllowed ON */);
      });

      describe('FF + CT', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          // Initialize the charing station context
          await testData.initChargingStationContext2TestChargingTime();
        });

        it('should create and bill an invoice with FF + CT', async () => {
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 1.29);
        });

      });

      describe('FF + ENERGY', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
        });

        it('should create and bill an invoice with FF + ENERGY', async () => {
          await testData.initChargingStationContext2TestCS3Phased();
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 10.08);
        });

        it('should create and bill an invoice with FF+ENERGY(STEP)', async () => {
          await testData.initChargingStationContext2TestCS3Phased('FF+E(STEP)');
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 9.50);
        });
      });

      describe('On COMBO CCS - DC', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
        });

        it('should bill the Energy on COMBO CCS - DC', async () => {
          await testData.initChargingStationContext2TestFastCharger();
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 16.16);
        });

        it('should bill the FF+CT+PT on COMBO CCS - DC', async () => {
          await testData.initChargingStationContext2TestFastCharger('FF+CT+PT');
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 6.49);
        });

        it('should bill the CT(STEP)+PT(STEP) on COMBO CCS - DC', async () => {
          await testData.initChargingStationContext2TestFastCharger('CT(STEP)+PT(STEP)');
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 11.00);
        });

        it('should bill the ENERGY + PT(STEP) on COMBO CCS - DC', async () => {
          await testData.initChargingStationContext2TestFastCharger('E+PT(STEP)');
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 19.49);
        });

        it('should bill the FF+E with 2 tariffs on COMBO CCS - DC', async () => {
          // A first Tariff for the ENERGY Only
          await testData.initChargingStationContext2TestFastCharger('FF+E');
          // A second Tariff applied after 30 mins!
          await testData.initChargingStationContext2TestFastCharger('E-After30mins');
          // A tariff applied immediately
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 24.63);
        });

        it('should bill the FF+E(STEP)+E(STEP) with 2 tariffs on COMBO CCS - DC', async () => {
          // A first Tariff for the ENERGY Only
          await testData.initChargingStationContext2TestFastCharger('FF+E(STEP)-MainTariff');
          // A second Tariff applied after 30 mins!
          await testData.initChargingStationContext2TestFastCharger('E(STEP)-After30mins');
          // A tariff applied immediately
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 22);
        });

        it('should bill the FF+E+E(STEP) with 2 tariffs on COMBO CCS - DC', async () => {
          // A first Tariff for the ENERGY Only
          await testData.initChargingStationContext2TestFastCharger('FF+E');
          // A second Tariff applied after 30 mins!
          await testData.initChargingStationContext2TestFastCharger('E(STEP)-After30mins');
          // A tariff applied immediately
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 15.37);
        });

      });
    });

    describe('with Transaction Billing + Periodic Billing ON', () => {
      before(async () => {
        testData.initUserContextAsAdmin();
        // Initialize the Billing module
        testData.billingImpl = await testData.setBillingSystemValidCredentials(true, false /* immediateBillingAllowed OFF, so periodicBilling ON */);
      });

      describe('Where admin user', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          // Initialize the charing station context
          await testData.initChargingStationContext2TestChargingTime();
        });

        it('should create a DRAFT invoice, Finalize it and Pay it', async () => {
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and but no invoiceNumber yet
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.DRAFT);
          // Let's simulate the periodic billing operation
          const operationResult: BillingChargeInvoiceAction = await testData.billingImpl.chargeInvoices(true /* forceOperation */);
          assert(operationResult.inSuccess > 0, 'The operation should have been able to process at least one invoice');
          assert(operationResult.inError === 0, 'The operation should detect any errors');
          // The transaction should now have a different status and know the final invoice number
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID);
          // The user should have no DRAFT invoices
          const nbDraftInvoices = await testData.checkForDraftInvoices();
          assert(nbDraftInvoices === 0, 'The expected number of DRAFT invoices is not correct');
        });

      });
    });
  });

});
