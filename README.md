iot
===

The technology landscape is changing fast and for good. With HTML5 becoming standard and protocols for M2M like MQTT getting wider acceptance, it's about time an application framework was designed using these. I've done a PoC with these components and am excited with the outcome.

The framework consists of the following:

    Lightweight HTML5 client with only MQTT JS library dependency. This allows easy customization of UI with simple HTML and CSS. It uses Websockets to communicate with broker.

    MQTT broker. I used HiveMQ (27 MB). Any other MQTT broker supporting websockets, even cloud based, would do.

    Device client based on MQTT API. I used Java API. However, C API is also available which can be used to run the logic in low-powered microcontroller; or Python API running on RPi. This involves two Java classes:
        SerialClient - Interacts with device implementing device specific calls for 0 , 1 and range messages
        TestDevice - Interacts with broker and SerialClient

This design allows limiting the amount of code deployed on a resource starved device instead of using one-size fits all approach which is bulky and difficult to customize.

Also, the framework supports the idea of hierarchy of devices. So if a device is published at topic/home/room1/lights1 (A) and another at topic/home/room1 (B), then turning off B in the UI would turn off both A AND B.

Code: https://github.com/atamariya/iot
Video: http://youtu.be/yqLjVDUZzhA
