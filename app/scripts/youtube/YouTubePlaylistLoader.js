define('youtube/YouTubePlaylistLoader', function() {
    
  'use strict';
  
  // constructor 
  function YouTubePlaylistLoader( id, callback ) {        
    
    var xmlhttp = new XMLHttpRequest();
      var playlistData;
      xmlhttp.onreadystatechange = function() {
          if (xmlhttp.readyState === 4 && xmlhttp.status === 200) {
              playlistData = JSON.parse(xmlhttp.responseText);
              callback.call( this, playlistData );
          }
      };
      xmlhttp.open('GET', 'https://gdata.youtube.com/feeds/api/playlists/' + id + '?v=2&alt=json', true);
      xmlhttp.send();
  }

  return YouTubePlaylistLoader;

});