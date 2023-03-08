module.exports = {
  apps: [{
    env: {
      NODE_ENV: "development",
      SERVER_ROLE: "ocppj"
    },
    name: "pm2 - OCPP",
    script: "./dist/start.js"
  }, {
    env: {
      NODE_ENV: "development",
      SERVER_ROLE: "rest"
    },
    name: "pm2 - REST",
    script: "./dist/start.js"
  }, {
    env: {
      NODE_ENV: "development",
      SERVER_ROLE: "batch"
    },
    name: "pm2 - BATCH",
    script: "./dist/start.js"
  }]
}
