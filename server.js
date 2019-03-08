let express = require('express');
let app = express();
let server = require('http').createServer(app);
let io = require('socket.io').listen(server);
let orm = require('orm');

users = [];
connections = [];
//192.168.1.6
//83.239.42.246

//10.137.57.156
//178.252.127.246
//server.listen(process.env.PORT || 3000, 'localhost');
//server.listen(process.env.PORT || 3000, '178.252.118.52');
let port = process.env.PORT;
if (process.env.PORT == null)
    port = 3000;
//var host = '0.0.0.0';
//var host = '178.252.118.52';
const host = '10.137.57.156';
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
    let eventsModel = {
        id: {type: 'serial', key: true},
        name: String,
        description: String,
        creator_id: {type: "integer"},
        created: String,
        starting: String,
        ending: String,
        city: String,
        latitude: {type: "number"},
        longitude: {type: "number"}
    };
    models.Events = db.define("events", eventsModel);
}

function defineUsers(models, db) {
    let userModel = {
        id: {type: 'serial', key: true},
        login: String,
        name: String,
        surname: String,
        gender: ["male", "female"],
        info: String,
        photo: Buffer,
        birthday: {type: "date", time: false}
    };
    models.Users = db.define("users", userModel);
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
    console.log("sow " + i);
    i++;
    //res.send(__dirname);
    res.send("Hello");
});

app.get('/', function (req, res) {
    //res.send(__dirname);
    res.sendFile(__dirname + '/index.html');
});

app.get('/user/:userId', function (req, res) {
    req.models.Users.one({id: req.params.userId}, function (err, user) {
        if (err) {
            res.status(500).send(err.toString());
            throw err;
        }
        else {
            if (user == null) {
                res.status(404).send([]);
            }
            else {
                res.send(user);
            }
        }
    });
});

let rad = function (x) {
    return x * Math.PI / 180;
};

let getDistance = function (p1, p2) {
    const R = 6378137; // Earth's mean radius in meter
    const dLat = rad(p2.latitude - p1.latitude);
    const dLong = rad(p2.longitude - p1.longitude);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(rad(p1.latitude)) * Math.cos(rad(p2.latitude)) *
        Math.sin(dLong / 2) * Math.sin(dLong / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // returns the distance in meter
};

app.get('/events', function (req, res) {
    req.models.Events.find({}, function (err, events) {
        if (err) {
            //socket.emit("query error with this input", userProps);
            throw err;
        }
        else {
            if (events.length === 0) {
                socket.emit("FoundNullEvents", events.length);
            }
            else {
                let eventList = [];
                for (let i = 0; i < events.length; i++) {
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


io.sockets.on('connection', function (socket) {
    let onUserLoginCallback = function (data) {
        console.log("Login event: " + data.login + ' ' + data.password);
        if (checkIncomingData(data)) {
            socket.models.Users.one({login: data.login, password: data.password}, function (err, user) {
                if (err) {
                    throw err;
                }
                else {
                    if (user == null)
                        socket.emit("WrongLoginEvent", data);
                    else {
                        console.log("User logged in: %s %s", user.name, user.surname);
                        //var birth = new Date(users[0].birthday).format("yyyy-mm-dd");
                        //var birth_month = birth.getMonth() + 1;
                        //var formattedBirthDay = birth.getDate()+'.'+ birth_month+'.'+birth.getFullYear();
                        // var formated_date = now.format("yyyy-mm-dd");
                        //users[0].birthday = formattedBirthDay;

                        socket.usr = user.id;
                        socket.emit("RightLoginEvent", user);
                    }
                }
            });
        }
        else {
            socket.emit("WrongLoginParametersEvent", data);
        }
    };

    let onSocketDisconnectedCallback = function () {
        users.splice(users.indexOf(socket.username), 1);
        updateUserNames();
        connections.splice(connections.indexOf(socket), 1);
        console.log('Disconnected: %s sockets connected', connections.length);
    };

    let onFindEventsCallback = function (userProps) {
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
                if (events.length === 0) {
                    socket.emit("FoundNullEvents", events.length);
                }
                else {
                    let eventList = [];
                    for (let i = 0; i < events.length; i++) {
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
    let onEventCreationCallback = function (newEventData) {

    };

    //TODO USERREG
    let onUserRegistrationCallback = function (newUserData) {

    };

    let initialize = function (socket) {
        socket.on('disconnect', onSocketDisconnectedCallback);
        socket.on('login', onUserLoginCallback);
        socket.on('EventCreation', onEventCreationCallback);
        socket.on('FindEvents', onFindEventsCallback);
        socket.on('UserRegistration', onUserRegistrationCallback);
        connections.push(socket);
        console.log('Connected: %s sockets connected', connections.length);
    };
    initialize(socket);
});

function updateUserNames() {
    io.sockets.emit('get users', users);
}

function checkIncomingData(data) {
    return !!(data.login && data.password);
}