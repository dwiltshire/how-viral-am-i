'use strict';

var currentSectionIndex = 0;
var states = $(document).find('section').map(function(){ return this.id; }).get();

$( 'body' ).keydown(function( event ) {  
  if( event.which === 32 )
  {
  	currentSectionIndex = ( ++currentSectionIndex < states.length ) ? currentSectionIndex : 0;
  	$(this).removeClass().addClass( states[ currentSectionIndex ] );
  }
});

$('#start-button').click(function(event){
	$('body').removeClass().addClass('play');
})

$('#who-button').click(function(event){
	$('body').removeClass().addClass('who');
})