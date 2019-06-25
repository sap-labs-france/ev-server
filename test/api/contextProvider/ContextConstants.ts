export default class CONTEXTS {
  /**************************************
  * Available contexts that can be used in the unit tests
  ***************************************/
  static readonly TENANT_CONTEXTS: any = {
    TENANT_WITH_ALL_COMPONENTS: "ut-all", // All components are active
    TENANT_WITH_NO_COMPONENTS: "ut-nothing", // No components are active
    TENANT_ORGANIZATION: "ut-org", // Only organization component is active
    TENANT_SIMPLE_PRICING: "ut-pricing", // Only pricing component is active
    TENANT_CONVERGENT_CHARGING: "ut-convcharg", // Only convergent charging component is active
    TENANT_OCPI: "ut-ocpi", // Only ocpi component is active
    TENANT_FUNDING: "ut-refund" // Only organization component is active
  };

  static readonly SITE_CONTEXTS: any = {
    NO_SITE: "No site", // Used for unassigned Charging Station or CS in tenant with no organizations
    SITE_BASIC: "ut-site", // Default site with no settings
    SITE_WITH_AUTO_USER_ASSIGNMENT: "ut-site-auto", // Automatic user assignment is active
    SITE_WITH_OTHER_USER_STOP_AUTHPORIZATION: "ut-site-stop" // Authorization to stop other users transaction is active
  };

  static readonly SITE_AREA_CONTEXTS: any = {
    NO_SITE: "No site", // Used for unassigned Charging Station or CS in tenant with no organizations
    WITH_ACL: "withACL",  // ACL is active
    WITHOUT_ACL: "withoutACL" // ACL is inactive
  };

  static readonly CHARGING_STATION_CONTEXTS: any = {
    ASSIGNED_OCCP16: "cs-16", // Charging Station is assigned to each site area with OCPP16
    UNASSIGNED_OCPP16: "cs-notassigned" // Charging station is not assigned and use OCPP16
  };

  static readonly USER_CONTEXTS: any = {
    DEFAULT_ADMIN: {
      role: 'A', status: 'A', assignedToSite: true, withTagIDs: true
    },
    ADMIN_UNASSIGNED: {
      role: 'A', status: 'A', assignedToSite: false, withTagIDs: true
    },
    BASIC_USER: {
      role: 'B', status: 'A', assignedToSite: true, withTagIDs: true
    },
    BASIC_USER_UNASSIGNED: {
      role: 'B', status: 'A', assignedToSite: false, withTagIDs: true
    },
    BASIC_USER_PENDING: {
      role: 'B', status: 'P', assignedToSite: true, withTagIDs: true
    },
    BASIC_USER_LOCKED: {
      role: 'B', status: 'L', assignedToSite: true, withTagIDs: true
    },
    BASIC_USER_NO_TAGS: {
      role: 'B', status: 'A', assignedToSite: true, withTagIDs: false
    },
    DEMO_USER: {
      role: 'D', status: 'A', assignedToSite: true, withTagIDs: true
    },
  };

// export class CONTEXTS_DEFINITION {
  /*
  * Definition of the different contexts
  */

  static readonly TENANT_CONTEXT_LIST: any = [{
    // contextName: CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS,
    tenantName: CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS,
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
      organization: {
      },
      statistics: {
      },
      refund: {
        type: 'concur',
        content: {
          concur: {
            authenticationUrl: '',
            apiUrl: '',
            clientId: '',
            clientSecret: '',
            payementTypeId: '',
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
      }
    },
  },
  {
    // contextName: CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
    tenantName: CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
    subdomain: 'utnothing',
  },
  {
    // contextName: CONTEXTS.TENANT_CONTEXTS.TENANT_ORGANIZATION,
    tenantName: CONTEXTS.TENANT_CONTEXTS.TENANT_ORGANIZATION,
    subdomain: 'utorg',
    componentSettings: {
      organization: {
      }
    }
  },
  {
    // contextName: CONTEXTS.TENANT_CONTEXTS.TENANT_SIMPLE_PRICING,
    tenantName: CONTEXTS.TENANT_CONTEXTS.TENANT_SIMPLE_PRICING,
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
    // contextName: CONTEXTS.TENANT_CONTEXTS.TENANT_CONVERGENT_CHARGING,
    tenantName: CONTEXTS.TENANT_CONTEXTS.TENANT_CONVERGENT_CHARGING,
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
    // contextName: CONTEXTS.TENANT_CONTEXTS.TENANT_OCPI,
    tenantName: CONTEXTS.TENANT_CONTEXTS.TENANT_OCPI,
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
    // contextName: CONTEXTS.TENANT_CONTEXTS.TENANT_FUNDING,
    tenantName: CONTEXTS.TENANT_CONTEXTS.TENANT_FUNDING,
    subdomain: 'utrefund',
    componentSettings: {
      refund: {
        type: 'concur',
        content: {
            concur: {
              authenticationUrl: '',
              apiUrl: '',
              clientId: '',
              clientSecret: '',
              payementTypeId: '',
              expenseTypeCode: '',
              policyId: '',
              reportName: ''
            }
          }
        }
      },
  }];

  // List of users created in a tenant
  static readonly TENANT_USER_LIST: any = [
    // email and password are taken from config file for all users
    { // Default Admin user.
      id: '5ce249a1a39ae1c056c389bd',
      role: CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN.role,
      status: CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN.status,
      assignedToSite: CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN.assignedToSite,
      tagIDs: (CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN.withTagIDs ? ['A1234'] : null)
    },
    { // Admin not assigned
      id: '5ce249a1a39ae1c056c123ef',
      role: CONTEXTS.USER_CONTEXTS.ADMIN_UNASSIGNED.role,
      status: CONTEXTS.USER_CONTEXTS.ADMIN_UNASSIGNED.status,
      assignedToSite: CONTEXTS.USER_CONTEXTS.ADMIN_UNASSIGNED.assignedToSite,
      emailPrefix: 'a-unassigned-',
      tagIDs: (CONTEXTS.USER_CONTEXTS.ADMIN_UNASSIGNED.withTagIDs ? ['A12341'] : null)
    },
    { // Basic user
      id: '5ce249a1a39ae1c056c123ab',
      role: CONTEXTS.USER_CONTEXTS.BASIC_USER.role,
      status: CONTEXTS.USER_CONTEXTS.BASIC_USER.status,
      assignedToSite: CONTEXTS.USER_CONTEXTS.BASIC_USER.assignedToSite,
      emailPrefix: 'basic-',
      tagIDs: (CONTEXTS.USER_CONTEXTS.BASIC_USER.withTagIDs ? ['A12342'] : null)
    },
    { // Demo user
      id: '5ce249a1a39ae1c056c123cd',
      role: CONTEXTS.USER_CONTEXTS.DEMO_USER.role,
      status: CONTEXTS.USER_CONTEXTS.DEMO_USER.status,
      assignedToSite: CONTEXTS.USER_CONTEXTS.DEMO_USER.assignedToSite,
      emailPrefix: 'demo-',
      tagIDs: (CONTEXTS.USER_CONTEXTS.DEMO_USER.withTagIDs ? ['A12343'] : null)
    },
    { // Basic user unassigned
      role: CONTEXTS.USER_CONTEXTS.BASIC_USER_UNASSIGNED.role,
      status: CONTEXTS.USER_CONTEXTS.BASIC_USER_UNASSIGNED.status,
      assignedToSite: CONTEXTS.USER_CONTEXTS.BASIC_USER_UNASSIGNED.assignedToSite,
      emailPrefix: 'b-unassigned-',
      tagIDs: (CONTEXTS.USER_CONTEXTS.BASIC_USER_UNASSIGNED.withTagIDs ? ['A12348'] : null)
    },
    { // Basic user pending
      id: '5ce249a1a39ae1c056c456ab',
      role: CONTEXTS.USER_CONTEXTS.BASIC_USER_PENDING.role,
      status: CONTEXTS.USER_CONTEXTS.BASIC_USER_PENDING.status,
      assignedToSite: CONTEXTS.USER_CONTEXTS.BASIC_USER_PENDING.assignedToSite,
      emailPrefix: 'b-pending-',
      tagIDs: (CONTEXTS.USER_CONTEXTS.BASIC_USER_PENDING.withTagIDs ? ['A12349'] : null)
    },
    { // Basic user Locked
      id: '5ce249a1a39ae1c056c789ef',
      role: CONTEXTS.USER_CONTEXTS.BASIC_USER_LOCKED.role,
      status: CONTEXTS.USER_CONTEXTS.BASIC_USER_LOCKED.status,
      assignedToSite: CONTEXTS.USER_CONTEXTS.BASIC_USER_LOCKED.assignedToSite,
      emailPrefix: 'b-locked-',
      tagIDs: (CONTEXTS.USER_CONTEXTS.BASIC_USER_LOCKED.withTagIDs ? ['A123410'] : null)
    },
    { // Basic user No Tags
      id: '5ce249a1a39ae1c056c567ab',
      role: CONTEXTS.USER_CONTEXTS.BASIC_USER_NO_TAGS.role,
      status: CONTEXTS.USER_CONTEXTS.BASIC_USER_NO_TAGS.status,
      assignedToSite: CONTEXTS.USER_CONTEXTS.BASIC_USER_NO_TAGS.assignedToSite,
      emailPrefix: 'b-notTag',
      tagIDs: (CONTEXTS.USER_CONTEXTS.BASIC_USER_NO_TAGS.withTagIDs ? ['A123411'] : null)
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
    { // default site
      // contextName: CONTEXTS.SITE_CONTEXTS.SITE_BASIC,
      id: '5ce249a2372f0b1c8caf9294',
      name: CONTEXTS.SITE_CONTEXTS.SITE_BASIC,
      allowAllUsersToStopTransactions: false,
      autoUserSiteAssignment: false,
      companyID: '5ce249a2372f0b1c8caf928f'
    },
    { // site with other user stop
      // contextName: CONTEXTS.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHPORIZATION,
      id: '5ce249a2372f0b1c8caf8367',
      name: CONTEXTS.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHPORIZATION,
      allowAllUsersToStopTransactions: true,
      autoUserSiteAssignment: false,
      companyID: '5ce249a2372f0b1c8caf928f'
    },
    { // site with auto user assignment
      // contextName: CONTEXTS.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT,
      id: '5ce249a2372f0b1c8caf6532',
      name: CONTEXTS.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT,
      allowAllUsersToStopTransactions: false,
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
      name: `${CONTEXTS.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHPORIZATION}-${CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL}`,
      accessControl: true,
      siteName: CONTEXTS.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHPORIZATION
    },
    { // Without access control
      id: '5ce249a2372f0b1c8caf5432',
      name: `${CONTEXTS.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHPORIZATION}-${CONTEXTS.SITE_AREA_CONTEXTS.WITHOUT_ACL}`,
      accessControl: false,
      siteName: CONTEXTS.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHPORIZATION
    }
  ];

  // List of Charging Station created in a tenant
  // siteAreaNames must refer the site Areas where teh charging station will be created
  // if siteAreaNames is null then the CS will not be assigned or created in tenant with no porganization, so the baseName MUST be unique
  static readonly TENANT_CHARGINGSTATION_LIST: any = [
    {
      baseName: CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCCP16, // Concatenated with siteAreaName
      ocppVersion: '1.6',
      siteAreaNames: [
        `${CONTEXTS.SITE_CONTEXTS.SITE_BASIC}-${CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL}`,
        `${CONTEXTS.SITE_CONTEXTS.SITE_BASIC}-${CONTEXTS.SITE_AREA_CONTEXTS.WITHOUT_ACL}`,
        `${CONTEXTS.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT}-${CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL}`,
        `${CONTEXTS.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT}-${CONTEXTS.SITE_AREA_CONTEXTS.WITHOUT_ACL}`,
        `${CONTEXTS.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHPORIZATION}-${CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL}`,
        `${CONTEXTS.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHPORIZATION}-${CONTEXTS.SITE_AREA_CONTEXTS.WITHOUT_ACL}`]
    },
    // {
    //   baseName: 'cs-15',
    //   ocppVersion: '1.5',
    //   siteAreaNames: ['ut-site-withACL', 'ut-site-withoutACL', 'ut-site-auto-withACL', 'ut-site-auto-withoutACL', 'ut-site-stop-withACL', 'ut-site-stop-withoutACL']
    // },
    {
      baseName: CONTEXTS.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP16,
      ocppVersion: '1.6',
      siteAreaNames: null,
    },
  ];

};
