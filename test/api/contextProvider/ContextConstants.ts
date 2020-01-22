import faker from 'faker';

/**
 * Available contexts that can be used in the unit tests
 */
export default class CONTEXTS {
  static readonly TENANT_CONTEXTS: any = {
    TENANT_WITH_ALL_COMPONENTS: 'ut-all', // All components are active
    TENANT_WITH_NO_COMPONENTS: 'ut-nothing', // No components are active
    TENANT_ORGANIZATION: 'ut-org', // Only organization component is active
    TENANT_SIMPLE_PRICING: 'ut-pricing', // Only pricing component is active
    TENANT_CONVERGENT_CHARGING: 'ut-convcharg', // Only convergent charging component is active
    TENANT_OCPI: 'ut-ocpi', // Only ocpi component is active
    TENANT_FUNDING: 'ut-refund', // Only refund component is active
    TENANT_BILLING: 'ut-billing' // Only billing and pricing component is active
  };

  static readonly SITE_CONTEXTS: any = {
    NO_SITE: 'No site', // Used for unassigned Charging Station or CS in tenant with no organizations
    SITE_BASIC: 'ut-site', // Default site with no settings
    SITE_WITH_AUTO_USER_ASSIGNMENT: 'ut-site-auto', // Automatic user assignment is active
    SITE_WITH_OTHER_USER_STOP_AUTHORIZATION: 'ut-site-stop' // Authorization to stop other users transaction is active
  };

  static readonly SITE_AREA_CONTEXTS: any = {
    NO_SITE: 'No site', // Used for unassigned Charging Station or CS in tenant with no organizations
    WITH_ACL: 'withACL', // ACL is active
    WITHOUT_ACL: 'withoutACL' // ACL is inactive
  };

  static readonly CHARGING_STATION_CONTEXTS: any = {
    UNREGISTERED_OCPP16: faker.random.alphaNumeric(10),
    INVALID_IDENTIFIER_OCPP16: 'inv@l!d:1.6',
    ASSIGNED_OCPP16: 'cs-16', // Charging Station is assigned to each site area with OCPP16
    UNASSIGNED_OCPP16: 'cs-notassigned16', // Charging station is not assigned and use OCPP16
    UNREGISTERED_OCPP15: faker.random.alphaNumeric(10),
    INVALID_IDENTIFIER_OCPP15: 'inv@l!d-1,5',
    ASSIGNED_OCPP15: 'cs-15', // Charging Station is assigned to each site area with OCPP15
    UNASSIGNED_OCPP15: 'cs-notassigned15' // Charging station is not assigned and use OCPP15
  };

  static readonly USER_CONTEXTS: any = {
    DEFAULT_ADMIN: {
      role: 'A', status: 'A', assignedToSite: true, withTags: true
    },
    ADMIN_UNASSIGNED: {
      role: 'A', status: 'A', assignedToSite: false, withTags: true
    },
    BASIC_USER: {
      role: 'B', status: 'A', assignedToSite: true, withTags: true
    },
    BASIC_USER_UNASSIGNED: {
      role: 'B', status: 'A', assignedToSite: false, withTags: true
    },
    BASIC_USER_PENDING: {
      role: 'B', status: 'P', assignedToSite: true, withTags: true
    },
    BASIC_USER_LOCKED: {
      role: 'B', status: 'L', assignedToSite: true, withTags: true
    },
    BASIC_USER_NO_TAGS: {
      role: 'B', status: 'A', assignedToSite: true, withTags: false
    },
    DEMO_USER: {
      role: 'D', status: 'A', assignedToSite: true, withTags: true
    },
  };

