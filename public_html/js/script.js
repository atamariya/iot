var $ = function(id) {
    return document.getElementById(id);
};

var refreshInterval = 1000; //ms
var connected = false;
var brokerURL, port, client;
var editMode = false; // Edit mode

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
    if (connected)
        return;

    brokerURL = localStorage["brokerURL"];
    port = parseInt(localStorage["port"]);
    if (!brokerURL || !port || typeof brokerURL !== 'string'
            || typeof port !== 'number') {
        settingsDialog();
        return;
    }

    client = new Messaging.Client(brokerURL, port,
            "mHome" + String(Math.random() * 1000));
    client.onConnectionLost = function(responseObject) {
        console.log("connection lost: " + responseObject.errorMessage);
        connected = false;
    };

    client.onMessageArrived = function(message) {
        processMessage(message);
        console.log(message.destinationName + " " + message.payloadString);
    };

    try {
        client.connect(options);
    } catch (e) {
        // Garbage setting. Re-initialize
        localStorage["brokerURL"] = "";
        localStorage["port"] = "";
        connect();
    }
}

/**
 * Cleanup routine.
 */
function disconnect() {
    localStorage["d"] = JSON.stringify(d);
    if (connected)
        client.disconnect();
}

function send(msg) {
    connect();
    if (connected)
        client.send(msg);
}
onunload = disconnect;

var d = new Object();

var Device = function(id, physicalDevice, type) {
    this.id = id;
    /** If it's a physical device, children are not modifiable. */
    this.physical = physicalDevice;

    /** Controls can have range of values unlike switch. max = 1 is 
     * switch. max > 1 is a control. */
    this.value = this.min = 0;
    this.max = 1;
    this.active = true;
    this.children = new Array();
    this.parent;
    this.name = '';
    this.type = type; // Control, sensor, switch

};
function getName(device) {
    var str = (device.name == '' ? device.id : device.name);
    return str.substring(0, 20);
}
function getWidget(device) {
    var str = getName(device);
    if (editMode) {
        str = '<input type="button" value="' + str
                + '" onclick="editDevice(\'' + device.id
                + '\')" >';
    } else {
        if (device.type != "sensor") {
            str = '<input type="button" value="' + str
                    + '" onclick="publish(\'' + device.id
                    + '\')"' + (device.active ? '' : 'disabled') + '>';
        }
    }
    return '<div id="' + device.id + '" class="device">\
                            <div class="type">' + device.type + '</div>\
                            <div class="name">' + str + '</div>\
                            <div class="child">' + device.value + '</div>\
                        </div>';
}

