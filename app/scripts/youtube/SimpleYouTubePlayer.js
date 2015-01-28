define('youtube/SimpleYouTubePlayer', function(require) {
    
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