//https://www.terlici.com/2015/04/03/mongodb-node-express.html

const express = require('express'),
    mongoose = require( 'mongoose'),
    Task = require('./../models/task');

exports.save = function (sessionData) {
  console.log('Saving session data...');
  Task.create(sessionData);
};
