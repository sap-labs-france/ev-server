import { AnalyticsSettingsType, BillingSettingsType, PricingSettingsType, RefundSettingsType, RoamingSettingsType, SettingDBContent, SmartChargingSettingsType } from '../../../src/types/Setting';

import { OCPPVersion } from '../../../src/types/ocpp/OCPPServer';
import { ObjectId } from 'mongodb';
import { Voltage } from '../../../src/types/ChargingStation';
import { faker } from '@faker-js/faker';

export interface TenantDefinition {
  id: string;
  subdomain: string;
  tenantName: string;
  componentSettings?: {
    pricing?: { content?: SettingDBContent };
    ocpi?: { content?: SettingDBContent };
    oicp?: { content?: SettingDBContent };
    organization?: { content?: SettingDBContent };
    statistics?: { content?: SettingDBContent };
    refund?: { content?: SettingDBContent };
    analytics?: { content?: SettingDBContent };
    smartCharging?: { content?: SettingDBContent };
    billing?: { content?: SettingDBContent };
    billingPlatform?: { content?: SettingDBContent };
    asset?: { content?: SettingDBContent };
    car?: { content?: SettingDBContent };
  };
}

export default class ContextDefinition {
  public static readonly TENANT_CONTEXTS: Record<string, string> = {
    TENANT_WITH_ALL_COMPONENTS: 'utall', // All components are active
    TENANT_WITH_NO_COMPONENTS: 'utnothing', // No components are active
    TENANT_ORGANIZATION: 'utorg', // Only organization component is active
    TENANT_SIMPLE_PRICING: 'utpricing', // Only pricing component is active
    TENANT_OCPI: 'utocpi', // Only ocpi component is active
    TENANT_OICP: 'utoicp', // Only ocpi component is active
    TENANT_FUNDING: 'utrefund', // Only refund component is active
    TENANT_BILLING: 'utbilling', // Only billing and pricing component is active
    TENANT_BILLING_PLATFORM: 'utbillingplatform', // Only billing, pricing and billingplatform component is active
    TENANT_ASSET: 'utasset', // Only asset component is active
    TENANT_CAR: 'utcar', // Only car component is active
    TENANT_SMART_CHARGING: 'utsmartcharging' // Organization and Smart Charging components are active
  };

  public static readonly SITE_CONTEXTS: Record<string, string> = {
    NO_SITE: 'No site', // Used for unassigned Charging Station or CS in tenant with no organizations
    SITE_BASIC: 'ut-site', // Default site with no settings
    SITE_WITH_AUTO_USER_ASSIGNMENT: 'ut-site-auto', // Automatic user assignment is active
    SITE_WITH_OTHER_USER_STOP_AUTHORIZATION: 'ut-site-stop' // Authorization to stop other users transaction is active
  };

  public static readonly SITE_AREA_CONTEXTS: Record<string, string> = {
    NO_SITE: 'No site', // Used for unassigned Charging Station or CS in tenant with no organizations
    WITH_ACL: 'withACL', // ACL is active
    WITHOUT_ACL: 'withoutACL', // ACL is inactive
    WITH_SMART_CHARGING_THREE_PHASED: 'withSmartChargingThreePhased', // Smart Charging is active three phased
    WITH_SMART_CHARGING_SINGLE_PHASED: 'withSmartChargingSinglePhased', // Smart Charging is active single phased
    WITH_SMART_CHARGING_DC: 'withSmartChargingDC', // Smart Charging is active DC
  };

