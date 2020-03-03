/*
Description: jsPsych plugin for running a decision-making task that tests people's sensitivity to non-independence of information
Preferably load p5.min.js in the main experiment page (otherwise it will be downloaded from cdnjs.cloudflare.com)
Need to load jsStat in main expt page
Todo:
randomise anchors (currently 0-2 male; 3-5 female)
*/

jsPsych.plugins['source-choice-training'] = (function(){

  var plugin = {};

  plugin.info = {
    name: 'source-choice-training',
    parameters: {
      main_instructions: {
        type: jsPsych.plugins.parameterType.STRING,
        pretty_name: 'Main instructions',
        default: null,
        description: 'Instructions for likelihood/acceptability rating.'
      },
      cutoffs: {
        type: jsPsych.plugins.parameterType.OBJECT,
        default: {}
      },
      secondary_instructions: {
        type: jsPsych.plugins.parameterType.STRING,
        pretty_name: 'Secondary instructions',
        default: null,
        description: 'Instructions for confidence rating'
      },
      rating_type: {
        type: jsPsych.plugins.parameterType.STRING,
        pretty_name: 'Rating type',
        default: 'likelihood',
        description: 'Options: "likelihood" or "morality"'
      },
    }
  };

  plugin.trial = function(display_element, trial){

    // set up basic html for trial

    var css = '<style id="jspsych-source-choice-training-css">'+
    '#mainSketchContainer {position: relative;}'+
    '.instructions {position: absolute; left: 220px; width: 360px; text-align: left; font-size: 15px; text-align: center}'+
    '#instructions {margin-top: 30px;}'+
    '#instructions2 {margin-top: 260px;}'+
    '</style>';
    var html = '<div id="mainSketchContainer"><div id="instructions" class="instructions"></div>';
    html += '<div id="instructions2" class="instructions"></div></div>';
    var button = '<br><button id="next">Next</button>';

    display_element.innerHTML = css + html;

    // check if p5 script is loaded
    if (window.p5){
        console.log('p5 already loaded...');
        createSketch();
    } else {
      $.ajax({
          url: "https://cdnjs.cloudflare.com/ajax/libs/p5.js/0.5.16/p5.min.js",
          dataType: "script",
          success: function() {
            console.log("p5 downloaded...");
            createSketch();
          }
      });
    }


    var trial_data = {rts: {}, bad_responses: []};
    var estimate;
    var confidence;
    var displays;
    var trial_state = 'initial';
    var start_time;

    // trial functions

    function endTrial() {
      trial_data.rts.total = Date.now() - start_time;
      mainSketch.remove();
      display_element.innerHTML = ''; // clear everything
      console.log(trial_data)
      jsPsych.finishTrial(trial_data);
    }

    function updateInstructions(){
      if(trial_state=='initial'){
        $('#instructions').html(trial.main_instructions);
      } else if(trial_state=='confidence'){
        $('#instructions').html('');
        $('#instructions2').html(trial.secondary_instructions);
      }
    }

    function saveTime(trial_state, time_now){

    }
/*
 P5.js Pseudo-classes for multiple sketches
*/
  var mainSketch;
  function createSketch(){
    mainSketch = new p5(function( sketch ) {

      // declare sketch variables
      var sketchWidth = 900;
      var sketchHeight = 600;
      var topMargin = 50;
      var moral;
      var vote;
      // sketch functions & pseudo-classes

      function barColor(proportion){
        var red = (1-proportion)*255;
        var green = proportion*255;
        var blue = 0;
        var alpha = 230;
        return {red: red, green: green, blue: blue, alpha: alpha};
      }

      function Rating(type){
        this.type = type;
        this.x = 250;
        if(this.type == 'likelihood'){
          this.y = 200;
          this.labels = ['Very unlikely', 'Very likely'];
        } else if (this.type == 'morality'){
          this.y = 200;
          this.labels = ['Morally bad', 'Morally good'];
        } else {
          this.y = 350;
          this.labels = ['Very unsure', 'Very sure'];
        }
        this.width = 300;
        this.yOffset = 20;
        this.proportion = null;
        this.xval = null;

        this.displayMode = function(){
          if(this.type == 'confidence'){
            if(/confidence/.test(trial_state)){
              return 'show';
            } else {
              return 'hidden';
            }
          }
          if(this.type == 'likelihood' | this.type == 'morality'){
            if(/initial/.test(trial_state)){
              return 'show';
            } else if(/confidence/.test(trial_state)) {
              return 'background';
            } else {
              return 'hidden';
            }
          }
        };

        this.show = function(){
          if(this.displayMode() != 'hidden'){
            sketch.push();
              sketch.translate(this.x, this.y);
              this.scale();
              this.bar();
              this.label();
            sketch.pop();
          }
        };

        this.scale = function(){
          if(!this.foreground() | this.displayMode() == 'background'){
            sketch.stroke(200);
          } else {
            sketch.stroke(0);
          }
          sketch.strokeWeight(2);
          sketch.line(0, this.yOffset, this.width, this.yOffset);
          for(var p = 0; p <= 1; p += 0.1){
            sketch.line(p*this.width, this.yOffset-7, p*this.width, this.yOffset+7);
          }
        };

        this.bar = function(){
          var color;
          var display = this.displayMode();
          if((this.over() & this.foreground()) | display == 'background'){
              if(display == 'background'){
                sketch.fill(200, 200, 200, 200);
              } else {
                this.xval = sketch.mouseX - this.x;
                if(this.xval < 0){
                  this.xval = 0;
                }
                if(this.xval > this.width){
                  this.xval = this.width;
                }
                this.proportion = this.xval/this.width;
                color = barColor(this.proportion);
                sketch.fill(color.red, color.green, color.blue, color.alpha);
              }
              sketch.rect(0, this.yOffset-6, this.xval, 12);
            }
        };

        this.label = function(){
          sketch.push();
            sketch.textSize(10);
            sketch.strokeWeight(0);
            if(this.proportion){
                if(this.over()){
                  var chance = Math.round(this.proportion*100);
                  var chance_string = chance + '%';
                  sketch.text(chance_string, this.width*this.proportion, 10);
                }
            }
            if(!this.foreground() | this.displayMode() == 'background'){
              sketch.fill(200, 200, 200, 200);
            } else {
              sketch.fill(0);
            }
            sketch.text(this.labels[0], 0, 40);
            sketch.textAlign(sketch.RIGHT);
            sketch.text(this.labels[1], this.width, 40);
          sketch.pop();
        };

        this.foreground = function(){
          if(/initial/.test(trial_state)){
            if(this.type == 'likelihood' | this.type == 'morality'){
              return true;
            } else {
              return false;
            }
          }
          if(/confidence/.test(trial_state)){
            if(this.type=='confidence'){
              return true;
            } else {
              return false;
            }
          }
        };

        this.clicked = function(){
          var response_ok = true;
          if(this.over()){
            if(this.checkResponse()){
              if(!trial_data[trial_state]){
                trial_data[trial_state] =  Math.round(this.proportion*100)/100;
              }
              if(!trial_data.rts[trial_state]){
                var click_time = Date.now();
                trial_data.rts[trial_state] = click_time - start_time;
              }
              if(trial_state == 'initial'){
                trial_state = 'confidence';
                updateInstructions();
              } else {
                endTrial();
              }
            } else {
              trial_data.bad_responses.push({
                stage: trial_state,
                response: Math.round(this.proportion*100)/100,
                cutoff: trial.cutoffs[trial_state]
              });
              alert(trial.cutoffs[trial_state].message);
            }
          }
        };

        this.checkResponse = function(){
          // console.log(trial.cutoffs[trial_state])
          if(trial.cutoffs[trial_state]){
            // console.log('here')
            var response_ok = true;
            if(trial.cutoffs[trial_state].lower){
              if(this.proportion < trial.cutoffs[trial_state].lower){
                response_ok = false;
              }
            }
            if(trial.cutoffs[trial_state].upper){
              if(this.proportion > trial.cutoffs[trial_state].upper){
                response_ok = false;
              }
            }
            return response_ok;
          } else {
            return true;
          }
        };

        this.over = function(){
          if(sketch.mouseX >= this.x - 3 &
            sketch.mouseX <= this.x + this.width + 3 &
            sketch.mouseY >= this.y &
            sketch.mouseY <= this.y+2*this.yOffset){
              return true;
          } else {
            return false;
          }
        };
      }


      // preload images
      sketch.preload = function(){
        if(trial.rating_type=='morality'){
          icon = sketch.loadImage('img/icons/moral.png');
        } else if(trial.rating_type == 'likelihood'){
          icon = sketch.loadImage('img/icons/vote.png');
        }
      };

      // set up sketch

      sketch.setup = function() {
        icon.loadPixels();
        sketch.createCanvas(sketchWidth, sketchHeight);
        sketch.frameRate(10);
        estimate = new Rating(trial.rating_type);
        confidence = new Rating('confidence');
        updateInstructions();
      };

      // draw sketch

      sketch.draw = function() {
        sketch.background(255);
        estimate.show();
        confidence.show();
        sketch.image(icon, 350, 450, 100, 100);
      };

      sketch.mousePressed = function(e){
        estimate.clicked();
        confidence.clicked();
      };

    }, 'mainSketchContainer');


    start_time = Date.now();

  }
};

return plugin;

})();
