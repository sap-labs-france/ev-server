# EV Charging Platform
## Summary
This application consists of two parts:
* An OCPP Server that receives requests from the charging stations and stores the JSon data to MongoDB
* An OCPP Client that triggers actions to the EV charging stations like *reboot*...

## Server Installation
* It runs on top of NodeJs so you should have it installed: https://nodejs.org/
* You should also install MongoDB: https://www.mongodb.com/
* Once NodeJS installed, clone the GitHub project anf run: *npm install* (it'll install all the dependencies)
* At the root of this project, you have a configuration file named *config.json*
* Check the content and adjust eventually the server or the database port
* Start the server with *npm start*
* You should have the two following messages:
    * SOAP Server started on port 8000
    * MongoDB: Connected to localhost:27017, Schema evcharger

## Charging Stations Setup
Each charging station vendor has its own configuration interface, so I'll just describe in general terms what's to be setup on those.
* You must configure the server URL to point to this server
* Check the charging station ID usually called *ChargingStationIdentity*. This is important as this will be the key in the database.
* Set the charging station default public URL to a reachable URL so the server can use it to trigger action on it (avoid using *localhost*)

## OCPP Server

### Communication Protocol
The Server that will receive the request is implemented using SOAP protocol of OCPP.
The version 1.6 proposes a lighter REST protocol based on JSon, this framework will allow you to provide your own REST server implementation easily (server interface decoupled from the techs like SOAP)

### Database
By default MongoDB is used but you can plug your own data supplier that will get the data that you will store wherever you want.
So there can be many databases where you can publish but there will be only one leading.

### Add a new Charging Station Action
A charging station action is a command that sends the Charging Station to the OCPP Server.
If a new protocol will be issued along new actions, follow the procedure below to add a new one:
##### New Version of OCPP
The current server implementation uses the SOAP protocol to exchange with the charging stations, then if there is a new version of OCPP you should generate the proxy js file with the help of the new WDSL.
* TODO
##### Add a new SOAP Action
Let add for instance a new action named **StatusNotification**:

* Handle the action in Soap service files
    * In all the **centralSystemService\*.js** files in folder **/server/soap/services** find the new method **StatusNotification** (should have been generated with the WDSL tool above)
    * Add the call below to the OCPP Central Server class **CentralSystemServer**
    ```
            return global.centralSystem.handleStatusNotification(args, headers, req);
    ```
    * In the class **CentralSystemServer**, implement the method **handleStatusNotification**
    ```
            handleStatusNotification(args, headers, req) {
                // Set the ChargeBox ID
                args.chargeBoxIdentity = headers.chargeBoxIdentity || 'Unknown';

                // Save Status Notif
                global.storage.saveStatusNotification(args);

                // Return the response
                return {
                  statusnotificationResponse: {
                  }
                }
            }
    ```
    * Here we save the request in the leading database (could have several ones) and return the response (no data to be returned for this action)

* Enhance the Storage class to save the action
    * In the **Storage** class in folder **/Storage** add an empty method to save the action and read it
    ```
            saveStatusNotification(statusNotification) {
            }

            getStatusNotifications(chargeBoxIdentity) {
            }
    ```    
    * In the **StorageFacade** class, add also both methods with the following implementation
    ```
            saveStatusNotification(statusNotification) {
                // Delegate
                _storages.forEach(function(storage) {
                  // Trigger Save for other DB
                  storage.saveStatusNotification(statusNotification);
                });

                // Delegate
                return _leadingStorage.saveStatusNotification(statusNotification).then(function() {});
            }

            getStatusNotifications(chargeBoxIdentity) {
                // Delegate
                return _leadingStorage.getStatusNotifications(chargeBoxIdentity);
            }
    ```
    * The **saveStatusNotification** goes in all extra databases and call the save method and perform a save on the leading one with a promise response.
    * Then to store it in MongoDB implementation we will need to create a model in folder **\storage\mongodb\model\**
    * In this folder create a file named **MDBStatusNotification.js** and declare the MongoDB model
    ```
            var mongoose = require('mongoose');

            module.exports = mongoose.model('StatusNotification',{
              chargeBoxIdentity: String,
              chargeBoxID: {type: mongoose.Schema.ObjectId, ref: 'ChargingStation'},
              connectorId: Number,
              errorCode: String,
              info: String,
              status: String,
              timestamp: Date,
              vendorId: String,
              vendorErrorCode: String
            });
    ```    
    * Now that the model is created, we'll use it in MongoDB implementation class named **MongoDBStorage** in folder **\storage\mongodb\**
    * Implement the method **saveStatusNotification**
    ```
            saveStatusNotification(statusNotification) {
              // Get
              return this._getChargingStationMongoDB(statusNotification.chargeBoxIdentity).then(function(chargingStationMongoDB) {
                if (chargingStationMongoDB) {
                  // No: Create it
                  var statusNotificationMongoDB = new MDBStatusNotification(statusNotification);

                  // Set the ID
                  statusNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;

                  // Create new
                  return statusNotificationMongoDB.save(function(err, results) {
                      if (err) {
                          console.log(`MongoDB: Error when creating Status Notification of ${statusNotification.chargeBoxIdentity}: ${err.message}`);
                          throw err;
                      }
                      console.log(`MongoDB: Status Notification of ${statusNotification.chargeBoxIdentity} created with success`);
                  });
                } else {
                  console.log(`MongoDB: Charging Station ${statusNotification.chargeBoxIdentity} not found: Cannot add Status Notification`);
                }
              }).catch(function(err) {
                console.log(`MongoDB: error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
              });
            }
    ```
    * And finally the method **getStatusNotifications**
    ```
            getStatusNotifications(chargeBoxIdentity) {
              // Get the Status Notification
              return new Promise(function(fulfill, reject) {
                  // Exec request
                  MDBStatusNotification.find((chargeBoxIdentity?{"chargeBoxIdentity": chargeBoxIdentity}:{}), function(err, statusNotificationsMongoDB) {
                      var statusNotifications = [];

                      if (err) {
                          reject(err);
                      } else {
                          // Create
                          statusNotificationsMongoDB.forEach(function(statusNotificationMongoDB) {
                            var statusNotification = {};
                            // Set values
                            Utils.updateStatusNotification(statusNotificationMongoDB, statusNotification);
                            // Add
                            statusNotifications.push(statusNotification);
                          });
                          // Ok
                          fulfill(statusNotifications);
                      }
                  });
              });
            }
    ```
    * Now the action is persisted in the database
* Last will be to make the data available from a REST service so it can be consumed by any front-end
    * So the call to the service will be of the form:
    ```
            {
            	"action": "GetStatusNotifications",
            	"args": {
            		"chargeBoxIdentity": "REE001"
            	}
            }
    ```
    * With the **args** optional if you want all the notifications of all charging stations
    * In file **SoapChargingStationClient** there are two parts: actions to perform on a charging station and data to retrieve from the database. Here we are in the second case.
    * Add in the **switch** statement a new case named like the **action** param in the request: **GetStatusNotifications** and simply call the database to return the result:
    ```
            // Get all the Status Notifications
            case "GetStatusNotifications":
              global.storage.getStatusNotifications((req.body.args?req.body.args.chargeBoxIdentity:null)).then(function(statusNotifications) {
                // Return the error
                res.json(statusNotifications);
                next();
              });
              break;
    ```    
### How to implement a new Server protocol

### How to implement a new Data Supplier


## OCPP Client
A REST API is exposed by the server to handle commands to send to the charging stations

### List of REST services
##### Actions to perform on a charging station
##### Data to retrieve from the database
