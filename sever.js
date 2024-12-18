import express from 'express';
import https from 'httpolyglot';
import fs from 'fs';
import mediasoup from 'mediasoup';

const app = express();
const options = {
  key: fs.readFileSync('./server/ssl/key.pem', 'utf-8'),
  cert: fs.readFileSync('./server/ssl/cert.pem', 'utf-8'),
};

const httpsServer = https.createServer(options, app);
httpsServer.listen(9000, () => {
  console.log('Server is listening on port: 9000');
});

let worker, router, producerTransport, audioProducer, consumerTransport, consumerTransport2;
let audioConsumers = [];  // Mảng lưu trữ các consumer

const device_ip = '192.168.21.30'; // Thay đổi thành IP của máy chủ bạn

(async () => {
  try {
    worker = await mediasoup.createWorker({
      logLevel: 'error',
      logTags: ['rtp', 'srtp', 'rtcp'],
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
    });
    console.log('Mediasoup worker created');

    router = await worker.createRouter({
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          preferredPayloadType: 111,
          channels: 2,
        },
      ],
    });
    console.log('Mediasoup router created');

    producerTransport = await router.createPlainTransport({
      listenInfo: {
        protocol: "udp",
        ip: "0.0.0.0",
        announcedAddress: device_ip,
        port: 40001
      },
      rtcpListenInfo: {
        protocol: "udp",
        ip: "0.0.0.0",
        announcedAddress: device_ip,
        port: 40002
      },
      rtcpMux: false,
      comedia: true,
    });

    consumerTransport = await router.createPlainTransport({
      listenInfo: {
        protocol: "udp",
        ip: "0.0.0.0",
        announcedAddress: device_ip,
        port: 40003
      },
      rtcpListenInfo: {
        protocol: "udp",
        ip: "0.0.0.0",
        announcedAddress: device_ip,
        port: 40004
      },
      rtcpMux: false,
      comedia: false,
    });

    consumerTransport2 = await router.createPlainTransport({
      listenInfo: {
        protocol: "udp",
        ip: "0.0.0.0",
        announcedAddress: device_ip,
        port: 40005
      },
      rtcpListenInfo: {
        protocol: "udp",
        ip: "0.0.0.0",
        announcedAddress: device_ip,
        port: 40006
      },
      rtcpMux: false,
      comedia: false,
    });

    const producer = await producerTransport.produce({
      kind: 'audio',
      rtpParameters: {
        codecs: [
          {
            mimeType: 'audio/opus',
            clockRate: 48000,
            payloadType: 101,
            channels: 2,
          },
        ],
        encodings: [{ ssrc: 12345678 }],
      },
    });

    audioProducer = producer;
    console.log('Audio producer created successfully');
    console.log('Producer id:', producer.id);
    console.log('Producer :', producer.rtpParameters);

    // Tạo Consumer sau khi Producer được tạo
    await createConsumer(consumerTransport, audioProducer, 1);
    await createConsumer(consumerTransport2, audioProducer, 2);
  } catch (err) {
    console.error('Error during setup:', err);
  }
})();

// Tạo Consumer
async function createConsumer(transport, producer, stt) {
  try {
    const consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities: router.rtpCapabilities,
    });

    audioConsumers.push(consumer);  // Lưu trữ mỗi consumer vào mảng
    console.log('Audio consumer created:', stt, {
      id: consumer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    });

    // Kiểm tra kết nối và xác nhận dữ liệu đã bắt đầu được nhận
    setInterval(async () => {
      const stats = await consumer.getStats();
      console.log('Audio Consumer Stats:', stt, stats);
    }, 5000);
  } catch (err) {
    console.error('Error creating consumer:', err);
  }
}
