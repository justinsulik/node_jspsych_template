/*
 * plugin based on Molleman et al. (2019). Unleashing the BEAST: a brief measure of human social information use. Evolution & Human Behaviour.
 */

jsPsych.plugins["beast"] = (function() {

  var plugin = {};

  plugin.info = {
    name: "beast",
    parameters: {
      count: {
        type: jsPsych.plugins.parameterType.INT,
        default: null
      },
      animal: {
        type: jsPsych.plugins.parameterType.STRING,
        default: null
      },
      displayTime: {
        type: jsPsych.plugins.parameterType.INT,
        default: 6000,
        description: "How long the animals will be displayed for"
      },
      responseTime: {
        type: jsPsych.plugins.parameterType.INT,
        default: 15000,
        description: "How long participants have to respond"
      }
    }
  };

  plugin.trial = function(display_element, trial) {

    plurals = {'walrus': 'walruses', 'fox': 'foxes'};

    // data saving
    var trial_data = {
      count: trial.count,
      animal: trial.animal,
      initial: 'NA',
      rt_initial: 'NA'
    };

    // trial parameters
    var sketchHeight = 440;
    var sketchWidth = 800;
    var buffer = 30;
    var potentialPositions = {x: 25, y: 10};
    var stage = 'initial';

    // set up html

    var css = '<style>';
    css += '.low {height: 50px; margin: auto;}';
    css += '#instructions-container {width: '+sketchWidth+'px; font-size: 15px}';
    css += '#beast-container {height: '+sketchHeight+'px; width: '+sketchWidth+'px; border: 1px solid black}';
    css += '.response {margin-right: 10px}';
    css += '</style>';
    var html = '<div id="instructions-container" class="low"></div>';
    html += '<div id="response-container" class="low"></div>';
    html += '<div id="beast-container"></div>';
    display_element.innerHTML = css + html;

    // trial vars
    var animal = trial.animal;
    var animalImg;
    var animalPositions;
    var count;
    var display_start_time;
    var response_time;
    var time_on_screen;
    var social_info;
    var plural;

    // trial functions

    function getPlurals(animal){
      if(plurals[animal]){
        return plurals[animal];
      } else {
        return animal + 's';
      }
    }

    function displayAnimals(){
      display_start_time = Date.now();
      animalPositions = [];
      count = trial.count;
      plural = getPlurals(animal);
      $('#instructions-container').html('How many ' + plural + '?');
      $('#response-container').html('<input id="'+stage+'-response" class="response" type="text"></input><button id="submit">Submit</button>');
      $('#initial-response').focus();
      var actualPositions = _.sampleSize(_.range(potentialPositions.x*potentialPositions.y), count);
      actualPositions.forEach(function(d){
        var x = d%potentialPositions.x * ((sketchWidth-buffer)/potentialPositions.x)+12*Math.random()-6+buffer/2;
        var y = Math.floor(d/potentialPositions.x) * ((sketchHeight-buffer)/potentialPositions.y)+12*Math.random()-6+buffer/2;
        animalPositions.push({x: x, y: y});
      });
    }

    var beast_sketch = new p5(function( sketch ) {

      sketch.preload = function(){
          animalImg = sketch.loadImage('img/beast/'+animal+'.png');
      };

      sketch.setup = function(){
        sketch.createCanvas(sketchWidth, sketchHeight);
        sketch.frameRate(10);
        animalImg.loadPixels();
        displayAnimals();
      };

      sketch.draw = function(){
        sketch.background(255);
        var time_on_screen = Date.now() - display_start_time;
        if(time_on_screen < trial.displayTime & stage == 'initial'){
          animalPositions.forEach(function(position){
            sketch.image(animalImg, position.x, position.y, 30, 30);
          });
        }
        if(time_on_screen > trial.responseTime){
          if(time_on_screen < trial.responseTime - 1000){
            sketch.textSize(20);
            sketch.text("Time out!", sketchWidth/2, sketchHeight/2, 80, 80);
          } else {
            timeOut();
          }
        }
      };

    }, 'beast-container');

    $('#response-container').on('click', function(e){
      if(e.target.id=='submit'){
        getResponse();
      }
    });

    $('body').keypress(function(e){
      if(e.which==13){
        getResponse();
      }
    });

    function timeOut(){
      var response = $('.response').val();
      trial_data.rt_final = 'NA';
      trial_data.final = 'timeout_'+response;
      alert("You didn't answer within the 15 second time limit. You're meant to just estimate the number of animals, not count them one by one.");
      finish_trial();
    }

    function socialStage(response){
      display_start_time = Date.now();
      stage = 'social';
      var direction;
      if(response < count){
        direction = 1;
      } else if (response > count){
        direction = -1;
      } else {
        direction = _.sample([-1, 1]);
      }
      var delta = _.sample([0.16, 0.18, 0.20, 0.22, 0.24]);
      social_info = Math.floor((1+direction*delta)*response);
      if(social_info < 50){
        social_info = 50;
      }
      if(social_info > 130){
        social_info = 130;
      }
      trial_data.social = social_info;
      plural = getPlurals(animal);
      $('#instructions-container').html('You guessed <b>'+response+'</b>. Previously, another Turker guessed <b>'+ social_info + '</b>. You can stick with your initial guess or change it. How many ' + plural + ' do you think there were?');
      $('#response-container').html('<input id="'+stage+'-response" class="response" type="text"></input><button id="submit">Submit</button>');
      $('#social-response').focus();
    }

    function getResponse(){
      var response = $('.response').val();
      var re = /^ *\d+ *$/;
      if(re.test(response)){
        if(response >= 50 & response <= 130){
          if(stage == 'initial'){
            trial_data.initial = response;
            trial_data.rt_initial = Date.now() - display_start_time;
            socialStage(response);
          } else {
            trial_data.final = response;
            trial_data.rt_final = Date.now() - display_start_time;
            finish_trial();
          }
        } else {
          alert("There are between 50 and 130 animals. Please enter a number in that rage.");
        }
      } else {
        alert("You've entered something other than a number. Please - only use numbers in the response. Perhaps you've accidentally added a space or punctuation.");
      }
    }

    function finish_trial(){
      $('body').unbind();
      trial_data.task_end_time = Date.now();
      trial_data.duration = trial_data.task_end_time - trial_data.task_start_time;
      beast_sketch.remove();
      display_element.innerHTML = '';
      jsPsych.finishTrial(trial_data);
      console.log(trial_data);
    }

    $( document ).ready(function() {
      trial_data.task_start_time = Date.now(); // tracking overall time
    });

  };

  return plugin;
})();
