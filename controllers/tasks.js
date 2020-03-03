//https://www.terlici.com/2015/04/03/mongodb-node-express.html

const express = require('express'),
    router = express.Router(),
    mongoose = require( 'mongoose'),
    Task = require('./../models/task');

exports.save = function (sessionData) {
  console.log('saving session data...');
  Task.create(sessionData);
};
