/* 
 *  Copyright 2014 MarkLogic
 *  
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  
 *     http://www.apache.org/licenses/LICENSE-2.0
 *  
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
//var util = require('util');
var EventEmitter = require('events').EventEmitter;
var dgram = require('dgram');
var server = dgram.createSocket('udp4');
var parser = require('glossy').Parse;
var uuid = require('node-uuid');
var marklogic = require('marklogic');
var buff = require('buffertools');

/*
  <http://wiki.splunk.com/Community:HowTo_Configure_Mac_OS_X_Syslog_To_Forward_Data>
  
  /etc/syslog.conf
  # Add the following. Tabs, not spaces.
  *.*									@127.0.0.1:5140

  # Restart syslogd
  sudo launchctl unload /System/Library/LaunchDaemons/com.apple.syslogd.plist
  sudo launchctl load /System/Library/LaunchDaemons/com.apple.syslogd.plist
  
  # Write
  syslog -s -l DEBUG "Hello, world."
  
  # Query
  syslog -k Sender MarkLogic
  
  Facility 3: daemon
  RFC3164
  
 */
 
 // TODO: Make port number externally configurable

var conn = {
  host: "localhost",
  port: 8000,
  database: "Logs",
  user: "admin",
  password: "********",
  authType: "DIGEST"
}


function bind(f, that) {
  return function() {
    return f.apply(that);
  }
}

var TimedBuffer = function(delay) {
  this.state = [];
  function handleInterval() {
    //console.log("buffer.length: " + this.state.length);
    if(this.state.length) {
      this.emit('flush', this.state);
      this.state = [];
    }
  }
  var inteval = setInterval(bind(handleInterval, this), delay || 1000);
}
//util.inherits(TimedBuffer, EventEmitter);
TimedBuffer.prototype = new EventEmitter;
TimedBuffer.prototype.push = function(value) {
  this.state.push(value);
  if(this.state.length >= 2000) {
    this.emit('flush', this.state);
    this.state = [];
  }
}


var db = marklogic.createDatabaseClient(conn);
var buffer = new TimedBuffer();

buffer.on('flush', function(messages) {
  console.log("Writing " + messages.length + " messages.");
  db.documents.write(
    messages.map(function(message) {
      return {
        uri: "/" + uuid.v4() + ".json",
        collections: ["logs"],
        content: message
      }
    })
  ).
    result(function(response){
      //console.dir(JSON.stringify(response))
      //console.log(response.documents[0].uri);
    }, function(error) {
      console.error(error);
    });
});

server.on("message", function (msg, rinfo) {
  
  if(buff.indexOf(msg, "MarkLogic[") > 0) {
    //console.log(parser.parse(msg.toString('utf8', 0)));
    var msgObj = parser.parse(msg.toString('utf8', 0));
    //console.log(msgObj);
    
    if(msgObj.message.match(/^MarkLogic\[\d+\]/)) {    
      msgObj.sender = "MarkLogic";
      var msgMatches = msgObj.message.match(/MarkLogic\[(\d+)\]: (.+)\n/);
      msgObj.pID = parseInt(msgMatches[1], 10);
      msgObj.message = msgMatches[2];
      
      buffer.push(msgObj);
      
    } else {
      cosole.log("UNEXPECTED: " + msgObj.message);
    }
  }
});

server.on("listening", function () {
  var address = server.address();
  console.log("server listening " + address.address + ":" + address.port);  

});

server.bind(5140);