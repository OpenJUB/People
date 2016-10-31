var c;
var timeout = null;
var lastLength = 0;

var showInactive = false;

var store = [];

var descriptions = {
	"year" : function(yr) {
		if(yr != 0) {
			return "class of " + (yr.length == 2 ? "20" + yr : yr);
		} else {
			return "";
		}
	},
	"major" : "studies ",
	"phone" : "phone: ",
	"room" : function(rm) {
		return (rm.match("^[N|C|M|K|A|B|C|D]{2}-[0-9]{3}$") ? "lives in " : "room: ") + rm
	},
	"country" : "from "
}

function loggedIn() {
	if(c.user && c.user != "") {
		$("#overlay").hide('slow');
		$('#search').focus();
	}
}

function updateResults() {
	console.log("Updating results...");

	timeout = null;
	var spinId = setTimeout(blankOut, 500);
	var query = $("#search").val();

	try{
		window.history.pushState( {} , window.title, '/?q='+escape(query) );
	} catch(e){}

	if(!showInactive) {
		query += " active: true";
	}

	c.search(query, [], 7000, 0, function(error, data) {
		clearTimeout(spinId);
		hideSpinner();
		$("#frame").empty();

		if(!error) {
			store = data.data;

			store.map(function(e, idx) {
				$("#frame")
					.append($("<img></img>")
					.attr("src", e.picture)
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


	var img = $("<img>")
				.attr("src", usr.picture)
				.attr("data-uid", uid)
        .on("error", function(){
          $(this).attr("src", "/imgs/duck.jpg").off("error");
        });

	highlight
	.append(img)
	.append($("<img>").attr("src", usr.flag).attr("class", "flag").on("error", function(){
    $(this).attr("src", "/imgs/NoCountry.png").off("error"); 
  }))
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
						.append($("<h2>").html(usr.fullName)));

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

	c = new JUB.Client("https://api.jacobs-cs.club");

	var q = $.query.get("q");

	console.log(q);

	if(typeof q == "string" && q != "") {
		$("#search").attr("value", q.replace(/\+/g, " "));
		updateResults();
	}

	$("a#login").click(function() {
		c.authenticate(loggedIn);
	})

	c.isOnCampus(function(error, data) {
		if(!error) {
			if(!data.on_campus && !c.user) {
				$("#overlay").fadeIn();
			}
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
