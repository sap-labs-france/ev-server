# Electric Vehicule Charging Station (EVSE) - Application Server

## Summary

This application server (NodeJs) collects and stores the data (MongoDB) received from the Charging Stations via the OCPP protocol and exposes a REST service to an Angular front-end dashboard application ([EVSE-Dashboard](https://github.com/LucasBrazi06/ev-dashboard)).

The application:
* Displays of the charging stations, their status and their delivered power in real time.
* User management (create, update, delete, authorize, change role...)
* Charging station charging curve real time
* Actions on charging stations: Reboot, Clear Cache, Stop Transaction, Unlock Connector...
* Energy control: Set the maximum energy delivered by the charging station

**Live demo here** [Smart EVSE](https://smart-evse.com/)

## Installation
* Install NodeJS: https://nodejs.org/ (install the LTS version)
* Install Python version 2.7 (not the version 3.7!)
* Install MongoDB: https://www.mongodb.com/ (do not install the DB as a service)
* Clone this GitHub project
* Go into the **ev-server** directory and run **npm install** or **yarn install** (use sudo in Linux)
* In case of issue with package **bcrypt** do the following:
```
  - npm install -g node-gyp
  - npm install --g --production windows-build-tools
  - npm install bcrypt
```
* Follow the rest of the setup below

## The Database

#### Start MongoDB

```
mongod --port <port> --dbpath <path> --replSet <replcaSetName>
```
For instance:
```
mongod --port 27017 --dbpath "/var/lib/mongodb" --replSet "rs0"
```

#### Create the Admin user

This user will be used to connect to the database as an administrator with tools like MongoDB shell or RoboMongo:

Create Admin User on Admin schema:
```
  use admin
  db.createUser({
    user: "evse-admin",
	  pwd: "<Password>",
	  roles: [
        "read",
        "readWrite",
        "dbAdmin",
        "userAdmin",
        "clusterAdmin",
        "readAnyDatabase",
        "readWriteAnyDatabase",
        "userAdminAnyDatabase",
        "dbAdminAnyDatabase"
	  ]
  })
```

#### Create the Application User

Create Application User on EVSE schema
```
  use evse
  db.createUser({
    user: "evse-user",
    pwd: "YourPassword",
	  roles: [
		  "readWrite"
	  ]
  })
```

#### Activate the Replica Set

Activate the replica set:

- Start the Mongo client
```
mongo
```

- Activate the Replica Set
```
rs.initiate()
```

Check here for more info:
[Mongo DB Replica Set](https://docs.mongodb.com/manual/tutorial/convert-standalone-to-replica-set/)

#### Restart MongoDB with authentication enabled

This will restart MongoDB and will accept only authenticated connections from now:

```
mongod --auth --port <port> --dbpath <path> --replSet <replcaSetName>
```

Now your database is ready to be used.

## The Application Server

The application server consists of:
* **Central Service Server**: Serves the charging stations
* **Central Service REST Server**: Serves the Angular front-end dashboard


### The Central Service Server (CSS)

This application server will listen to the charging stations and store the data exchanged into to the database.

It can also communicate with the charging stations (reboot, stop a transaction...)

The protocol used by this application server is OCPP (Open Charge Point Protocol) in version 1.2, 1.5 and 1.6 (SOAP.)

Other protocols, like the ISO 15118, or OCPP 2.0 will also be supported in the future.

#### Configuration

There are two templates already provided named **config-template-http.json** for HTTP and **config-template-https.json** for HTTPS.

Choose one and rename it to **config.json**.

Move this configuration file into the **src** directory.

#### Listen to the Charging Stations

Set the protocol, host and the port which you want the server to listen to (only OCPP SOAP implementation is supported):

```
  "CentralSystems": [
    {
      "implementation": "soap",
      "protocol": "http",
      "host": "localhost",
      "port": 8000
    }
  ]
```
There can be several central systems with different protocols but today only http protocol is supported, thus there is no possibility to encrypt the communication between the server and the charging stations for the time being.


### The Central Service REST Server (CSRS)

The server also exposes a set of REST services to serve the front-end [Angular Dashboard](https://github.com/LucasBrazi06/ev-dashboard).

This application displays the charging stations with their statuses, charging curves, user management...

To set the end point, fill the following information in the **config.json** file

#### Secure Configuration (SSL)

```
  "CentralSystemRestService": {
    "protocol": "https",
    "host": "localhost",
    "port": 443,
    "ssl-key": "ssl/64933587-localhost.key",
    "ssl-cert": "ssl/64933587-localhost.cert",
    "ssl-ca": [],
    "userTokenKey": "MySecureKeyToEncodeTokenAuth",
    "userTokenLifetimeHours": 12,
    "userDemoTokenLifetimeDays": 365,
    "webSocketNotificationIntervalSecs": 5,
    "debug": false
  }
```

#### Simple Configuration

```
  "CentralSystemRestService": {
    "protocol": "http",
    "host": "localhost",
    "port": 80,
    "userTokenKey": "YourSecureKeyToEncodeTokenAuth",
    "userTokenLifetimeHours": 12,
    "userDemoTokenLifetimeDays": 365,
    "webSocketNotificationIntervalSecs": 5,
    "debug": false
  }
```

### Central Service Server (CSS) > Database

You have now to connect the server to the database.


#### Configuration

Database connection info:

```
  "Storage": {
    "implementation": "mongodb",
    "host": "localhost",
    "port": 27017,
    "user": "evse-user",
    "password": "YourPassword",
    "schema": "evse"
  }
```

### Front-End

When the user will be notified (by email for instance), a link to the front-end application will be built based on the configuration below:

```
  "CentralSystemFrontEnd": {
    "protocol": "https",
    "host": "localhost",
    "port": 8080
  }
```

### Notifications

The user will receive a notification when, for instance, his vehicule will be fully charged.

Only notification via emails is implemented today.

#### Email Notification

Edit the following info:

```
  "Email": {
    "from": "evse.adm.noreply@gmail.com",
    "bcc": "",
    "smtp": {
      "host": "smtp.gmail.com",
      "port": 465,
      "secure": true,
      "requireTLS": true,
      "type": "login",
      "user": "YourEmailUser",
      "password": "YourEmailPassword",
      "debug": false
    }
  }
```

### Users


#### Authentication

The authentication is done via user login/password and the server will deliver a token that will expire after a certain period of time.

Then there are neither session nor cookies sent around and this will allow to scale easily.

The token key is provided is the **config.json** file:

```
  "CentralSystemRestService": {
	...
	"userTokenKey": "MySecureKeyToEncodeTokenAuth",
    "userTokenLifetimeHours": 12,
    "userDemoTokenLifetimeDays": 365,
	...
  }
```

You can set your own key to encode it in key **userTokenKey** and change its lifetime in **userTokenLifetimeHours** (12 hours by default.)

The Demo users can have a longer lifetime for demo purposes with key **userDemoTokenLifetimeDays** (365 days by default)


#### Authorization

The users can have differents roles:
* Admin (**A**)
* Basic (**B**)
* Demo (**D**)

##### Authorisation Matrix

|                  |                                                       Admin                                                       |                   Basic                 |      Demo     |
|------------------|:-----------------------------------------------------------------------------------------------------------------:|:---------------------------------------:|:-------------:|
| Users            |                                                        List                                                       |                    -                    |       -       |
| User             |                                        Create, Read, Update, Delete, Logout                                       | Read, Update (Only logged user), Logout | (user hidden) |
| ChargingStations |                                                        List                                                       |                   List                  |      List     |
| ChargingStation  | Read, Update, Delete, Reset, ClearCache,  GetConfiguration, ChangeConfiguration, StopTransaction, UnlockConnector |                   Read                  |      Read     |
| Logging          |                                                        List                                                       |                    -                    |               |


### Notifications

The user will receive a notification when, for instance, his vehicle will be fully charged.

#### Email Notification

Set the following info:

```
  "Email": {
    "from": "evse.adm.noreply@gmail.com",
    "bcc": "",
    "smtp": {
      "host": "smtp.gmail.com",
      "port": 465,
      "secure": true,
      "requireTLS": true,
      "type": "login",
      "user": "YourEmailUser",
      "password": "YourEmailPassword",
      "debug": false
    }
  }
```

### Charging Station Parameters

Here are the charging station parameters:

```
  "ChargingStation": {
    "heartbeatIntervalSecs": 60,
    "checkEndOfChargeNotificationAfterMin": 5,
    "notifBeforeEndOfChargePercent": 50,
    "notifBeforeEndOfChargeEnabled": false,
    "notifEndOfChargePercent": 0,
    "notifEndOfChargeEnabled": true,
    "notifStopTransactionAndUnlockConnector": false
  },

```

* **heartbeatIntervalSecs**: The time interval which the charging station will send the data to the server
* **checkEndOfChargeNotificationAfterMin**: The delay to wait before the notification will be sent when the charge will be finished
* **notifBeforeEndOfChargePercent**: The threshold for the intermediate notification  (% of the energy delivered by the charging station)
* **notifBeforeEndOfChargeEnabled**: Enable the intermediate notification
* **notifEndOfChargePercent**: The threshold for the end of charge (% of the energy delivered by the charging station)
* **notifEndOfChargeEnabled**: Enable the end of charge notification
* **notifStopTransactionAndUnlockConnector**: Enable the stop transaction and unlock of the connector when the charge will be finished

### Internationalization

Here are the default delivered locales:

```
 "Locales": {
 	"default": "en_US",
    "supported": [
      "en_US",
      "fr_FR"
    ]
 },
```

### Advanced Configuration

Here is the advanced configuration:

```
 "Advanced": {
  "backgroundTasksIntervalSecs": 120,
  "chargeCurveMeterIntervalSecs": 60
 }
```

* **backgroundTasksIntervalSecs**: Interval used by the background tasks that will do some actions like: updating the status of the charging stations, check and send notifications, import the initial users...
* **chargeCurveMeterIntervalSecs**: The interval between two points in the charging curve displayed in the Dashboard

## The Charging Stations

Each charging station vendor has its own configuration interface, so I'll just describe in general terms what's to be setup on those:

* Set this server URL in the charging station's interface
* Rename the charging station ID if necessary: this will be the key (use Company-Town-Number)
* Set the charging station endpoint public URL to a reachable URL so the server can use it to trigger action on it (avoid using *localhost*)

Tested and supported Charging Station:

* **Schneider Electric**
	* **Type**: Accelerated Charger
	* **Power**: 2 connectors AC of 22 kW
	* **Connector**: Type 2
	* **Product Id**: 501FE25
	* **Reference**: EV.2S22P44R
	* **OCPP Version**: 1.5
	* **Firmware**: 2.7.4.17


## Start the Central Service Server (CSS)

### Production Mode

Build the application:

```
npm run build:prod
```

Start the application:

```
npm run start:prod
```

Make sure you set the NODE_ENV variable before:

```
export NODE_ENV=production
```

Or in Windows:

```
SET NODE_ENV=production
```

### Development Mode

Build the application (it will watch any changes and rebuild it on the fly):

```
npm run build:dev
```

In another console, start the application (restarts if any changes is detected):

```
npm run start:dev
```
### Tests

* Create a local configuration file located in '/config/tests/local.json' with the parameters to override like 
         
        {
          "admin": {
            "username": "bla",
            "password": "bli"
          },
          "trace_logs": false
        }

  For further parameters, check the [`config`](./test/config.js) content. It is also possible to use environment variables as defined in the [`config`](./test/config.js) file
* Start a server containing the configured admin user in the database
* run the command `npm tests`

## Architecture

### TAM Model
![TAM Model](./tam-model.png)
