(function () {/**
 * @license almond 0.3.1 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                //Lop off the last part of baseParts, so that . matches the
                //"directory" and not name of the baseName's module. For instance,
                //baseName of "one/two/three", maps to "one/two/three.js", but we
                //want the directory, "one/two" for this normalization.
                name = baseParts.slice(0, baseParts.length - 1).concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            var args = aps.call(arguments, 0);

            //If first arg is not require('string'), and there is only
            //one arg, it is the array form without a callback. Insert
            //a null so that the following concat is correct.
            if (typeof args[0] !== 'string' && args.length === 1) {
                args.push(null);
            }
            return req.apply(undef, args.concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {
        if (typeof name !== 'string') {
            throw new Error('See almond README: incorrect module build, no module name');
        }

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("../../bower_components/almond/almond", function(){});

define('youtube/SimpleYouTubePlayer', ['require','jquery'],function(require) {
    
  'use strict';

  var $ = require('jquery'); 

  var youTubeSettings = {
    controls:0, // disable controls
    disablekb:1, // disable keyboard
    modestbranding:1, // use 'modest' branding
    playsinline:1, // no full screen on iOS
    rel:0, // don't show related videos
    showinfo:0, // do not display title and uploader before playback
    origin: window.location.host
  };
  
  // constructor 
  function SimpleYouTubePlayer( targetElementId, width, height ) {        
    
    this._targetElementId = targetElementId;
    this._width = width;
    this._height = height;
    this._yt = null; // YouTubeLib Loaded Aynschrnously

    this.element = $(targetElementId);
    this.self = this;

    this.initYouTube();
  }

  // static constants
  SimpleYouTubePlayer.READY    = 'ready';
  SimpleYouTubePlayer.PLAYING  = 'playing';
  SimpleYouTubePlayer.ENDED    = 'ended';

  // public methods
  SimpleYouTubePlayer.prototype.playVideo = function(videoId) {
    this._player.loadVideoById( videoId );
  };

  SimpleYouTubePlayer.prototype.pause = function() {
    this._player.pauseVideo();
  };

  // private methods
  SimpleYouTubePlayer.prototype.initYouTube = function (){

    var tag = document.createElement('script');
    tag.src = '//www.youtube.com/iframe_api';
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);  

    window.onYouTubeIframeAPIReady = $.proxy( this.onYouTubeIframeAPIReady, this);

  };

  SimpleYouTubePlayer.prototype.onYouTubeIframeAPIReady = function () {
    this._yt = window.YT;
    this._player = new this._yt.Player( 
      this._targetElementId, {
        width: this._width,
        height: this._height,
        playerVars: youTubeSettings,
        events: {
          'onReady': $.proxy( this.onPlayerReady, this),
          'onStateChange': $.proxy( this.onPlayerStateChange, this)
        }
    });
  };

  SimpleYouTubePlayer.prototype.onPlayerReady = function () {
    $(this).trigger( SimpleYouTubePlayer.READY );
  };

  SimpleYouTubePlayer.prototype.onPlayerStateChange = function (event) {
    switch( event.data )
    {
      case window.YT.PlayerState.ENDED:
        $(this).trigger( SimpleYouTubePlayer.ENDED );
        break;
      case window.YT.PlayerState.BUFFERING:
      case window.YT.PlayerState.CUED:
      case window.YT.PlayerState.PAUSED:
      case window.YT.PlayerState.PLAYING:
        $(this).trigger( SimpleYouTubePlayer.PLAYING );
        break;
      case window.YT.PlayerState.UNSTARTED:
        break;
    }
  };

  return SimpleYouTubePlayer;

});
define( 'utils/ArrayUtils', [],function() {

  'use strict';

  function ArrayUtils(){
  }

  ArrayUtils.shuffle = function(array) {
    var currentIndex = array.length, temporaryValue, randomIndex ;
    while (0 !== currentIndex) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
    return array;
  };

  return ArrayUtils;

});

'use strict';

define('jquery', [], function() { return jQuery; });

define( 'main', [
    'youtube/SimpleYouTubePlayer',
    'utils/ArrayUtils',
    'jquery'],

  function(SimpleYouTubePlayer, ArrayUtils, $) {

    var rightScore = 0;
    var wrongScore = 0;

    var correctAnswerNumber;
    var nextViralTimer;

    var player;

    // Navigation
  	$('#start-button').click(function(){
  		$('body').removeClass().addClass('play');
  	});

  	$('#who-button').click(function(){
  		$('body').removeClass().addClass('who');
  	});

  	$('#return-button').click(function(){
  		$('body').removeClass().addClass('play');
  	});

    // Sharing
    function shareFacebook(){
      window.FB.ui({
        method: 'feed',
        link: window.location.href,
        caption: generateShareMessage(rightScore, rightScore+wrongScore),
      }, function(){});
    }

    function shareTwitter(){
      var twitterShareUrl = [
          'https://twitter.com/intent/tweet?text=',
          generateShareMessage(rightScore, rightScore+wrongScore),
          '&url=',
          window.location.href
      ].join('');
      window.open( twitterShareUrl, '_blank' );      
    }

    $('#share-generic-button').click(shareFacebook);
    $('#share-facebook-button').click(shareFacebook);
    $('#share-twitter-button').click(shareTwitter);

    // Gameplay    
    player = new SimpleYouTubePlayer( 'player', 549, 333 );
    $(player).bind( SimpleYouTubePlayer.READY, function(){ 
      initAudio();
    });

    $('#next-button').click( function(){
      enableButtons(false);
      loadNext();
    }); 

    $(player).on( SimpleYouTubePlayer.ENDED, function(){ //loadNext(); 
    });

    var playlist;
    $.ajax({
      url: 'data/playlist.json',
      dataType: 'json'
    }).done(function( result ){
      playlist = ArrayUtils.shuffle( result );
    });

    var correctAudio;
    var incorrectAudio;

    function initAudio(){
      correctAudio = document.createElement('audio');
      correctAudio.setAttribute('src', 'audio/correct.mp3');

      incorrectAudio = document.createElement('audio');
      incorrectAudio.setAttribute('src', 'audio/incorrect.mp3');
    }

    function loadNext(){
      clearTimeout(nextViralTimer);

      var videoData = playlist.shift();

      populateAnswers( videoData.views );
      enableButtons(true);

      player.playVideo( videoData.id );
      playlist.push( videoData ); // keep looping...
    }

    function enableButtons(enabled){
      var answerButtons = $('.answer');
      if( !enabled )
      {
        answerButtons.off('click')
          .off('mouseover')
          .off('mouseout')
          .removeClass('mouse-enabled');
      } else {
        answerButtons.click( onAnswerSelected )
          .mouseover( function(){ $(this).addClass('selected');} )
          .mouseout( function(){$(this).removeClass('selected');} )
          .addClass('mouse-enabled');
      }
    }

    function onAnswerSelected(event){

      var isCorrect = ($('.answer').index(event.currentTarget)+1) === correctAnswerNumber;
      if( isCorrect )
      {
        rightScore++;
        correctAudio.play();
        $('#right .counter').text(rightScore);
      } else {
        wrongScore++;
        incorrectAudio.play();
        $('#wrong .counter').text(wrongScore);
      }

      enableButtons(false);
      markCorrectAnswer();
      $(event.target).addClass('selected');

      nextViralTimer = setTimeout( loadNext, 1500 );
    }

    function clearAnswers(){
      $('.answer').removeClass('selected').removeClass('correct');
    }

    function markCorrectAnswer(){
      clearAnswers();  
      $('#option'+correctAnswerNumber).addClass('correct');
    }

    function populateAnswers( score ){
      correctAnswerNumber = Math.ceil( Math.random()*4 );
      console.log( 'Correct answer:' + correctAnswerNumber );
      clearAnswers();

      var max = score*correctAnswerNumber;
      for( var i=1; i<=4; i++ )
      {
        $('#option'+i+'>.number').text( commaSeparateNumber( Math.round(max/i) ) );
        // $('#option'+i).css( 'background-color', (i===correctAnswerNumber)?'green':' )
      }
    }

    // utils

    function commaSeparateNumber(val){
      while (/(\d+)(\d{3})/.test(val.toString())){
        val = val.toString().replace(/(\d+)(\d{3})/, '$1'+','+'$2');
      }
      return val;
    }

    function generateShareMessage(numCorrect, total)
    {
      return 'I got ' + numCorrect + '/' + total + ' in \'How Viral Am I\'! Can you beat that?';
    }

    return this;
  }
);

// Test Navigation

/*var currentSectionIndex = 0;
var states = $(document).find('section').map(function(){ return this.id; }).get();

$( 'body' ).keydown(function( event ) {  
  if( event.which === 32 )
  {
  	currentSectionIndex = ( ++currentSectionIndex < states.length ) ? currentSectionIndex : 0;
  	$(this).removeClass().addClass( states[ currentSectionIndex ] );
  }
});*/

// set runtime paths (needed for dev only, prod files compiled with almond)
require.config({
    baseUrl: 'scripts'
});

// GO!
require(['main']);
}());