/*
Copyright 2018 William Viker <william@bitfocus.io>

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.

*/

// Enable debuging
process.env.DEBUG = '*';

var AisParser   = require("aisparser");
var parser      = new AisParser({ checksum : true });
var debug       = require('debug')('aisParser');
var serverdebug = require('debug')('tcpServer');
var net         = require('net');

var clients = [];

function broadcast(message, sender) {
  clients.forEach(function (client) {
    if (client === sender) return;
    client.write(message);
  });
  process.stdout.write(message)
}

net.createServer(function (socket) {
  socket.name = socket.remoteAddress + ":" + socket.remotePort
  clients.push(socket);

	serverdebug(socket.name + " connected");

  socket.on('data', function (data) {
    serverdebug(socket.name + "> " + data);
  });

  socket.on('end', function () {
    clients.splice(clients.indexOf(socket), 1);
    serverdebug(socket.name + " disconnected\n");
  });

}).listen(5000);

var valid_packet = function(payload) {
	var output_format = payload.mmsi + ":" + payload.latitude + "," + payload.longitude;
	console.log(output_format);
	broadcast(output_format+"\n")
};

var parse = function(sentence) {

  var result = parser.parse(sentence);

	var info = {};
	var match = 0;

  if (result.valid == 'VALID') {

    try {
      var suppValues = result.supportedValues;
      for(field in suppValues) {
				if (field == 'mmsi' || field == 'latitude' || field == 'longitude') {
					info[field] = result[field];
					match++;
				}
      }
    } catch(error) {
        debug('parsing failed for' + sentence + ' error:' + error);
    }

		if (match == 3) {
			valid_packet(info);
		}

  }

	else if (result.valid == 'UNSUPPORTED') {
    debug('unsupported message: ' + sentence, result.errMsg);
	}

  else if (result.valid == 'INVALID') {
    debug('invalid message: ' + sentence, result.errMsg);
  }

	else if (result.valid == 'INCOMPLETE') {
    debug('incomplete message, waiting for more');
  }

	else {
		debug('Well, this is unexpected?')
	}

};

process.stdin.resume();
process.stdin.setEncoding('utf8');

var lingeringLine = "";

process.stdin.on('data', function(chunk) {
  lines = chunk.split("\n");
  lines[0] = lingeringLine + lines[0];
  lingeringLine = lines.pop();
  lines.forEach(parse);
});

process.stdin.on('end', function() {
  parse(lingeringLine);
});
