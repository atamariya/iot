var $ = function(id) {
    return document.getElementById(id);
};

var refreshInterval = 1000; //ms
var connected = false;
var client = new Messaging.Client("localhost", 8000,
        "mHome" + String(Math.random() * 1000));

client.onConnectionLost = function(responseObject) {
    console.log("connection lost: " + responseObject.errorMessage);
    connected = false;
};

client.onMessageArrived = function(message) {
    processMessage(message);
    console.log(message.destinationName + " " + message.payloadString);
};

var options = {
    timeout: 60, //seconds
    onSuccess: function() {
        console.log("Connected");
        connected = true;
        // Connection succeeded; subscribe to our topic
        client.subscribe('#', {qos: 0});
    },
    onFailure: function(message) {
        alert("Connection failed: " + message.errorMessage);
    }
};

function connect() {
    disconnect();
    client.connect(options);
}
function disconnect() {
    if (connected)
        client.disconnect();
//                localStorage["d"] = JSON.stringify(d);
}
;
connect();

onunload = disconnect;

var d = new Object();

var Device = function(id, physicalDevice, type) {
    this.id = id;
    /** If it's a physical device, children are not modifiable. */
    this.physical = physicalDevice;

    /** Controls can have range of values unlike switch. max = 1 is 
     * switch. max > 1 is a control. */
    this.value = this.min = this.max = 0;
    this.active;
    this.children = new Array();
    this.parent;
    this.name;
    this.type = type;

};
function getName(device) {
    var str = (!device.name ? device.id : device.name);
    return str.substring(0, 20);
}
function getWidget(device) {
    var str = getName(device);
    if (device.type != "sensor") {
        str = '<input type="button" value="' + getName(device)
                + '" onclick="publish(\'' + device.id
                + '\')" >';
    }
    return '<div id="' + device.id + '" class="device">\
                            <div class="type">' + device.type + '</div>\
                            <div class="name">' + str + '</div>\
                            <div class="child">' + device.value + '</div>\
                        </div>';
}

function draw(device) {
    var node = $(device.id);
    var replace = false;
    if (node) {
        node = node.parentNode;
        replace = true;
    } else
        node = document.createElement("li");

    console.log(device);
    node.innerHTML = getWidget(device);
    var parent = $("devices");
    if (!replace)
        parent.appendChild(node);
}

function processMessage(message) {
    var device = new Device(message.destinationName, true);
    device.value = message.payloadString;

    device = resolveHierarchy(device);
    draw(device);
}

function resolveHierarchy(device) {
    if (d[device.id]) {
        // Update device state using info. from arrived msg.
        d[device.id].value = device.value;
        return d[device.id];
    }

    var parent = null;
    var parts = device.id.split("/");
    if (parts.length < 1)
        return;
    device.type = "sensor";
    if (parts[0] == "ctrl") {
        if (device.max > 1)
            device.type = "control";
        else
            device.type = "switch";
    }
    d[device.id] = device;

    for (i = parts.length - 1; i > 0; ) {
        var id = parts[--i];
        parent = new Device(id, false, device.type);
        parent.max = device.max;
        parent.children.push(device);
        device = parent;
        d[device.id] = device;
    }
    return device;
}

function publish(id) {
    var device = d[id];
    if (!device || device.type == "sensor")
        return;

    if (device.type == "control")
        getValue(device, execute);
    else {
        device.value = (device.value == "1" ? "0" : "1");
        execute(device);
    }
}

function execute(device) {
    console.log("Executing for " + device.id);
    draw(device);
    if (device.physical) {
        var msg = new Messaging.Message(String(device.value));
        msg.destinationName = device.id;
        client.send(msg);
    } else {
        // Logical switches act on complete heirarchy
        device.children.forEach(function(child) {
            child.value = device.value;
            execute(child)
        });
    }
}