  public static readonly CHARGING_STATION_CONTEXTS: Record<string, string> = {
    UNREGISTERED_OCPP16: faker.random.alphaNumeric(10),
    INVALID_IDENTIFIER_OCPP16: 'inv@l!d:1.6',
    ASSIGNED_OCPP16: 'cs-16', // Charging Station is assigned to each site area with OCPP16
    UNASSIGNED_OCPP16: 'cs-notassigned16', // Charging station is not assigned and use OCPP16
    UNKNOWN_OCPP16: 'cs-unknown16', // Charging station is not in template and use OCPP16
    UNREGISTERED_OCPP15: faker.random.alphaNumeric(10),
    INVALID_IDENTIFIER_OCPP15: 'inv@l!d-1,5',
    ASSIGNED_OCPP15: 'cs-15', // Charging Station is assigned to each site area with OCPP15
    UNASSIGNED_OCPP15: 'cs-notassigned15', // Charging station is not assigned and use OCPP15
    UNKNOWN_OCPP15: 'cs-unknown15' // Charging station is not in template and use OCPP15
  };

  public static readonly USER_CONTEXTS: Record<string, any> = {
    DEFAULT_ADMIN: {
      role: 'A', status: 'A', assignedToSite: true, withTags: true, issuer: true
    },
    ADMIN_UNASSIGNED: {
      role: 'A', status: 'A', assignedToSite: false, withTags: true, issuer: true
    },
    SUPER_ADMIN: {
      role: 'S', status: 'S', assignedToSite: true, withTags: true, issuer: true
    },
    BASIC_USER: {
      role: 'B', status: 'A', assignedToSite: true, withTags: true, issuer: true
    },
    BASIC_USER_UNASSIGNED: {
      role: 'B', status: 'A', assignedToSite: false, withTags: true, issuer: true
    },
    BASIC_USER_PENDING: {
      role: 'B', status: 'P', assignedToSite: true, withTags: true, issuer: true
    },
    BASIC_USER_LOCKED: {
      role: 'B', status: 'L', assignedToSite: true, withTags: true, issuer: true
    },
    BASIC_USER_NO_TAGS: {
      role: 'B', status: 'A', assignedToSite: true, withTags: false, issuer: true
    },
    DEMO_USER: {
      role: 'D', status: 'A', assignedToSite: true, withTags: true, issuer: true
    },
    EXTERNAL_USER: {
      role: 'B', status: 'A', assignedToSite: false, withTags: true, issuer: false
    },
  };


  /**
   * Price of the consumed energy - 1 Euros / kWh
   */
  public static readonly DEFAULT_PRICE = 1;

