function prepareData(experiment_start_time){
  console.log('    Preparing data...');
  var data = {};
  var experiment_end_time = Date.now();
  var duration = experiment_end_time - experiment_start_time;
  var interactionData = jsPsych.data.getInteractionData().json();
  jsPsych.data.get().addToLast({duration: duration,
                                interactionData: interactionData,
                              });
  data.responses = jsPsych.data.get().json();
  data.trial_id = trial_id;
  data.completionCode = completionCode;
  return data;
}

function save(data, dataUrl){
  var save_attempts = 0;
  var save_timeout = 1000;
  console.log('    About to post survey output data...', data);
  dataJSON = JSON.stringify(data);
  $.ajax({
     type: 'POST',
     url: dataUrl,
     data: dataJSON,
     contentType: "application/json",
     timeout: save_timeout,
     success: function(request, status, error){
       finish(completionCodeEnd+'_'+save_attempts);
     },
     error: function(request, status){
       $('#jspsych-content').html("Please wait a few seconds while we save your responses...");
       console.log('    Error posting data...', request, status);
       if(save_attempts < 5){
         save_attempts += 1;
         save_timeout += 500;
         console.log("Trying again, attempt ", save_attempts);
         setTimeout(function () {
            save();
          }, save_timeout);
       } else {
         finish(completionCodeEnd+'_'+save_attempts);
       }
     }
   });
}

function finish(completionCode){
    window.location.href = "/finish?token="+completionCode;
}

function makeCode(len){
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYabcdefghijklmnopqrstuvwxy0123456789";
  for( var i=0; i < len; i++ ){
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

var helper = {
  makeCode: makeCode,
  prepareData: prepareData,
  save: save,
};

if (typeof exports !== 'undefined') {
  if (typeof module !== 'undefined' && module.exports) {
    exports = module.exports = helper;
  }
  exports.helper = helper;
} else {
  window.helper = helper;
}
