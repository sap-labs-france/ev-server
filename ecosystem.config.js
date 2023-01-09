module.exports = {
  apps: [{
    env: {
      NODE_ENV: "development",
      SERVER_ROLE: "ocppj"
    },
    name: "pm2 - ocppj - server",
    script: "./dist/start.js"
  }, {
    env: {
      NODE_ENV: "development",
      SERVER_ROLE: "rest"
    },
    name: "pm2 - rest server",
    script: "./dist/start.js"
  }]
}
