const commonConfig = require('./build/webpack.common');
const { merge } = require('webpack-merge');

const addons = (addonsArg) => {
  const addons = []
    .concat.apply([], [addonsArg]) // Normalize array of addons (flatten)
    .filter(Boolean); // If addons is undef, filter is out

  return addons.map((addonName) => { require(`./build/addons/webpack.${addonName}`); });
};

module.exports = (env) => {
  // Get env config
  const envConfig = require(env.prod ? `./build/webpack.prod` : `./build/webpack.dev`);
  // Merge configs
  const config = merge(commonConfig, envConfig, addons(env.addons));
  // Return it
  return config;
};
