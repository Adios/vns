var ap = require('http').createServer(server),
	redis = require('redis'),
	client = redis.createClient('/tmp/redis.sock'),
	level = /\/([^\/]+)(?:\/([^\/]+))?/;

ap.listen(3216);

client.on('error', function(err) {
	console.log('Redis error: ' + err);
});

function server(req, response) {
	var	video, range, segment,
		respond = respondOn.bind(response),
		m = req.url.match(level);

	if (!m) {
		respond(404)();
		return;
	}

	video = m[1];
	range = m[2];
	segment = video + ':' + range;

	switch (req.method) {
	case 'GET':
		console.log('[%s] %s %s', req.connection.remoteAddress, req.method, req.url);
		if (range)
			getSegmentAddresses(segment, respond(200), respond(404));
		else
			getVideoAddresses(video, respond(200), respond(404));
		break;
	case 'POST':
		console.log('[%s] %s %s', req.connection.remoteAddress, req.method, req.url);
		putSegmentAddress(segment, req.connection.remoteAddress, respond(200));
		break;
	case 'DELETE':
		if (range)
			purgeSegmentAddresses(segment, respond(200));
		else
			purgeVideoAddresses(video, respond(200));
		break;
	default:
		respond(200)();
		break;
	}
}

function respondOn(code) {
	var t = this;
	return function(res) {
		t.writeHead(code);
		t.end(JSON.stringify(res));
	};
}

function getVideoAddresses(name, found, notFound) {
	client.keys(name + '*', function (err, reply) {
		(reply.length == 0) ? notFound() : found(reply);
	});
}

function getSegmentAddresses(key, found, notFound) {
	client.srandmember(key, 2, function(err, reply) {
		(reply.length == 0) ? notFound() : found(reply);
	});
}

function putSegmentAddress(key, address, callback) {
	client.sadd(key, address, function(err, reply) {
		callback(reply);
	});
}

function purgeSegmentAddresses(key, callback) {
	client.del(key, function(err, reply) {
		callback(reply);
	});
}

function purgeVideoAddresses(name, callback) {
	client.keys(name + '*', function(err, reply) {
		reply.forEach(function(key) {
			client.del(key);
		});
		// don't care
		callback();
	});
}
