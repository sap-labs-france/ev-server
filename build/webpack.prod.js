const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const config = {
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [{
          loader: 'ts-loader',
          options: {
              configFile: "tsconfig-prod.json"
          }
        }],
        exclude: [/node_modules/]
      }
    ]
  },
  plugins: [
    new CleanWebpackPlugin(),
  ]
};

module.exports = config;