  /**
   * Definition of the different contexts
   */
  public static readonly TENANT_CONTEXT_LIST: TenantDefinition[] = [{
    tenantName: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS,
    id: 'aaaaaaaaaaaaaaaaaaaaaaa1',
    subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS,
    componentSettings: {
      pricing: {
        content: {
          type: PricingSettingsType.SIMPLE,
          simple: {
            price: ContextDefinition.DEFAULT_PRICE,
            currency: 'EUR'
          }
        },
      },
      car: {},
      asset: {},
      ocpi: {
        content: {
          type: RoamingSettingsType.OCPI,
          ocpi: {
            currency: 'EUR',
            cpo: {
              countryCode: 'FR',
              partyID: 'UT',
            },
            emsp: {
              countryCode: 'FR',
              partyID: 'UT',
            },
            businessDetails: {
              name: 'Test OCPI',
              website: 'http://www.uttest.net'
            }
          }
        }
      },
      organization: {},
      statistics: {},
      refund: {
        content: {
          type: RefundSettingsType.CONCUR,
          concur: {
            authenticationUrl: '',
            apiUrl: '',
            appUrl: '',
            clientId: '',
            clientSecret: '',
            paymentTypeId: '',
            expenseTypeCode: '',
            policyId: '',
            reportName: ''
          }
        }
      },
      analytics: {
        content: {
          type: AnalyticsSettingsType.SAC,
          sac: {
            mainUrl: '',
            timezone: 'Europe/Paris'
          }
        }
      },
      smartCharging: {
        content: {
          type: SmartChargingSettingsType.SAP_SMART_CHARGING,
          sapSmartCharging: {
            optimizerUrl: '',
            user: '',
            password: '',
            stickyLimitation: true,
            limitBufferDC: 20,
            limitBufferAC: 10
          }
        }
      },
      billing: {
        content: {
          type: BillingSettingsType.STRIPE,
          billing: {
            isTransactionBillingActivated: true,
            immediateBillingAllowed: true,
            periodicBillingAllowed: true,
            taxID: ''
          },
          stripe: {
            url: '',
            secretKey: '',
            publicKey: '',
          }
        }
      }
    },
  },
  {
    tenantName: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
    id: 'aaaaaaaaaaaaaaaaaaaaaaa2',
    subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
  },
  {
    tenantName: ContextDefinition.TENANT_CONTEXTS.TENANT_ORGANIZATION,
    id: 'aaaaaaaaaaaaaaaaaaaaaaa3',
    subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_ORGANIZATION,
    componentSettings: {
      organization: {}
    }
  },
  {
    tenantName: ContextDefinition.TENANT_CONTEXTS.TENANT_SIMPLE_PRICING,
    id: 'aaaaaaaaaaaaaaaaaaaaaaa4',
    subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_SIMPLE_PRICING,
    componentSettings: {
      pricing: {
        content: {
          type: PricingSettingsType.SIMPLE,
          simple: {
            price: ContextDefinition.DEFAULT_PRICE,
            currency: 'EUR'
          }
        }
      }
    },
  },
  {
    tenantName: ContextDefinition.TENANT_CONTEXTS.TENANT_OCPI,
    id: 'aaaaaaaaaaaaaaaaaaaaaaa6',
    subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_OCPI,
    componentSettings: {
      ocpi: {
        content: {
          type: RoamingSettingsType.OCPI,
          ocpi: {
            cpo: {
              countryCode: 'FR',
              partyID: 'UT',
            },
            emsp: {
              countryCode: 'FR',
              partyID: 'UT',
            },
            currency: 'EUR',
            businessDetails: {
              name: 'Test OCPI',
              website: 'http://www.uttest.net'
            }
          }
        }
      },
    },
  },
  {
    tenantName: ContextDefinition.TENANT_CONTEXTS.TENANT_FUNDING,
    id: 'aaaaaaaaaaaaaaaaaaaaaaa7',
    subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_FUNDING,
    componentSettings: {
      pricing: {
        content: {
          type: PricingSettingsType.SIMPLE,
          simple: {
            price: ContextDefinition.DEFAULT_PRICE,
            currency: 'EUR'
          }
        }
      },
      refund: {
        content: {
          type: RefundSettingsType.CONCUR,
          concur: {
            authenticationUrl: '',
            apiUrl: '',
            appUrl: '',
            clientId: '',
            clientSecret: '',
            paymentTypeId: '',
            expenseTypeCode: '',
            policyId: '',
            reportName: ''
          }
        }
      }
    }
  },
  {
    tenantName: ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING,
    id: 'aaaaaaaaaaaaaaaaaaaaaaa8',
    subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING,
    componentSettings: {
      pricing: {
        content: {
          type: PricingSettingsType.SIMPLE,
          simple: {
            price: ContextDefinition.DEFAULT_PRICE,
            currency: 'USD'
          }
        }
      },
      billing: {
        content: {
          type: BillingSettingsType.STRIPE,
          billing: {
            isTransactionBillingActivated: true,
            immediateBillingAllowed: true,
            periodicBillingAllowed: true,
            taxID: ''
          },
          stripe: {
            url: '',
            secretKey: '',
            publicKey: '',
          }
        }
      },
      organization: {},
    },
  },
  {
    tenantName: ContextDefinition.TENANT_CONTEXTS.TENANT_ASSET,
    id: 'aaaaaaaaaaaaaaaaaaaaaaa9',
    subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_ASSET,
    componentSettings: {
      asset: {},
      organization: {}
    }
  },
  {
    tenantName: ContextDefinition.TENANT_CONTEXTS.TENANT_CAR,
    id: 'aaaaaaaaaaaaaaaaaaaaaab1',
    subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_CAR,
    componentSettings: {
      car: {},
    }
  },
  {
    tenantName: ContextDefinition.TENANT_CONTEXTS.TENANT_SMART_CHARGING,
    id: 'aaaaaaaaaaaaaaaaaaaaaab2',
    subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_SMART_CHARGING,
    componentSettings: {
      organization: {},
      asset: {},
      smartCharging:
      {
        content:
        {
          type: SmartChargingSettingsType.SAP_SMART_CHARGING, sapSmartCharging:
          {
            optimizerUrl: '',
            user: '',
            password: '',
            stickyLimitation: true,
            limitBufferDC: 20,
            limitBufferAC: 10
          }
        }
      },
    }
  },
  {
    tenantName: ContextDefinition.TENANT_CONTEXTS.TENANT_OICP,
    id: 'aaaaaaaaaaaaaaaaaaaaaab3',
    subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_OICP,
    componentSettings: {
      oicp: {
        content: {
          type: RoamingSettingsType.OICP,
          oicp: {
            cpo: {
              countryCode: 'FR',
              partyID: 'UT',
            },
            emsp: {
              countryCode: 'FR',
              partyID: 'UT',
            },
            currency: 'EUR',
            businessDetails: {
              name: 'Test OICP',
              website: 'http://www.utoicp.net'
            }
          }
        }
      },
    },
  },
  {
    tenantName: ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING_PLATFORM,
    id: 'aaaaaaaaaaaaaaaaaaaaaab4',
    subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING_PLATFORM,
    componentSettings: {
      pricing: {
        content: {
          type: PricingSettingsType.SIMPLE,
          simple: {
            price: ContextDefinition.DEFAULT_PRICE,
            currency: 'USD'
          }
        }
      },
      billing: {
        content: {
          type: BillingSettingsType.STRIPE,
          billing: {
            isTransactionBillingActivated: true,
            immediateBillingAllowed: true,
            periodicBillingAllowed: true,
            taxID: ''
          },
          stripe: {
            url: '',
            secretKey: '',
            publicKey: '',
          }
        }
      },
      billingPlatform: {
      },
      organization: {},
    },
  },
  ];

