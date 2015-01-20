define('youtube/YouTubeDataLoader', function() {
    
  'use strict';
  
  // constructor 
  function YouTubeDataLoader( id, callback ) {        
    
    var xmlhttp = new XMLHttpRequest();
      var videoData;
      xmlhttp.onreadystatechange = function() {
          if (xmlhttp.readyState === 4 && xmlhttp.status === 200) {
              videoData = JSON.parse(xmlhttp.responseText);
              callback.call( this, videoData );
          }
      };
      xmlhttp.open('GET', 'https://gdata.youtube.com/feeds/api/videos/' + id + '?v=2&alt=json', true);
      xmlhttp.send();
  }

  return YouTubeDataLoader;

});