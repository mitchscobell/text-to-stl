const webpack = require("webpack");
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

let config = (module.exports = {
  context: path.resolve(__dirname),

  mode: "production",
  //mode: "development",

  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.(png|jpg|jpeg)$/,
        use: "url-loader",
      },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      chunks: ["index"],
      filename: "index.html",
      inject: "body",
      title: "Text to STL",
      favicon: "./src/images/favicon.png",
    }),
  ],

  target: "web",

  resolve: {
    extensions: [".web.tsx", ".tsx", ".web.ts", ".ts", ".web.js", ".js"],
  },

  output: {
    path: path.resolve("./dist"),
    filename: "[name].js",
    pathinfo: true,
  },

  entry: {
    index: "./src/web.tsx",
  },
  
  performance: {
    hints: false
  },
});