  // List of users created in a tenant
  public static readonly TENANT_USER_LIST: any[] = [
    // Email and password are taken from config file for all users
    { // Default Admin user.
      id: '5ce249a1a39ae1c056c389bd',
      name: 'Admin',
      firstName: 'User',
      locale: 'en-US',
      phone: '66666666666',
      mobile: '66666666666',
      plateID: '666-FB-69',
      issuer: ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN.issuer,
      role: ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN.role,
      status: ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN.status,
      assignedToSite: ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN.assignedToSite,
      tags: (ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN.withTags ? [{
        id: 'A1234',
        visualID: new ObjectId().toString(),
        issuer: false,
        active: true
      }] : null),
    },
    { // Admin not assigned
      id: '5ce249a1a39ae1c056c123ef',
      name: 'Admin',
      firstName: 'User',
      locale: 'en-US',
      phone: '66666666666',
      mobile: '66666666666',
      plateID: '666-FB-69',
      issuer: ContextDefinition.USER_CONTEXTS.ADMIN_UNASSIGNED.issuer,
      role: ContextDefinition.USER_CONTEXTS.ADMIN_UNASSIGNED.role,
      status: ContextDefinition.USER_CONTEXTS.ADMIN_UNASSIGNED.status,
      assignedToSite: ContextDefinition.USER_CONTEXTS.ADMIN_UNASSIGNED.assignedToSite,
      emailPrefix: 'a-unassigned-',
      tags: (ContextDefinition.USER_CONTEXTS.ADMIN_UNASSIGNED.withTags ? [{
        id: 'A12341',
        visualID: new ObjectId().toString(),
        issuer: false,
        active: true
      }] : null),
    },
    { // Basic user
      id: '5ce249a1a39ae1c056c123ab',
      name: 'Basic',
      firstName: 'User',
      locale: 'en-US',
      phone: '66666666666',
      mobile: '66666666666',
      plateID: '666-FB-69',
      issuer: ContextDefinition.USER_CONTEXTS.BASIC_USER.issuer,
      role: ContextDefinition.USER_CONTEXTS.BASIC_USER.role,
      status: ContextDefinition.USER_CONTEXTS.BASIC_USER.status,
      assignedToSite: ContextDefinition.USER_CONTEXTS.BASIC_USER.assignedToSite,
      emailPrefix: 'basic-',
      tags: (ContextDefinition.USER_CONTEXTS.BASIC_USER.withTags ? [{
        id: 'A12342',
        visualID: new ObjectId().toString(),
        issuer: false,
        active: true
      }] : null),
    },
    { // Demo user
      id: '5ce249a1a39ae1c056c123cd',
      name: 'Demo',
      firstName: 'User',
      locale: 'en-US',
      phone: '66666666666',
      mobile: '66666666666',
      plateID: '666-FB-69',
      issuer: ContextDefinition.USER_CONTEXTS.DEMO_USER.issuer,
      role: ContextDefinition.USER_CONTEXTS.DEMO_USER.role,
      status: ContextDefinition.USER_CONTEXTS.DEMO_USER.status,
      assignedToSite: ContextDefinition.USER_CONTEXTS.DEMO_USER.assignedToSite,
      emailPrefix: 'demo-',
      tags: (ContextDefinition.USER_CONTEXTS.DEMO_USER.withTags ? [{
        id: 'A12343',
        visualID: new ObjectId().toString(),
        issuer: false,
        active: true
      }] : null),
      freeAccess: false,
    },
    { // Basic user unassigned
      id: '5ce249a1a39ae1c056c456ad',
      name: 'Basic',
      firstName: 'User',
      locale: 'en-US',
      phone: '66666666666',
      mobile: '66666666666',
      plateID: '666-FB-69',
      issuer: ContextDefinition.USER_CONTEXTS.BASIC_USER_UNASSIGNED.issuer,
      role: ContextDefinition.USER_CONTEXTS.BASIC_USER_UNASSIGNED.role,
      status: ContextDefinition.USER_CONTEXTS.BASIC_USER_UNASSIGNED.status,
      assignedToSite: ContextDefinition.USER_CONTEXTS.BASIC_USER_UNASSIGNED.assignedToSite,
      emailPrefix: 'b-unassigned-',
      tags: (ContextDefinition.USER_CONTEXTS.BASIC_USER_UNASSIGNED.withTags ? [{
        id: 'A12348',
        visualID: new ObjectId().toString(),
        issuer: false,
        active: true
      }] : null),
    },
    { // Basic user pending
      id: '5ce249a1a39ae1c056c456ab',
      name: 'Basic',
      firstName: 'User',
      locale: 'en-US',
      phone: '66666666666',
      mobile: '66666666666',
      plateID: '666-FB-69',
      issuer: ContextDefinition.USER_CONTEXTS.BASIC_USER_PENDING.issuer,
      role: ContextDefinition.USER_CONTEXTS.BASIC_USER_PENDING.role,
      status: ContextDefinition.USER_CONTEXTS.BASIC_USER_PENDING.status,
      assignedToSite: ContextDefinition.USER_CONTEXTS.BASIC_USER_PENDING.assignedToSite,
      emailPrefix: 'b-pending-',
      tags: (ContextDefinition.USER_CONTEXTS.BASIC_USER_PENDING.withTags ? [{
        id: 'A12349',
        visualID: new ObjectId().toString(),
        issuer: false,
        active: true
      }] : null),
      freeAccess: false,
    },
    { // Basic user Locked
      id: '5ce249a1a39ae1c056c789ef',
      name: 'Basic',
      firstName: 'User',
      locale: 'en-US',
      phone: '66666666666',
      mobile: '66666666666',
      plateID: '666-FB-69',
      issuer: ContextDefinition.USER_CONTEXTS.BASIC_USER_LOCKED.issuer,
      role: ContextDefinition.USER_CONTEXTS.BASIC_USER_LOCKED.role,
      status: ContextDefinition.USER_CONTEXTS.BASIC_USER_LOCKED.status,
      assignedToSite: ContextDefinition.USER_CONTEXTS.BASIC_USER_LOCKED.assignedToSite,
      emailPrefix: 'b-locked-',
      tags: (ContextDefinition.USER_CONTEXTS.BASIC_USER_LOCKED.withTags ? [{
        id: 'A123410',
        visualID: new ObjectId().toString(),
        issuer: false,
        active: true
      }] : null),
      freeAccess: false,
    },
    { // Basic user No Tags
      id: '5ce249a1a39ae1c056c567ab',
      name: 'Basic',
      firstName: 'User',
      locale: 'en-US',
      phone: '66666666666',
      mobile: '66666666666',
      plateID: '666-FB-69',
      issuer: ContextDefinition.USER_CONTEXTS.BASIC_USER_NO_TAGS.issuer,
      role: ContextDefinition.USER_CONTEXTS.BASIC_USER_NO_TAGS.role,
      status: ContextDefinition.USER_CONTEXTS.BASIC_USER_NO_TAGS.status,
      assignedToSite: ContextDefinition.USER_CONTEXTS.BASIC_USER_NO_TAGS.assignedToSite,
      emailPrefix: 'b-notTag',
      tags: (ContextDefinition.USER_CONTEXTS.BASIC_USER_NO_TAGS.withTags ? [{
        id: 'A123411',
        visualID: new ObjectId().toString(),
        issuer: false,
        active: true
      }] : null),
      freeAccess: false,
    },
    { // External User
      id: '5ce249a1a39ae1c056c456ae',
      name: 'External',
      firstName: 'User',
      locale: 'en-US',
      phone: '66666666666',
      mobile: '66666666666',
      plateID: '666-FB-69',
      issuer: ContextDefinition.USER_CONTEXTS.EXTERNAL_USER.issuer,
      role: ContextDefinition.USER_CONTEXTS.EXTERNAL_USER.role,
      status: ContextDefinition.USER_CONTEXTS.EXTERNAL_USER.status,
      assignedToSite: ContextDefinition.USER_CONTEXTS.EXTERNAL_USER.assignedToSite,
      emailPrefix: 'b-external-',
      tags: (ContextDefinition.USER_CONTEXTS.EXTERNAL_USER.withTags ? [{
        id: 'A220311',
        visualID: new ObjectId().toString(),
        issuer: false,
        active: true
      }] : null),
      freeAccess: false,
    }
  ];

