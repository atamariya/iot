var refreshInterval = 1000; //ms
var connected = false;
var client = new Messaging.Client("localhost", 8000,
        "mHome" + String(Math.random() * 1000));

client.onConnectionLost = function(responseObject) {
    console.log("connection lost: " + responseObject.errorMessage);
    connected = false;
};

client.onMessageArrived = function(message) {
    var device = new Device(message.destinationName, true);
    device.value = message.payloadString;

    resolveHierarchy(device);
    draw(device);
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

client.connect(options);
window.setInterval(function() {
    if (!connected) {
//        console.log("reconnect");
        client.connect(options);
    }
}, refreshInterval);

onunload = function() {
    client.disconnect();
};

function draw(device) {
    var node = document.getElementById(device.id);
    var replace = false;
    if (node) {
        node = node.parentNode;
        replace = true;
    } else
        node = document.createElement("li");

    console.log(device);
    node.innerHTML = getWidget(device);
    var parent = document.getElementById("devices");
    if (!replace)
        parent.appendChild(node);
}

var d = new Object();

function resolveHierarchy(device) {
    var parent = null;
    var parts = device.id.split("/");
    if (parts.length < 1)
        return;
    device.type = "sensor";
    if (parts[0] == "ctrl")
        device.type = "control";
    for (i = parts.length - 1; i > 0; i--) {
        var id = parts[--i];
        parent = new Device(id, false, device.type);
        parent.children.push(device);
        device = parent;
    }
//    if (d[device.id]) {
//        parent = d[device.id];
//        parent.children.addAll(device.children);
//        device = parent;
//    } else
    d[device.id] = device;
}
