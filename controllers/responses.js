//https://www.terlici.com/2015/04/03/mongodb-node-express.html

const express = require('express'),
    router = express.Router(),
    mongoose = require( 'mongoose'),
    Response = require('./../models/response');

exports.save = function (data) {
  var stage = 'Saving trial data in db...';
  return new Promise((resolve, reject) => {
    console.log(data.trial_id, stage);

    Response.create(data, (err, result) => {
      if (err){
        err.trial_id = data.trial_id;
        reject(err);
      } else {
        console.log(data.trial_id, 'Data saved!');
        resolve(data);
      }
    });
  });
};
