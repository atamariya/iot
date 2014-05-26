/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
var d;
var store = window.localStorage;
var refreshInterval = 500; //ms
function resolveHierarchy(device) {
    var parent = null;
    var parts = device.id.split("/");
    if (parts.length < 1)
        return;

    for (i = parts.length - 1; i > 0; i--) {
        var id = parts[--i];
        parent = new Device(id);
        device.parent = parent;
        device = parent;
    }
    if (d.indexOf(parent) > 0) {
        parent = d[devices.indexOf(device)];
        parent.children.addAll(device.children);
        device = parent;
    } else
        d.push(device);
}

var connected = false;
var client = new Messaging.Client("localhost", 8000,
        "mHome");

client.onConnectionLost = function(responseObject) {
    console.log("connection lost: " + responseObject.errorMessage);
    connected = false;
};

client.onMessageArrived = function(message) {
    var device = new Device(message.destinationName);
    device.value = message.payloadString;

    resolveHierarchy(device);
    draw(device);
    console.log(message.destinationName + " " + message.payloadString);
};

var options = {
    timeout: 10, //seconds
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

window.setInterval(function() {
    if (!connected) {
        console.log("reconnect");
        client.connect(options);
    }
}, refreshInterval);

function draw(device) {
    var node = document.getElementById(device.id);
    if (node)
        node = node.parentNode;
    else
        node = document.createElement("li");

    console.log(device);
    node.innerHTML = getWidget(device);
    var parent = document.getElementById("devices");
    parent.appendChild(node);
}
;