  // List of companies created in a tenant where organization component is active
  public static readonly TENANT_COMPANY_LIST: any[] = [
    { // Default company no settings yet
      id: '5ce249a2372f0b1c8caf928f'
    },
    { // Second company no settings yet
      id: '5ce249a2372f0b1c8caf928e'
    }
  ];

  // List of sites created in a tenant where organization component is active
  public static readonly TENANT_SITE_LIST: any[] = [
    { // Default site
      // contextName: ContextDefinition.SITE_CONTEXTS.SITE_BASIC,
      id: '5ce249a2372f0b1c8caf9294',
      name: ContextDefinition.SITE_CONTEXTS.SITE_BASIC,
      autoUserSiteAssignment: false,
      public: true,
      companyID: '5ce249a2372f0b1c8caf928f'
    },
    { // Site with other user stop
      // contextName: ContextDefinition.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION,
      id: '5ce249a2372f0b1c8caf8367',
      name: ContextDefinition.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION,
      autoUserSiteAssignment: false,
      public: true,
      companyID: '5ce249a2372f0b1c8caf928f'
    },
    { // Site with auto user assignment
      // contextName: ContextDefinition.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT,
      id: '5ce249a2372f0b1c8caf6532',
      name: ContextDefinition.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT,
      autoUserSiteAssignment: true,
      public: true,
      companyID: '5ce249a2372f0b1c8caf928f'
    }
  ];

