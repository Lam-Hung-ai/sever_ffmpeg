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

let worker, router, producerTransport, consumerTransport, audioProducer, audioConsumer;

const device_ip = '192.168.1.30'; // Thay đổi thành IP của máy chủ bạn

(async () => {
  // Tạo Worker
  worker = await mediasoup.createWorker({
    logLevel: 'error',
    logTags: ['rtp', 'srtp', 'rtcp'],
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
  });
  console.log('Mediasoup worker created');

  // Tạo Router
  router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        preferredPayloadType: 111,
        clockRate: 48000,
        channels: 2,
      },
    ],
  });
  console.log('Mediasoup router created');

  // Tạo Producer Transport
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
  console.log('Producer PlainTransport created:', producerTransport.tuple);

  // Tạo Consumer Transport
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
    comedia: true,
  });
  // consumerTransport.connect({
  //   ip: "192.168.1.21",
  //   port: 10003,
  //   rtcpPort: 10004,
  // })
  // Lắng nghe thông tin từ Consumer Transport
  consumerTransport.on('tuple', (tuple) => {
    console.log('Consumer Transport tuple*************:', tuple);
  });

  // Tạo Producer
  producerTransport.produce({
    kind: 'audio',
    rtpParameters: {
      codecs: [
        {
          mimeType: 'audio/opus',
          clockRate: 48000,
          payloadType: 96,
          channels: 2,
        },
      ],
      encodings: [{ ssrc: 12345678 }],
    },
  })
    .then((producer) => {
      audioProducer = producer;
      console.log('Audio producer created successfully');
      console.log('Producer id:', producer.id);
      // Tạo Consumer sau khi Producer được tạo
      createConsumer(consumerTransport, audioProducer);
    })
    .catch((err) => {
      console.error('Error creating audio producer:', err);
    });
})();

// Tạo Consumer
async function createConsumer(transport, producer) {
  try {
    console.log("Producer SSRC:", producer.rtpParameters.encodings[0].ssrc);
    audioConsumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities: router.rtpCapabilities,
      paused: false,
    });

    console.log('Audio consumer created:', {
      id: audioConsumer.id,
      kind: audioConsumer.kind,
      rtpParameters: audioConsumer.rtpParameters,
    });

    // Kiểm tra SSRC của consumer
    console.log("Consumer SSRC:", audioConsumer.rtpParameters.encodings[0].ssrc);

    // Kiểm tra kết nối và xác nhận dữ liệu đã bắt đầu được nhận
    setInterval(async () => {
      const stats = await audioConsumer.getStats();
      console.log('Audio Consumer Stats:', stats);
      console.log('Consumer PlainTransport created:', consumerTransport.tuple);
    }, 5000);

    // Tạo SDP content
    const sdpContent = `
v=0
o=- 0 0 IN IP4 ${device_ip}  # Địa chỉ IP của bạn
s=AudioStream
c=IN IP4 ${device_ip}
t=0 0
m=audio ${consumerTransport.tuple.localPort} RTP/AVP 96  # Cổng RTP và payload type
a=rtpmap:96 opus/48000/2  # Codec opus, sample rate 48kHz, stereo
a=fmtp:96 minptime=10  # Tham số cho opus (tùy chọn)
a=ssrc:${audioConsumer.rtpParameters.encodings[0].ssrc}  # SSRC của consumer
    `;
    
    fs.writeFileSync('consumer.sdp', sdpContent);
    console.log('SDP file created successfully');
  } catch (err) {
    console.error('Error creating consumer:', err);
  }
}