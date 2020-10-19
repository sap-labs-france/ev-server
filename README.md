# Electric Vehicle Charging Station (EVSE) - Application Server

## Summary

This application server (NodeJs) collects and stores the data (MongoDB) received from the Charging Stations via the OCPP protocol and exposes a REST service to an Angular front-end dashboard application ([EVSE-Dashboard](https://github.com/LucasBrazi06/ev-dashboard)).

The application features:

* Displays of the charging stations, their status and their delivered power in real time.
* User management (create, update, delete, authorize, change role...)
* Charging station charging curves in real time
* Actions on charging stations: Reboot, Clear Cache, Stop Transaction, Unlock Connector...
* Energy control: set the maximum energy delivered by the charging station

**Live demo here** <a href="https://slf.evse.cfapps.eu10.hana.ondemand.com/auth/login?email=demo.demo@sap.com&password=DeM*Us$r1" target="_blank">e-Mobility</a>

## Installation

* Install NodeJS: https://nodejs.org/ (install the LTS version)
* Install Python version 2.7 (not the version 3.7!)
* Install MongoDB: https://www.mongodb.com/
* Clone this GitHub project
* Install required build tools:
  * Under Windows as an administrator:
    ```
    npm install --global --production windows-build-tools
    ```
  * Under Mac OS X, install Xcode from the Apple store
  * Under Debian based GNU/Linux distribution:
    ```
    sudo apt install build-essential
    ```
* Go into the **ev-server** directory and run **npm install** or **yarn install**

**NOTE**:
* On Windows with **chocolatey** (https://chocolatey.org/), do as an administrator:

```
choco install -y nodejs-lts python2 mongodb postman robot3t microsoft-build-tools
```

* On Mac OSX with **Homebrew** (https://brew.sh/), do:

```
brew tap mongodb/brew
brew install node mongodb-community@4.2 && brew cask install postman robo-3t
```

* Follow the rest of the setup below

## The Database

#### Start MongoDB

##### Manually

```
mongod --port <port> --dbpath <path> --replSet <replcaSetName>
```
For instance:
```
mongod --port 27017 --dbpath "/var/lib/mongodb" --replSet "rs0"
```

##### As a Windows service

Add to /path/to/mongod.cfg (open -a TextEdit /usr/local/etc/mongod.cfg)
```
...
replication:
  replSetName: "rs0"
...
```
Restart the MongoDB service with Powershell as an administrator:

    Restart-Service -Name "MongoDB"

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

#### Create the Admin user

This user will be used to connect to the database as an administrator with tools like MongoDB shell or RoboMongo:

Create Admin User on Admin schema:
```
  use admin
  db.createUser({
    user: "evse-admin",
    pwd: "<YourPassword>",
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
    ],
    passwordDigestor: "server"
  })
```

#### Restart MongoDB with authentication enabled

##### Manually

This will restart MongoDB and will accept only authenticated connections from now:

```
mongod --auth --port <port> --dbpath <path> --replSet <replcaSetName>
```

##### As a Windows service

Add to /path/to/mongod.cfg:
```
...
security:
  authorization: enabled
...
```

Restart the MongoDB service with Powershell as an administrator:

    Restart-Service -Name "MongoDB"

#### Create the Application User

Connect using the admin user

```
mongo -u evse-admin -p <YourPassword> --authenticationDatabase admin
```

Create Application User on EVSE schema
```
  use evse
  db.createUser({
    user: "evse-user",
    pwd: "<YourPassword>",
    roles: [
      "readWrite"
    ],
    passwordDigestor: "server"
  })
```

Now your database is ready to be used.

**NOTE**: You can also use empty-db.zip or empty-db-service.zip on the share to do the initial setup of the databases required by simply deleting all files in the MongoDB databases path and then dropping its content inside instead.

## The Application Server

The application server consists of:

* **Central Service Server**: Serves the charging stations
* **Central Service REST Server**: Serves the Angular front-end dashboard

### The Central Service Server (CSS)

This application server will listen to the charging stations and store the data exchanged into to the database.

It can also communicate with the charging stations (reboot, stop a transaction...)

The protocol used by this application server is OCPP (Open Charge Point Protocol) in version 1.2, 1.5 and 1.6 (SOAP).

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
    "socketIO": true,
    "socketIOListNotificationIntervalSecs": 5,
    "socketIOSingleNotificationIntervalSecs": 1,
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
    "socketIO": true,
    "socketIOListNotificationIntervalSecs": 5,
    "socketIOSingleNotificationIntervalSecs": 1,
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

The user will receive a notification when, for instance, his vehicle will be fully charged.

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
* SuperAdmin (**S**)
* Admin (**A**)
* Basic (**B**)
* Demo (**D**)

##### Authorisation Matrix

|                  |            SuperAdmin          |                                                       Admin                                                       |                   Basic                 |      Demo     |
|------------------|:------------------------------:|:-----------------------------------------------------------------------------------------------------------------:|:---------------------------------------:|:-------------:|
| Users            |                                |                                                        List                                                       |                    -                    |       -       |
| User             |                                |                                        Create, Read, Update, Delete, Logout                                       | Read, Update (Only logged user), Logout | (user hidden) |
| ChargingStations |                                |                                                        List                                                       |                   List                  |      List     |
| ChargingStation  |                                | Read, Update, Delete, Reset, ClearCache,  GetConfiguration, ChangeConfiguration, StopTransaction, UnlockConnector |                   Read                  |      Read     |
| Logging          |               List             |                                                        List                                                       |                    -                    |               |
| Tenant           |  Create, Read, Update, Delete  |                                                                                                                   |                    -                    |               |

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
      "fr_FR",
      "es_MX",
      "de_DE",
      "pt_PT",
    ]
 },
```

## The Charging Stations

Each charging station vendor has its own configuration interface, so I'll just describe in general terms what's to be setup on those:

* Set this server URL in the charging station's interface
* Rename the charging station ID if necessary: this will be the key (use Company-Town-Number)
* Set the charging station endpoint public URL to a reachable URL so the server can use it to trigger action on it (avoid using *localhost*)

All charging stations supporting OCPP-J and OCPP-S version 1.5 and 1.6 protocols are compatibles.

## Start the Central Service Server (CSS)

### Production Mode

Start the application:

```
npm run start
```

You can also start the application with the standard nodejs profiler:

```
npm run start:prod:prof
```

### Development Mode

In a console, start the application (rebuild and restarts if any changes is detected):

```
npm run start:dev
```

You can also start the application with the standard nodejs profiler:

```
npm run start:dev:prof
```

### Profiling with [clinic](https://clinicjs.org)

```
npm run start:(prod|dev):(doctorprof|flameprof|bubbleprof)
```

**NOTE**: You can also use the files in the ev-config-scripts.zip on the share to have a correct initial setup of your development environment and some server startup helpers.

### Tests
**Prerequisite:** The database must contain an admin user.

* Create a local configuration file located in './test/config/local.json' from the template file './test/config-template.json' with the parameters to override like

        {
          "superadmin": {
            "username": "YOUR_SUPERADMIN_USERNAME",
            "password": "YOUR_SUPERADMIN_PASSWORD"
          },
          "admin": {
            "username": "YOUR_ADMIN_USERNAME",
            "password": "YOUR_ADMIN_PASSWORD"
          },
          "server": {
            "logs": "json"
          },
          "ocpp": {
            "json": {
                "logs": "json"
            }
          }
        }


  For further parameters, check the [`config`](./test/config.js) content. It is also possible to use environment variables as defined in the [`config`](./test/config.js) file
* Start a server containing the configured admin user in the database
* If you have not done it yet, run the command `npm run mochatest:createContext`
* Run the command `npm run mochatest`

### Docker Mode
Depending on the need it is possible to start different docker containers.

Each following command has to be executed in folder [docker](./docker).

#### Minimal local environment
It consist in starting a pre configured empty mongo database plus a mail service and mongo express.
To start it, execute command:
```bash
make local-env
```
To stop it, execute command:
```bash
make clean-local-env-containers
```
The mongo database folder will be kept along multiple restarts. To remove it:
```bash
make clean-mongo-data
```
Due to fixed replica set configuration, the database hostname has to be referenced in the host machine to be accessible.
To enable it, as admin, add the entry `ev_mongo 127.0.0.1` in `/private/etc/hosts` for MacOSX or in `C:\Windows\System32\Drivers\etc\hosts` for Windows.

The database is then accessible using the credential `evse-admin/evse-admin-pwd`.
The default login/password on the master tenant is super.admin@ev.com/Super.admin00. The default login/password on the SLF tenant is slf.admin@ev.com/Slf.admin00.

#### ev-server
In case of UI development or test purpose, the server has been containerized.
To start it, execute command:
```bash
make server
```
In order to rebuild the image in case of changes:
```bash
make server-force
```
To stop it, execute command:
```bash
make clean-server-container
```

#### mongo express
If needed, it is possible to start or stop a [mongo express](https://github.com/mongo-express/mongo-express) instance auto connected to mongodb independently.
To start it, execute command:
```bash
make mongo-express
```

To stop it, execute command:
```bash
make clean-mongo-express-container
```

#### All in one
It is possible to build and start all containers in one command:
```bash
make
```
Or without the optional git submodules:
```bash
make SUBMODULES_INIT=false
```
That Makefile option works for all targets.

## Architecture

### TAM Model
![TAM Model](./tam-model.png)

## License

This file and all other files in this repository are licensed under the Apache Software License, v.2 and copyrighted under the copyright in [NOTICE](NOTICE) file, except as noted otherwise in the [LICENSE](LICENSE) file.

Please note that Docker images can contain other software which may be licensed under different licenses. This LICENSE and NOTICE files are also included in the Docker image. For any usage of built Docker images please make sure to check the licenses of the artifacts contained in the images.