function refresh() {
    connect();
    redraw();
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

function redraw() {
//    var elm = $("devices");
//    while (elm.firstChild) {
//        elm.removeChild(elm.firstChild);
//    }
    clear();
    for (var k in d)
        draw(d[k]);
}

function clear() {
    $("devices").innerHTML = "";
    $("Physical").style.border = "";
    $("Virtual").style.border = "";
}

function isPressed(id) {
    //Toggle logic
    if ($(id).style["border-style"] == "inset"
            || $(id).style["borderStyle"] == "inset") {
        return true;
    }
    return false;
}

function applyFilter(filter) {
    if (isPressed(filter)) {
        redraw();
        return;
    }

    clear();
    $(filter).style.border = "inset";
    for (var k in d) {
        if ((filter == "Physical" && d[k].physical == true)
                || (filter == "Virtual" && d[k].physical == false))
            draw(d[k]);
    }
}

function processMessage(message) {
    var id = message.destinationName;
    var value = message.payloadString;

    // First part is topic type
    var type = id.substring(0, 4);
    id = id.substring(5);
    var device = new Device(id, true);
    if (type == "meta") {
        if (!value) {
            device = resolveHierarchy(device);
            deactivate(device);
            return;
        } else {
            // payload is an object representing device meta info
            device.type = value.type;
            device.max = value.max;
            device = resolveHierarchy(device);
        }
    } else if (type == "stat")
        device.value = value;
    else
        return;

    draw(device);
}

function findChild(device) {
    for (var key in d) {
        if (key.match(device.id)) {
            device.children.push(d[key]);
        }
    }
}

function resolveHierarchy(device) {
    findChild(device);
    if (d[device.id]) {
        // Update device state using info. from arrived msg.
        d[device.id].value = device.value;
        d[device.id].active = device.active;
        return d[device.id];
    }

    var parent = null;
    var parts = device.id.split("/");
    if (parts.length < 1)
        return;

    if (device.max > 1)
        device.type = "control";
    else if (device.max = 1)
        device.type = "switch";
    else
        device.type = "sensor";
    d[device.id] = device;

    for (i = parts.length - 1; i > 1 /* don't use first part of topic */; ) {
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

    connect(); // Ensure we're connected

    if (device.type == "control")
        getValue(device, execute);
    else {
        device.value = (device.value == "1" ? "0" : "1");
        execute(device);
    }
}

function deactivate(device) {
    device.active = false;
    draw(device);
    if (device.children == 0) {
        return;
    }
    device.children.forEach(deactivate);
}

function execute(device) {
    console.log("Executing for " + device.id);
    draw(device);
    if (device.physical) {
        var msg = new Messaging.Message(String(device.value));
        msg.destinationName = "ctrl/" + device.id;
        send(msg);
    } else {
        // Logical switches act on complete heirarchy
        device.children.forEach(function(child) {
            child.value = device.value;
            execute(child)
        });
    }
}

function getValue(device, callback) {
    // Show pop-up with slider
    $("dialog").style.display = "block";
    $("slider").style.display = "block";
    $("dialog").onclick = function() {
        $("dialog").style.display = "none";
        $("slider").style.display = "none";

        this.onclick = null;
        // Don't make unnecessary calls
        if (device.value != $("points").value) {
            device.value = $("points").value;
            callback(device);
        }
    };
    var points = $("points");
    points.min = device.min;
    points.max = device.max;
    points.value = device.value;
}

function settingsDialog() {
    $("dialog").style.display = "block";
    $("settings").style.display = "block";

    $("broker").host.value = localStorage["brokerURL"] || '';
    $("broker").port.value = localStorage["port"];
    // Handle reset
    $("broker").host.defaultValue = localStorage["brokerURL"] || '';
    $("broker").port.defaultValue = localStorage["port"];

    $("broker").onsubmit = function() {
        $("dialog").style.display = "none";
        $("settings").style.display = "none";

        // Remember pref
        localStorage["brokerURL"] = $("broker").host.value;
        localStorage["port"] = $("broker").port.value;
        disconnect();
        connect();
        return false;
    };

    $("broker").cancel.onclick = function() {
        $("dialog").style.display = "none";
        $("settings").style.display = "none";
    };
}

function manageSelection(from, to) {
    /* This must be done in two steps as select list length is
     * re-evaluated after each removal :
     * 1. Add to destination list. 
     * 2. Remove from source list starting from end. 
     */
    for (var index = 0; index < from.length; index++) {
        if (from[index].selected) {
            var option = from[index];
            to.add(new Option(option.text, option.value));
        }
    }
    for (var index = from.length - 1; index >= 0; index--) {
        if (from[index].selected) {
            from.remove(index);
        }
    }
}


function editDevice(id) {
    $("dialog").style.display = "block";
    $("device").style.display = "block";

    var form = $("deviceForm");
    var device = d[id];
    if (!device) {
        var cnt = parseInt(localStorage["cnt"] || 0);
        device = new Device("logical/" + cnt, false);
    }
    form.id.value = device.id;
    form.name.value = device.name;
    form.type.value = device.type;
    form.max.value = device.max;

    // Handle reset
    form.id.defaultValue = device.id;
    form.name.defaultValue = device.name;
    form.type.defaultValue = device.type;
    form.max.defaultValue = device.max;

    for (var i = 0; i < device.children.length; i++) {
        var name = getName(device.children[i]);
        form.children.options[i] = new Option(device.children[i].id, name);
    }
    if (device.physical != true) {
        $("choose").style.display = "";
        var i = 0;
        for (var k in d) {
            var name = getName(d[k]);
            form.option.options[i++] = new Option(d[k].id, name);
        }
    } else {
        $("choose").style.display = "none";
    }

    $("deviceForm").onsubmit = function() {
        $("dialog").style.display = "none";
        $("device").style.display = "none";

        var cnt = parseInt(localStorage["cnt"] || 0);
        localStorage["cnt"] = ++cnt;
        this.onsubmit = null;

        var form = $("deviceForm");
        var device = new Device(form.id.value, false);
        device.name = form.name.value;
        device.type = form.type.value;
        device.max = form.max.value;
        resolveHierarchy(device);
        draw(device);

        return false;
    };

    $("deviceForm").cancel.onclick = function() {
        $("dialog").style.display = "none";
        $("device").style.display = "none";
        form.option.innerHTML = '';
        form.children.innerHTML = '';
    };

    $("deviceForm").add.onclick = function() {
        manageSelection(form.option, form.children);
    };

    $("deviceForm").remove.onclick = function() {
        manageSelection(form.children, form.option);
    };
}

