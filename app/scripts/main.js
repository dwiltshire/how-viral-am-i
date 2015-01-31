'use strict';

define('jquery', [], function() { return jQuery; });

define( 'main', [
    'youtube/SimpleYouTubePlayer', 
    'youtube/YouTubeDataLoader', 
    'youtube/YouTubePlaylistLoader', 
    'jquery'], 
  function(SimpleYouTubePlayer, YouTubeDataLoader, YouTubePlaylistLoader, $) {

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

    var playlist = [];
    new YouTubePlaylistLoader( 'PLGCdvgeFY7e86r9Snh71NnDewn12n5Zo6', function(playlistData){
      for( var i=0; i<playlistData.feed.entry.length; i++)
      {        
        playlist.push(playlistData.feed.entry[i].media$group.yt$videoid.$t);
      }
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
      var videoId = playlist.shift();
      new YouTubeDataLoader( videoId, function(data){

        populateAnswers( data.entry.yt$statistics.viewCount );
        enableButtons(true);

        player.playVideo(videoId);
        playlist.push(videoId); // keep looping...
      });
    }

    function enableButtons(enabled){
      var answerButtons = $('.answer');
      if( !enabled )
      {
        answerButtons.off('click');
        answerButtons.off('mouseover');
        answerButtons.off('mouseout');
        answerButtons.removeClass('mouse-enabled');
      } else {
        answerButtons.click( onAnswerSelected );
        answerButtons.mouseover( function(){ $(this).addClass('selected');} ); 
        answerButtons.mouseout( function(){$(this).removeClass('selected');} ); 
        answerButtons.addClass('mouse-enabled');
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