  // List of siteArea created in a tenant where organization component is active
  // sitename must refer an existing site from TENANT_SITE_LIST
  public static readonly TENANT_SITEAREA_LIST: any[] = [
    { // With access control
      id: '5ce249a2372f0b1c8caf9294',
      name: `${ContextDefinition.SITE_CONTEXTS.SITE_BASIC}-${ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL}`,
      numberOfPhases: 3,
      accessControl: true,
      siteName: ContextDefinition.SITE_CONTEXTS.SITE_BASIC,
      voltage: Voltage.VOLTAGE_230
    },
    { // Without access control
      id: '5ce249a2372f0b1c8caf5476',
      name: `${ContextDefinition.SITE_CONTEXTS.SITE_BASIC}-${ContextDefinition.SITE_AREA_CONTEXTS.WITHOUT_ACL}`,
      numberOfPhases: 3,
      accessControl: false,
      siteName: ContextDefinition.SITE_CONTEXTS.SITE_BASIC,
      voltage: Voltage.VOLTAGE_230
    },
    { // With access control
      id: '5ce249a2372f0b1c8caf1234',
      name: `${ContextDefinition.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT}-${ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL}`,
      numberOfPhases: 3,
      accessControl: true,
      siteName: ContextDefinition.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT,
      voltage: Voltage.VOLTAGE_230
    },
    { // Without access control
      id: '5ce249a2372f0b1c8caf4678',
      name: `${ContextDefinition.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT}-${ContextDefinition.SITE_AREA_CONTEXTS.WITHOUT_ACL}`,
      numberOfPhases: 3,
      accessControl: false,
      siteName: ContextDefinition.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT,
      voltage: Voltage.VOLTAGE_230
    },
    { // With access control
      id: '5ce249a2372f0b1c8caf5497',
      name: `${ContextDefinition.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION}-${ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL}`,
      numberOfPhases: 3,
      accessControl: true,
      siteName: ContextDefinition.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION,
      voltage: Voltage.VOLTAGE_230
    },
    { // Without access control
      id: '5ce249a2372f0b1c8caf5432',
      name: `${ContextDefinition.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION}-${ContextDefinition.SITE_AREA_CONTEXTS.WITHOUT_ACL}`,
      numberOfPhases: 3,
      accessControl: false,
      siteName: ContextDefinition.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION,
      voltage: Voltage.VOLTAGE_230
    },
    // Smart Charging must be deactivated. (Connection to CS will fail, because they do not exist)
    { // With smart charging three phased
      id: '5ce249a2372f0b1c8caf5442',
      name: `${ContextDefinition.SITE_CONTEXTS.SITE_BASIC}-${ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_THREE_PHASED}`,
      numberOfPhases: 3,
      accessControl: true,
      maximumPower: 100000,
      smartCharging: true,
      parentSiteAreaID: '5ce249a2372f0b1c8caf5444',
      voltage: Voltage.VOLTAGE_230,
      siteName: ContextDefinition.SITE_CONTEXTS.SITE_BASIC
    },
    { // With smart charging single phased
      id: '5ce249a2372f0b1c8caf5443',
      name: `${ContextDefinition.SITE_CONTEXTS.SITE_BASIC}-${ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_SINGLE_PHASED}`,
      numberOfPhases: 1,
      maximumPower: 100000,
      smartCharging: true,
      voltage: Voltage.VOLTAGE_230,
      siteName: ContextDefinition.SITE_CONTEXTS.SITE_BASIC
    },
    { // With smart charging DC
      id: '5ce249a2372f0b1c8caf5444',
      name: `${ContextDefinition.SITE_CONTEXTS.SITE_BASIC}-${ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_DC}`,
      numberOfPhases: 3,
      accessControl: true,
      maximumPower: 200000,
      smartCharging: true,
      voltage: Voltage.VOLTAGE_230,
      siteName: ContextDefinition.SITE_CONTEXTS.SITE_BASIC
    }
  ];


