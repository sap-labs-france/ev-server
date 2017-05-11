var Logging = require('../../utils/Logging');
var ChargingStation = require('../../model/ChargingStation');
var centralSystemService12 = require('./services/centralSystemService1.2');
var centralSystemService15 = require('./services/centralSystemService1.5');
var centralSystemService16 = require('./services/centralSystemService1.6');
var ChargingStationRestService = require('../ChargingStationRestService');
var fs = require('fs');
var soap = require('strong-soap').soap;
var path = require('path');
var xmlformatter = require('xml-formatter');
var http = require('http');
var express = require('express')();
var cors = require('cors');
var bodyParser = require("body-parser");
var cookieParser = require('cookie-parser')()
var CentralSystemServer = require('../CentralSystemServer');
var helmet = require('helmet');
require('body-parser-xml')(bodyParser);
var passport = require('passport');
var JwtStrategy = require('passport-jwt').Strategy;
var ExtractJwt = require('passport-jwt').ExtractJwt;
var LocalStrategy = require('passport-local').Strategy;
var expressSession = require('express-session')({
    secret: 's3A92797boeiBhxQDM1GInRith',
    resave: false,
    saveUninitialized: true,
    cookie: { httpOnly: true, maxAge: 2419200000 },
    secure: true })

const allowedOrigins = [
  'http://localhost:8080',
  'http://37.71.38.82:8080'];

let _serverConfig;
let _chargingStationConfig;

class SoapCentralSystemServer extends CentralSystemServer {
    constructor(serverConfig, chargingStationConfig) {
      super(serverConfig, chargingStationConfig);

      // Keep local
      _serverConfig = serverConfig;
      _chargingStationConfig = chargingStationConfig;
    }

    isAuthenticated(req, res, next) {
      if (!req.isAuthenticated()) {
        res.status(401).send();
      } else {
        next();
      }
    }

    /*
      Start the server and listen to all SOAP OCCP versions
      Listen to external command to send request to charging stations
    */
    start() {
      // Body parser
      express.use(bodyParser.json());
      express.use(bodyParser.urlencoded({ extended: false }));
      express.use(bodyParser.xml());

      // Cross origin headers
      // express.use(cors());

      // Cookies
      express.use(cookieParser);

      // Use session
      express.use(expressSession);

      // Secure the application
      express.use(helmet());

      // Authentication
      passport.use(new LocalStrategy({usernameField: 'email', session: true},
        function(email, password, done) {
          // Check email
          global.storage.getUserByEmail(email).then(function(user) {
            if (user) {
              return done(null, user.getModel());
            } else {
              return done(null, false);
            }
            next();
          }).catch((err) => {
            // Log
            return done(err, false);
          });
        }
      ));
      // // Init JWT auth
      // var opts = {};
      // opts.secretOrKey = 'secret';
      // opts.jwtFromRequest = ExtractJwt.fromAuthHeader();
      // // opts.issuer = 'accounts.examplesoft.com';
      // // opts.audience = 'yoursite.net';
      // passport.use(new JwtStrategy(opts, function(jwtPayload, done) {
      //   // Check the user
      //   global.storage.getUser(jwtPayload.sub).then(function(user) {
      //     if (user) {
      //       return done(null, user.getModel());
      //     } else {
      //       return done(null, false);
      //     }
      //     next();
      //   }).catch((err) => {
      //     // Log
      //     return done(err, false);
      //   });
      // }));

      passport.serializeUser(function(user, done) {
        done(null, user.id);
      });

      passport.deserializeUser(function(id, done) {
        // Check email
        global.storage.getUser(id).then(function(user) {
          if (user) {
            return done(null, user.getModel());
          } else {
            return done(null, null);
          }
          next();
        }).catch((err) => {
          // Log
          return done(err, null);
        });
      });
            // Authentication
      express.use(passport.initialize());
      express.use(passport.session());

      // Cross Origin
      express.use((request, response, next) => {
        var origin = request.headers.origin;
        if (allowedOrigins.indexOf(origin) > -1) {
          response.setHeader('Access-Control-Allow-Origin', origin);
        }
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Requested-With');
        response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,HEAD,DELETE,OPTIONS');
        response.setHeader('Access-Control-Allow-Credentials', true);
        // Check
        if (request.method === "OPTIONS") {
          response.end();
        } else {
          next();
        }
      });

      // authenticate
      // express.post('/auth/local', passport.authenticate('jwt', { session: false }),
      //   function(req, res) {
      //     res.status(200).send("pong!");
      //   }
      // );

      // Login
      express.post('/auth/login', passport.authenticate('local', {}),
        function(req, res) {
          res.status(200).send({});
      });

      // Logout
      express.get('/auth/logout',
        function(req, res) {
          // Get rid of the session token. Then call `logout`; it does no harm.
          req.logout();
          req.session.destroy();
          res.status(200).send({});
      });

      // Receive REST request to trigger action to the charging station remotely (reboot...)
      express.use('/client/api', this.isAuthenticated, ChargingStationRestService);

      // Ping
      express.get('/ping', function(req, res) {
        res.status(200).send({});
      });

      // Create the HTTP server
      var httpServer = http.createServer(express);

      // Read the WSDL files
      var centralSystemWsdl12 = fs.readFileSync(
        path.join(__dirname, '/wsdl/OCPP_CentralSystemService1.2.wsdl'), 'UTF-8');
      var centralSystemWsdl15 = fs.readFileSync(
        path.join(__dirname, '/wsdl/OCPP_CentralSystemService1.5.wsdl'), 'UTF-8');
      var centralSystemWsdl16 = fs.readFileSync(
        path.join(__dirname, '/wsdl/OCPP_CentralSystemService1.6.wsdl'), 'UTF-8');

      // Create Soap Servers
      // OCPP 1.2 -----------------------------------------
      var soapServer12 = soap.listen(httpServer, '/OCPP12', centralSystemService12, centralSystemWsdl12);

      // OCPP 1.5 -----------------------------------------
      var soapServer15 = soap.listen(httpServer, '/OCPP15', centralSystemService15, centralSystemWsdl15);

      // OCPP 1.6 -----------------------------------------
      var soapServer16 = soap.listen(httpServer, '/OCPP16', centralSystemService16, centralSystemWsdl16);

      // Listen
      httpServer.listen(_serverConfig.port, function(req, res) {
        // Log
        Logging.logInfo({
          source: "Central Server", module: "SoapCentralSystemServer", method: "start",
          message: `Central Server started on 'localhost:${_serverConfig.port}'` });
        console.log(`Central Server started on 'localhost:${_serverConfig.port}'`);
      });
    }
}

module.exports = SoapCentralSystemServer;
