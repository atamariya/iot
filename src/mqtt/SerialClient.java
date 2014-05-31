/**
 * 
 */
package mqtt;

import java.util.Arrays;
import javax.xml.bind.DatatypeConverter;
import jssc.SerialPort;
import jssc.SerialPortException;
import jssc.SerialPortTimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * @author Anand.Tamariya
 *
 */
public class SerialClient {
   /** The logger. */
   private static final Logger logger = LoggerFactory.getLogger(SerialClient.class.getName());

   final byte ack = 0x2E;
   final byte nack1 = 0x21;
   final byte nack2 = 0x3E;
   byte[] mr = new byte[] { 0x6D, 0x72, 0x05, (byte) 0xA7, 0x0D };
   byte[] mt_allon = new byte[] { 0x6D, 0x74, 0x05, (byte) 0xA7, (byte) 0x02, (byte) 0xFF, 0x0D };
   byte[] mt_alloff = new byte[] { 0x6D, 0x74, 0x05, (byte) 0xA7, (byte) 0xFF, 0x00, 0x0D };

   
   private static SerialClient instance = new SerialClient();
   private SerialPort port;
   private String lastCommand, lastStatus, portName;
   
   private SerialClient() {
//      String[] portNames = SerialPortList.getPortNames();
//      boolean found = false;
//      for (int i = 1; i < portNames.length; i++) {
//         port = new SerialPort(portNames[i]);
//         String status = null;
//         try {
////            status = send("P0055FF", null);
//         } catch (Exception e) {
//            e.printStackTrace();
//         } finally {
//            try {
//               port.closePort();
//            } catch (SerialPortException e1) {
//            }
//         }
//         System.out.println(portNames[i] + " " + status);
//         if (status != null && status.length() == 4) {
//            found = true;
//            break;
//         }
//      }
//      
//      if (!found)
//         throw new RuntimeException("Device not connected");
   }
   
   public static SerialClient getInstance() {
      return instance;
   }

   /**
    * Old protocol. M0501FF
    * @param address
    * @param cmd
    * @return
    * @throws Exception
    */
   public synchronized String send1(String address, String cmd) throws Exception {
      // Avoid unnecessary repeating commands on the port
      if (address.equals(lastCommand) && cmd == null)
         return lastStatus;
      
      // Use masking technique to target command to a particular socket
      int stat = 0;
      if (address.startsWith("M")) {
         StringBuilder str = new StringBuilder(address.substring(0, 3));
         int i = Integer.parseInt(address.substring(3, 5), 16);
         
         if (lastStatus != null) stat = Integer.parseInt(lastStatus, 2);
         if ("on".equals(cmd)) 
            stat |= i;
         else
            stat &= ~i;
  
         str.append(String.format("%02d", stat)).append("FF");
         address = str.toString();
         logger.debug("cmd is: {0} stat: {1}, port: {2}", address, stat, i);
      }
      
      if (port == null) {
         port = new SerialPort(portName);
      }
      port.openPort();
      port.setParams(9600, SerialPort.DATABITS_8, SerialPort.STOPBITS_1, SerialPort.PARITY_NONE);

      long start = System.currentTimeMillis();

      // Repeat command once
      String string = null;
      for (int i = 0; i < 3; i++) {
         port.writeString(address);
         string = port.readString(160);
         System.out.println("trial: " + i + " " + string);
         logger.debug("trial [{0}]: {1}", i, string);
         if (string.contains("ACK RECEIVED") || string.contains("RELAY")
               && !(string.contains("NO RESPONSE") || string.contains("NOT VALID")))
            break;
      }
      System.out.println("Time taken: " + (System.currentTimeMillis() - start));

      if (string.contains("ACK RECEIVED")) {
         String str = Integer.toBinaryString(stat);
         lastStatus = "0000".substring(str.length()) + str;
      } else 
      {
         lastStatus = SerialCommand.parseResponse(string);
      }
      lastCommand = address;
      
      port.closePort();
      return lastStatus;
   }

   /**
    * New Protocol. mi, mr, mt
    * @param address
    * @param cmd
    * @return
    */
   public synchronized String send(String address, String cmd) {
      // Avoid unnecessary repeating commands on the port
      if (address.equals(lastCommand) && cmd == null) return lastStatus;

      byte[] request = null;
      if (cmd == null) {
         request = mr;
      } else {
         byte stat = 0;
         if ("on".equals(cmd)) stat = (byte) 0xFF;
         else if ("off".equals(cmd)) stat = (byte) 0x00;
         mt_allon[4] = DatatypeConverter.parseHexBinary(address)[0];
         mt_allon[5] = stat;
         request = mt_allon;
      }

      if (port == null) {
         port = new SerialPort(portName);
      }
      try {
         port.openPort();
         port.setParams(9600, SerialPort.DATABITS_8, SerialPort.STOPBITS_1, SerialPort.PARITY_NONE);

         long start = System.currentTimeMillis();

         // Try command thrice
         byte[] buffer = null;
         logger.debug("Command: {0}", Arrays.toString(request));
         for (int i = 0; i < 3; i++) {
            port.writeBytes(request);

            buffer = port.readBytes(1);
            System.out.println(Arrays.toString(buffer));
            if (buffer[0] == ack) {
               buffer = port.readBytes(6, 3000);
               String str = Integer.toBinaryString(buffer[5]);
               if (str.length() < 4)
                  lastStatus = "0000".substring(str.length()) + str;
               else
                  lastStatus = str.substring(0, 4);
               lastCommand = address;

               break;
            }
         }
         System.out.println("Time taken: " + (System.currentTimeMillis() - start));
      } catch (SerialPortException e) {
         e.printStackTrace();
      } catch (SerialPortTimeoutException e) {
         e.printStackTrace();
      } finally {

         try {
            port.closePort();
         } catch (SerialPortException e) {
            e.printStackTrace();
         }
      }
      return lastStatus;
   }
   /**
    * @param portName the portName to set
    */
   public void setPortName(String portName) {
      this.portName = portName;
   }
}
