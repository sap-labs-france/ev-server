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
* Install NodeJS: https://nodejs.org/
* Install MongoDB: https://www.mongodb.com/
* Clone this GitHub project
* Run **npm install** in the **ev-server** directory
* Follow the setup below

## The Database

#### Start MongoDB

```
mongod --port 27017 --dbpath /data/evse
```

#### Create the Admin user

This user will be used to connect to the database as an administrator with tools like MongoDB shell or RoboMongo:

In MongoDB shell, run the following command:

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

#### Create the Application user

This user will be used by the application server to read/write data in MongoDB:

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

#### Restart MongoDB with authentication enabled

This will restart MongoDB and will accept only authenticated connections from now:

```
mongod --auth --port 27017 --dbpath /data/evse
```

Now your database is ready to be used.

## The Application Server

The application server consits of:
* **Central Service Server**: A server that communicates with the charging stations
* **Central Service REST Server**: A REST server that communicates with front-end Angular dashboard


### The Central Service Server (CSS)

This application server will listen to the charging station and store their data to the database.

It can also communicate with the charging stations (reboot, stop a transaction...)

The communication used by this application server is the OCPP protocol (Open Charge Point Protocol) in version 1.2, 1.5 and 1.6.

Other protocols, like the ISO 15118, may also be supported in the future.

#### Configuration

The server configuration is stored in the **config.json** file in the **src** directory.

There is a template already provided named **config-template.json**.

Rename it to **config.json**.

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

In the **config.json** file, set the database connection info

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

In the **config.json** file edit the following info:

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
* Corporate (**C**)
* Demo (**D**)

##### Authorisation Matrix

|                  |                                                       Admin                                                       |                   User                  | Corporate |      Demo     |
|------------------|:-----------------------------------------------------------------------------------------------------------------:|:---------------------------------------:|:---------:|:-------------:|
| Users            |                                                        List                                                       |                    -                    |     -     |       -       |
| User             |                                        Create, Read, Update, Delete, Logout                                       | Read, Update (Only logged user), Logout |    Read   | (user hidden) |
| ChargingStations |                                                        List                                                       |                   List                  |    List   |      List     |
| ChargingStation  | Read, Update, Delete, Reset, ClearCache,  GetConfiguration, ChangeConfiguration, StopTransaction, UnlockConnector |                   Read                  |    Read   |      Read     |
| Logging          |                                                        List                                                       |                    -                    |     -     |               |

#### Import initial Users in database

First time you launch the dashoard, the database will be empty.

Edit the **user-template.json** file and enter at least an Admin user (role = "A":

```
 {
  "name": "Admin",
  "firstName": "",
  "email": "",
  "phone": "",
  "mobile": "",
  "iNumber": "",
  "costCenter": "",
  "status": "A",
  "tagIDs": [],
  "role": "A"
 },
```

Only the **email** and the **name** are mandatory and must not exist in the database.

Once done, rename the file to **user.json** and when you will start the server, you will get your user imported and the file will be renamed to **user-imported.json**.

You can repeat the process with new users.

Once done, you can get your password using the dashboard (you will receive it by email.)


### Notifications

The user will receive a notification when, for instance, his vehicule will be fully charged.

#### Email Notification

In the **config.json**, set the following info:

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
npm start:prod
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
npm start:dev
```

## Architecture

### TAM Model
![TAM Model](./tam-model.png)
