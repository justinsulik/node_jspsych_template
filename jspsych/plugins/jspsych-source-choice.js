/*
Description: jsPsych plugin for running a decision-making task that tests people's sensitivity to non-independence of information
Preferably load p5.min.js in the main experiment page (otherwise it will be downloaded from cdnjs.cloudflare.com)
Need to load jsStat in main expt page
Todo:
randomise anchors (currently 0-2 male; 3-5 female)
*/

jsPsych.plugins['source-choice'] = (function(){

  var plugin = {};

  plugin.info = {
    name: 'source-choice',
    parameters: {
      choice_type: {
        type: jsPsych.plugins.parameterType.STRING,
        pretty_name: 'Choice type',
        default: 'intentional',
        description: 'If "random", appears to be random selection; if "intentional", appears to be intentional selection'
      },
      rating_type: {
        type: jsPsych.plugins.parameterType.STRING,
        pretty_name: 'Rating type',
        default: 'likelihood',
        description: 'Options: "likelihood" or "morality"'
      },
      agent_ids: {
        type: jsPsych.plugins.parameterType.OBJECT,
        default: [{gender: 'm', hair: 0}, {gender: 'm', hair: 1}, {gender: 'f', hair: 0}, {gender: 'f', hair: 1}, {gender: 'f', hair: 2}],
        array: true,
        description: 'IDs of agents'
      },
      diversity: {
        type: jsPsych.plugins.parameterType.STRING,
        default: 'high',
        description: 'If "high" then all TVs different; if "med" then one repeated 3 times; if "low" one repeated 4 times'
      },
      channel_ids: {
        type: jsPsych.plugins.parameterType.INT,
        array: true,
        default: [0, 1, 2, 3, 4],
        description: 'Which channel IDs to use (shuffle in main expt script)'
      },
      agreement: {
        type: jsPsych.plugins.parameterType.STRING,
        default: 'disagree',
        description: 'whether the townspeople will agree/disagree with participant'
      },
      instructions: {
        type: jsPsych.plugins.parameterType.COMPLEX,
        default: {scenario: 'blah'},
        description: 'instructions, with each stage of the trial as a key. Stages = scenario, priorEstimate, tvStart, tvsOn, socInfoCheck, posteriorEstimate'
      },
      labels: {
        type: jsPsych.plugins.parameterType.STRING,
        array: true,
        description: 'Optional labels as anchors for the slider'
      }
    }
  };

  plugin.trial = function(display_element, trial){

    // set up basic html for trial

    console.log(trial)

    var css = '<style id="jspsych-source-choice-css">'+
    '#mainSketchContainer {border: 1px solid black; position: relative;}'+
    '.instructions {position: absolute; left: 500px; width: 360px; text-align: left; font-size: 15px}'+
    '#instructions {margin-top: 30px;}'+
    '#instructions2 {margin-top: 260px;}'+
    '.hidden {color: grey;}'+
    '</style>';
    var html = '<div id="mainSketchContainer"><div id="instructions" class="instructions"></div>'+
    '<div id="instructions2" class="instructions"></div></div>';
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

    // an object for tracking the current state of the animation, and what should happen next

    var stateGraph = {
      'scenario': {
        // describe the problem/topic that is being decided
        instructions: function(){
          return trial.instructions.scenario + button;
        },
        onClick: function(){
          trial_state = 'priorEstimate';
          updateInstructions();
        }
      },
      'priorEstimate': {
        // give prior rating in response to scenario
        instructions: function(){
          return trial.instructions.priorEstimate;
        },
        onClick: function(){
          // check if reponse given: advance or remind
          if(trial_data.prior_estimate){
            social_info = generateInfo();
            trial_data.social_info = social_info;
            console.log(social_info);
            // update agents to reflect social_info
            updateAgentsBeliefs();
            trial_state = 'priorConfidence';
            updateInstructions();
          } else {
            alert(rating_alert);
          }
        }
      },
      'priorConfidence': {
        // give prior confidence
        instructions: function(){
          return 'How confident are you about your decision? Rate your confidence on the scale below (click scale to confirm).';
        },
        onClick: function(){
          // check if reponse given: advance or remind
          if(trial_data.prior_confidence){
            trial_state = 'tvStart';
            updateInstructions();
          }
        }
      },
      'tvStart': {
        // explain how tvs will work
        instructions: function(){
          return trial.instructions.tvStart;
        },
        onClick: function(){
          $('#instructions').html('');
        }
      },
      'tvsOn': {
        // give posterior rating in response to new data
        instructions: function(){
          return trial.instructions.tvsOn + button;
        },
        onClick: function(){
            trial_state = 'socInfoCheck'; // prev: socialInfo
            updateInstructions();
        }
      },
      'socInfoCheck': {
        // give posterior rating in response to new data
        instructions: function(){
          return trial.instructions.socInfoCheck;
        },
        onClick: function(){
          if(trial_data.checks.socInfoCheck){
            trial_state = 'posteriorEstimate';
            updateInstructions();
          }
        }
      },
      'posteriorEstimate': {
        instructions: function(){
          return trial.instructions.posteriorEstimate;
        },
        onClick: function(){
          if(trial_data.posterior_estimate){
            trial_state = 'posteriorConfidence';
            updateInstructions();
          }
        }
      },
      'posteriorConfidence': {
        instructions: function(){
          return "How confident are you about your decision? Rate your confidence on the scale below (click scale to confirm).";
        },
        onClick: function(){
          console.log(trial_data)
          if(trial_data.posterior_confidence){
            endTrial();
          }
        }
      }
    };

    // trial variables

    var trial_data = {checks: {}, attn_check_misses: 0, rt: {}};
    trial_data.choice_type = trial.choice_type;
    trial_data.rating_type = trial.rating_type;
    trial_data.diversity = trial.diversity;
    trial_data.agreement = trial.agreement;
    trial_data.instructions = trial.instructions;
    var trial_state = 'scenario';
    var estimate;
    var confidence;
    var displays;
    var thoughts;
    var agents;
    var social_info;
    var start_time;
    var displayDict = displayId();
    var hide_agents = ['scenario', 'priorEstimate', 'priorConfidence'];
    var hide_tv = ['scenario', 'priorEstimate', 'priorConfidence', 'priorAgents'];
    var show_bar = ['priorEstimate', 'priorConfidence', 'posteriorEstimate', 'posteriorConfidence'];

    var rating_alert;
    var check_alert;
    if(trial.rating_type=='likelihood'){
      rating_alert = 'Click on the bar to rate how likely you think this is.';
      check_alert = 'No, look closely. Someone else thinks there is an even higher chance.';
    } else {
      rating_alert = 'Click on the bar to rate how favorably you view this.';
      check_alert = 'No, look closely. Someone else has an even more favorable view.';
    }

    // trial functions

    function displayId(){
      // depending on the trial condition (diversity = high/med/low) create a dictionary with agent# as key and tv station ID as val
      var displayDict = {};
      var keys = _.range(0,trial.agent_ids.length);
      var keys_shuffled = jsPsych.randomization.shuffle(keys);
      var channelCount = {'low': 2, 'medium': 3, 'high': 5};
      var channels = _.range(0, channelCount[trial.diversity]);
      var duplicate = channels[channelCount[trial.diversity]-1];
      for(i = channelCount[trial.diversity]; i < trial.agent_ids.length; i++){
        channels.push(duplicate);
      }
      var channels_shuffled = jsPsych.randomization.shuffle(channels);
      keys_shuffled.forEach(function(d, i){
        displayDict[d] = channels_shuffled[i];
      });
      return displayDict;
    }

    function endTrial() {
      trial_data.rt.end_time = Date.now() - start_time;
      mainSketch.remove();
      display_element.innerHTML = ''; // clear everything
      jsPsych.finishTrial(trial_data);
    }

    function checkDisplays(){
      var on = 0;
       displays.forEach(function(d,i){
        if(d.stable){
          on+=1;
        }
      });
      if(on==displays.length & trial_state == 'tvStart'){
        trial_state = 'tvsOn';
        updateInstructions();
      }
    }

    function updateInstructions(){
      switch(trial_state){
        case 'priorConfidence':
          $('#instructions2').html(stateGraph[trial_state].instructions());
          $('#instructions').addClass('hidden');
          break;
        case 'tvStart':
          $('#instructions2').html('');
          $('#instructions').removeClass('hidden');
          $('#instructions').html(stateGraph[trial_state].instructions());
          break;
        case 'socInfoCheck':
          $('#instructions').html('');
          window.setTimeout(function(){$('#instructions').html(stateGraph[trial_state].instructions());}, 1000 );

          break;
        case 'posteriorConfidence':
          $('#instructions2').html(stateGraph[trial_state].instructions());
          $('#instructions').addClass('hidden');
          break;
        default:
          console.log('here', trial_state)
          $('#instructions').html(stateGraph[trial_state].instructions());
      }
    }

    function classifyPrior(prior){
      var bin;
      if(prior <= 0.25){
        bin = 'lowest';
      } else if (prior < 0.5){
        bin = 'lower';
      } else if (prior < 0.75) {
        bin = 'higher';
      } else {
        bin = 'highest';
      }
      return bin;
    }

    // set up the social data

    function pickRange(){
      // generate the range that social info will be drawn from
      var range;
      var prior_binned = classifyPrior(trial_data.prior_estimate);
      switch(prior_binned){
        case 'lowest':
          if(trial.agreement=='agree'){
            range = [0, 0.35];
          } else {
            range = [0.45, 0.8];
          }
          break;
        case 'lower':
          if(trial.agreement=='agree'){
            range = [0.2, 0.55];
          } else {
            range = [0.65, 1];
          }
          break;
        case 'higher':
          if(trial.agreement=='agree'){
            range = [0.45, 0.8];
          } else {
            range = [0, 0.35];
          }
          break;
        case 'highest':
          if(trial.agreement=='agree'){
            range = [0.65, 1];
          } else {
            range = [0.2, 0.55];
          }
          break;
      }
      return range;
    }

    function splitLeaders(array){
      // avoid too close of an overlap between 1st and 2nd highest vals, which are asked about as an attention check
      var max = _.max(array);
      var second = _.reduce(array, function(acc, val){
        if(val > acc[0] & val < acc[1]){
          acc[0] = val;
        }
        return acc;
      }, [0, max]);
      second = second[0];
      var downward = 0;
      var upward = 0;
      if(max - second < 0.06){
        var diff = 0.06 - (max - second);
        upward = Math.min(1-max,diff/2);
        downward = diff - upward;
      }
      // incorporate above, and avoid any outright zeros (otherwise there will be no bar to display)
      var array_edited = _.map(array, function(d){
        if(d<0.04){
          return 0.04;
        } else if(d==second){
          return d - downward;
        } else if(d==max){
          return d + upward;
        } else {
          return d;
        }
      });
      return array_edited;
    }

    function randomUniform(range, n=5) {
      var min = range[0];
      var max = range[1];
      var random = [];
      for(var i = 0; i < n; i++){
        random.push(Math.random() * (max - min) + min);
      }
      return random;
    }

    function generateInfo(){
      var range = pickRange();
      var random_array = randomUniform(range);
      var final_array = splitLeaders(random_array);
      return final_array;
    }

    function updateAgentsBeliefs(){
      thoughts.forEach(function(d,i){
        d.belief = social_info[i];
        d.barWidth = d.distance*(d.belief);
        d.red = (1-d.belief)*255;
        d.green = d.belief*255;
      });
    }

/*
 P5.js Pseudo-classes for multiple sketches
*/
  var mainSketch;
  function createSketch(){
    mainSketch = new p5(function( sketch ) {

      // set global vars
      displays = [];
      thoughts = [];
      agents = [];

      // declare sketch variables
      var thought;
      var icon;
      var tvs = [];
      var backgrounds = [];
      var jaws = [];
      var remotesImg = [];
      var remotes = [];


      var agentCount = trial.agent_ids.length;
      var agentParts = {m: {hair: {}}, f: {hair: {}}};
      var sketchWidth = 900;
      var sketchHeight = 600;
      var agentSize = 100;
      var thoughtSize = 100;
      var topMargin = 40;
      var passes = 4;
      var displaySize = {x: 141, y: 88};
      var displayOffset = {x: 10, y: 31};
      var tvSize = {x: 160, y: 160};
      var bodyColors = [{r: 255, g: 30, b: 30}, {r: 51, g: 158, b: 51}, {r: 227, g: 80, b: 234},
          {r: 247, g: 147, b: 35}, {r: 9, g: 202, b: 237}];
      var hairColors = [{r: 236, g: 236, b: 25}, {r: 160, g: 68, b: 11}, {r: 167, g: 113, b: 13},
          {r: 93, g: 51, b: 4}, {r: 39, g: 26, b: 11}];
      var headColors = [{r: 117, g: 60, b: 16}, {r: 220, g: 182, b: 83}, {r: 250, g: 235, b: 173},
          {r: 209, g: 160, b: 69}, {r: 124, g: 93, b: 35}];
      var legColors = [{r: 43, g: 107, b: 171}, {r: 114, g: 181, b: 249}, {r: 41, g: 83, b: 125},
          {r: 130, g: 150, b: 169}, {r: 194, g: 188, b: 175}];
      var feetColors = [{r: 0, g: 0, b: 0}, {r: 90, g: 63, b: 2}, {r: 204, g: 4, b: 4},
          {r: 164, g: 153, b: 169}, {r: 116, g: 87, b: 32}];
      bodyColors = _.shuffle(bodyColors);
      hairColors = _.shuffle(hairColors);
      headColors = _.shuffle(headColors);
      legColors = _.shuffle(legColors);
      feetColors = _.shuffle(feetColors);

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
        this.x = 500;
        if(this.type == 'likelihood'){
          this.y = 200;
          this.labels = ['Very unlikely', 'Very likely'];
        } else if (this.type == 'morality'){
          this.y = 200;
          if(trial.labels){
            this.labels = trial.labels;
          } else {
            this.labels = ['Morally bad', 'Morally good'];
          }
        } else {
          this.y = 350;
          this.labels = ['Low confidence', 'High confidence'];
        }
        // override the above defaults if given

        this.width = 300;
        this.yOffset = 20;
        this.proportion = null;
        this.xval = null;

        this.displayMode = function(){
          if(this.type == 'confidence'){
            if(/Confidence/.test(trial_state)){
              return 'show';
            } else {
              return 'hidden';
            }
          }
          if(this.type == 'likelihood' | this.type == 'morality'){
            if(/Estimate/.test(trial_state)){
              return 'show';
            } else if(/Confidence/.test(trial_state)) {
              return 'background';
            } else {
              return 'hidden';
            }
          }
        };

        this.show = function(){
          if(show_bar.indexOf(trial_state) != -1 & this.displayMode() != 'hidden'){
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
          if(/Estimate/.test(trial_state)){
            if(this.type == 'likelihood' | this.type == 'morality'){
              return true;
            } else {
              return false;
            }
          }
          if(/Confidence/.test(trial_state)){
            if(this.type=='confidence'){
              return true;
            } else {
              return false;
            }
          }
        };

        this.clicked = function(){
          if(this.over() & show_bar.indexOf(trial_state) != -1){
            trial_data.rt[trial_state] = Date.now() - start_time;
            switch(trial_state){
              case 'priorEstimate':
                trial_data.prior_estimate = this.proportion;
              break;
              case 'priorConfidence':
                trial_data.prior_confidence = this.proportion;
              break;
              case 'posteriorEstimate':
                trial_data.posterior_estimate = this.proportion;
              break;
              case 'posteriorConfidence':
                trial_data.posterior_confidence = this.proportion;
              break;
            }
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

      function Thought(agentNumber){
        this.x = 70;
        this.y = agentNumber*((sketchHeight-topMargin)/agentCount);
        var start = {x: 10, y: 45};
        var end = {x: 90, y: 45};
        var scaleHeight = 10;
        var barHeight = 19;
        this.distance = end.x - start.x;

        this.show = function() {
          if(['socInfoCheck', 'posteriorEstimate', 'posteriorConfidence'].indexOf(trial_state) != -1){
            sketch.push();
              sketch.translate(this.x, this.y);
              sketch.image(thought, 0, 0, thoughtSize, thoughtSize);
              this.scale();
              this.bar();
            sketch.pop();
          }
        };

        this.scale = function() {
          sketch.line(start.x, start.y, end.x, end.y);
          for(var p = 0; p <= 1; p += 0.1){
            sketch.line(start.x + p*this.distance, start.y - scaleHeight, start.x + p*this.distance, start.y + scaleHeight);
          }
        };

        this.bar = function(){
              sketch.fill(this.red, this.green, 0, 220);
              sketch.rect(start.x, start.y-barHeight/2, this.barWidth, barHeight);
        };
      }

      function Agent(gender, hairNo, agentNumber){
        this.agentNumber = agentNumber;
        this.y = agentNumber*((sketchHeight-topMargin)/agentCount) + topMargin;
        this.x = 150;

        this.body = agentParts[gender].body;
        this.head = agentParts[gender].head;
        this.hair = agentParts[gender].hair[hairNo];
        this.legs = agentParts[gender].legs;
        this.feet = agentParts[gender].feet;

        this.body.loadPixels();
        this.head.loadPixels();
        this.hair.loadPixels();
        this.legs.loadPixels();
        this.feet.loadPixels();

        this.show = function(){
          if(hide_agents.indexOf(trial_state) == -1){
            sketch.push();
              sketch.translate(this.x, this.y);
              sketch.push();
                sketch.tint(bodyColors[this.agentNumber].r, bodyColors[this.agentNumber].g, bodyColors[this.agentNumber].b);
                sketch.image(this.body, 0, 0, agentSize, agentSize);
              sketch.pop();
              sketch.push();
                sketch.tint(headColors[this.agentNumber].r, headColors[this.agentNumber].g, headColors[this.agentNumber].b);
                sketch.image(this.head, 0, 0, agentSize, agentSize);
              sketch.pop();
              sketch.push();
                sketch.tint(hairColors[this.agentNumber].r, hairColors[this.agentNumber].g, hairColors[this.agentNumber].b);
                sketch.image(this.hair, 0, 0, agentSize, agentSize);
              sketch.pop();
              sketch.push();
                sketch.tint(legColors[this.agentNumber].r, legColors[this.agentNumber].g, legColors[this.agentNumber].b);
                sketch.image(this.legs, 0, 0, agentSize, agentSize);
              sketch.pop();
              sketch.push();
                sketch.tint(feetColors[this.agentNumber].r, feetColors[this.agentNumber].g, feetColors[this.agentNumber].b);
                sketch.image(this.feet, 0, 0, agentSize, agentSize);
              sketch.pop();
            sketch.pop();
          }
        };

        this.clicked = function(){
          if(trial_state == 'socInfoCheck' & this.over()){
            var supporter = _.reduce(thoughts, function(agg,thought,agentNumber){
              var belief = thought.belief;
              if(belief>agg.max){
                agg.max = belief;
                agg.agentNumber = agentNumber;
              }
              return agg;
            }, {max: 0, agentNumber: null});
            if(this.agentNumber == supporter.agentNumber){
              trial_data.checks[trial_state] = true;
            } else {
              trial_data.attn_check_misses += 1
              alert(check_alert);

            }
          }
        };

        this.over = function(){
          if(sketch.mouseX >= this.x &
             sketch.mouseX <= this.x + agentSize &
             sketch.mouseY >= this.y &
             sketch.mouseY <= this.y + agentSize){
               return true;
             } else {
               return false;
             }
        };
      }

      function Display(agentNumber, channel){
        this.agentNumber = agentNumber;
        this.passes = passes;
        this.tv = tvs[agentNumber];
        this.channel = channel;
        this.on = false;
        this.stable = false;
        this.y = agentNumber*((sketchHeight-topMargin)/agentCount) + topMargin;
        this.x = 290;
        this.jawOffset = 0;

        // for random channels, set up a random sequence of displays
        if(trial.choice_type == 'random'){
          var displaySequence = [];
          for(var i = 0; i<passes; i++){
            trial.channel_ids.forEach(function(d,i){
              displaySequence.push(i);
            });
          }
          this.displaySequence = _.shuffle(displaySequence);
          this.displayIndex = this.displaySequence.length;
          this.channelIndex = this.displaySequence[this.displayIndex];
        }

        this.blankScreen = function(){
          sketch.push();
            sketch.translate(displayOffset.x, displayOffset.y);
            sketch.rect(0, 0, displaySize.x, displaySize.y);
          sketch.pop();
        };

        this.jawMove = function(){
          if(this.jawOffset == 0){
            this.jawOffset = 1;
          } else {
            this.jawOffset = 0;
          }
        };

        this.spinChannels = function(){
          if(this.displayIndex <= 0){
            this.channelIndex = this.channel;
            this.stable = true;
            if(trial_state == 'tvStart' | trial_state == 'tvsOn'){
              this.jawMove();
            }
            if(trial_state=='tvStart'){
              checkDisplays();
            }
          } else {
            this.displayIndex -= 1;
            this.channelIndex = this.displaySequence[this.displayIndex];
          }
          sketch.image(backgrounds[this.channelIndex], 0, 0, tvSize.x, tvSize.y);
          // sketch.image(anchors[this.channelIndex], 0, 0, tvSize.x, tvSize.y);
          sketch.image(jaws[this.channelIndex], 0, this.jawOffset, tvSize.x, tvSize.y);
        };

        this.showLogo = function(){
          sketch.image(backgrounds[this.channel], 0, 0, tvSize.x, tvSize.y);
          // sketch.image(anchors[this.channel], 0, 0, tvSize.x, tvSize.y);
          sketch.image(jaws[this.channel], 0, this.jawOffset, tvSize.x, tvSize.y);
          this.stable = true;
          if(trial_state == 'tvStart' | trial_state == 'tvsOn'){
            this.jawMove();
          }
          if(trial_state=='tvStart'){
            checkDisplays();
          }
        };

        this.displayTv = function(){
          if(hide_tv.indexOf(trial_state) == -1){
            sketch.push();
              sketch.translate(this.x, this.y);
              sketch.scale(0.8);

              sketch.image(this.tv, 0, 0, tvSize.x, tvSize.y);
              sketch.push();
                if(this.on){
                  sketch.fill(255);
                } else {
                  sketch.fill(40);
                }
                // blank screen
                this.blankScreen();
                if(this.on){
                  if(trial.choice_type=='random'){
                    this.spinChannels();
                  } else {
                    this.showLogo();
                  }
                }
              sketch.pop();
            sketch.pop();
          }
        };

        this.clicked = function(e){
          if(trial_state == 'tvStart' & trial.choice_type=='random'){
            if(sketch.mouseX >= this.x &
               sketch.mouseX <= this.x + displaySize.x &
               sketch.mouseY >= this.y &
               sketch.mouseY <= this.y + displaySize.y){
               this.on = true;
            }
          }
        };
      }

      function Remote(agentNumber){
        this.index = agentNumber;
        this.y = agentNumber*((sketchHeight-topMargin)/agentCount) + agentSize + 12;
        this.x = 150 + 0.85*agentSize;
        this.on = false;

        this.show = function(){
          if(hide_tv.indexOf(trial_state) == -1){
            sketch.push();
              sketch.translate(this.x, this.y);
              if(this.on){
                sketch.rotate(0.85);
                this.on = false;
              } else {
                sketch.rotate(0.6);
              }
              sketch.imageMode(sketch.CENTER);
              sketch.image(remotesImg[this.index], 0, 0, 10, 30);
            sketch.pop();
          }
        };

        this.clicked = function(){
          if(trial_state == 'tvStart' & trial.choice_type=='intentional'){
            if(sketch.mouseX >= this.x - 35 &
               sketch.mouseX <= this.x + 35 &
               sketch.mouseY >= this.y - 35 &
               sketch.mouseY <= this.y + 35){
                 this.on = true;
                 displays[this.index].on = true;
               }
          }
        };
      }

      // preload images

      sketch.preload = function() {

        if(trial.rating_type=='morality'){
          icon = sketch.loadImage('img/icons/moral.png');
        } else if(trial.rating_type == 'likelihood'){
          icon = sketch.loadImage('img/icons/vote.png');
        }

        thought = sketch.loadImage('img/icons/thought.png');

        agentParts.f.body = sketch.loadImage('img/agents/f_body.png');
        agentParts.f.head = sketch.loadImage('img/agents/f_head.png');
        agentParts.f.feet = sketch.loadImage('img/agents/feet.png');
        agentParts.f.legs = sketch.loadImage('img/agents/f_legs.png');

        agentParts.m.body = sketch.loadImage('img/agents/m_body.png');
        agentParts.m.head = sketch.loadImage('img/agents/m_head.png');
        agentParts.m.feet = sketch.loadImage('img/agents/feet.png');
        agentParts.m.legs = sketch.loadImage('img/agents/m_legs.png');

        trial.agent_ids.forEach(function(d,i){
          var gender = d.gender;
          var hair = d.hair;
          var imgPath = 'img/agents/'+gender+'_hair_'+hair+'.png';
          agentParts[gender].hair[hair] = sketch.loadImage(imgPath);
          agents[i] = new Agent(gender, hair, i);
        });

        for(var j = 0; j<agentCount; j++){
          tvs[j] = sketch.loadImage('img/tv/tv_'+j+'.png');
          if(trial.choice_type=='intentional'){
            remotesImg[j] = sketch.loadImage('img/remotes/'+j+'.png');
          }
        }
        trial.channel_ids.forEach(function(d,i){
          backgrounds[i] = sketch.loadImage('img/tv/channel_'+d+'.png');
          jaws[i] = sketch.loadImage('img/tv/channel_'+d+'_jaw.png');
        });
      };

      // set up sketch

      sketch.setup = function() {

        thought.loadPixels();
        backgrounds.forEach(function(d,i){
          backgrounds[i].loadPixels();
          jaws[i].loadPixels();
        });
        agents.forEach(function(d,i){
          tvs[i].loadPixels();
          var k = displayDict[i];
          displays[i] = new Display(i, k);
          thoughts[i] = new Thought(i, Math.random(), Math.random());
          if(trial.choice_type=='intentional'){
            remotesImg[i].loadPixels();
            remotes[i] = new Remote(i);
          }
        });
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
        displays.forEach(function(d,i){
          d.displayTv();
        });
        thoughts.forEach(function(d,i){
          d.show();
        });
        agents.forEach(function(d,i){
          d.show();
        });
        if(trial.choice_type=='intentional'){
          remotes.forEach(function(d,i){
            d.show();
          });
        }
        sketch.image(icon, 600, 450, 100, 100);
      };

      sketch.mousePressed = function(e){
        displays.forEach(function(display,i){
          display.clicked();
        });
        agents.forEach(function(agent,i){
          agent.clicked();
        });
        remotes.forEach(function(remote,i){
          remote.clicked();
        });
        estimate.clicked();
        confidence.clicked();
        if(['scenario', 'tvStart', 'tvsOn'].indexOf(trial_state) == -1){
          stateGraph[trial_state].onClick();
        }
        console.log(trial_state);
      };

    }, 'mainSketchContainer');

    $('body').on('click', function(e){
      if(['scenario', 'tvsOn'].indexOf(trial_state) != -1 & e.target.id=='next'){
        stateGraph[trial_state].onClick();
      }
    });

    start_time = Date.now();

  }
};

return plugin;

})();
