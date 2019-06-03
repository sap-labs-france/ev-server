const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const config = {
  mode: 'production',
  devtool: "source-map",
  plugins: [
    new CleanWebpackPlugin(),
  ]
};

module.exports = config;
