var	async = require('async'),
	server = require('http').createServer(processRequest),
	redis = require('redis').createClient('/tmp/redis.sock'),

	level = /\/([^\/]+)(?:\/([^\/]+))?/;

server.listen(3216);

redis.on('error', function(err) {
	console.error('Redis error: ' + err);
});

function processRequest(req, response) {
	var	video, range,
		match = req.url.match(level),
		respond = respondOn.bind(response);

	if (!match)
		return respond(404)();

	if (match[2])
		range = match[2].split('-');
	video = match[1];

	switch (req.method) {
	case 'GET':
		range ? getSegmentAddresses(video, parseInt(range[0]), parseInt(range[1]), respond(200), respond(404))
			  : getAllSegmentAddresses(video, respond(200), respond(404));
		break;
	case 'POST':
		putSegmentAddress(video, parseInt(range[0]), parseInt(range[1]), req.connection.remoteAddress, respond(200));
		break;
	case 'DELETE':
		purgeAllSegmentAddresses(video, respond(200));
		break;
	default:
		return respond(200)();
	}
}

function respondOn(code) {
	var t = this;
	return function(res) {
		t.writeHead(code);
		t.end(JSON.stringify(res));
	};
}

function randomlyTakeN(n, a) {
	var i = len = a.length, j, tmp,
		mm = m = (n > i) ? i : n;

	for (; m; j = Math.floor(Math.random() * i), tmp = a[--i], a[i] = a[j], a[j] = tmp, --m);
	return a.slice(len - mm);
}

function getAllSegmentAddresses(key, exists, notExists) {
	redis.zrangebyscore(key, '-inf', '+inf', 'WITHSCORES', function(err, addrsWithScore) {
		(addrsWithScore.length == 0) ? notExists() : exists(addrsWithScore);
	});
}

function getSegmentAddresses(key, begin, end, exists, notExists) {
	redis.zrangebyscore(key, '-inf', begin, function(err, addrs) {
		if (addrs.length == 0)
			return notExists();

		var covered = addrs.filter(function(addrWithEnd) {
			return parseInt(addrWithEnd) >= end;
		}).map(function(addrWithEnd) {
			return addrWithEnd.split(' ')[1];
		});

		return (covered.length == 0)
			? notExists()
			: exists(randomlyTakeN(2, covered));
	});
}

function putSegmentAddress(key, begin, end, address, callback) {
	redis.zrangebyscore(key, '-inf', end + 1, 'WITHSCORES', function(err, addrsWithScore) {
		var minBegin = begin,
			maxEnd = end,
			covered = [];

		for (var i = 0, len = addrsWithScore.length; i < len; i += 2) {
			var str = addrsWithScore[i].split(' '),
				segmentAddr = str[1],
				segmentBegin = parseInt(addrsWithScore[i + 1]),
				segmentEnd = parseInt(str[0]);

			if (segmentAddr != address || segmentEnd < begin - 1)
				continue;

			if (begin >= segmentBegin && end <= segmentEnd)
				return callback('Already be covered.');

			covered.push(addrsWithScore[i]);

			minBegin = (segmentBegin > minBegin) ? minBegin : segmentBegin;
			maxEnd = (segmentEnd > maxEnd) ? segmentEnd : maxEnd;
		}

		async.each(covered, function(m, callback) {
			redis.zrem(key, m, callback);
		}, function(err) {
			redis.zadd(key, minBegin, maxEnd + ' ' + address, function(err, reply) {
				callback(reply);
			});
		});
	});
}

function purgeAllSegmentAddresses(key, callback) {
	redis.del(key, function(err, reply) {
		callback(reply);
	});
}
