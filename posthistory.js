'use strict';
console.log("Loading post history addon");
var url = require('url');
var formOps = require('../engine/formOps');
var db = require('../db');

var posts = db.posts();
var threads = db.threads();

exports.init = function() {
  console.log("Loaded post history addon");
};

var respond = function(value, res){ //DEBUG
    res.setHeader('Content-Type', 'text/html');
	res.end(value, null, 3)
}

var respondJson = function(value, res){ //DEBUG
    res.setHeader('Content-Type', 'application/json');
	res.end(JSON.stringify(value), null, 3)
}

var getIpFromPost = function(postId, board){
	var matchQuery = {
		$match : {
			boardUri : board,
			postId : postId
		}
	}
	var projectQuery = {
		$project : {
			ip : 1
		}
	}
	return posts.aggregate([matchQuery, projectQuery])
	.toArray();
}

var getIpFromThread = function(threadId, board){
	var matchQuery = {
		$match : {
			boardUri : board,
			threadId : threadId
		}
	}
	var projectQuery = {
		$project : {
			ip : 1
		}
	}
	return threads.aggregate([matchQuery, projectQuery])
	.toArray();
}

var getIp = function(id, board){
	return Promise.all([getIpFromPost(id, board), getIpFromThread(id, board)])
	.then(function(values){
		return values[0].concat(values[1])[0].ip;
	});
}

var getByIp = function(ip, board){
	var matchQuery = {
		$match : {
			boardUri : board
			,ip : ip
		}
	}
	
	var addPostField = {
		$addFields: {
			type: "post"
		}
	}
	var addThreadField = {
		$addFields: {
			type: "thread"
		}
	}
	
	var projectQuery = {
		$project : {
			type: 1,
			postId : 1,
			threadId : 1,
			boardUri : 1,
			markdown : 1,
			message:1,
			signedRole: 1,
			subject: 1,
			name: 1,
			creation: 1,
			email:1,
			file:1,
			innerCache:1,
			outerCache:1
		}
	}
	
	var p = posts.aggregate([matchQuery, projectQuery, addPostField])
	.toArray();
	var t = threads.aggregate([matchQuery, projectQuery, addThreadField])
	.toArray();
	return Promise.all([p,t])
	.then(function(values){
		var combined = values[0].concat(values[1]);
		return combined;
	});
}

var SortByDate = function(values){
	values.sort((a,b) => new Date(a.creation) < new Date(b.creation) ? 1 : -1);
	return values;
}

var MakeLink = function(boardname, threadId, postId){
	return `/${boardname}/res/${threadId}.html#${postId}`;
}

var PostIdOrThreadId = function(item){
	if (typeof item.postId !== 'undefined') {
		return item.postId;
	}
	return item.threadId;
}

var InnerOrOuterCache = function(item){
	if (typeof item.innerCache !== 'undefined') {
		return item.innerCache;
	}
	return item.outerCache;
}

var ToPage = function(values){
	var csslinks = `<link
  href="/.static/css/global.css"
  type="text/css"
  rel="stylesheet" />
<link
  href="/.static/css/posting.css"
  type="text/css"
  rel="stylesheet" />
<link
  href="/.static/css/thread.css"
  type="text/css"
  rel="stylesheet" />
<link
  href="/.static/css/threadPage.css"
  type="text/css"
  rel="stylesheet" />
<link
  href="/.static/css/boardContent.css"
  type="text/css"
  rel="stylesheet" />
<link
  href="/.static/css/settingsMenu.css"
  type="text/css"
  rel="stylesheet" />
<link
  href="/.static/css/sideCatalog.css"
  type="text/css"
  rel="stylesheet" />`
	return csslinks + values.map(x => 
	'<div style="border: red;border-width: 10px;border: solid red; display: block;overflow: auto;margin-top: 5px;margin-left: 5px;margin-right: 5px;">' 
	+ `<a href="${MakeLink(x.boardUri, x.threadId, PostIdOrThreadId(x))}">Jump to post</a><br>`
	+ InnerOrOuterCache(x) + "</div>").join("");
}

var getById = function(postid, board, res){
	getIp(postid, board)
	.then((ip) => getByIp(ip, board))
	.then(SortByDate)
	.then(ToPage)
	.then((ok) => respond(ok, res), function(error) {
		throw(error);
	}
	);
}


exports.formRequest = function(req, res){
	formOps.getAuthenticatedPost(
		req, 
		res, 
		false,
		function onAuthorized(auth, userData) {
			var parameters = url.parse(req.url, true).query;
			getById(parseInt(parameters.id), parameters.board, res);
		}, 
		false, 
		false, 
		true
	);
}
