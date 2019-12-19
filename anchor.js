'use strict';
console.log("Loading anchor addon");
var editOps = require('../engine/modOps/editOps');
var postOps = require('../engine/postingOps').common;
var miscOps = require('../engine/miscOps');
var staticManipulator = require('../engine/domManipulator/static');
var templatehandler = require('../engine/templateHandler');
var db = require('../db');

exports.init = function() {
	
	
  var threads = db.threads();
  
  var changed_func = function(parameters, thread, callback) {
	  parameters.lock = !!parameters.lock;
	  parameters.pin = !!parameters.pin;
	  parameters.cyclic = !!parameters.cyclic;
	  parameters.autoSage = !!parameters.autoSage; //added this

	  var changePin = parameters.pin !== thread.pinned;
	  var changeLock = parameters.lock !== thread.locked;
	  var changeCyclic = parameters.cyclic !== thread.cyclic;
	  var changeAutoSage = parameters.autoSage !== thread.autoSage; //added this
	  
	  if (!changeLock && !changePin && !changeCyclic && !changeAutoSage/*added this*/) {
		callback();

		return;
	  }
	  
	  threads.updateOne({
		_id : thread._id
	  }, {
		$set : {
		  locked : parameters.lock,
		  pinned : parameters.pin,
		  cyclic : parameters.cyclic,
		  autoSage : parameters.autoSage && !parameters.cyclic //changed this from //thread.autoSage && !parameters.cyclic
		},
		$unset : miscOps.individualCaches
	  }, function updatedThread(error) {

		if (!error) {
		  // signal rebuild of thread
		  process.send({
			board : thread.boardUri,
			thread : thread.threadId
		  });

		  if (changePin) {

			// signal rebuild of board pages
			postOps.setThreadsPage(thread.boardUri, function(errr) {
			  if (error) {
				console.log(error);
			  } else {
				process.send({
				  board : thread.boardUri
				});
			  }
			});

		  } else {
			// signal rebuild of page
			process.send({
			  board : thread.boardUri,
			  page : thread.page
			});
		  }

		}

		callback(error);

	  });
	};

  editOps.setNewThreadSettings = changed_func;
  
  var original_domanipulator = staticManipulator.setModdingInformation;
  
  staticManipulator.setModdingInformation = function(document, threadData){
	  if (threadData.autoSage) {
		 console.log(document)
		document = document.replace('__checkboxAutoSage_checked__', 'true');
	  } else {
		document = document.replace('checked="__checkboxAutoSage_checked__"', '');
	  }
	  return original_domanipulator(document, threadData);
  }
  
  templatehandler.pageTests[10]["prebuiltFields"]["checkboxAutoSage"]= "checked";
  
  
  console.log("Loaded anchor addon");
};


