var dgram = require('dgram');
var server = dgram.createSocket('udp4');
var parser = require('glossy').Parse;
var uuid = require('node-uuid');
var marklogic = require('marklogic');

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
var db = marklogic.createDatabaseClient(conn);


//create an event listener for when a syslog message is recieved
server.on("message", function (msg, rinfo) {
  //sanitise the data by replacing single quotes with two single-quotes
  var message = msg.toString();
  if(message.match(/MarkLogic/g)) {
    //console.log(parser.parse(msg.toString('utf8', 0)));
    db.documents.write(
      {
        uri: "/" + uuid.v4() + ".json",
        contentType: "application/json",
        collections: ["logs"],
        content: parser.parse(msg.toString('utf8', 0))
      }
    ).
      result(function(response){
        console.dir(JSON.stringify(response))
      });

  }
});

//create an event listener to tell us that the has successfully opened the syslog port and is listening for messages
server.on("listening", function () {
  var address = server.address();
  console.log("server listening " + address.address + ":" + address.port);  

});

server.bind(5140);