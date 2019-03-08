var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var orm = require('orm');

users = [];
connections = [];
//192.168.1.6
//83.239.42.246

//10.137.57.156
//178.252.127.246
//server.listen(process.env.PORT || 3000, 'localhost');
//server.listen(process.env.PORT || 3000, '178.252.118.52');
var port = process.env.PORT;
if (process.env.PORT == null)
    port = 3000;
//var host = '0.0.0.0';
//var host = '178.252.118.52';
var host = '10.137.57.156';
server.listen(port, host);
//server.listen(process.env.PORT || 3000, '10.137.57.156');

console.log('Example app listening at http://%s:%s', host, port);

app.use(orm.express("mysql://root:welldone@127.0.0.1/sppr", {
//app.use(orm.express("mysql://root@127.0.0.1/sppr", {
    define: function (db, models, next) {
        defineEvents(models, db);
        defineUsers(models, db);
        next();
    }
}));

io.use(orm.express("mysql://root:welldone@127.0.0.1/sppr", {
//io.use(orm.express("mysql://root@127.0.0.1/sppr", {
    define: function (db, models, next) {
        defineEvents(models, db);
        defineUsers(models, db);
        next();
    }
}));

function defineEvents(models, db) {
    models.Events = db.define("events", {
        event_id: {type: 'serial', key: true},
        name: String,
        description: String,
        creator_id: {type: "integer"},
        created: String,
        starting: String,
        ending: String,
        city: String,
        latitude: {type: "number"},
        longitude: {type: "number"}
    });
}

function defineUsers(models, db) {
    models.Users = db.define("users", {
        user_id: {type: 'serial', key: true},
        login : String,
        //login : String,
        name: String,
        surname: String,
        sex: ["male", "female"],
        info: String,
        photo: Buffer,
        birthday: {type: "date", time: false}
    });
}

io.use(function (socket, next) {
    const handshakeData = socket.request;
    handshakeData.headers.cookie = "mahere";
    // make sure the handshake data looks good as before
    // if error do this:
    // next(new Error('not authorized');
    // else just call next
    next();
});

let i = 1;

app.get('/hello', function (req, res) {
    console.log("sow " +i);
    i++;
    //res.send(__dirname);
    res.send("Hello");
});

app.get('/', function (req, res) {
    //res.send(__dirname);
    res.sendFile(__dirname + '/index.html');
});

app.get('/users/{id}', function (req, res) {
    //res.send(__dirname);
    res.sendFile(__dirname + '/index.html');
});

app.get('/events', function (req, res) {
    req.models.Events.find({}, function (err, events) {
        if (err) {
            //socket.emit("query error with this input", userProps);
            throw err;
        }
        else {
            if (events.length == 0) {
                socket.emit("FoundNullEvents", events.length);
            }
            else {
                let eventList = [];
                for (var i = 0; i < events.length; i++) {
                    let dist = getDistance(new LatLng(req.query.latitude, req.query.longitude), events[i]);
                    let parsed = parseInt(req.query.area);
                    if (dist < req.query.area)
                        eventList.push(events[i]);
                    console.log(dist);
                }
                res.send(eventList);
            }
        }
    });
});

let LatLng = class {
    constructor(lat, lng) {
        this.latitude = lat;
        this.longitude = lng;
    }
};

var rad = function (x) {
    return x * Math.PI / 180;
};

var getDistance = function (p1, p2) {
    var R = 6378137; // Earth�s mean radius in meter
    var dLat = rad(p2.latitude - p1.latitude);
    var dLong = rad(p2.longitude - p1.longitude);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(rad(p1.latitude)) * Math.cos(rad(p2.latitude)) *
        Math.sin(dLong / 2) * Math.sin(dLong / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // returns the distance in meter
};

io.sockets.on('connection', function (socket) {
    var onUserLogin_Cb = function (data) {
        console.log("Login event: " + data.login + ' ' + data.password);
        if (check_incoming_data(data)) {
            socket.models.Users.find({login: data.login, password: data.password}, function (err, users) {
                if (err) {
                    throw err;
                }
                else {
                    if (users.length == 0)
                        socket.emit("WrongLoginEvent", data);
                    else {
                        console.log("User logged in: %s %s", users[0].name, users[0].surname);
                        //var birth = new Date(users[0].birthday).format("yyyy-mm-dd");
                        //var birth_month = birth.getMonth() + 1;
                        //var formattedBirthDay = birth.getDate()+'.'+ birth_month+'.'+birth.getFullYear();
                       // var formated_date = now.format("yyyy-mm-dd");
                        //users[0].birthday = formattedBirthDay;

                        socket.usr = users[0].user_id;
                        socket.emit("RightLoginEvent", users[0]);
                    }
                }
            });
        }
        else {
            socket.emit("WrongLoginParametersEvent", data);
        }
    };

    var onSocketDisconnection_Cb = function () {
        users.splice(users.indexOf(socket.username), 1);
        updateUsernames();
        connections.splice(connections.indexOf(socket), 1);
        console.log('Disconnected: %s sockets connected', connections.length);
    };

    var onFindEvents_Cb = function (userProps) {
        console.log(userProps);
        socket.models.Events.find({
            //latitude: orm.between(userProps.latitude - userProps.area, userProps.latitude + userProps.area),
            //longitude: orm.between(userProps.longitude - userProps.area, userProps.longitude + userProps.area)
        }, function (err, events) {
            if (err) {
                socket.emit("query error with this input", userProps);
                throw err;
            }
            else {
                if (events.length == 0) {
                    socket.emit("FoundNullEvents", events.length);
                }
                else {
                    let eventList = [];
                    for (var i = 0; i < events.length; i++) {
                        let dist = getDistance(new LatLng(userProps.latitude, userProps.longitude), events[i]);
                        if (dist < userProps.area)
                            eventList.push(events[i]);
                        console.log(dist);
                    }
                    console.log(socket.usr);
                    socket.emit("FoundEvents", eventList);
                }
            }
        });
    };

    //TODO Event creation
    var onEventCreation_Cb = function (newEventData) {

    };

    //TODO USERREG
    var onUserRegistration_Cb = function (newUserData) {

    };

    var initialize = function (socket) {
        socket.on('disconnect', onSocketDisconnection_Cb);
        socket.on('login', onUserLogin_Cb);
        socket.on('EventCreation', onEventCreation_Cb);
        socket.on('FindEvents', onFindEvents_Cb);
        socket.on('UserRegistration', onUserRegistration_Cb);
        connections.push(socket);
        console.log('Connected: %s sockets connected', connections.length);
    };
    initialize(socket);
});

function updateUsernames() {
    io.sockets.emit('get users', users);
}
function check_incoming_data(data) {
    if (data.login && data.password)
        return true;
    else
        return false;
}