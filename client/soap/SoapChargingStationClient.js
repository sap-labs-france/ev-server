var ChargingStationClient = require('../ChargingStationClient');
var soap = require('strong-soap').soap;
var path = require('path');
var Promise = require('promise');

let _client = null;
let _chargingStation;

class SoapChargingStationClient extends ChargingStationClient {
  constructor(chargingStation) {
    super();
    var that = this;

    _chargingStation = chargingStation;

    // Get the Charging Station
    return new Promise(function(fulfill, reject) {
      var chargingStationWdsl = null;

      // Read the WSDL client files
      switch(_chargingStation.getOcppVersion()) {
        // OCPP V1.2
        case "1.2":
          chargingStationWdsl = path.join(__dirname, '/wsdl/OCPP_ChargePointService1.2.wsdl');
          break;
        case "1.5":
          chargingStationWdsl = path.join(__dirname, '/wsdl/OCPP_ChargePointService1.5.wsdl');
          break;
        case "1.6":
          chargingStationWdsl = path.join(__dirname, '/wsdl/OCPP_ChargePointService1.6.wsdl');
          break;
        default:
          reject(`OCPP version ${_chargingStation.getOcppVersion()} not supported`);
      }

      // Client' options
      var options = {};

      // Create client
      soap.createClient(chargingStationWdsl, options, function(err, client) {
        if (err) {
          reject(`Error when creating SOAP client for chaging station with ID ${_chargingStation.getChargeBoxIdentity()}: ${err.message}`);
        } else {
          // Keep
          _client = client;

          // Log
          _client.on("request", function(request) {
            console.log(request);
          });

          // Set endpoint
          _client.setEndpoint(_chargingStation.getEndPoint());

          // Ok
          fulfill(that);
        }
      });
    });
  }

  initSoapHeaders(action) {
    // Clear the SOAP Headers`
    _client.clearSoapHeaders();

    // Add them
    _client.addSoapHeader(`<h:chargeBoxIdentity xmlns:h="urn://Ocpp/Cp/2012/06/">${_chargingStation.getChargeBoxIdentity()}</h:chargeBoxIdentity>`);
    _client.addSoapHeader(`<a:MessageID xmlns:a="http://www.w3.org/2005/08/addressing">urn:uuid:589e13ae-1787-49f8-ab8b-4567327b23c6</a:MessageID>`);
    _client.addSoapHeader(`<a:ReplyTo xmlns:a="http://www.w3.org/2005/08/addressing"><a:Address>http://www.w3.org/2005/08/addressing/anonymous</a:Address></a:ReplyTo>`);
    _client.addSoapHeader(`<a:To xmlns:a="http://www.w3.org/2005/08/addressing">${_chargingStation.getEndPoint()}</a:To>`);
    _client.addSoapHeader(`<a:Action xmlns:a="http://www.w3.org/2005/08/addressing">/${action}</a:Action>`);
    _client.addSoapHeader(`<a:From xmlns:a="http://www.w3.org/2005/08/addressing"><a:Address>http://localhost:8080</a:Address></a:From>`);
  }

  reset(args) {
    var that = this;

    // Get the Charging Station
    return new Promise(function(fulfill, reject) {
      // Init SOAP Headers with the action
      that.initSoapHeaders("Reset");

      // Execute
      _client.Reset({resetRequest: args}, function(err, result, envelope) {
        if(err) {
          reject(`Reset - Error: ${err.message}`);
          //res.json(`{error: ${err.message}}`);
        } else {
          fulfill(result);
        }
      });
    });
  }

  getConfiguration(args) {
    var that = this;

    // Get the Charging Station
    return new Promise(function(fulfill, reject) {
      // Init SOAP Headers with the action
      that.initSoapHeaders("GetConfiguration");

      // Execute
      _client.GetConfiguration({getConfigurationRequest:(args?args:'')}, function(err, result, envelope) {
        if(err) {
          reject(`GetConfiguration - Error: ${err.message}`);
          //res.json(`{error: ${err.message}}`);
        } else {
          fulfill(result);
        }
      });
    });
  }

  getChargingStation() {
    return _chargingStation;
  }
}

module.exports = SoapChargingStationClient;
