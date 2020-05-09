const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const config = {
  mode: 'production',
  plugins: [
    new CleanWebpackPlugin(),
  ]
};

module.exports = config;
