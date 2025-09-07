import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import styles from "../styles/videoComponent.module.css";
import IconButton from "@mui/material/IconButton";
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from '@mui/icons-material/Chat'
import Badge from "@mui/material/Badge";
import server from "../environment";

const server_url = server;
let connections = {};

const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoMeetComponent() {
  const socketRef = useRef();
  const socketIdRef = useRef();
  const localVideoRef = useRef();
  const chatEndRef = useRef(null);

  // States
  const [screen, setScreen] = useState(false);
  const [screenAvailable, setScreenAvailable] = useState(true);
  const [audio, setAudio] = useState(true);
  const [videoAvailable, setVideoAvailable] = useState(true);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [newMessages, setNewMessages] = useState(0);
  const [showModal, setModal] = useState(true);

  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");
  const [videos, setVideos] = useState([]); // all remote streams

  // Ask permissions
  const getPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      window.localStream = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.log("Permission error:", err);
    }
  };

  useEffect(() => {
    getPermission();
  }, []);

  // Handle signals
  const gotMessageFromServer = (fromId, message) => {
    const signal = JSON.parse(message);

    if (fromId !== socketIdRef.current) {
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            if (signal.sdp.type === "offer") {
              connections[fromId]
                .createAnswer()
                .then((description) => {
                  connections[fromId].setLocalDescription(description).then(() => {
                    socketRef.current.emit(
                      "signal",
                      fromId,
                      JSON.stringify({ sdp: connections[fromId].localDescription })
                    );
                  });
                })
                .catch((e) => console.log(e));
            }
          });
      }

      if (signal.ice) {
        connections[fromId]
          .addIceCandidate(new RTCIceCandidate(signal.ice))
          .catch((e) => console.log(e));
      }
    }
  };

  // Add chat message
  let addMessage = (data, sender, socketIdSender) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { sender, data }
    ]);

    if (socketIdSender !== socketIdRef.current) {
      setNewMessages((prev) => prev + 1);
    }
  };

  // Setup socket
  const connectToSocketServer = () => {
    socketRef.current = io(server_url, { secure: false });

    socketRef.current.on("signal", gotMessageFromServer);

    socketRef.current.on("connect", () => {
      socketRef.current.emit("join-call", "room1");
      socketIdRef.current = socketRef.current.id;

      socketRef.current.on("user-left", (id) => {
        setVideos((videos) => videos.filter((video) => video.socketId !== id));
        delete connections[id];
      });

      socketRef.current.on("user-joined", (id, clients) => {
        console.log("👥 user-joined", id, clients);

        clients.forEach((socketListId) => {
          if (connections[socketListId]) return;

          connections[socketListId] = new RTCPeerConnection(peerConfigConnections);

          // Handle ICE
          connections[socketListId].onicecandidate = (event) => {
            if (event.candidate) {
              socketRef.current.emit(
                "signal",
                socketListId,
                JSON.stringify({ ice: event.candidate })
              );
            }
          };

          // Handle remote tracks
          connections[socketListId].ontrack = (event) => {
            console.log("✅ Remote track received from", socketListId);

            setVideos((prev) => {
              const exists = prev.find((v) => v.socketId === socketListId);
              if (exists) {
                return prev.map((v) =>
                  v.socketId === socketListId ? { ...v, stream: event.streams[0] } : v
                );
              } else {
                return [
                  ...prev,
                  {
                    socketId: socketListId,
                    stream: event.streams[0],
                    autoPlay: true,
                    playsinline: true,
                  },
                ];
              }
            });
          };

          // Add local stream
          if (window.localStream) {
            window.localStream.getTracks().forEach((track) => {
              connections[socketListId].addTrack(track, window.localStream);
            });
          }
        });

        // If I'm the new user, send offers
        if (id === socketIdRef.current) {
          for (let id2 in connections) {
            if (id2 === socketIdRef.current) continue;

            connections[id2]
              .createOffer()
              .then((description) => {
                connections[id2].setLocalDescription(description).then(() => {
                  socketRef.current.emit(
                    "signal",
                    id2,
                    JSON.stringify({ sdp: connections[id2].localDescription })
                  );
                });
              })
              .catch((e) => console.log(e));
          }
        }
      });

      // ✅ Chat listener
      socketRef.current.on("chat-message", (data, sender, socketIdSender) => {
        addMessage(data, sender, socketIdSender);
      });
    });
  };

  let routeTo = useNavigate();

  const connect = () => {
    setAskForUsername(false);
    connectToSocketServer();
  };

  // Added additionally
  useEffect(() => {
    if (!askForUsername && localVideoRef.current && window.localStream) {
      localVideoRef.current.srcObject = window.localStream;
    }
  }, [askForUsername]);

  // Auto scroll chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  let handleVideo = () => {
    setVideoAvailable((prev) => {
      if (window.localStream) {
        window.localStream.getVideoTracks().forEach(track => {
          track.enabled = !prev;
        });
      }
      return !prev;
    });
  };

  let handleAudio = () => {
    setAudio(!audio);
    if (window.localStream) {
      window.localStream.getAudioTracks().forEach(track => {
        track.enabled = !audio;
      });
    }
  };

  // Helper to replace video tracks in all peer connections
  const replaceVideoTrack = (newTrack) => {
    for (let id in connections) {
      const sender = connections[id]
        .getSenders()
        .find((s) => s.track && s.track.kind === "video");
      if (sender) {
        sender.replaceTrack(newTrack);
      }
    }
  };

  const getDisplayMedia = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      window.localStream.getVideoTracks().forEach((track) => track.stop());
      const newStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...window.localStream.getAudioTracks(),
      ]);
      window.localStream = newStream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = window.localStream;
      }
      const screenTrack = screenStream.getVideoTracks()[0];
      replaceVideoTrack(screenTrack);
      screenTrack.onended = () => {
        setScreen(false);
        restoreCameraStream();
      };
    } catch (e) {
      console.log("Screen share error:", e);
      setScreen(false);
    }
  };

  const restoreCameraStream = async () => {
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      window.localStream = cameraStream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = window.localStream;
      }
      const cameraTrack = cameraStream.getVideoTracks()[0];
      replaceVideoTrack(cameraTrack);
    } catch (e) {
      console.log("Restore camera error:", e);
    }
  };

  let handleScreen = () => {
    if (!screen) {
      setScreen(true);
      getDisplayMedia();
    } else {
      setScreen(false);
      restoreCameraStream();
    }
  };

  let sendMessage = () => {
    if (message.trim() !== "") {
      socketRef.current.emit("chat-message", message, username);
      setMessage("");
    }
  };

  let handleEndCall = () => {
    try {
      let tracks = localVideoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop())
    } catch(e) {}

    routeTo("/home")

  }

  return (
    <div>
      {askForUsername ? (
        <div>
          <h2>Enter into lobby</h2>
          <TextField
            id="outlined-basic"
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            variant="outlined"
          />
          <Button variant="contained" onClick={connect}>
            Connect
          </Button>
          <div>
            <video ref={localVideoRef} autoPlay muted playsInline></video>
          </div>
        </div>
      ) : (
        <div className={styles.meetVideoContainer}>
          {showModal ? (
            <div className={styles.chatRoom}>
              <div className={styles.chatContainer}>
                <h1>Chat</h1>
                <div className={styles.chattingDisplay}>
                  { messages.length > 0 ?  messages.map((item, index) => (
                    <div style={{marginBottom : "10px"}} key={index}>
                      <p style={{ fontWeight: "bold" }}>{item.sender}</p>
                      <p>{item.data}</p>
                    </div>
                  )) : <p>No Messages Till Now</p> }
                  <div ref={chatEndRef}></div>
                </div>
                <div className={styles.chattingArea}>
                  <TextField
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    id="outlined-basic"
                    label="Enter Your Chat"
                    variant="outlined"
                  />
                  <Button variant="contained" onClick={sendMessage}>Send</Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className={styles.buttonContainers}>
            <IconButton onClick={handleVideo} style={{ color: "white" }}>
              {videoAvailable ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>
            <IconButton onClick={handleEndCall} style={{ color: "red" }}>
              <CallEndIcon />
            </IconButton>
            <IconButton onClick={handleAudio} style={{ color: "white" }}>
              {audio ? <MicIcon /> : <MicOffIcon />}
            </IconButton>
            {screenAvailable ? (
              <IconButton onClick={handleScreen} style={{ color: "white" }}>
                {screen ? <ScreenShareIcon /> : <StopScreenShareIcon />}
              </IconButton>
            ) : null}
            <Badge badgeContent={newMessages} max={999} color="secondary">
              <IconButton onClick={() => { setModal(!showModal); setNewMessages(0); }} style={{ color: "white" }}>
                <ChatIcon />
              </IconButton>
            </Badge>
          </div>

          {/* Local video */}
          <div className={styles.conferenceView} key="local">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={styles.meetUserVideo}
            ></video>
          </div>

          {/* Remote videos */}
          <div className={styles.conferenceView}>
            {videos.map((video) => (
              <div key={video.socketId}>
                <video
                  ref={(ref) => {
                    if (ref && video.stream) {
                      ref.srcObject = video.stream;
                    }
                  }}
                  autoPlay
                  playsInline
                ></video>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
