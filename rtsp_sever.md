# *Gstreamer RTSP server
## Thiết lập server

### Nhận dữ liệu audio opus từ cổng 40001 
Server chỉ có chức năng chuyển tiếp dữ liệu
```bash
./test-launch "( udpsrc port=40001 caps=\"application/x-rtp,media=audio,encoding-name=OPUS,payload=96\" ! rtpopusdepay ! rtpopuspay name=pay0 pt=96 )"
```
## Producer
### Phát audio từ 1 file 
- Lệnh FFmpeg
```bash
ffmpeg -re -i /home/lamhung/Downloads/dung_lam_trai_tim_anh_dau.mp3 -acodec libopus -b:a 32k -vbr on -ar 48000 -ac 2 -payload_type 96 -f rtp "rtp://{server_ip}:{port}"
```  

- Lệnh GStreamer
```bash
gst-launch-1.0 filesrc location=/home/lamhung/Downloads/di_giua_troi_ruc_ro.mp3 ! decodebin ! audioconvert ! audioresample ! audio/x-raw,format=S16LE,rate=48000,channels=2 ! opusenc bitrate=32000 bitrate-type=vbr complexity=6 frame-size=20 bandwidth=wideband dtx=true ! rtpopuspay ! udpsink host={server_ip} port={server_port}

```

### Phát audio từ MIC
- Lệnh FFmpeg
```bash
ffmpeg -re -f alsa -i hw:0,0 -acodec libopus -b:a 32k -vbr on -ar 48000 -ac 2 -payload_type 96 -f rtp "rtp://{server_ip}:{port}"
```
- Lệnh GStreamer
```bash
gst-launch-1.0 alsasrc ! audioconvert ! audioresample ! audio/x-raw,format=S16LE,rate=48000,channels=2 ! opusenc bitrate=32000 bitrate-type=vbr complexity=6 frame-size=20 bandwidth=wideband dtx=true ! rtpopuspay ! udpsink host={server_ip} port={server_port}
```

## Consumer
### Lệnh FFmpeg (sử dụng 1 trong 2, lệnh chưa tối ưu cho thiết bị IoT) 
```bash
ffmpeg -i rtsp://{server_ip}:{port}/test -f alsa default
```

```bash
ffmpeg -i rtsp://{server_ip}:{port}/test -f wav - | aplay
```

### Lệnh GStreamer ( lệnh đã tối ưu cho thiết bị IoT nhưng trễ khoảng 1.2s)
```bash
gst-launch-1.0 rtspsrc location=rtsp://{server_ip}:{port}/test latency=700 ! queue max-size-buffers=100 max-size-time=0 ! application/x-rtp,media=audio,encoding-name=OPUS ! queue max-size-buffers=100 max-size-time=0 ! rtpopusdepay ! queue max-size-buffers=100 max-size-time=0 ! opusdec ! queue max-size-buffers=100 max-size-time=0 ! autoaudiosink
```  
# *Mediasoup server
## Producer
### Phát audio từ 1 file 
- Lệnh FFmpeg ( tùy chọn gửi rtcp hoặc không )
```bash
ffmpeg -re -i /home/lamhung/Downloads/dung_lam_trai_tim_anh_dau.mp3 -acodec libopus -b:a 32k -vbr on -ar 48000 -ac 2 -payload_type 96 -ssrc {ssrc của producer} -f rtp "rtp://{server_ip}:{rtp_port}?rtcpport={rtcp_port}&localrtpport={rtp_port máy local}&localrtcpport={rtcp_port_máy_local}"
```  

- Lệnh GStreamer
```bash
gst-launch-1.0 filesrc location=/home/lamhung/Downloads/di_giua_troi_ruc_ro.mp3 ! decodebin ! audioconvert ! audioresample ! audio/x-raw,format=S16LE,rate=48000,channels=2 ! opusenc bitrate=32000 bitrate-type=vbr complexity=6 frame-size=20 bandwidth=wideband dtx=true ! rtpopuspay ssrc={ssrc của producer} ! udpsink host={server_ip} port={server_port}
```

### Phát audio từ MIC
- Lệnh FFmpeg
```bash
ffmpeg -re -f alsa -i hw:0,0 -acodec libopus -b:a 32k -vbr on -ar 48000 -ac 2 -payload_type 96 -ssrc {ssrc của producer} -f rtp "rtp://{server_ip}:{rtp_port}?rtcpport={rtcp_port}&localrtpport={rtp_port máy local}&localrtcpport={rtcp_port_máy_local}"
```
- Lệnh GStreamer
```bash
gst-launch-1.0 alsasrc ! audioconvert ! audioresample ! audio/x-raw,format=S16LE,rate=48000,channels=2 ! opusenc bitrate=32000 bitrate-type=vbr complexity=6 frame-size=20 bandwidth=wideband dtx=true ! rtpopuspay ssrc={ssrc của producer} ! udpsink host={server_ip} port={server_port}
```

## Consumer
Trước khi nhận audio từ mediasoup server thì ta cần phải gửi một chút audio để server xác định địa chỉ ip và cổng của client trong cùng mạng VPN hoặc mạng LAN
### Lệnh FFmpeg 
- Gửi audio nhỏ tới server
```bash
ffmpeg -f lavfi -i "sine=frequency=440" -t 0.1 -acodec libopus -b:a 32k -vbr on -ar 48000 -ac 2 -payload_type 96 -f rtp "rtp://{server_ip}:{rtp_port}?rtcpport={rtcp_port}&localrtpport={rtp_port_máy_local}&localrtcpport={rtcp_port_máy_local}"
```
- Tạo file consumer.sdp với nội dung
```text
v=0
o=- 0 0 IN IP4 127.0.0.1
s=AudioStream
c=IN IP4 127.0.0.1
t=0 0
m=audio {port_nhận_audio_từ_server} RTP/AVP 96
a=rtpmap:96 opus/48000/2
a=fmtp:96 minptime=10
```
port_nhận_audio_từ_server tương ứng với {rtp_port máy local} khi gửi audio nhở tới server
- Nhận audio từ Mediasoup server
```bash
ffplay -protocol_whitelist file,udp,rtp -i consumer.sdp
```

### Lệnh GStreamer
- Gửi audio nhỏ tới server
```bash
gst-launch-1.0 -v audiotestsrc freq=440 num-buffers=5 wave=sine ! audioconvert ! audioresample ! opusenc bitrate=32000 ! rtpopuspay pt=96 ! udpsink host={server_ip}port={server_port} bind-address=127.0.0.1 bind-port={rtp_port_máy_local} sync=false
```
- Nhận audio từ Mediasoup server
```bash
gst-launch-1.0 -v udpsrc port={rtp_port_máy_local} ! application/x-rtp,media=audio,encoding-name=OPUS,payload=96 ! queue max-size-buffers=100 max-size-time=0 ! rtpopusdepay ! queue max-size-buffers=100 max-size-time=0 ! opusdec ! queue max-size-buffers=100 max-size-time=0 ! autoaudiosink
```  
{rtp_port_máy_local} phải giống nhau khi gửi audio nhỏ tới server cũng như khi gửi lên

