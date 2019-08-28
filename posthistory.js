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

var getById = function(postid, board, res){
	getIp(postid, board)
	.then((ip) => getByIp(ip, board))
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