  /**
   * Definition of the different contexts
   */
  static readonly TENANT_CONTEXT_LIST: any = [{
    // pragma contextName: CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS,
    tenantName: CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS,
    id: 'aaaaaaaaaaaaaaaaaaaaaaa1',
    subdomain: 'utall',
    componentSettings: {
      pricing: {
        type: 'simple',
        content: {
          simple: {
            price: 1,
            currency: 'EUR'
          }
        },
      },
      ocpi: {
        type: 'gireve',
        content: {
          countryCode: 'FR',
          partyId: 'UT',
          businessDetails: {
            name: 'Test OCPI',
            website: 'http://www.uttest.net'
          }
        }
      },
      organization: {},
      statistics: {},
      refund: {
        type: 'concur',
        content: {
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
        type: 'sac',
        content: {
          mainUrl: '',
          timezone: 'Europe/Paris'
        }
      },
      smartCharging: {
        type: 'sapSmartCharging',
        content: {
          optimizerUrl: '',
          user: '',
          password: ''
        }
      },
      billing: {
        type: 'stripe',
        content: {
          stripe: {
            currency: 'EUR',
            url: '',
            secretKey: '',
            publicKey: '',
            noCardAllowed: true,
            immediateBillingAllowed: true,
            periodicBillingAllowed: true,
            advanceBillingAllowed: true,
          }
        }
      }
    },
  },
  {
    // pragma contextName: CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
    tenantName: CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
    id: 'aaaaaaaaaaaaaaaaaaaaaaa2',
    subdomain: 'utnothing',
  },
  {
    // pragma contextName: CONTEXTS.TENANT_CONTEXTS.TENANT_ORGANIZATION,
    tenantName: CONTEXTS.TENANT_CONTEXTS.TENANT_ORGANIZATION,
    id: 'aaaaaaaaaaaaaaaaaaaaaaa3',
    subdomain: 'utorg',
    componentSettings: {
      organization: {}
    }
  },
  {
    // pragma contextName: CONTEXTS.TENANT_CONTEXTS.TENANT_SIMPLE_PRICING,
    tenantName: CONTEXTS.TENANT_CONTEXTS.TENANT_SIMPLE_PRICING,
    id: 'aaaaaaaaaaaaaaaaaaaaaaa4',
    subdomain: 'utprice',
    componentSettings: {
      pricing: {
        type: 'simple',
        content: {
          simple: {
            price: 1,
            currency: 'EUR'
          }
        }
      }
    },
  },
  {
    // pragma contextName: CONTEXTS.TENANT_CONTEXTS.TENANT_CONVERGENT_CHARGING,
    tenantName: CONTEXTS.TENANT_CONTEXTS.TENANT_CONVERGENT_CHARGING,
    id: 'aaaaaaaaaaaaaaaaaaaaaaa5',
    subdomain: 'utconvcharg',
    componentSettings: {
      pricing: {
        type: 'convergentCharging',
        content: {
          convergentCharging: {
            url: '',
            chargeableItemName: '',
            user: '',
            password: ''
          }
        }
      }
    },
  },
  {
    // pragma contextName: CONTEXTS.TENANT_CONTEXTS.TENANT_OCPI,
    tenantName: CONTEXTS.TENANT_CONTEXTS.TENANT_OCPI,
    id: 'aaaaaaaaaaaaaaaaaaaaaaa6',
    subdomain: 'utocpi',
    componentSettings: {
      ocpi: {
        type: 'gireve',
        content: {
          countryCode: 'FR',
          partyId: 'UT',
          businessDetails: {
            name: 'Test OCPI',
            website: 'http://www.uttest.net'
          }
        }
      },
    },
  },
  {
    // pragma contextName: CONTEXTS.TENANT_CONTEXTS.TENANT_FUNDING,
    tenantName: CONTEXTS.TENANT_CONTEXTS.TENANT_FUNDING,
    id: 'aaaaaaaaaaaaaaaaaaaaaaa7',
    subdomain: 'utrefund',
    componentSettings: {
      refund: {
        type: 'concur',
        content: {
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
    // pragma contextName: CONTEXTS.TENANT_CONTEXTS.TENANT_BILLING,
    tenantName: CONTEXTS.TENANT_CONTEXTS.TENANT_BILLING,
    id: 'aaaaaaaaaaaaaaaaaaaaaaa8',
    subdomain: 'utbilling',
    componentSettings: {
      pricing: {
        type: 'simple',
        content: {
          simple: {
            price: 1,
            currency: 'EUR'
          }
        }
      },
      billing: {
        type: 'stripe',
        content: {
          stripe: {
            currency: 'EUR',
            url: '',
            secretKey: '',
            publicKey: '',
            noCardAllowed: true,
            immediateBillingAllowed: true,
            periodicBillingAllowed: true,
            advanceBillingAllowed: true,
          }
        }
      }
    },
  }];

  // List of users created in a tenant
  static readonly TENANT_USER_LIST: any = [
    // Email and password are taken from config file for all users
    { // Default Admin user.
      id: '5ce249a1a39ae1c056c389bd',
      name: 'Admin',
      firstName: 'User',
      locale: 'en-US',
      phone: '66666666666',
      mobile: '66666666666',
      plateID: '666-FB-69',
      role: CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN.role,
      status: CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN.status,
      assignedToSite: CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN.assignedToSite,
      tags: (CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN.withTags ? [{
        id: 'A1234',
        issuer: false,
        deleted: false
      }] : null)
    },
    { // Admin not assigned
      id: '5ce249a1a39ae1c056c123ef',
      name: 'Admin',
      firstName: 'User',
      locale: 'en-US',
      phone: '66666666666',
      mobile: '66666666666',
      plateID: '666-FB-69',
      role: CONTEXTS.USER_CONTEXTS.ADMIN_UNASSIGNED.role,
      status: CONTEXTS.USER_CONTEXTS.ADMIN_UNASSIGNED.status,
      assignedToSite: CONTEXTS.USER_CONTEXTS.ADMIN_UNASSIGNED.assignedToSite,
      emailPrefix: 'a-unassigned-',
      tags: (CONTEXTS.USER_CONTEXTS.ADMIN_UNASSIGNED.withTags ? [{
        id: 'A12341',
        issuer: false,
        deleted: false
      }] : null)
    },
    { // Basic user
      id: '5ce249a1a39ae1c056c123ab',
      name: 'Basic',
      firstName: 'User',
      locale: 'en-US',
      phone: '66666666666',
      mobile: '66666666666',
      plateID: '666-FB-69',
      role: CONTEXTS.USER_CONTEXTS.BASIC_USER.role,
      status: CONTEXTS.USER_CONTEXTS.BASIC_USER.status,
      assignedToSite: CONTEXTS.USER_CONTEXTS.BASIC_USER.assignedToSite,
      emailPrefix: 'basic-',
      tags: (CONTEXTS.USER_CONTEXTS.BASIC_USER.withTags ? [{
        id: 'A12342',
        issuer: false,
        deleted: false
      }] : null)
    },
    { // Demo user
      id: '5ce249a1a39ae1c056c123cd',
      name: 'Demo',
      firstName: 'User',
      locale: 'en-US',
      phone: '66666666666',
      mobile: '66666666666',
      plateID: '666-FB-69',
      role: CONTEXTS.USER_CONTEXTS.DEMO_USER.role,
      status: CONTEXTS.USER_CONTEXTS.DEMO_USER.status,
      assignedToSite: CONTEXTS.USER_CONTEXTS.DEMO_USER.assignedToSite,
      emailPrefix: 'demo-',
      tags: (CONTEXTS.USER_CONTEXTS.DEMO_USER.withTags ? [{
        id: 'A12343',
        issuer: false,
        deleted: false
      }] : null)
    },
    { // Basic user unassigned
      id: '5ce249a1a39ae1c056c456ad',
      name: 'Basic',
      firstName: 'User',
      locale: 'en-US',
      phone: '66666666666',
      mobile: '66666666666',
      plateID: '666-FB-69',
      role: CONTEXTS.USER_CONTEXTS.BASIC_USER_UNASSIGNED.role,
      status: CONTEXTS.USER_CONTEXTS.BASIC_USER_UNASSIGNED.status,
      assignedToSite: CONTEXTS.USER_CONTEXTS.BASIC_USER_UNASSIGNED.assignedToSite,
      emailPrefix: 'b-unassigned-',
      tags: (CONTEXTS.USER_CONTEXTS.BASIC_USER_UNASSIGNED.withTags ? [{
        id: 'A12348',
        issuer: false,
        deleted: false
      }] : null)
    },
    { // Basic user pending
      id: '5ce249a1a39ae1c056c456ab',
      name: 'Basic',
      firstName: 'User',
      locale: 'en-US',
      phone: '66666666666',
      mobile: '66666666666',
      plateID: '666-FB-69',
      role: CONTEXTS.USER_CONTEXTS.BASIC_USER_PENDING.role,
      status: CONTEXTS.USER_CONTEXTS.BASIC_USER_PENDING.status,
      assignedToSite: CONTEXTS.USER_CONTEXTS.BASIC_USER_PENDING.assignedToSite,
      emailPrefix: 'b-pending-',
      tags: (CONTEXTS.USER_CONTEXTS.BASIC_USER_PENDING.withTags ? [{
        id: 'A12349',
        issuer: false,
        deleted: false
      }] : null)
    },
    { // Basic user Locked
      id: '5ce249a1a39ae1c056c789ef',
      name: 'Basic',
      firstName: 'User',
      locale: 'en-US',
      phone: '66666666666',
      mobile: '66666666666',
      plateID: '666-FB-69',
      role: CONTEXTS.USER_CONTEXTS.BASIC_USER_LOCKED.role,
      status: CONTEXTS.USER_CONTEXTS.BASIC_USER_LOCKED.status,
      assignedToSite: CONTEXTS.USER_CONTEXTS.BASIC_USER_LOCKED.assignedToSite,
      emailPrefix: 'b-locked-',
      tags: (CONTEXTS.USER_CONTEXTS.BASIC_USER_LOCKED.withTags ? [{
        id: 'A123410',
        issuer: false,
        deleted: false
      }] : null)
    },
    { // Basic user No Tags
      id: '5ce249a1a39ae1c056c567ab',
      name: 'Basic',
      firstName: 'User',
      locale: 'en-US',
      phone: '66666666666',
      mobile: '66666666666',
      plateID: '666-FB-69',
      role: CONTEXTS.USER_CONTEXTS.BASIC_USER_NO_TAGS.role,
      status: CONTEXTS.USER_CONTEXTS.BASIC_USER_NO_TAGS.status,
      assignedToSite: CONTEXTS.USER_CONTEXTS.BASIC_USER_NO_TAGS.assignedToSite,
      emailPrefix: 'b-notTag',
      tags: (CONTEXTS.USER_CONTEXTS.BASIC_USER_NO_TAGS.withTags ? [{
        id: 'A123411',
        issuer: false,
        deleted: false
      }] : null)
    }
  ];

  // List of companies created in a tenant where organization component is active
  static readonly TENANT_COMPANY_LIST: any = [
    { // Default company no settings yet
      id: '5ce249a2372f0b1c8caf928f'
    }
  ];

  // List of sites created in a tenant where organization component is active
  static readonly TENANT_SITE_LIST: any = [
    { // Default site
      // contextName: CONTEXTS.SITE_CONTEXTS.SITE_BASIC,
      id: '5ce249a2372f0b1c8caf9294',
      name: CONTEXTS.SITE_CONTEXTS.SITE_BASIC,
      autoUserSiteAssignment: false,
      companyID: '5ce249a2372f0b1c8caf928f'
    },
    { // Site with other user stop
      // contextName: CONTEXTS.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION,
      id: '5ce249a2372f0b1c8caf8367',
      name: CONTEXTS.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION,
      autoUserSiteAssignment: false,
      companyID: '5ce249a2372f0b1c8caf928f'
    },
    { // Site with auto user assignment
      // contextName: CONTEXTS.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT,
      id: '5ce249a2372f0b1c8caf6532',
      name: CONTEXTS.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT,
      autoUserSiteAssignment: true,
      companyID: '5ce249a2372f0b1c8caf928f'
    }
  ];

  // List of siteArea created in a tenant where organization component is active
  // sitename must refer an existing site from TENANT_SITE_LIST
  static readonly TENANT_SITEAREA_LIST: any = [
    { // With access control
      id: '5ce249a2372f0b1c8caf9294',
      name: `${CONTEXTS.SITE_CONTEXTS.SITE_BASIC}-${CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL}`,
      accessControl: true,
      siteName: CONTEXTS.SITE_CONTEXTS.SITE_BASIC
    },
    { // Without access control
      id: '5ce249a2372f0b1c8caf5476',
      name: `${CONTEXTS.SITE_CONTEXTS.SITE_BASIC}-${CONTEXTS.SITE_AREA_CONTEXTS.WITHOUT_ACL}`,
      accessControl: false,
      siteName: CONTEXTS.SITE_CONTEXTS.SITE_BASIC
    },
    { // With access control
      id: '5ce249a2372f0b1c8caf1234',
      name: `${CONTEXTS.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT}-${CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL}`,
      accessControl: true,
      siteName: CONTEXTS.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT
    },
    { // Without access control
      id: '5ce249a2372f0b1c8caf4678',
      name: `${CONTEXTS.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT}-${CONTEXTS.SITE_AREA_CONTEXTS.WITHOUT_ACL}`,
      accessControl: false,
      siteName: CONTEXTS.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT
    },
    { // With access control
      id: '5ce249a2372f0b1c8caf5497',
      name: `${CONTEXTS.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION}-${CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL}`,
      accessControl: true,
      siteName: CONTEXTS.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION
    },
    { // Without access control
      id: '5ce249a2372f0b1c8caf5432',
      name: `${CONTEXTS.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION}-${CONTEXTS.SITE_AREA_CONTEXTS.WITHOUT_ACL}`,
      accessControl: false,
      siteName: CONTEXTS.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION
    }
  ];

  // List of Charging Station created in a tenant
  // siteAreaNames must refer the site Areas where teh charging station will be created
  // if siteAreaNames is null then the CS will not be assigned or created in tenant with no porganization, so the baseName MUST be unique
  static readonly TENANT_CHARGING_STATION_LIST: any = [
    {
      baseName: CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16, // Concatenated with siteAreaName
      ocppVersion: '1.6',
      siteAreaNames: [
        `${CONTEXTS.SITE_CONTEXTS.SITE_BASIC}-${CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL}`,
        `${CONTEXTS.SITE_CONTEXTS.SITE_BASIC}-${CONTEXTS.SITE_AREA_CONTEXTS.WITHOUT_ACL}`,
        `${CONTEXTS.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT}-${CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL}`,
        `${CONTEXTS.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT}-${CONTEXTS.SITE_AREA_CONTEXTS.WITHOUT_ACL}`,
        `${CONTEXTS.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION}-${CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL}`,
        `${CONTEXTS.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION}-${CONTEXTS.SITE_AREA_CONTEXTS.WITHOUT_ACL}`]
    },
    {
      baseName: CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP15, // Concatenated with siteAreaName
      ocppVersion: '1.5',
      siteAreaNames: [
        `${CONTEXTS.SITE_CONTEXTS.SITE_BASIC}-${CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL}`,
        `${CONTEXTS.SITE_CONTEXTS.SITE_BASIC}-${CONTEXTS.SITE_AREA_CONTEXTS.WITHOUT_ACL}`,
        `${CONTEXTS.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT}-${CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL}`,
        `${CONTEXTS.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT}-${CONTEXTS.SITE_AREA_CONTEXTS.WITHOUT_ACL}`,
        `${CONTEXTS.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION}-${CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL}`,
        `${CONTEXTS.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION}-${CONTEXTS.SITE_AREA_CONTEXTS.WITHOUT_ACL}`]
    },
    {
      baseName: CONTEXTS.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP16,
      ocppVersion: '1.6',
      siteAreaNames: null,
    },
    {
      baseName: CONTEXTS.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP15,
      ocppVersion: '1.5',
      siteAreaNames: null,
    }
  ];

}
