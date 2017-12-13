/*
JUPI - Plain and simple jPeople client using the OpenJUB API
Copyright (C) 2016  Leonhard Kuboschek

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
var c;
// var dreamjub_url = 'http://localhost:8000/';
// var dreamjub_client_id = 'uXDaB3j1n8DiOU8WXjwCa2gbKqLveieoIDpjFa1d';

var dreamjub_url = 'https://jacobs.university/';
var dreamjub_client_id = 'XzdJ8kFrqlRGNsSF4ah5GDRDsjTeo2OciR7nf9AZ';

var timeout = null;
var lastLength = 0;

var showInactive = false;

var store = [];

var descriptions = {
	"year" : function(yr) {
		if(yr != 0) {
			return "class of 20" + yr;
		} else {
			return "";
		}
	},
	"majorShort" : "studies ",
	"phone" : "phone: ",
	"room" : function(rm) {
		return (rm.match("^[N|C|M|K|A|B|C|D]{2}-[0-9]{3}$") ? "lives in " : "room: ") + rm
	},
	"country" : "from "
}

function updateResults() {
	console.log("Updating results...");
	
	timeout = null;
	var spinId = setTimeout(blankOut, 500);
	var query = $("#search").val();
	
	try{
		window.history.pushState( {} , window.title, '/?q='+escape(query) );
	} catch(e){}

  if(query.length == 0){return;}
	
	if(!showInactive) {
		query += " active: true";
	}
	
	c.search(query, 7000, 0, function(success, data) {
		clearTimeout(spinId);
		hideSpinner();
		$("#frame").empty();
		
		if(success) {
			store = data.results;
			
			store.map(function(e, idx) {
				$("#frame")
				.append($("<img></img>")
				.attr("src", c.getImageURL(e.username))
				.attr("id", e.username)
				.on("error", function(){
					$(this).attr("src", "/imgs/duck.jpg").off("error");
				})
			);
		});
		
		$("div#frame img").hover(
			function() { // Hover in
				makeHighlight(this.id);
			}
		);
	}
});
}

function getUserData(uid) {
	for (var i = store.length - 1; i >= 0; i--) {
		if(store[i].username == uid)
		return store[i];
	};
}

function makeHighlight(uid) {
	// Kill the others
	$("div.highlight").remove();
	
	var anchor = $(("img#" + uid));
	
	var usr = getUserData(uid);
	
	var highlight = $("<div>")
	.addClass("highlight")
	.attr("data-uid", uid);
	
	switch(usr.college) {
		case "Nordmetall":
		highlight.addClass("c-n");
		break;
		
		case "C3":
		highlight.addClass("c-3");
		break;
		
		case "Mercator":
		highlight.addClass("c-m");
		break;
		
		case "Krupp":
		highlight.addClass("c-k");
		break;
		
		default:
		highlight.addClass("c-none");
	}

	highlight
	.append(
    $("<img>")
  	.attr("src", c.getImageURL(usr.username))
  	.attr("data-uid", uid)
  	.on("error", function(){
  		$(this).attr("src", "/imgs/duck.jpg").off("error");
  	})
  )
	.append(
    $("<img>")
    .attr("src", '/imgs/flags/'+usr.country.replace(' ', '_')+'.png')
    .attr("class", "flag")
    .on("error", function(){
		$(this).attr("src", "/imgs/NoCountry.png").off("error");
	 })
  )
	.append(getHighlightDetails(usr))
	.css(getHighlightPosition(anchor));
	
	highlight.hover(
		function() {},
		function() {
			this.remove();
		}
	);
	
	anchor.before(highlight);
}

function getHighlightDetails(usr) {
	var dtls = $("<div>")
	.addClass("hl-ctn");
	dtls.append($("<a>").attr("href", "mailto:" + usr.email)
	.append($("<h2>").html(usr.firstName + " " + usr.lastName)));
	
	var lst = $("<ul>");
	
	for (var field in usr) {
		if (usr.hasOwnProperty(field) && descriptions.hasOwnProperty(field)) {
			if(usr[field] && usr[field] != "") {
				if(typeof descriptions[field] != "function") {
					lst.append(
						$("<li>").text(descriptions[field] + usr[field])
					);
				} else {
					lst.append(
						$("<li>").text(descriptions[field](usr[field]))
					);
				}
			}
		}
	}
	
	dtls.append(lst);
	
	return dtls;
}

function getHighlightPosition(anchor){
	var offset = anchor.offset();
	
	return {
		'left': offset.left,
		'top': offset.top
	};
}

function blankOut() {
	$("img#spinner").show();
	$("#frame").empty();
}

function hideSpinner() {
	$("img#spinner").hide();
}

$(function(){
	
	$("#search").focus();
	
	var q = $.query.get("q");
	
	if(typeof q == "string" && q != "") {
		$("#search").attr("value", q.replace(/\+/g, " "));
	}
	
	$("#overlay").show();
	
	c = new dreamClient(dreamjub_url, dreamjub_client_id);
	c.authenticate(function(success, message){
		if(success){
			$("#overlay").hide();
			$('#search').focus();
      
      if(q.length >= 0){
			 updateResults();
      }
		} else {
			$("#overlay").text(message);
		}
	});
	
	$("#search").on('input', function(evt) {
		if(timeout != null) {
			clearTimeout(timeout);
			timeout = null;
		}
		
		if($("#search").val().length > 3) {
			if($("#search").val().length != lastLength && timeout) {
				lastLength = $("#search").val().length;
			} else {
				timeout = setTimeout(updateResults, 250);
			}
		}
	});
	
	$("#search").change(updateResults);
});

$("#show_inactive").click(function() {
	showInactive = !showInactive;
	
	if(showInactive) {
		$("#show_inactive").text("Hide inactive");
	} else {
		$("#show_inactive").text("Show inactive");
	}
	
	updateResults();
	return false;
})
