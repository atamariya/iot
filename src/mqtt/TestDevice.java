/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package mqtt;

import static mqtt.Test.brokerURL;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallback;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;

/**
 *
 * @author Anand.Tamariya
 */
public class TestDevice implements MqttCallback {

    static final String id = "vendor:deviceId";
    static final String brokerURL = "tcp://localhost:1883";
    MqttClient client;

    public static void main(String[] args) {
        {
            try {
                Thread subscribe = new Thread(new Runnable() {

                    @Override
                    public void run() {
                        MqttClient client;
                        try {
                            MqttConnectOptions options = new MqttConnectOptions();
                            // Only single LWT is allowed
                            options.setWill("meta/" + id, "".getBytes(), 2, true);

                            client = new MqttClient(
                                    brokerURL, "pahomqttsub1");
                            client.connect(options);
                            client.subscribe("ctrl/" + id + "/#");
                            client.setCallback(new TestDevice(client));
                        } catch (MqttException e) {
                            e.printStackTrace();
                        }

                    }
                });
                MqttClient client = new MqttClient(brokerURL,
                        "pahomqttpublish");
                client.connect();
                MqttMessage message = new MqttMessage();
                String json = "{type: '%s', max: %s}";
                json = json.format(json, "switch", 1);
                System.out.println(json);
                message.setPayload(json.getBytes());
                subscribe.start();
                client.publish("meta/" + id, json.getBytes(), 0, true);
                client.publish("meta/" + id + "/1", json.getBytes(), 0, true);
                client.publish("meta/" + id + "/2", json.getBytes(), 0, true);
                client.publish("meta/" + id + "/3", json.getBytes(), 0, true);
                client.publish("meta/" + id + "/4", json.getBytes(), 0, true);
                client.disconnect();

            } catch (MqttException e) {
                e.printStackTrace();
            }
        }
    }

    private TestDevice(MqttClient client) {
        this.client = client;
    }

    @Override
    public void connectionLost(Throwable thrwbl) {
        throw new UnsupportedOperationException("Not supported yet."); //To change body of generated methods, choose Tools | Templates.
    }

    @Override
    public void messageArrived(String topic,
            MqttMessage msg) throws Exception {
        System.out.println("messageArrived " + msg + " " + topic);
        String address = null, cmd = new String(msg.getPayload());
        String[] parts = topic.split("/");
        int i = parts.length - 1;
        if (id.equals(parts[i])) {
            address = "FF";
        } else if ("1".equals(parts[i])) {
            address = "F0";
        } else if ("2".equals(parts[i])) {
            address = "F2";
        } else if ("3".equals(parts[i])) {
            address = "F4";
        } else if ("4".equals(parts[i])) {
            address = "F8";
        }
       
        
        if (cmd.equals("1"))
            cmd = "on";
        else 
            cmd = "off";
            
        SerialClient.getInstance().setPortName("COM4");
        String str = SerialClient.getInstance().send(address, cmd);
        System.out.println(str);
//        client.publish("meta/" + id, str.getBytes(), 0, true);
    }

    @Override
    public void deliveryComplete(IMqttDeliveryToken imdt) {
        throw new UnsupportedOperationException("Not supported yet."); //To change body of generated methods, choose Tools | Templates.
    }

}
