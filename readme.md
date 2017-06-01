# Electric Vehicule Charging Station Server
## Summary
This server collects the data from the Charging Stations via the OCPP protocol (supports 1.2, 1.4 and 1.6.)
It exposes a REST service to exploit these data with whatever front-end.
An Angular 2  Dashbord, the EVSE-Dashboard (ev-dashboard) is using this service to display Charging Station data and provide actions.

## Server Installation
* Install NodeJS: https://nodejs.org/
* Install MongoDB: https://www.mongodb.com/
* Clone this GitHub project
* Run **npm install** in the **ev-serveur** directory
* Follow the setup below

## Database Setup

#### Start MongoDB
Start MongoDB without the **--auth** param to avoid authentication.
```
mongod --port 27017 --dbpath /data/evse
```

#### Create the Admin User

Launch the MongoDB console and create two users:

```json
Admin User
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
```json
use evse
  db.createUser({
    user: "evse-user",
    pwd: "<Password>",
	  roles: [
		  "readWrite"
	  ]
  })
```

#### Restart MongoDB with the '--auth' param
```
mongod --auth --port 27017 --dbpath /data/evse
```
Now MongoDB will accept only authenticated connections.

## Central Service Server (Listen to Charging Stations)

Edit the **config.json** and set the list of servers with connection and implementation data
```
  "CentralSystems": [
    {
      "implementation": "soap",
      "protocol": "http",
      "port": 8000
    }
  ]
```

## Central Service REST Server (Serve the EVSE-Dashboard)

Edit the **config.json** file

Enable the SSL protocol by providing the SSL certificates
```
  "CentralSystemRestService": {
    "protocol": "https",
    "port": 8888,
    "ssl-key": "ssl/64933587-localhost.key",
    "ssl-cert": "ssl/64933587-localhost.cert"
  }
```

## Central Service Server Database

The serveur supports several databases to push data into but only one will be the leading DB (user management...)

Edit the **config.json** file

### Setup the Leading Database
Set the leading database connection info
```
  "Storages": [
    {
      "implementation": "mongodb",
      "host": "localhost",
      "port": 27017,
      "user": "evse-user",
      "password": "<Password>",
      "schema": "evse",
      "leading" : true
    }
  ],
```

### EVSE-Dashboard connection example

In **assets** directory edit the **config.json** directory and set the URL
```
  "CentralSystemServer": {
    "protocol": "https",
    "host": "localhost",
    "port": 8888
  }
```

## Charging Stations Setup
Each charging station vendor has its own configuration interface, so I'll just describe in general terms what's to be setup on those.
* You must configure the server URL to point to this server
* Check the charging station ID usually called *ChargingStationIdentity*. This is important as this will be the key in the database.
* Set the charging station default public URL to a reachable URL so the server can use it to trigger action on it (avoid using *localhost*)

## Start the Central Service Server

### Start Production Mode Server
It's start the server that will connect first to the database, start the Central Service server (charging stations) and the Central Service Rest server (front-end.)
```
npm start
```
### Start Dev Mode Server
```
npm start:dev
```

## Start the EVSE-Dashboard Server

### Start Production Mode Server
```
npm start:prod:dist
```
### Start Production Secured Mode Server
```
npm start:prod:dist:ssl
```
### Start Dev Mode Server
```
npm start
```
