import { Action, AuthorizationContext, AuthorizationDefinition, Entity } from '../types/Authorization';
import { IDictionary, IFunctionCondition } from 'role-acl';

export const AUTHORIZATION_DEFINITION: AuthorizationDefinition = {
  superAdmin: {
    grants: [
      {
        resource: Entity.USER, action: Action.LIST,
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'createdOn', 'createdBy.name', 'createdBy.firstName',
          'lastChangedOn', 'lastChangedBy.name', 'lastChangedBy.firstName', 'eulaAcceptedOn', 'eulaAcceptedVersion', 'locale',
          'billingData.customerID', 'billingData.lastChangedOn'
        ],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: [],
            metadata: {
              status: {
                visible: true,
                mandatory: true,
              }
            },
          }
        },
      },
      { resource: Entity.CHARGING_STATION_TEMPLATE, action: [Action.LIST],
        attributes: [
          'id', 'createdOn', 'createdBy.name', 'createdBy.firstName', 'lastChangedOn', 'lastChangedBy.name', 'lastChangedBy.firstName',
          'template.chargePointVendor', 'template.extraFilters.chargePointModel', 'template.extraFilters.chargeBoxSerialNumber'
        ]
      },
      {
        resource: Entity.CHARGING_STATION_TEMPLATE, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE],
        attributes: [
          'id', 'createdOn', 'createdBy.name', 'createdBy.firstName', 'lastChangedOn', 'lastChangedBy.name', 'lastChangedBy.firstName',
          'template.chargePointVendor', 'template.extraFilters.chargePointModel', 'template.extraFilters.chargeBoxSerialNumber',
          'template.technical.masterSlave', 'template.technical.maximumPower', 'template.technical.voltage', 'template.technical.powerLimitUnit', 'template.technical.excludeFromPowerLimitation',
          'template.technical.chargePoints.chargePointID', 'template.technical.chargePoints.currentType', 'template.technical.chargePoints.amperage', 'template.technical.chargePoints.numberOfConnectedPhase', 'template.technical.chargePoints.cannotChargeInParallel',
          'template.technical.chargePoints.sharePowerToAllConnectors', 'template.technical.chargePoints.excludeFromPowerLimitation', 'template.technical.chargePoints.ocppParamForPowerLimitation',
          'template.technical.chargePoints.power', 'template.technical.chargePoints.efficiency', 'template.technical.chargePoints.connectorIDs',
          'template.technical.connectors.connectorId', 'template.technical.connectors.type', 'template.technical.connectors.power', 'template.technical.connectors.amperage', 'template.technical.connectors.numberOfConnectedPhase', 'template.technical.connectors.chargePointID',
          'template.capabilities.supportedFirmwareVersions', 'template.capabilities.supportedOcppVersions', 'template.capabilities.capabilities.supportStaticLimitation', 'template.capabilities.capabilities.supportChargingProfiles',
          'template.capabilities.capabilities.supportRemoteStartStopTransaction', 'template.capabilities.capabilities.supportUnlockConnector', 'template.capabilities.capabilities.supportReservation',
          'template.capabilities.capabilities.supportCreditCard', 'template.capabilities.capabilities.supportRFIDCard',
          'template.ocppStandardParameters.supportedFirmwareVersions', 'template.ocppStandardParameters.supportedOcppVersions',
          'template.ocppStandardParameters.parameters.AllowOfflineTxForUnknownId', 'template.ocppStandardParameters.parameters.AuthorizationCacheEnabled', 'template.ocppStandardParameters.parameters.AuthorizeRemoteTxRequests', 'template.ocppStandardParameters.parameters.BlinkRepeat',
          'template.ocppStandardParameters.parameters.ClockAlignedDataInterval', 'template.ocppStandardParameters.parameters.ConnectionTimeOut', 'template.ocppStandardParameters.parameters.GetConfigurationMaxKeys', 'template.ocppStandardParameters.parameters.HeartbeatInterval',
          'template.ocppStandardParameters.parameters.LightIntensity', 'template.ocppStandardParameters.parameters.LocalAuthorizeOffline', 'template.ocppStandardParameters.parameters.LocalPreAuthorize', 'template.ocppStandardParameters.parameters.MaxEnergyOnInvalidId',
          'template.ocppStandardParameters.parameters.MeterValuesAlignedData', 'template.ocppStandardParameters.parameters.MeterValuesAlignedDataMaxLength', 'template.ocppStandardParameters.parameters.MeterValuesSampledData', 'template.ocppStandardParameters.parameters.MeterValuesSampledDataMaxLength',
          'template.ocppStandardParameters.parameters.MeterValueSampleInterval', 'template.ocppStandardParameters.parameters.MinimumStatusDuration', 'template.ocppStandardParameters.parameters.NumberOfConnectors', 'template.ocppStandardParameters.parameters.ResetRetries',
          'template.ocppStandardParameters.parameters.ConnectorPhaseRotation', 'template.ocppStandardParameters.parameters.ConnectorPhaseRotationMaxLength', 'template.ocppStandardParameters.parameters.StopTransactionOnEVSideDisconnect', 'template.ocppStandardParameters.parameters.StopTransactionOnInvalidId',
          'template.ocppStandardParameters.parameters.StopTxnAlignedData', 'template.ocppStandardParameters.parameters.StopTxnAlignedDataMaxLength', 'template.ocppStandardParameters.parameters.StopTxnSampledData', 'template.ocppStandardParameters.parameters.StopTxnSampledDataMaxLength',
          'template.ocppStandardParameters.parameters.SupportedFeatureProfiles', 'template.ocppStandardParameters.parameters.SupportedFeatureProfilesMaxLength', 'template.ocppStandardParameters.parameters.TransactionMessageAttempts', 'template.ocppStandardParameters.parameters.TransactionMessageRetryInterval',
          'template.ocppStandardParameters.parameters.UnlockConnectorOnEVSideDisconnect', 'template.ocppStandardParameters.parameters.WebSocketPingInterval', 'template.ocppStandardParameters.parameters.LocalAuthListEnabled', 'template.ocppStandardParameters.parameters.LocalAuthListMaxLength',
          'template.ocppStandardParameters.parameters.SendLocalListMaxLength', 'template.ocppStandardParameters.parameters.ReserveConnectorZeroSupported', 'template.ocppStandardParameters.parameters.ChargeProfileMaxStackLevel', 'template.ocppStandardParameters.parameters.ChargingScheduleAllowedChargingRateUnit',
          'template.ocppStandardParameters.parameters.ChargingScheduleMaxPeriods', 'template.ocppStandardParameters.parameters.ConnectorSwitch3to1PhaseSupported', 'template.ocppStandardParameters.parameters.MaxChargingProfilesInstalled',
          'template.ocppVendorParameters.supportedFirmwareVersions', 'template.ocppVendorParameters.supportedOcppVersions', 'template.ocppVendorParameters.parameters',
        ]
      },
      {
        resource: Entity.USER, action: Action.DELETE,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['-OwnUser', 'LocalIssuer']
          }
        }
      },
      {
        resource: Entity.USER, action: [Action.READ, Action.CREATE],
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'locale', 'plateID',
          'notificationsActive', 'notifications', 'phone', 'mobile', 'iNumber', 'costCenter',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ]
      },
      {
        resource: Entity.USER, action: Action.UPDATE,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['LocalIssuer']
          }
        },
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'locale', 'plateID',
          'notificationsActive', 'notifications', 'phone', 'mobile', 'iNumber', 'costCenter',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ]
      },
      {
        resource: Entity.LOGGING, action: [Action.LIST, Action.EXPORT],
        attributes: [
          'id', 'level', 'timestamp', 'type', 'source', 'host', 'action', 'message', 'chargingStationID', 'siteID',
          'user.name', 'user.firstName', 'actionOnUser.name', 'actionOnUser.firstName', 'hasDetailedMessages', 'method', 'module',
        ]
      },
      {
        resource: Entity.LOGGING, action: Action.READ,
        attributes: [
          'id', 'level', 'timestamp', 'type', 'source', 'host', 'action', 'message', 'chargingStationID', 'siteID',
          'user.name', 'user.firstName', 'actionOnUser.name', 'actionOnUser.firstName', 'hasDetailedMessages', 'detailedMessages'
        ]
      },
      { resource: Entity.TENANT, action: Action.LIST },
      { resource: Entity.TENANT, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE] },
      {
        resource: Entity.CAR_CATALOG, action: Action.LIST,
        attributes: [
          'id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed', 'performanceTopspeed',
          'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'image',
          'chargeStandardPower', 'chargeStandardPhase', 'chargeStandardPhaseAmp', 'chargeAlternativePower', 'chargeOptionPower',
          'chargeOptionPhaseAmp', 'chargeOptionPhase', 'chargeAlternativePhaseAmp', 'chargeAlternativePhase', 'chargePlug', 'fastChargePlug',
          'fastChargePowerMax', 'drivetrainPowerHP'
        ]
      },
      { resource: Entity.CAR_CATALOG, action: Action.SYNCHRONIZE },
      {
        resource: Entity.CAR_CATALOG, action: Action.READ,
        attributes: [
          'id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed',
          'performanceTopspeed', 'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'drivetrainPropulsion',
          'drivetrainTorque', 'batteryCapacityUseable', 'chargePlug', 'fastChargePlug', 'fastChargePowerMax', 'chargePlugLocation',
          'drivetrainPowerHP', 'chargeStandardChargeSpeed', 'chargeStandardChargeTime', 'miscSeats', 'miscBody', 'miscIsofix', 'miscTurningCircle',
          'miscSegment', 'miscIsofixSeats', 'chargeStandardPower', 'chargeStandardPhase', 'chargeAlternativePower', 'hash',
          'chargeAlternativePhase', 'chargeOptionPower', 'chargeOptionPhase', 'image', 'chargeOptionPhaseAmp', 'chargeAlternativePhaseAmp'
        ]
      },
    ]
  },
  admin: {
    grants: [
      {
        resource: Entity.USER,
        action: [
          Action.LIST, Action.EXPORT, Action.IMPORT
        ],
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'createdOn', 'createdBy.name', 'createdBy.firstName',
          'lastChangedOn', 'lastChangedBy.name', 'lastChangedBy.firstName', 'eulaAcceptedOn', 'eulaAcceptedVersion', 'locale',
          'billingData.customerID', 'billingData.lastChangedOn', 'technical', 'freeAccess'
        ],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: [],
            metadata: {
              status: {
                visible: true,
                mandatory: true,
              }
            },
          }
        }
      },
      {
        resource: Entity.USER, action: Action.IN_ERROR,
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer',
          'createdOn', 'lastChangedOn', 'errorCodeDetails', 'errorCode'
        ]
      },
      { resource: Entity.USER, action: Action.SYNCHRONIZE_BILLING_USER },
      {
        resource: Entity.USER, action: Action.DELETE,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['-OwnUser', 'LocalIssuer']
          }
        }
      },
      {
        resource: Entity.USER, action: [Action.READ, Action.CREATE],
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'locale', 'plateID',
          'notificationsActive', 'notifications', 'phone', 'mobile', 'iNumber', 'costCenter', 'technical', 'freeAccess',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ]
      },
      {
        resource: Entity.USER, action: Action.UPDATE,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['LocalIssuer']
          }
        },
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'locale', 'plateID',
          'notificationsActive', 'notifications', 'phone', 'mobile', 'iNumber', 'costCenter', 'technical', 'freeAccess',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ]
      },
      {
        resource: Entity.COMPANY, action: Action.LIST,
        attributes: [
          'id', 'name', 'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country',
          'address.coordinates', 'logo', 'issuer', 'distanceMeters', 'createdOn', 'lastChangedOn',
          'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName', 'accountData'
        ]
      },
      {
        resource: Entity.TAG, action: Action.LIST,
        attributes: [
          'id', 'userID', 'active', 'ocpiToken', 'description', 'visualID', 'issuer', 'default',
          'user.name', 'user.firstName', 'user.email', 'createdOn', 'lastChangedOn'
        ]
      },
      { resource: Entity.TAG, action: [Action.IMPORT, Action.EXPORT] },
      {
        resource: Entity.TAG, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: [],
          }
        },
        attributes: [
          'id', 'userID', 'issuer', 'active', 'description', 'visualID', 'default', 'user.id',
          'user.name', 'user.firstName', 'user.email'
        ]
      },
      {
        resource: Entity.TAG, action: [Action.UPDATE, Action.DELETE],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['LocalIssuer'],
          }
        }
      },
      { resource: Entity.TAG, action: Action.CREATE },
      {
        resource: Entity.CHARGING_PROFILE, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: []
          }
        },
        attributes: [
          'id', 'chargingStationID', 'chargePointID', 'connectorID',
          'chargingStation.id', 'chargingStation.siteID', 'chargingStation.siteAreaID',
          'chargingStation.siteArea.id', 'chargingStation.siteArea.name', 'chargingStation.siteArea.maximumPower','chargingStation.siteArea.siteID',
          'profile.chargingProfileKind', 'profile.chargingProfilePurpose', 'profile.stackLevel', 'profile.chargingSchedule'
        ]
      },
      { resource: Entity.CHARGING_PROFILE, action: [Action.READ, Action.CREATE, Action.UPDATE, Action.DELETE] },
      {
        resource: Entity.COMPANY, action: Action.READ,
        attributes: [
          'id', 'name', 'issuer', 'logo',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates', 'accountData'
        ]
      },
      {
        resource: Entity.COMPANY,
        action: [
          Action.CREATE, Action.UPDATE, Action.DELETE
        ],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['LocalIssuer']
          }
        },
      },
      {
        resource: Entity.SITE, action: Action.LIST,
        attributes: [
          'id', 'name', 'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country',
          'address.coordinates', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
          'autoUserSiteAssignment', 'distanceMeters', 'public', 'createdOn', 'lastChangedOn',
          'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName', 'connectorStats', 'accountData'
        ]
      },
      {
        resource: Entity.SITE, action: Action.READ,
        attributes: [
          'id', 'name', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
          'autoUserSiteAssignment', 'distanceMeters', 'public', 'createdOn', 'lastChangedOn', 'tariffID',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates', 'accountData'
        ]
      },
      {
        resource: Entity.SITE,
        action: [
          Action.CREATE, Action.UPDATE, Action.DELETE, Action.EXPORT_OCPP_PARAMS, Action.GENERATE_QR, Action.MAINTAIN_PRICING_DEFINITIONS,
        ],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['LocalIssuer']
          }
        },
      },
      {
        resource: Entity.USERS_SITES, action: Action.LIST,
        attributes: [
          'user.id', 'user.name', 'user.firstName', 'user.email', 'user.role', 'siteAdmin', 'siteOwner', 'siteID'
        ]
      },
      {
        resource: Entity.USERS_SITES,
        action: [Action.ASSIGN, Action.UNASSIGN, Action.READ],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: []
          }
        },
      },
      {
        resource: Entity.SITE_AREA, action: Action.LIST,
        attributes: [
          'id', 'name', 'siteID', 'maximumPower', 'voltage', 'numberOfPhases', 'accessControl', 'smartCharging', 'chargingStations.id',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country',
          'address.coordinates', 'site.id', 'site.name', 'site.public', 'parentSiteAreaID', 'parentSiteArea.name', 'issuer', 'distanceMeters',
          'createdOn', 'createdBy.name', 'createdBy.firstName', 'lastChangedOn', 'lastChangedBy.name', 'lastChangedBy.firstName', 'connectorStats'
        ]
      },
      {
        resource: Entity.SITE_AREA,
        action: [Action.READ, Action.READ_CHARGING_STATIONS_FROM_SITE_AREA],
        attributes: [
          'id', 'name', 'issuer', 'image', 'maximumPower', 'numberOfPhases', 'voltage', 'smartCharging', 'accessControl',
          'connectorStats', 'siteID', 'site.name', 'site.public', 'parentSiteAreaID', 'parentSiteArea.name', 'tariffID',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ]
      },
      {
        resource: Entity.SITE_AREA,
        action: [
          Action.CREATE, Action.UPDATE, Action.DELETE, Action.ASSIGN_ASSETS_TO_SITE_AREA,
          Action.UNASSIGN_ASSETS_FROM_SITE_AREA, Action.ASSIGN_CHARGING_STATIONS_TO_SITE_AREA,
          Action.UNASSIGN_CHARGING_STATIONS_FROM_SITE_AREA, Action.EXPORT_OCPP_PARAMS, Action.GENERATE_QR,
          Action.READ_ASSETS_FROM_SITE_AREA
        ],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['LocalIssuer']
          }
        },
      },
      {
        resource: Entity.CHARGING_STATION, action: Action.LIST,
        attributes: [
          'id', 'inactive', 'connectorsStatus', 'connectorsConsumption', 'public', 'firmwareVersion', 'chargePointVendor', 'chargePointModel',
          'ocppVersion', 'ocppProtocol', 'lastSeen', 'firmwareUpdateStatus', 'coordinates', 'issuer', 'voltage', 'distanceMeters',
          'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.siteID', 'site.name', 'siteArea.address', 'siteID', 'maximumPower', 'powerLimitUnit',
          'chargePointModel', 'chargePointSerialNumber', 'chargeBoxSerialNumber', 'connectors.connectorId', 'connectors.status', 'connectors.type', 'connectors.power', 'connectors.errorCode',
          'connectors.currentTotalConsumptionWh', 'connectors.currentInstantWatts', 'connectors.currentStateOfCharge', 'connectors.info', 'connectors.vendorErrorCode',
          'connectors.currentTransactionID', 'connectors.currentTotalInactivitySecs', 'connectors.currentTagID', 'lastReboot', 'createdOn',
          'connectors.user.id', 'connectors.user.name', 'connectors.user.firstName', 'connectors.user.email',
          'chargePoints.chargePointID','chargePoints.currentType','chargePoints.voltage','chargePoints.amperage','chargePoints.numberOfConnectedPhase',
          'chargePoints.cannotChargeInParallel','chargePoints.sharePowerToAllConnectors','chargePoints.excludeFromPowerLimitation','chargePoints.ocppParamForPowerLimitation',
          'chargePoints.power','chargePoints.efficiency','chargePoints.connectorIDs'
        ]
      },
      {
        resource: Entity.CHARGING_STATION, action: Action.GET_STATUS_NOTIFICATION,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: []
          }
        },
        attributes: [
          'id', 'timestamp', 'chargeBoxID', 'connectorId', 'timezone', 'status', 'errorCode', 'info', 'vendorId', 'vendorErrorCode'
        ]
      },
      {
        resource: Entity.CHARGING_STATION, action: Action.GET_BOOT_NOTIFICATION,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: []
          }
        },
        attributes: [
          'id', 'chargePointVendor', 'chargePointModel', 'chargePointSerialNumber', 'chargeBoxSerialNumber', 'firmwareVersion', 'ocppVersion',
          'ocppProtocol', 'endpoint', 'timestamp', 'chargeBoxID', 'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName'
        ]
      },
      {
        resource: Entity.CHARGING_STATION, action: Action.IN_ERROR,
        attributes: [
          'id', 'inactive', 'connectorsStatus', 'connectorsConsumption', 'public', 'errorCodeDetails', 'errorCode', 'lastSeen',
          'connectors.connectorId', 'connectors.status', 'connectors.type', 'connectors.power', 'connectors.errorCode'
        ]
      },
      {
        resource: Entity.CHARGING_STATION,
        action: [
          Action.RESET, Action.CLEAR_CACHE, Action.CHANGE_AVAILABILITY, Action.UPDATE, Action.DELETE, Action.GENERATE_QR,
          Action.GET_CONFIGURATION, Action.CHANGE_CONFIGURATION, Action.STOP_TRANSACTION, Action.START_TRANSACTION,
          Action.AUTHORIZE, Action.SET_CHARGING_PROFILE,Action.GET_COMPOSITE_SCHEDULE, Action.CLEAR_CHARGING_PROFILE, Action.GET_DIAGNOSTICS, Action.UPDATE_FIRMWARE,
          Action.EXPORT_OCPP_PARAMS, Action.TRIGGER_DATA_TRANSFER, Action.UPDATE_OCPP_PARAMS, Action.LIMIT_POWER, Action.DELETE_CHARGING_PROFILE, Action.GET_OCPP_PARAMS,
          Action.UPDATE_CHARGING_PROFILE, Action.GET_CONNECTOR_QR_CODE
        ],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['LocalIssuer']
          }
        }
      },
      {
        resource: Entity.CHARGING_STATION,
        action: [
          Action.CREATE, Action.READ, Action.REMOTE_START_TRANSACTION, Action.REMOTE_STOP_TRANSACTION, Action.UNLOCK_CONNECTOR, Action.EXPORT, Action.RESERVE_NOW,
        ]
      },
      {
        resource: Entity.CONNECTOR,
        action: [Action.STOP_TRANSACTION, Action.START_TRANSACTION],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['LocalIssuer']
          }
        },
      },
      {
        resource: Entity.CONNECTOR,
        action: [Action.REMOTE_STOP_TRANSACTION, Action.REMOTE_START_TRANSACTION],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: []
          }
        },
      },
      { resource: Entity.TRANSACTION, action: [Action.LIST, Action.EXPORT, Action.IN_ERROR] },
      {
        resource: Entity.TRANSACTION,
        action: [
          Action.READ, Action.UPDATE, Action.DELETE, Action.REFUND_TRANSACTION
        ]
      },
      { resource: Entity.REPORT, action: [Action.READ] },
      {
        resource: Entity.LOGGING, action: [Action.LIST, Action.EXPORT],
        attributes: [
          'id', 'level', 'timestamp', 'type', 'source', 'host', 'action', 'message', 'chargingStationID', 'siteID',
          'user.name', 'user.firstName', 'actionOnUser.name', 'actionOnUser.firstName', 'hasDetailedMessages', 'method', 'module',
        ]
      },
      {
        resource: Entity.LOGGING, action: Action.READ,
        attributes: [
          'id', 'level', 'timestamp', 'type', 'source', 'host', 'action', 'message', 'chargingStationID', 'siteID',
          'user.name', 'user.firstName', 'actionOnUser.name', 'actionOnUser.firstName', 'hasDetailedMessages', 'detailedMessages'
        ]
      },
      { resource: Entity.PRICING, action: [Action.READ, Action.UPDATE] },
      {
        resource: Entity.PRICING_DEFINITION, action: [Action.LIST],
        attributes: [
          'id', 'entityID', 'entityType', 'name', 'description', 'entityName',
          'staticRestrictions.validFrom', 'staticRestrictions.validTo', 'staticRestrictions.connectorType', 'staticRestrictions.connectorPowerkW',
          'restrictions.daysOfWeek', 'restrictions.timeFrom', 'restrictions.timeTo',
          'restrictions.minEnergyKWh', 'restrictions.maxEnergyKWh', 'restrictions.minDurationSecs', 'restrictions.maxDurationSecs',
          'dimensions.flatFee.active', 'dimensions.flatFee.price', 'dimensions.flatFee.stepSize', 'dimensions.flatFee.pricedData',
          'dimensions.energy.active', 'dimensions.energy.price', 'dimensions.energy.stepSize', 'dimensions.energy.pricedData',
          'dimensions.chargingTime.active', 'dimensions.chargingTime.price', 'dimensions.chargingTime.stepSize', 'dimensions.chargingTime.pricedData',
          'dimensions.parkingTime.active', 'dimensions.parkingTime.price', 'dimensions.parkingTime.stepSize', 'dimensions.parkingTime.pricedData',
        ]
      },
      {
        resource: Entity.PRICING_DEFINITION, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE],
        attributes: [
          'id', 'entityID', 'entityType', 'name', 'description', 'entityName',
          'staticRestrictions.validFrom', 'staticRestrictions.validTo', 'staticRestrictions.connectorType', 'staticRestrictions.connectorPowerkW',
          'restrictions.daysOfWeek', 'restrictions.timeFrom', 'restrictions.timeTo',
          'restrictions.minEnergyKWh', 'restrictions.maxEnergyKWh', 'restrictions.minDurationSecs', 'restrictions.maxDurationSecs',
          'dimensions.flatFee.active', 'dimensions.flatFee.price', 'dimensions.flatFee.stepSize', 'dimensions.flatFee.pricedData',
          'dimensions.energy.active', 'dimensions.energy.price', 'dimensions.energy.stepSize', 'dimensions.energy.pricedData',
          'dimensions.chargingTime.active', 'dimensions.chargingTime.price', 'dimensions.chargingTime.stepSize', 'dimensions.chargingTime.pricedData',
          'dimensions.parkingTime.active', 'dimensions.parkingTime.price', 'dimensions.parkingTime.stepSize', 'dimensions.parkingTime.pricedData',
        ]
      },
      { resource: Entity.BILLING, action: [Action.CHECK_CONNECTION, Action.CLEAR_BILLING_TEST_DATA] },
      {
        resource: Entity.BILLING_ACCOUNT,
        action: [Action.LIST, Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.BILLING_ONBOARD_ACCOUNT],
        attributes: [
          'id', 'accountExternalID', 'businessOwnerID', 'businessOwner.id', 'businessOwner.firstName', 'businessOwner.name', 'businessOwner.email', 'status'
        ]
      },
      {
        resource: Entity.BILLING_TRANSFER,
        action: [Action.LIST, Action.BILLING_FINALIZE_TRANSFER, Action.BILLING_SEND_TRANSFER],
        attributes: [
          'id', 'status', 'createdOn', 'sessions', 'totalAmount', 'transferAmount', 'accountID', 'transferExternalID',
          'account.businessOwnerID', 'account.accountExternalID', 'businessOwner.name', 'businessOwner.firstName',
          'platformFeeData.feeAmount', 'platformFeeData.feeTaxAmount', 'currency'
        ]
      },
      { resource: Entity.TAX, action: [Action.LIST] },
      {
        resource: Entity.INVOICE, action: [Action.LIST],
        attributes: [
          'id', 'number', 'status', 'amount', 'createdOn', 'currency', 'downloadable', 'sessions', 'userID', 'user.id', 'user.name', 'user.firstName', 'user.email'
        ]
      },
      {
        resource: Entity.INVOICE, action: [Action.DOWNLOAD, Action.READ]
      },
      {
        resource: Entity.ASSET, action: [Action.CREATE, Action.READ,
          Action.CHECK_CONNECTION, Action.CREATE_CONSUMPTION]
      },
      {
        resource: Entity.ASSET, action: Action.READ_CONSUMPTION,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: []
          }
        },
        attributes: [
          'id', 'name', 'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.siteID', 'siteID', 'assetType', 'coordinates',
          'dynamicAsset', 'usesPushAPI', 'connectionID', 'meterID', 'currentInstantWatts', 'currentStateOfCharge', 'issuer',
          'startedAt', 'instantWatts', 'instantAmps', 'limitWatts', 'limitAmps', 'endedAt', 'stateOfCharge'
        ]
      },
      {
        resource: Entity.ASSET, action: Action.RETRIEVE_CONSUMPTION,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: []
          }
        }
      },
      {
        resource: Entity.ASSET, action: [Action.UPDATE, Action.DELETE],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['LocalIssuer']
          }
        }
      },
      {
        resource: Entity.ASSET, action: Action.LIST,
        attributes: [
          'id', 'name', 'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.siteID', 'siteID', 'assetType', 'coordinates',
          'dynamicAsset', 'usesPushAPI', 'connectionID', 'meterID', 'currentInstantWatts', 'currentStateOfCharge', 'issuer',
          'site.id', 'site.name'
        ]
      },
      {
        resource: Entity.ASSET, action: Action.IN_ERROR,
        attributes: ['id', 'name', 'errorCodeDetails', 'errorCode']
      },
      { resource: Entity.SETTING, action: Action.LIST },
      { resource: Entity.SETTING, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE] },
      {
        resource: Entity.REGISTRATION_TOKEN, action: Action.LIST,
        attributes: [
          'id', 'status', 'description', 'createdOn', 'lastChangedOn', 'expirationDate', 'revocationDate',
          'siteAreaID', 'siteArea.name', 'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName'
        ]
      },
      {
        resource: Entity.REGISTRATION_TOKEN, action: [Action.READ, Action.CREATE, Action.UPDATE],
        attributes: [
          'id', 'status', 'description', 'createdOn', 'lastChangedOn', 'expirationDate', 'revocationDate',
          'siteAreaID', 'siteArea.name', 'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName'
        ]
      },
      { resource: Entity.REGISTRATION_TOKEN, action: [Action.DELETE, Action.REVOKE] },
      { resource: Entity.OCPI_ENDPOINT, action: Action.LIST },
      {
        resource: Entity.OCPI_ENDPOINT,
        action: [
          Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.PING, Action.GENERATE_LOCAL_TOKEN,
          Action.REGISTER, Action.TRIGGER_JOB
        ],
      },
      { resource: Entity.OICP_ENDPOINT, action: Action.LIST },
      {
        resource: Entity.OICP_ENDPOINT,
        action: [
          Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.PING, Action.REGISTER,
          Action.TRIGGER_JOB
        ],
      },
      { resource: Entity.CONNECTION, action: Action.LIST },
      { resource: Entity.CONNECTION, action: [Action.CREATE, Action.READ, Action.DELETE] },
      {
        resource: Entity.CAR_CATALOG, action: Action.LIST,
        attributes: [
          'id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed', 'performanceTopspeed',
          'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'image',
          'chargeStandardPower', 'chargeStandardPhase', 'chargeStandardPhaseAmp', 'chargeAlternativePower', 'chargeOptionPower',
          'chargeOptionPhaseAmp', 'chargeOptionPhase', 'chargeAlternativePhaseAmp', 'chargeAlternativePhase', 'chargePlug', 'fastChargePlug',
          'fastChargePowerMax', 'drivetrainPowerHP'
        ]
      },
      {
        resource: Entity.CAR_CATALOG, action: Action.READ,
        attributes: [
          'id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed',
          'performanceTopspeed', 'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'drivetrainPropulsion',
          'drivetrainTorque', 'batteryCapacityUseable', 'chargePlug', 'fastChargePlug', 'fastChargePowerMax', 'chargePlugLocation',
          'drivetrainPowerHP', 'chargeStandardChargeSpeed', 'chargeStandardChargeTime', 'miscSeats', 'miscBody', 'miscIsofix', 'miscTurningCircle',
          'miscSegment', 'miscIsofixSeats', 'chargeStandardPower', 'chargeStandardPhase', 'chargeAlternativePower', 'hash',
          'chargeAlternativePhase', 'chargeOptionPower', 'chargeOptionPhase', 'image', 'chargeOptionPhaseAmp', 'chargeAlternativePhaseAmp'
        ]
      },
      { resource: Entity.CAR, action: [Action.CREATE, Action.UPDATE, Action.DELETE] },
      {
        resource: Entity.CAR, action: Action.READ,
        attributes: [
          'id', 'type', 'vin', 'licensePlate', 'converter', 'default', 'createdOn', 'lastChangedOn',
          'carCatalogID', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion', 'carCatalog.image',
          'carCatalog.chargeStandardPower', 'carCatalog.chargeStandardPhaseAmp', 'carCatalog.chargeStandardPhase',
          'carCatalog.chargeAlternativePower', 'carCatalog.chargeAlternativePhaseAmp', 'carCatalog.chargeAlternativePhase',
          'carCatalog.chargeOptionPower', 'carCatalog.chargeOptionPhaseAmp', 'carCatalog.chargeOptionPhase',
          'user.id', 'user.name', 'user.firstName', 'userID', 'carConnectorData.carConnectorID', 'carConnectorData.carConnectorMeterID'
        ]
      },
      {
        resource: Entity.CAR, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: [],
            metadata: {
              createPoolCar: {
                visible: true
              }
            }
          }
        },
        attributes: [
          'id', 'type', 'vin', 'licensePlate', 'converter', 'default', 'createdOn', 'lastChangedOn',
          'carCatalog.id', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion',
          'carCatalog.image', 'carCatalog.fastChargePowerMax', 'carCatalog.batteryCapacityFull',
          'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName',
          'user.id', 'user.name', 'user.firstName', 'userID'
        ]
      },
      { resource: Entity.NOTIFICATION, action: Action.CREATE },
      { resource: Entity.PAYMENT_METHOD, action: Action.LIST },
      { resource: Entity.PAYMENT_METHOD, action: [Action.READ, Action.CREATE, Action.DELETE] },
      { resource: Entity.SOURCE, action: Action.LIST },
    ]
  },
  basic: {
    grants: [
      {
        resource: Entity.USER, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser']
          }
        },
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'issuer', 'locale',
          'notificationsActive', 'notifications', 'phone', 'mobile', 'iNumber', 'costCenter',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ]
      },
      {
        resource: Entity.USER, action: Action.UPDATE,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: ['BasicUser'],
            filters: ['OwnUser']
          }
        },
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'issuer', 'locale',
          'notificationsActive', 'notifications', 'phone', 'mobile', 'iNumber', 'costCenter',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ]
      },
      { resource: Entity.SETTING, action: Action.READ },
      {
        resource: Entity.CAR_CATALOG, action: Action.LIST,
        attributes: [
          'id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed', 'performanceTopspeed',
          'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'image',
          'chargeStandardPower', 'chargeStandardPhase', 'chargeStandardPhaseAmp', 'chargeAlternativePower', 'chargeOptionPower',
          'chargeOptionPhaseAmp', 'chargeOptionPhase', 'chargeAlternativePhaseAmp', 'chargeAlternativePhase', 'chargePlug', 'fastChargePlug',
          'fastChargePowerMax', 'drivetrainPowerHP'
        ]
      },
      {
        resource: Entity.CAR_CATALOG, action: Action.READ,
        attributes: [
          'id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed',
          'performanceTopspeed', 'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'drivetrainPropulsion',
          'drivetrainTorque', 'batteryCapacityUseable', 'chargePlug', 'fastChargePlug', 'fastChargePowerMax', 'chargePlugLocation',
          'drivetrainPowerHP', 'chargeStandardChargeSpeed', 'chargeStandardChargeTime', 'miscSeats', 'miscBody', 'miscIsofix', 'miscTurningCircle',
          'miscSegment', 'miscIsofixSeats', 'chargeStandardPower', 'chargeStandardPhase', 'chargeAlternativePower', 'hash',
          'chargeAlternativePhase', 'chargeOptionPower', 'chargeOptionPhase', 'image', 'chargeOptionPhaseAmp', 'chargeAlternativePhaseAmp'
        ]
      },
      {
        resource: Entity.CAR, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser']
          }
        },
        attributes: [
          'id', 'type', 'vin', 'licensePlate', 'converter', 'default',
          'carCatalog.id', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion',
          'carCatalog.image', 'carCatalog.fastChargePowerMax', 'carCatalog.batteryCapacityFull'
        ],
      },
      {
        resource: Entity.CAR, action: [Action.CREATE, Action.UPDATE],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: ['-PoolCar', 'OwnUser'],
            filters: ['OwnUser']
          }
        }
      },
      {
        resource: Entity.CAR, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser']
          }
        },
        attributes: [
          'id', 'type', 'vin', 'licensePlate', 'converter', 'default', 'createdOn', 'lastChangedOn',
          'carCatalogID', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion', 'carCatalog.image',
          'carCatalog.chargeStandardPower', 'carCatalog.chargeStandardPhaseAmp', 'carCatalog.chargeStandardPhase',
          'carCatalog.chargeAlternativePower', 'carCatalog.chargeAlternativePhaseAmp', 'carCatalog.chargeAlternativePhase',
          'carCatalog.chargeOptionPower', 'carCatalog.chargeOptionPhaseAmp', 'carCatalog.chargeOptionPhase',
          'user.id', 'user.name', 'user.firstName', 'userID', 'carConnectorData.carConnectorID', 'carConnectorData.carConnectorMeterID'
        ],
      },
      {
        resource: Entity.CAR, action: Action.DELETE,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser']
          }
        }
      },
      {
        resource: Entity.COMPANY, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSitesCompanies']
          }
        },
        attributes: [
          'id', 'name', 'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country',
          'address.coordinates', 'logo', 'issuer', 'distanceMeters', 'createdOn', 'lastChangedOn'
        ]
      },
      {
        resource: Entity.COMPANY, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSitesCompanies']
          }
        },
        attributes: [
          'id', 'name', 'issuer', 'logo',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ]
      },
      {
        resource: Entity.INVOICE, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser']
          }
        },
        attributes: [
          'id', 'number', 'status', 'amount', 'createdOn', 'currency', 'downloadable', 'sessions'
        ]
      },
      {
        resource: Entity.INVOICE, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser']
          }
        },
        attributes: [
          'id', 'number', 'status', 'amount', 'createdOn', 'currency', 'downloadable', 'sessions'
        ]
      },
      {
        resource: Entity.INVOICE, action: Action.DOWNLOAD,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser']
          }
        }
      },
      {
        resource: Entity.PAYMENT_METHOD, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser']
          }
        }
      },
      {
        resource: Entity.PAYMENT_METHOD, action: [Action.READ, Action.CREATE, Action.DELETE],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser']
          }
        }
      },
      {
        resource: Entity.SITE, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites']
          }
        },
        attributes: [
          'id', 'name', 'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country',
          'address.coordinates', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
          'autoUserSiteAssignment', 'distanceMeters', 'public', 'createdOn', 'lastChangedOn', 'connectorStats'
        ],
      },
      {
        resource: Entity.SITE, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites']
          }
        },
        attributes: [
          'id', 'name', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
          'autoUserSiteAssignment', 'distanceMeters', 'public', 'createdOn', 'lastChangedOn',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ],
      },
      {
        resource: Entity.SITE_AREA, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites']
          }
        },
        attributes: [
          'id', 'name', 'siteID', 'maximumPower', 'voltage', 'numberOfPhases', 'accessControl', 'smartCharging', 'chargingStations.id',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country',
          'address.coordinates', 'site.id', 'site.name', 'parentSiteAreaID', 'parentSiteArea.name', 'issuer',
          'distanceMeters', 'createdOn', 'lastChangedOn', 'connectorStats'
        ],
      },
      {
        resource: Entity.SITE_AREA, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites']
          }
        },
        attributes: [
          'id', 'name', 'issuer', 'image', 'maximumPower', 'numberOfPhases',
          'voltage', 'smartCharging', 'accessControl', 'connectorStats', 'siteID',
          'parentSiteAreaID', 'site.name', 'parentSiteArea.name',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ],
      },
      {
        resource: Entity.SITE_AREA, action: Action.READ_CHARGING_STATIONS_FROM_SITE_AREA,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites']
          }
        },
        attributes: [
          'id', 'name', 'issuer', 'image', 'maximumPower', 'numberOfPhases',
          'voltage', 'smartCharging', 'accessControl', 'connectorStats', 'siteID',
          'parentSiteAreaID', 'site.name', 'parentSiteArea.name',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ],
      },
      {
        resource: Entity.CHARGING_STATION, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites']
          }
        },
        attributes: [
          'id', 'inactive', 'connectorsStatus', 'connectorsConsumption', 'public', 'lastSeen', 'coordinates', 'issuer', 'voltage', 'distanceMeters',
          'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.siteID', 'site.name', 'siteArea.address', 'siteID', 'maximumPower', 'powerLimitUnit',
          'connectors.connectorId', 'connectors.status', 'connectors.type', 'connectors.power', 'connectors.errorCode',
          'connectors.currentTotalConsumptionWh', 'connectors.currentInstantWatts', 'connectors.currentStateOfCharge', 'connectors.info', 'connectors.vendorErrorCode',
          'connectors.currentTransactionID', 'connectors.currentTotalInactivitySecs', 'lastReboot', 'createdOn', 'companyID',
          'connectors.user.id', 'connectors.user.name', 'connectors.user.firstName', 'connectors.user.email', 'connectors.currentTagID',
          'chargePoints.chargePointID','chargePoints.currentType','chargePoints.voltage','chargePoints.amperage','chargePoints.numberOfConnectedPhase',
          'chargePoints.cannotChargeInParallel','chargePoints.sharePowerToAllConnectors','chargePoints.excludeFromPowerLimitation','chargePoints.ocppParamForPowerLimitation',
          'chargePoints.power','chargePoints.efficiency','chargePoints.connectorIDs'
        ]
      },
      {
        resource: Entity.CHARGING_STATION, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites']
          }
        },
        attributes: [
          'id','issuer','public','siteAreaID','lastSeen','inactive','forceInactive','manualConfiguration','voltage','coordinates','chargingStationURL', 'forceInactive',
          'tariffID', 'maximumPower', 'masterSlave',
          'chargePoints.chargePointID','chargePoints.currentType','chargePoints.voltage','chargePoints.amperage','chargePoints.numberOfConnectedPhase',
          'chargePoints.cannotChargeInParallel','chargePoints.sharePowerToAllConnectors','chargePoints.excludeFromPowerLimitation','chargePoints.ocppParamForPowerLimitation',
          'chargePoints.power','chargePoints.efficiency','chargePoints.connectorIDs',
          'connectors.status', 'connectors.type', 'connectors.power', 'connectors.errorCode', 'connectors.connectorId', 'connectors.currentTotalConsumptionWh',
          'connectors.currentInstantWatts', 'connectors.currentStateOfCharge', 'connectors.info', 'connectors.vendorErrorCode', 'connectors.currentTransactionID',
          'connectors.currentTotalInactivitySecs', 'connectors.phaseAssignmentToGrid', 'connectors.chargePointID', 'connectors.tariffID', 'connectors.currentTransactionDate', 'connectors.currentTagID',
          'siteArea', 'site', 'siteID',
        ]
      },
      {
        resource: Entity.CHARGING_STATION, action: [Action.RESERVE_NOW, Action.REMOTE_START_TRANSACTION, Action.REMOTE_STOP_TRANSACTION],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites']
          }
        },
      },
      {
        resource: Entity.CHARGING_STATION,
        action: [Action.START_TRANSACTION, Action.STOP_TRANSACTION, Action.AUTHORIZE, Action.GET_CONNECTOR_QR_CODE],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites', 'LocalIssuer']
          }
        },
      },
      {
        resource: Entity.CONNECTOR,
        action: Action.START_TRANSACTION,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites', 'LocalIssuer']
          }
        },
      },
      {
        resource: Entity.CONNECTOR,
        action: [Action.REMOTE_STOP_TRANSACTION, Action.STOP_TRANSACTION],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: ['OwnUser'],
            filters: ['OwnUser']
          }
        },
      },
      {
        resource: Entity.CONNECTOR, action: Action.REMOTE_START_TRANSACTION,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites'],
          }
        },
      },
      {
        resource: Entity.TAG, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser']
          }
        },
        attributes: [
          'userID', 'active', 'description', 'visualID', 'issuer', 'default',
          'createdOn', 'lastChangedOn'
        ],
      },
      {
        resource: Entity.TAG, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser'],
            metadata: {
              id: {
                visible: false
              }
            },
          }
        },
        attributes: [
          'userID', 'issuer', 'active', 'description', 'visualID', 'default',
          'user.id', 'user.name', 'user.firstName', 'user.email', 'user.issuer'
        ],
      },
      {
        resource: Entity.TAG, action: [Action.UNASSIGN, Action.UPDATE_BY_VISUAL_ID],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: ['OwnUser'],
            filters: ['OwnUser']
          }
        }
      },
      {
        resource: Entity.TAG, action: Action.ASSIGN,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['LocalIssuer']
          }
        },
        attributes: [
          'userID', 'description', 'visualID', 'default',
          'user.name', 'user.firstName', 'user.email', 'createdOn', 'lastChangedOn'
        ]
      },
      { resource: Entity.TRANSACTION, action: [Action.LIST, Action.EXPORT] },
      {
        resource: Entity.TRANSACTION, action: [Action.READ, Action.UPDATE],
        condition: {
          Fn: 'OR',
          args: [
            {
              Fn: 'EQUALS',
              args: { 'user': '$.owner' }
            },
            {
              Fn: 'LIST_CONTAINS',
              args: {
                'tagIDs': '$.tagID'
              }
            }
          ]
        }
      },
      { resource: Entity.CONNECTION, action: Action.LIST },
      { resource: Entity.CONNECTION, action: [Action.CREATE] },
      {
        resource: Entity.CONNECTION, action: [Action.READ, Action.DELETE],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser']
          }
        }
      },
      { resource: Entity.NOTIFICATION, action: Action.CREATE },
    ]
  },
  demo: {
    grants: [
      {
        resource: Entity.USER, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser']
          }
        },
        attributes: [
          'id', 'name', 'firstName', 'email', 'issuer', 'locale', 'notificationsActive',
          'notifications', 'phone', 'mobile', 'iNumber', 'costCenter',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ],
      },
      {
        resource: Entity.ASSET, action: Action.LIST,
        attributes: [
          'id', 'name', 'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.siteID', 'siteID', 'assetType', 'coordinates',
          'dynamicAsset', 'connectionID', 'meterID', 'currentInstantWatts', 'currentStateOfCharge', 'site.id', 'site.name'
        ]
      },
      { resource: Entity.ASSET, action: Action.READ },
      {
        resource: Entity.ASSET, action: Action.READ_CONSUMPTION,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: []
          }
        },
        attributes: [
          'id', 'name', 'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.siteID', 'siteID', 'assetType', 'coordinates',
          'dynamicAsset', 'connectionID', 'meterID', 'currentInstantWatts', 'currentStateOfCharge',
          'startedAt', 'instantWatts', 'instantAmps', 'limitWatts', 'limitAmps', 'endedAt', 'stateOfCharge'
        ]
      },
      { resource: Entity.SETTING, action: Action.READ },
      {
        resource: Entity.CAR_CATALOG, action: Action.LIST,
        attributes: [
          'id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed', 'performanceTopspeed',
          'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'image',
          'chargeStandardPower', 'chargeStandardPhase', 'chargeStandardPhaseAmp', 'chargeAlternativePower', 'chargeOptionPower',
          'chargeOptionPhaseAmp', 'chargeOptionPhase', 'chargeAlternativePhaseAmp', 'chargeAlternativePhase', 'chargePlug', 'fastChargePlug',
          'fastChargePowerMax', 'drivetrainPowerHP'
        ]
      },
      {
        resource: Entity.CAR_CATALOG, action: Action.READ,
        attributes: [
          'id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed',
          'performanceTopspeed', 'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'drivetrainPropulsion',
          'drivetrainTorque', 'batteryCapacityUseable', 'chargePlug', 'fastChargePlug', 'fastChargePowerMax', 'chargePlugLocation',
          'drivetrainPowerHP', 'chargeStandardChargeSpeed', 'chargeStandardChargeTime', 'miscSeats', 'miscBody', 'miscIsofix', 'miscTurningCircle',
          'miscSegment', 'miscIsofixSeats', 'chargeStandardPower', 'chargeStandardPhase', 'chargeAlternativePower', 'hash',
          'chargeAlternativePhase', 'chargeOptionPower', 'chargeOptionPhase', 'image', 'chargeOptionPhaseAmp', 'chargeAlternativePhaseAmp'
        ]
      }, {
        resource: Entity.CAR, action: Action.READ,
        attributes: [
          'id', 'type', 'vin', 'licensePlate', 'converter', 'default',
          'carCatalogID', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion', 'carCatalog.image',
          'carCatalog.chargeStandardPower', 'carCatalog.chargeStandardPhaseAmp', 'carCatalog.chargeStandardPhase',
          'carCatalog.chargeAlternativePower', 'carCatalog.chargeAlternativePhaseAmp', 'carCatalog.chargeAlternativePhase',
          'carCatalog.chargeOptionPower', 'carCatalog.chargeOptionPhaseAmp', 'carCatalog.chargeOptionPhase'
        ]
      },
      {
        resource: Entity.CAR, action: Action.LIST,
        attributes: [
          'id', 'type', 'vin', 'licensePlate', 'converter', 'default',
          'carCatalog.id', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion',
          'carCatalog.image', 'carCatalog.fastChargePowerMax', 'carCatalog.batteryCapacityFull'
        ]
      },
      {
        resource: Entity.COMPANY, action: Action.LIST,
        attributes: [
          'id', 'name', 'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country',
          'address.coordinates', 'logo', 'issuer', 'distanceMeters'
        ]
      },
      {
        resource: Entity.COMPANY, action: Action.READ,
        attributes: [
          'id', 'name', 'issuer', 'logo',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ]
      },
      {
        resource: Entity.SITE, action: Action.LIST,
        attributes: [
          'id', 'name', 'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country',
          'address.coordinates', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
          'autoUserSiteAssignment', 'distanceMeters', 'public', 'connectorStats'
        ]
      },
      {
        resource: Entity.SITE, action: Action.READ,
        attributes: [
          'id', 'name', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
          'autoUserSiteAssignment', 'distanceMeters', 'public',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ]
      },
      {
        resource: Entity.SITE_AREA, action: Action.LIST,
        attributes: [
          'id', 'name', 'siteID', 'maximumPower', 'voltage', 'numberOfPhases', 'accessControl', 'smartCharging', 'chargingStations.id',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country',
          'address.coordinates', 'site.id', 'site.name', 'parentSiteAreaID', 'parentSiteArea.name', 'issuer',
          'distanceMeters', 'connectorStats'
        ]
      },
      {
        resource: Entity.SITE_AREA, action: Action.READ,
        attributes: [
          'id', 'name', 'issuer', 'image', 'maximumPower', 'numberOfPhases',
          'voltage', 'smartCharging', 'accessControl', 'connectorStats',
          'siteID', 'parentSiteAreaID', 'site.name', 'parentSiteArea.name',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ]
      },
      {
        resource: Entity.CHARGING_STATION, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites']
          }
        },
        attributes: [
          'id', 'inactive', 'connectorsStatus', 'connectorsConsumption', 'public', 'lastSeen', 'coordinates', 'issuer', 'voltage', 'distanceMeters',
          'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.siteID', 'site.name', 'siteArea.address', 'siteID', 'maximumPower', 'powerLimitUnit',
          'connectors.connectorId', 'connectors.status', 'connectors.type', 'connectors.power', 'connectors.errorCode',
          'connectors.currentTotalConsumptionWh', 'connectors.currentInstantWatts', 'connectors.currentStateOfCharge', 'connectors.info', 'connectors.vendorErrorCode',
          'connectors.currentTransactionID', 'connectors.currentTotalInactivitySecs', 'lastReboot', 'createdOn', 'companyID',
          'chargePoints.chargePointID','chargePoints.currentType','chargePoints.voltage','chargePoints.amperage','chargePoints.numberOfConnectedPhase',
          'chargePoints.cannotChargeInParallel','chargePoints.sharePowerToAllConnectors','chargePoints.excludeFromPowerLimitation','chargePoints.ocppParamForPowerLimitation',
          'chargePoints.power','chargePoints.efficiency','chargePoints.connectorIDs'
        ]
      },
      {
        resource: Entity.CHARGING_STATION, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites']
          }
        },
        attributes: [
          'id', 'issuer', 'public', 'siteAreaID', 'lastSeen', 'inactive', 'forceInactive', 'manualConfiguration', 'voltage', 'coordinates', 'chargingStationURL',
          'forceInactive', 'tariffID', 'maximumPower', 'masterSlave',
          'chargePoints.chargePointID','chargePoints.currentType','chargePoints.voltage','chargePoints.amperage','chargePoints.numberOfConnectedPhase',
          'chargePoints.cannotChargeInParallel','chargePoints.sharePowerToAllConnectors','chargePoints.excludeFromPowerLimitation','chargePoints.ocppParamForPowerLimitation',
          'chargePoints.power','chargePoints.efficiency','chargePoints.connectorIDs',
          'connectors.status', 'connectors.type', 'connectors.power', 'connectors.errorCode', 'connectors.connectorId', 'connectors.currentTotalConsumptionWh',
          'connectors.currentInstantWatts', 'connectors.currentStateOfCharge', 'connectors.info', 'connectors.vendorErrorCode', 'connectors.currentTransactionID',
          'connectors.currentTotalInactivitySecs', 'connectors.phaseAssignmentToGrid', 'connectors.chargePointID', 'connectors.tariffID','connectors.currentTransactionDate', 'connectors.currentTagID',
          'siteArea', 'site', 'siteID',
        ]
      },
      { resource: Entity.CHARGING_STATION, action: [Action.GET_CONNECTOR_QR_CODE] },
      { resource: Entity.TRANSACTION, action: Action.LIST },
      { resource: Entity.TRANSACTION, action: Action.READ },
    ]
  },
  siteAdmin: {
    '$extend': {
      'basic': {}
    },
    grants: [
      {
        resource: Entity.TAG, action: [Action.ASSIGN, Action.UNASSIGN, Action.UPDATE_BY_VISUAL_ID],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['ExcludeAction'],
          }
        }
      },
      {
        resource: Entity.USER, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin', 'LocalIssuer'],
            metadata: {
              status: {
                visible: true,
                mandatory: true,
              }
            },
          }
        },
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'createdOn',
          'lastChangedOn', 'eulaAcceptedOn', 'eulaAcceptedVersion', 'locale',
          'billingData.customerID', 'billingData.lastChangedOn', 'technical'
        ],
      },
      {
        resource: Entity.USER, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin', 'LocalIssuer']
          }
        },
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'locale', 'plateID',
          'notificationsActive', 'notifications', 'phone', 'mobile', 'iNumber', 'costCenter', 'technical',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ],
      },
      {
        resource: Entity.USER, action: Action.CREATE,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: ['BasicUser'],
            filters: ['SitesAdmin'],
          }
        },
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'locale', 'plateID',
          'notificationsActive', 'notifications', 'phone', 'mobile', 'iNumber', 'costCenter', 'technical',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ],
      },
      {
        resource: Entity.USER, action: Action.UPDATE,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: ['BasicUser'],
            filters: ['SitesAdmin', 'LocalIssuer'],
          }
        },
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'locale', 'plateID',
          'notificationsActive', 'notifications', 'phone', 'mobile', 'iNumber', 'costCenter', 'technical',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ],
      },
      { resource: Entity.USER, action: Action.SYNCHRONIZE_BILLING_USER },
      {
        resource: Entity.USER, action: Action.DELETE,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: ['BasicUser'],
            filters: ['-OwnUser', 'SitesAdmin', 'LocalIssuer']
          }
        }
      },
      {
        resource: Entity.USERS_SITES, action: [Action.LIST, Action.UNASSIGN, Action.READ],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin', 'LocalIssuer']
          }
        },
        attributes: [
          'user.id', 'user.name', 'user.firstName', 'user.email', 'user.role', 'siteAdmin', 'siteOwner', 'siteID'
        ]
      },
      {
        resource: Entity.SITE, action: [Action.UPDATE, Action.MAINTAIN_PRICING_DEFINITIONS, Action.EXPORT_OCPP_PARAMS],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin', 'LocalIssuer']
          }
        },
      },
      {
        resource: Entity.SITE, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: [],
            metadata: {
              autoUserSiteAssignment: {
                enabled: false,
              }
            },
          }
        },
        attributes: [
          'id', 'name', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
          'autoUserSiteAssignment', 'distanceMeters', 'public', 'createdOn', 'lastChangedOn', 'tariffID',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ],
      },
      {
        resource: Entity.SITE_AREA, action: Action.CREATE
      },
      {
        resource: Entity.SITE_AREA,
        action: [
          Action.UPDATE, Action.DELETE, Action.UNASSIGN_ASSETS_FROM_SITE_AREA, Action.UNASSIGN_CHARGING_STATIONS_FROM_SITE_AREA, Action.EXPORT_OCPP_PARAMS
        ],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin', 'LocalIssuer']
          }
        },
      },
      {
        resource: Entity.SITE_AREA, action: Action.READ,
        attributes: [
          'id', 'name', 'issuer', 'image', 'maximumPower', 'numberOfPhases',
          'voltage', 'smartCharging', 'accessControl', 'connectorStats',
          'siteID', 'site.name', 'site.public', 'tariffID',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ]
      },
      {
        resource: Entity.SITE_AREA, action: Action.READ_ASSETS_FROM_SITE_AREA,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin']
          }
        },
        attributes: [
          'id', 'name', 'issuer', 'image', 'maximumPower', 'numberOfPhases',
          'voltage', 'smartCharging', 'accessControl', 'connectorStats', 'siteID', 'site.name',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ],
      },
      {
        resource: Entity.ASSET, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites', 'LocalIssuer']
          }
        },
        attributes: [
          'id', 'name', 'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.siteID', 'siteID', 'assetType', 'coordinates',
          'dynamicAsset', 'connectionID', 'meterID', 'currentInstantWatts', 'currentStateOfCharge', 'excludeFromSmartCharging',
          'staticValueWatt', 'variationThresholdPercent', 'fluctuationPercent', 'site.id', 'site.name'
        ],
      },
      {
        resource: Entity.ASSET, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites', 'LocalIssuer']
          }
        },
        attributes: [
          'id', 'name', 'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.siteID', 'siteID', 'assetType', 'coordinates',
          'dynamicAsset', 'connectionID', 'meterID', 'currentInstantWatts', 'currentStateOfCharge', 'excludeFromSmartCharging',
          'staticValueWatt', 'variationThresholdPercent', 'fluctuationPercent'
        ],
      },
      {
        resource: Entity.ASSET, action: Action.READ_CONSUMPTION,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites', 'LocalIssuer']
          }
        },
        attributes: [
          'id', 'name', 'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.siteID', 'siteID', 'assetType', 'coordinates',
          'dynamicAsset', 'connectionID', 'meterID', 'currentInstantWatts', 'currentStateOfCharge',
          'startedAt', 'instantWatts', 'instantAmps', 'limitWatts', 'limitAmps', 'endedAt', 'stateOfCharge'
        ],
      },
      {
        resource: Entity.CAR, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin'],
            metadata: {
              createPoolCar: {
                visible: true
              },
              userID: {
                mandatory: true
              }
            }
          }
        },
        attributes: [
          'id', 'type', 'vin', 'licensePlate', 'converter', 'default', 'createdOn', 'lastChangedOn',
          'carCatalog.id', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion',
          'carCatalog.image', 'carCatalog.fastChargePowerMax', 'carCatalog.batteryCapacityFull',
          'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName',
          'user.id', 'user.name', 'user.firstName', 'userID'
        ],
      },
      {
        resource: Entity.CAR, action: Action.CREATE,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: []
          }
        },
      },
      {
        resource: Entity.CAR, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin']
          }
        },
        attributes: [
          'id', 'type', 'vin', 'licensePlate', 'converter', 'default', 'createdOn', 'lastChangedOn', 'user.id', 'user.name', 'user.firstName',
          'carCatalogID', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion', 'carCatalog.image',
          'carCatalog.chargeStandardPower', 'carCatalog.chargeStandardPhaseAmp', 'carCatalog.chargeStandardPhase',
          'carCatalog.chargeAlternativePower', 'carCatalog.chargeAlternativePhaseAmp', 'carCatalog.chargeAlternativePhase',
          'carCatalog.chargeOptionPower', 'carCatalog.chargeOptionPhaseAmp', 'carCatalog.chargeOptionPhase', 'carConnectorData.carConnectorID', 'carConnectorData.carConnectorMeterID'
        ],
      },
      {
        resource: Entity.CAR, action: [Action.UPDATE, Action.DELETE],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin']
          }
        }
      },
      {
        resource: Entity.CHARGING_STATION, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites']
          }
        },
        attributes: [
          'id', 'inactive', 'connectorsStatus', 'connectorsConsumption', 'public', 'lastSeen', 'coordinates', 'issuer', 'voltage', 'distanceMeters',
          'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.siteID', 'site.name', 'siteArea.address', 'siteID', 'maximumPower', 'powerLimitUnit',
          'connectors.connectorId', 'connectors.status', 'connectors.type', 'connectors.power', 'connectors.errorCode',
          'connectors.currentTotalConsumptionWh', 'connectors.currentInstantWatts', 'connectors.currentStateOfCharge', 'connectors.info', 'connectors.vendorErrorCode',
          'connectors.currentTransactionID', 'connectors.currentTotalInactivitySecs', 'lastReboot', 'createdOn', 'companyID',
          'chargePoints.chargePointID','chargePoints.currentType','chargePoints.voltage','chargePoints.amperage','chargePoints.numberOfConnectedPhase',
          'chargePoints.cannotChargeInParallel','chargePoints.sharePowerToAllConnectors','chargePoints.excludeFromPowerLimitation','chargePoints.ocppParamForPowerLimitation',
          'chargePoints.power','chargePoints.efficiency','chargePoints.connectorIDs'
        ]
      },
      {
        resource: Entity.CHARGING_STATION, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites']
          },
        },
        attributes: [
          'id', 'issuer', 'public', 'siteAreaID', 'lastSeen', 'inactive', 'forceInactive', 'manualConfiguration', 'voltage', 'coordinates', 'chargingStationURL',
          'forceInactive', 'tariffID', 'maximumPower', 'masterSlave',
          'chargePoints.chargePointID','chargePoints.currentType','chargePoints.voltage','chargePoints.amperage','chargePoints.numberOfConnectedPhase',
          'chargePoints.cannotChargeInParallel','chargePoints.sharePowerToAllConnectors','chargePoints.excludeFromPowerLimitation','chargePoints.ocppParamForPowerLimitation',
          'chargePoints.power','chargePoints.efficiency','chargePoints.connectorIDs',
          'connectors.status', 'connectors.type', 'connectors.power', 'connectors.errorCode', 'connectors.connectorId', 'connectors.currentTotalConsumptionWh',
          'connectors.currentInstantWatts', 'connectors.currentStateOfCharge', 'connectors.info', 'connectors.vendorErrorCode', 'connectors.currentTransactionID',
          'connectors.currentTotalInactivitySecs', 'connectors.phaseAssignmentToGrid', 'connectors.chargePointID', 'connectors.tariffID','connectors.currentTransactionDate', 'connectors.currentTagID',
          'siteArea', 'site', 'siteID',
        ]
      },
      {
        resource: Entity.CHARGING_STATION,
        action: [Action.UPDATE, Action.EXPORT, Action.EXPORT_OCPP_PARAMS, Action.GENERATE_QR, Action.UPDATE_OCPP_PARAMS, Action.LIMIT_POWER,
          Action.DELETE_CHARGING_PROFILE, Action.GET_OCPP_PARAMS, Action.UPDATE_CHARGING_PROFILE],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin', 'LocalIssuer']
          }
        }
      },
      {
        resource: Entity.CHARGING_STATION, action: [Action.RESET, Action.CLEAR_CACHE, Action.DELETE, Action.GET_CONFIGURATION,
          Action.CHANGE_CONFIGURATION, Action.SET_CHARGING_PROFILE, Action.GET_COMPOSITE_SCHEDULE,
          Action.CLEAR_CHARGING_PROFILE, Action.GET_DIAGNOSTICS, Action.UPDATE_FIRMWARE, Action.REMOTE_STOP_TRANSACTION,
          Action.STOP_TRANSACTION, Action.CHANGE_AVAILABILITY],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin']
          }
        }
      },
      {
        resource: Entity.CONNECTOR,
        action: [Action.REMOTE_STOP_TRANSACTION, Action.REMOTE_START_TRANSACTION],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites']
          }
        },
      },
      {
        resource: Entity.CONNECTOR, action: [Action.STOP_TRANSACTION, Action.START_TRANSACTION],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites', 'LocalIssuer']
          }
        },
      },
      {
        resource: Entity.CHARGING_PROFILE, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin']
          }
        },
        attributes: [
          'id', 'chargingStationID', 'chargePointID', 'connectorID',
          'chargingStation.id', 'chargingStation.siteID', 'chargingStation.siteAreaID',
          'chargingStation.siteArea.id', 'chargingStation.siteArea.name', 'chargingStation.siteArea.maximumPower','chargingStation.siteArea.siteID',
          'profile.chargingProfileKind', 'profile.chargingProfilePurpose', 'profile.stackLevel', 'profile.chargingSchedule'
        ]
      },
      {
        resource: Entity.CHARGING_PROFILE, action: [Action.CREATE, Action.UPDATE, Action.DELETE],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin']
          }
        }
      },
      {
        resource: Entity.CHARGING_PROFILE, action: [Action.READ],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin']
          }
        },
      },
      {
        resource: Entity.TRANSACTION, action: [Action.READ, Action.UPDATE],
        condition: {
          Fn: 'LIST_CONTAINS',
          args: { 'sitesAdmin': '$.site' }
        },
      },
      { resource: Entity.REPORT, action: [Action.READ] },
      {
        resource: Entity.LOGGING, action: [Action.LIST, Action.EXPORT],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin']
          }
        },
        attributes: [
          'id', 'level', 'timestamp', 'type', 'source', 'host', 'action', 'message', 'chargingStationID', 'siteID',
          'user.name', 'user.firstName', 'actionOnUser.name', 'actionOnUser.firstName', 'hasDetailedMessages', 'method', 'module',
        ]
      },
      {
        resource: Entity.LOGGING, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin']
          }
        },
        attributes: [
          'id', 'level', 'timestamp', 'type', 'source', 'host', 'action', 'message', 'chargingStationID', 'siteID',
          'user.name', 'user.firstName', 'actionOnUser.name', 'actionOnUser.firstName', 'hasDetailedMessages', 'detailedMessages'
        ]
      },
      {
        resource: Entity.REGISTRATION_TOKEN, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin'],
            metadata: {
              siteAreaID: {
                mandatory: true,
              }
            }
          }
        },
        attributes: [
          'id', 'status', 'description', 'createdOn', 'lastChangedOn', 'expirationDate', 'revocationDate',
          'siteAreaID', 'siteArea.name', 'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName'
        ]
      },
      {
        resource: Entity.REGISTRATION_TOKEN, action: [Action.READ],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin'],
          }
        },
        attributes: [
          'id', 'status', 'description', 'createdOn', 'lastChangedOn', 'expirationDate', 'revocationDate',
          'siteAreaID', 'siteArea.name', 'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName'
        ]
      },
      {
        resource: Entity.REGISTRATION_TOKEN, action: [Action.CREATE, Action.UPDATE],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: ['SiteAreaMandatory'],
            filters: ['SitesAdmin'],
          },
        },
        attributes: [
          'id', 'status', 'description', 'createdOn', 'lastChangedOn', 'expirationDate', 'revocationDate',
          'siteAreaID', 'siteArea.name', 'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName'
        ]
      },
      {
        resource: Entity.REGISTRATION_TOKEN, action: [Action.DELETE, Action.REVOKE],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin'],
          }
        },
      },
      {
        resource: Entity.TAG, action: [Action.LIST, Action.EXPORT],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin', 'LocalIssuer'],
            metadata: {
              userID: {
                mandatory: true,
              }
            },
          }
        },
        attributes: [
          'id', 'userID', 'active', 'ocpiToken', 'description', 'visualID', 'issuer', 'default',
          'user.name', 'user.firstName', 'user.email', 'createdOn', 'lastChangedOn'
        ],
      },
      {
        resource: Entity.TAG, action: Action.CREATE,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: ['UserMandatory'],
            filters: []
          }
        }
      },
      {
        resource: Entity.TAG, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin', 'LocalIssuer'],
            metadata: {
              userID: {
                mandatory: true,
              }
            },
          }
        },
        attributes: [
          'id', 'userID', 'issuer', 'active', 'description', 'visualID', 'default', 'user.id',
          'user.name', 'user.firstName', 'user.email'
        ],
      },
      {
        resource: Entity.TAG, action: Action.DELETE,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin', 'LocalIssuer']
          }
        }
      },
      {
        resource: Entity.TAG, action: Action.UPDATE,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: ['UserMandatory'],
            filters: ['SitesAdmin', 'LocalIssuer']
          }
        }
      },
      {
        resource: Entity.PRICING_DEFINITION, action: Action.LIST,
        attributes: ['id', 'entityID', 'entityType', 'name', 'description', 'entityName',
          'staticRestrictions.validFrom', 'staticRestrictions.validTo', 'staticRestrictions.connectorType', 'staticRestrictions.connectorPowerkW',
          'restrictions.daysOfWeek', 'restrictions.timeFrom', 'restrictions.timeTo',
          'restrictions.minEnergyKWh', 'restrictions.maxEnergyKWh', 'restrictions.minDurationSecs', 'restrictions.maxDurationSecs',
          'dimensions.flatFee.active', 'dimensions.flatFee.price', 'dimensions.flatFee.stepSize', 'dimensions.flatFee.pricedData',
          'dimensions.energy.active', 'dimensions.energy.price', 'dimensions.energy.stepSize', 'dimensions.energy.pricedData',
          'dimensions.chargingTime.active', 'dimensions.chargingTime.price', 'dimensions.chargingTime.stepSize', 'dimensions.chargingTime.pricedData',
          'dimensions.parkingTime.active', 'dimensions.parkingTime.price', 'dimensions.parkingTime.stepSize', 'dimensions.parkingTime.pricedData',
        ],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin']
          }
        },
      },
      {
        resource: Entity.PRICING_DEFINITION, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE],
        attributes: ['id', 'entityID', 'entityType', 'name', 'description', 'entityName',
          'staticRestrictions.validFrom', 'staticRestrictions.validTo', 'staticRestrictions.connectorType', 'staticRestrictions.connectorPowerkW',
          'restrictions.daysOfWeek', 'restrictions.timeFrom', 'restrictions.timeTo',
          'restrictions.minEnergyKWh', 'restrictions.maxEnergyKWh', 'restrictions.minDurationSecs', 'restrictions.maxDurationSecs',
          'dimensions.flatFee.active', 'dimensions.flatFee.price', 'dimensions.flatFee.stepSize', 'dimensions.flatFee.pricedData',
          'dimensions.energy.active', 'dimensions.energy.price', 'dimensions.energy.stepSize', 'dimensions.energy.pricedData',
          'dimensions.chargingTime.active', 'dimensions.chargingTime.price', 'dimensions.chargingTime.stepSize', 'dimensions.chargingTime.pricedData',
          'dimensions.parkingTime.active', 'dimensions.parkingTime.price', 'dimensions.parkingTime.stepSize', 'dimensions.parkingTime.pricedData',
        ],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin']
          }
        },
      },
      { resource: Entity.SOURCE, action: Action.LIST },
    ]
  },
  siteOwner: {
    '$extend': {
      'basic': {}
    },
    grants: [
      {
        resource: Entity.USER, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesOwner', 'LocalIssuer']
          }
        },
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'createdOn',
          'lastChangedOn', 'eulaAcceptedOn', 'eulaAcceptedVersion', 'locale',
          'billingData.customerID', 'billingData.lastChangedOn'
        ],
      },
      {
        resource: Entity.USER, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesOwner', 'LocalIssuer']
          }
        },
        attributes: [
          'id', 'name', 'firstName', 'email', 'issuer', 'locale', 'notificationsActive',
          'notifications', 'phone', 'mobile', 'iNumber', 'costCenter',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city',
          'address.department', 'address.region', 'address.country', 'address.coordinates'
        ],
      },
      {
        resource: Entity.TRANSACTION, action: [Action.READ, Action.REFUND_TRANSACTION],
        condition: {
          Fn: 'LIST_CONTAINS',
          args: { 'sitesOwner': '$.site' }
        }
      },
      { resource: Entity.REPORT, action: [Action.READ] },
      {
        resource: Entity.PRICING_DEFINITION, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesOwner', 'LocalIssuer']
          }
        },
        attributes: ['id', 'entityID', 'entityType', 'name', 'description', 'entityName',
          'staticRestrictions.validFrom', 'staticRestrictions.validTo', 'staticRestrictions.connectorType', 'staticRestrictions.connectorPowerkW',
          'restrictions.daysOfWeek', 'restrictions.timeFrom', 'restrictions.timeTo',
          'restrictions.minEnergyKWh', 'restrictions.maxEnergyKWh', 'restrictions.minDurationSecs', 'restrictions.maxDurationSecs',
          'dimensions.flatFee.active', 'dimensions.flatFee.price', 'dimensions.flatFee.stepSize', 'dimensions.flatFee.pricedData',
          'dimensions.energy.active', 'dimensions.energy.price', 'dimensions.energy.stepSize', 'dimensions.energy.pricedData',
          'dimensions.chargingTime.active', 'dimensions.chargingTime.price', 'dimensions.chargingTime.stepSize', 'dimensions.chargingTime.pricedData',
          'dimensions.parkingTime.active', 'dimensions.parkingTime.price', 'dimensions.parkingTime.stepSize', 'dimensions.parkingTime.pricedData',
        ],
      },
    ]
  },
};

export const AUTHORIZATION_CONDITIONS: IDictionary<IFunctionCondition> = {
  dynamicAuthorizations: (context: Record<string, any>, args: AuthorizationContext): boolean => {
    // Pass the dynamic filters to the context
    // Used by the caller to execute dynamic filters
    if (context) {
      // Filters
      if (!context.filters) {
        context.filters = [];
      }
      if (!context.filtersSet && args.filters) {
        context.filters = [
          ...args.filters
        ];
        context.filtersSet = true;
      }
      // Assertions
      if (!context.asserts) {
        context.asserts = [];
      }
      if (!context.assertsSet && args.asserts) {
        context.asserts = [
          ...args.asserts
        ];
        context.assertsSet = true;
      }
      // Metadata
      if (!context.metadata) {
        context.metadata = {};
      }
      if (!context.metadataSet && args.metadata) {
        context.metadata = args.metadata;
        context.metadataSet = true;
      }
    }
    return true;
  }
};