  // List of Charging Station created in a tenant
  // siteAreaNames must refer the site Areas where teh charging station will be created
  // if siteAreaNames is null then the CS will not be assigned or created in tenant with no organization, so the baseName MUST be unique
  public static readonly TENANT_CHARGING_STATION_LIST: any[] = [
    {
      baseName: ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16, // Concatenated with siteAreaName
      ocppVersion: OCPPVersion.VERSION_16,
      siteAreaNames: [
        `${ContextDefinition.SITE_CONTEXTS.SITE_BASIC}-${ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL}`,
        `${ContextDefinition.SITE_CONTEXTS.SITE_BASIC}-${ContextDefinition.SITE_AREA_CONTEXTS.WITHOUT_ACL}`,
        `${ContextDefinition.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT}-${ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL}`,
        `${ContextDefinition.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT}-${ContextDefinition.SITE_AREA_CONTEXTS.WITHOUT_ACL}`,
        `${ContextDefinition.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION}-${ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL}`,
        `${ContextDefinition.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION}-${ContextDefinition.SITE_AREA_CONTEXTS.WITHOUT_ACL}`,
        `${ContextDefinition.SITE_CONTEXTS.SITE_BASIC}-${ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_THREE_PHASED}`,
        `${ContextDefinition.SITE_CONTEXTS.SITE_BASIC}-${ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_SINGLE_PHASED}`,
        `${ContextDefinition.SITE_CONTEXTS.SITE_BASIC}-${ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_DC}`]
    },
    {
      baseName: ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP15, // Concatenated with siteAreaName
      ocppVersion: OCPPVersion.VERSION_15,
      siteAreaNames: [
        `${ContextDefinition.SITE_CONTEXTS.SITE_BASIC}-${ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL}`,
        `${ContextDefinition.SITE_CONTEXTS.SITE_BASIC}-${ContextDefinition.SITE_AREA_CONTEXTS.WITHOUT_ACL}`,
        `${ContextDefinition.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT}-${ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL}`,
        `${ContextDefinition.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT}-${ContextDefinition.SITE_AREA_CONTEXTS.WITHOUT_ACL}`,
        `${ContextDefinition.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION}-${ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL}`,
        `${ContextDefinition.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION}-${ContextDefinition.SITE_AREA_CONTEXTS.WITHOUT_ACL}`]
    },
    {
      baseName: ContextDefinition.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP16,
      ocppVersion: OCPPVersion.VERSION_16,
      siteAreaNames: null,
    },
    {
      baseName: ContextDefinition.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP15,
      ocppVersion: OCPPVersion.VERSION_15,
      siteAreaNames: null,
    }
  ];

  // List of assets created in a tenant where organization component is active
  public static readonly TENANT_ASSET_LIST: any[] = [
    {
      id: '5e68ae9e2fa3df719875edef',
      siteAreaID: '5ce249a2372f0b1c8caf9294'
    },
    {
      id: '5e7a4509fe033d9842cfd545',
      siteAreaID: '5ce249a2372f0b1c8caf9294'
    },
    {
      id: '5e7b41b76b802f26bcce005d',
      siteAreaID: '5ce249a2372f0b1c8caf5476'
    },
    {
      id: '5e7b434f6b802f26bcce0066',
      siteAreaID: '5ce249a2372f0b1c8caf5432'
    }
  ];
}
