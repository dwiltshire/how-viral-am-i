define('youtube/YouTubePlaylistLoader', function() {
    
  'use strict';
  
  var _playlist = [], _self;

  // constructor 
  function YouTubePlaylistLoader( id, callback ) {        
    _self = this;
    var xmlhttp = new XMLHttpRequest();
      xmlhttp.onreadystatechange = function() {
          if (xmlhttp.readyState === 4 && xmlhttp.status === 200) {
              parsePlaylist( JSON.parse(xmlhttp.responseText) );
              callback.call( this, _self );
          }
      };
      xmlhttp.open('GET', 'https://gdata.youtube.com/feeds/api/playlists/' + id + '?v=2&alt=json', true);
      xmlhttp.send();
  }

  function parsePlaylist( playlistData ){
    for( var i=0; i<playlistData.feed.entry.length; i++)
    {        
      _playlist.push(playlistData.feed.entry[i].media$group.yt$videoid.$t);
    }
  }

  function shuffle(array) {
    var counter = array.length, temp, index;
    while (counter > 0) {
        index = Math.floor(Math.random() * counter);
        counter--;
        temp = array[counter];
        array[counter] = array[index];
        array[index] = temp;
    }
    return array;
  }

  YouTubePlaylistLoader.prototype.getPlaylist = function(){
    return _playlist.concat();
  };

  YouTubePlaylistLoader.prototype.getShuffledPlaylist = function(){
    return shuffle(_playlist).concat();
  };

  return YouTubePlaylistLoader;

});