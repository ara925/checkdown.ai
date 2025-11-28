import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type CallType = 'audio' | 'video';
type CallState = 'idle' | 'calling' | 'incoming' | 'connected' | 'reconnecting';

interface CallContextType {
  callState: CallState;
  callType: CallType;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  participants: any[]; // For future expansion
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  activeRoomKey: string | null;
  startCall: (roomKey: string, type: CallType, participantId: number) => Promise<void>;
  joinCall: (roomKey: string, type: CallType) => Promise<void>;
  endCall: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  shareScreen: () => Promise<void>;
  stopScreenShare: () => void;
  incomingCall: { caller: any; roomKey: string; type: CallType } | null;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  raiseHand: () => void;
  lowerHand: () => void;
  handRaised: boolean;
  devices: MediaDeviceInfo[];
  selectedAudioInput: string;
  selectedVideoInput: string;
  selectedAudioOutput: string;
  setAudioInput: (deviceId: string) => void;
  setVideoInput: (deviceId: string) => void;
  setAudioOutput: (deviceId: string) => void;
  connectionQuality: 'good' | 'poor' | 'bad' | 'unknown';
  isCaptionsEnabled: boolean;
  toggleCaptions: () => void;
  transcript: string;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callType, setCallType] = useState<CallType>('audio');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [activeRoomKey, setActiveRoomKey] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{ caller: any; roomKey: string; type: CallType } | null>(null);
  const [handRaised, setHandRaised] = useState(false);
  
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('');

  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'bad' | 'unknown'>('unknown');
  const [isCaptionsEnabled, setIsCaptionsEnabled] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [remoteParticipantId, setRemoteParticipantId] = useState<number | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  // Monitor Connection Quality
  useEffect(() => {
    if (callState !== 'connected') return;
    
    const interval = setInterval(async () => {
        if (!pcRef.current) return;
        
        // Simple heuristic based on connection state and potentially stats if available
        // Getting full stats is complex, but we can check connectionState/iceConnectionState
        const state = pcRef.current.iceConnectionState;
        if (state === 'connected' || state === 'completed') {
            // Ideally check packet loss or RTT here
            setConnectionQuality('good');
        } else if (state === 'checking') {
            setConnectionQuality('unknown');
        } else {
            setConnectionQuality('poor');
        }
    }, 2000);
    return () => clearInterval(interval);
  }, [callState]);

  // Live Captions (Web Speech API)
  useEffect(() => {
      if (isCaptionsEnabled && 'webkitSpeechRecognition' in window) {
          const SpeechRecognition = (window as any).webkitSpeechRecognition;
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
              let finalTranscript = '';
              for (let i = event.resultIndex; i < event.results.length; ++i) {
                  if (event.results[i].isFinal) {
                      finalTranscript += event.results[i][0].transcript;
                  } else {
                      // interim
                  }
              }
              if (finalTranscript) {
                setTranscript(prev => {
                    const newText = prev + ' ' + finalTranscript;
                    // Keep only last few lines
                    return newText.slice(-200);
                });
              }
          };

          recognition.onerror = (event: any) => {
              console.error("Speech recognition error", event.error);
          };

          recognition.start();
          recognitionRef.current = recognition;
      } else {
          if (recognitionRef.current) {
              recognitionRef.current.stop();
              recognitionRef.current = null;
          }
      }
      return () => {
          if (recognitionRef.current) {
            recognitionRef.current.stop();
          }
      };
  }, [isCaptionsEnabled]);

  const toggleCaptions = () => setIsCaptionsEnabled(prev => !prev);

  // Enumerate devices
  useEffect(() => {
    const enumerate = async () => {
        try {
            // Request permission first to get labels? 
            // Actually, enumerateDevices returns empty labels if permission not granted. 
            // We'll handle permission in startCall/getMediaStream usually, but we can try to list what we can.
            const devs = await navigator.mediaDevices.enumerateDevices();
            setDevices(devs);
            
            // Set defaults if not set
            if (!selectedAudioInput) {
                const audioIn = devs.find(d => d.kind === 'audioinput' && d.deviceId !== 'default');
                if (audioIn) setSelectedAudioInput(audioIn.deviceId);
            }
            if (!selectedVideoInput) {
                const videoIn = devs.find(d => d.kind === 'videoinput' && d.deviceId !== 'default');
                if (videoIn) setSelectedVideoInput(videoIn.deviceId);
            }
            if (!selectedAudioOutput) {
                const audioOut = devs.find(d => d.kind === 'audiooutput' && d.deviceId !== 'default');
                if (audioOut) setSelectedAudioOutput(audioOut.deviceId);
            }
        } catch (e) {
            console.error("Error enumerating devices", e);
        }
    };
    enumerate();
    navigator.mediaDevices.addEventListener('devicechange', enumerate);
    return () => navigator.mediaDevices.removeEventListener('devicechange', enumerate);
  }, [selectedAudioInput, selectedVideoInput, selectedAudioOutput]);

  // Use ref to track callState without re-creating channel subscription
  const callStateRef = useRef(callState);
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // Listen for incoming calls - only create subscription once
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) return;
    
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    try {
      const user = JSON.parse(userData);
      console.log('[CallContext] Setting up incoming call listener for user:', user.id);
      
      channel = supabase.channel(`user_call_signaling:${user.id}`);
      
      channel.on('broadcast', { event: 'incoming_call' }, ({ payload }) => {
        console.log('[CallContext] Received incoming_call event:', payload);
        console.log('[CallContext] Current callState:', callStateRef.current);
        
        // Use ref to check current state to avoid stale closure
        if (callStateRef.current === 'idle') {
          console.log('[CallContext] Setting incoming call state');
          setIncomingCall(payload);
          setCallState('incoming');
        } else {
          console.log('[CallContext] Ignoring incoming call - not idle');
        }
      });
      
      channel.subscribe((status) => {
        console.log('[CallContext] User signaling channel status:', status);
      });
      
    } catch (e) {
      console.error("[CallContext] Error setting up incoming call listener:", e);
    }
    
    return () => {
      if (channel) {
        console.log('[CallContext] Cleaning up incoming call listener');
        supabase.removeChannel(channel);
      }
    };
  }, []); // Empty dependency - only run once

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupCall();
    };
  }, []);

  const cleanupCall = () => {
    console.log('[CallContext] Cleaning up call');
    try {
      pcRef.current?.getSenders().forEach(s => {
        try { s.track?.stop(); } catch {}
      });
      localStream?.getTracks().forEach(t => { try { t.stop(); } catch {} });
      pcRef.current?.close();
      channelRef.current?.unsubscribe();
    } catch {}
    
    pcRef.current = null;
    channelRef.current = null;
    remoteStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setCallState('idle');
    setActiveRoomKey(null);
    setIsScreenSharing(false);
    setIsMuted(false);
    setIsVideoOff(false);
    setHandRaised(false);
    setIncomingCall(null);
    setRemoteParticipantId(null);
  };

  // Ref to hold remote stream for building from tracks
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const createPeerConnection = (roomKey: string) => {
    console.log('[CallContext] Creating peer connection for room:', roomKey);
    
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302'] },
        { urls: ['stun:stun1.l.google.com:19302'] },
        { urls: ['stun:stun2.l.google.com:19302'] }
      ]
    });

    peer.onicecandidate = (e) => {
      if (e.candidate && channelRef.current) {
        console.log('[CallContext] Sending ICE candidate');
        channelRef.current.send({ type: 'broadcast', event: 'ice', payload: { candidate: e.candidate } });
      }
    };

    peer.oniceconnectionstatechange = () => {
      console.log('[CallContext] ICE connection state:', peer.iceConnectionState);
    };

    peer.onnegotiationneeded = () => {
      console.log('[CallContext] Negotiation needed');
    };

    // Handle remote tracks - this is CRITICAL for audio/video
    peer.ontrack = (ev) => {
      console.log('[CallContext] ontrack fired!', {
        kind: ev.track.kind,
        trackId: ev.track.id,
        streamsCount: ev.streams?.length,
        trackEnabled: ev.track.enabled,
        trackReadyState: ev.track.readyState
      });

      // Create or reuse remote stream
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }

      // Add the track to our remote stream
      const existingTrack = remoteStreamRef.current.getTracks().find(t => t.id === ev.track.id);
      if (!existingTrack) {
        console.log('[CallContext] Adding track to remote stream:', ev.track.kind);
        remoteStreamRef.current.addTrack(ev.track);
      }

      // Also use the stream from the event if available (preferred)
      const inbound = ev.streams?.[0];
      if (inbound) {
        console.log('[CallContext] Using stream from event, tracks:', inbound.getTracks().map(t => t.kind));
        setRemoteStream(inbound);
      } else {
        // Fallback: use our manually constructed stream
        console.log('[CallContext] Using manually constructed stream');
        setRemoteStream(remoteStreamRef.current);
      }
    };

    peer.onconnectionstatechange = () => {
      console.log('[CallContext] Connection state:', peer.connectionState);
      if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
        toast({ title: 'Call Disconnected', description: 'Connection lost', variant: 'destructive' });
        endCall();
      } else if (peer.connectionState === 'connected') {
        console.log('[CallContext] Peer connection established!');
        setCallState('connected');
      }
    };

    pcRef.current = peer;
    return peer;
  };

  const setupSignaling = (roomKey: string, isInitiator: boolean, stream?: MediaStream | null) => {
    if (channelRef.current) channelRef.current.unsubscribe();

    const channel = supabase.channel(roomKey, { config: { broadcast: { self: false } } });
    
    channel.on('broadcast', { event: 'offer' }, async ({ payload }) => {
      if (isInitiator) return; // Initiator ignores offers
      console.log('[CallContext] Received offer');
      try {
        const peer = pcRef.current || createPeerConnection(roomKey);
        await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        channel.send({ type: 'broadcast', event: 'answer', payload: { sdp: answer } });
        setCallState('connected');
      } catch (e) {
        console.error("Error handling offer:", e);
      }
    });

    channel.on('broadcast', { event: 'answer' }, async ({ payload }) => {
      console.log('[CallContext] Received answer');
      try {
        const peer = pcRef.current;
        if (peer && peer.signalingState !== 'stable') {
          await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          setCallState('connected');
        }
      } catch (e) {
        console.error("Error handling answer:", e);
      }
    });

    channel.on('broadcast', { event: 'ice' }, async ({ payload }) => {
      try {
        const peer = pcRef.current;
        if (peer) {
          await peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      } catch (e) {
        console.error("Error adding ice candidate:", e);
      }
    });

    channel.on('broadcast', { event: 'hangup' }, () => {
      toast({ title: 'Call Ended', description: 'The other participant ended the call.' });
      endCall();
    });

    channel.on('broadcast', { event: 'join' }, async () => {
      console.log('[CallContext] Received join event, isInitiator:', isInitiator);
      // Resend offer if we are the initiator
      if (isInitiator && pcRef.current) {
        try {
          console.log('[CallContext] Resending offer to joiner');
          // Include constraints to receive audio and video
          const offer = await pcRef.current.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          await pcRef.current.setLocalDescription(offer);
          channel.send({ type: 'broadcast', event: 'offer', payload: { sdp: offer } });
        } catch (e) {
          console.error("Error resending offer:", e);
        }
      }
    });

    channel.subscribe(async (status) => {
      console.log('[CallContext] Channel subscription status:', status, 'isInitiator:', isInitiator);
      if (status === 'SUBSCRIBED' && isInitiator) {
        // If initiator, create offer once subscribed
        try {
          const peer = createPeerConnection(roomKey);
          // Use passed stream instead of state (state may not be updated yet)
          const mediaStream = stream || localStream;
          if (mediaStream) {
            console.log('[CallContext] Adding', mediaStream.getTracks().length, 'tracks to peer connection');
            mediaStream.getTracks().forEach(track => {
              console.log('[CallContext] Adding track:', track.kind, track.id);
              peer.addTrack(track, mediaStream);
            });
          } else {
            console.warn('[CallContext] No media stream available for peer connection');
          }
          // Include constraints to receive audio and video from the other party
          const offer = await peer.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          await peer.setLocalDescription(offer);
          console.log('[CallContext] Sending initial offer with SDP length:', offer.sdp?.length);
          channel.send({ type: 'broadcast', event: 'offer', payload: { sdp: offer } });
        } catch (e) {
          console.error("Error creating offer:", e);
        }
      }
    });

    channelRef.current = channel;
  };

  const switchDevice = async (kind: 'audio' | 'video', deviceId: string) => {
    if (!localStream) return;
    try {
        const constraints = kind === 'audio' 
          ? { audio: { deviceId: { exact: deviceId } }, video: false }
          : { audio: false, video: { deviceId: { exact: deviceId }, width: 1280, height: 720 } };
        
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        const newTrack = kind === 'audio' ? newStream.getAudioTracks()[0] : newStream.getVideoTracks()[0];

        const oldTrack = kind === 'audio' ? localStream.getAudioTracks()[0] : localStream.getVideoTracks()[0];
        if (oldTrack) {
            oldTrack.stop();
            localStream.removeTrack(oldTrack);
            localStream.addTrack(newTrack);
            
            if (pcRef.current) {
                const sender = pcRef.current.getSenders().find(s => s.track?.kind === kind);
                if (sender) {
                    sender.replaceTrack(newTrack);
                }
            }
        } else {
           // If track didn't exist, we don't add it automatically here to avoid accidental escalation.
           // Cleanup new track since we aren't using it
           newTrack.stop();
        }
    } catch (e) {
        console.error(`Error switching ${kind} device:`, e);
        toast({ title: "Device Switch Failed", description: "Could not switch device.", variant: "destructive" });
    }
  };

  const setAudioInput = (deviceId: string) => {
      setSelectedAudioInput(deviceId);
      if (callState === 'connected' || callState === 'calling') switchDevice('audio', deviceId);
  };
  const setVideoInput = (deviceId: string) => {
      setSelectedVideoInput(deviceId);
      if (callState === 'connected' || callState === 'calling') switchDevice('video', deviceId);
  };
  const setAudioOutput = (deviceId: string) => setSelectedAudioOutput(deviceId);

  const getMediaStream = async (type: CallType) => {
    try {
      const audioConstraints = selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : true;
      const videoConstraints = type === 'video' 
        ? (selectedVideoInput ? { deviceId: { exact: selectedVideoInput }, width: 1280, height: 720 } : { width: 1280, height: 720 }) 
        : false;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: videoConstraints
      });
      setLocalStream(stream);
      return stream;
    } catch (e: any) {
      console.error("Error accessing media devices:", e);
      toast({ title: 'Media Error', description: 'Could not access camera/microphone. Please check your settings.', variant: 'destructive' });
      throw e;
    }
  };


  const logCallToChat = async (receiverId: number, action: 'started' | 'ended' | 'missed', duration?: string) => {
    try {
      const userData = localStorage.getItem("user");
      if (!userData) return;
      const me = JSON.parse(userData);
      
      const id1 = Math.min(me.id, receiverId);
      const id2 = Math.max(me.id, receiverId);
      const matrixRoomId = `dm:${id1}-${id2}`;

      // Find thread
      const { data: thread } = await supabase
        .from('threads')
        .select('id')
        .eq('matrix_room_id', matrixRoomId)
        .maybeSingle();

      if (thread) {
        let text = '';
        if (action === 'started') text = `📞 Call started`;
        else if (action === 'ended') text = `📞 Call ended ${duration ? `(${duration})` : ''}`;
        else if (action === 'missed') text = `📞 Missed call`;

        await supabase.from('thread_messages').insert({
            thread_id: thread.id,
            user_id: me.id,
            text: text
        });
      }
    } catch (e) {
      console.error("Error logging call to chat:", e);
    }
  };

  const startCall = async (roomKey: string, type: CallType, participantId: number) => {
    cleanupCall();
    setActiveRoomKey(roomKey);
    setCallType(type);
    setCallState('calling');
    setRemoteParticipantId(participantId);
    
    console.log(`[CallContext] Starting call to ${participantId} in room ${roomKey}`);

    // Send signal to participant
    try {
        const userData = localStorage.getItem("user");
        if (userData) {
            const user = JSON.parse(userData);
            // Log call - use type assertion to handle potential type sync issues
            const { error: logError } = await (supabase.from('call_logs') as any).insert({
                initiator_id: user.id,
                receiver_id: participantId,
                room_key: roomKey,
                status: 'ongoing'
            });
            
            if (logError) console.error("[CallContext] Error creating call log:", logError);

            // Log to chat
            logCallToChat(participantId, 'started');

            console.log(`[CallContext] Signaling user_call_signaling:${participantId}`);
            const signalChannel = supabase.channel(`user_call_signaling:${participantId}`);
            signalChannel.subscribe(async (status) => {
                console.log(`[CallContext] Signal channel status for ${participantId}:`, status);
                if (status === 'SUBSCRIBED') {
                    await signalChannel.send({ 
                        type: 'broadcast', 
                        event: 'incoming_call', 
                        payload: { 
                            caller: user, 
                            roomKey, 
                            type 
                        } 
                    });
                    console.log(`[CallContext] Incoming call signal sent to ${participantId}`);
                    // Don't remove channel immediately, wait longer or keep it? 
                    // Better to keep it for a bit to ensure delivery, or just rely on the fact that 'send' is async?
                    // 'send' is not promised-based in v2 usually, but let's wait.
                    setTimeout(() => {
                        console.log(`[CallContext] Unsubscribing from signal channel ${participantId}`);
                        supabase.removeChannel(signalChannel);
                    }, 10000);
                }
            });
        }
    } catch (e) {
        console.error("Error logging call or signaling:", e);
    }

    try {
      const stream = await getMediaStream(type);
      setupSignaling(roomKey, true, stream); // Pass stream directly
    } catch (e) {
      console.error("[CallContext] Media stream error:", e);
      setCallState('idle');
    }
  };

  const acceptCall = async () => {
    if (incomingCall) {
        const callInfo = { ...incomingCall }; // Copy before clearing
        setRemoteParticipantId(callInfo.caller.id);
        setIncomingCall(null);
        await joinCall(callInfo.roomKey, callInfo.type);
    }
  };

  const rejectCall = () => {
      if (incomingCall) {
          logCallToChat(incomingCall.caller.id, 'missed');
      }
      setIncomingCall(null);
      setCallState('idle');
  };

  const raiseHand = () => {
      setHandRaised(true);
      channelRef.current?.send({ type: 'broadcast', event: 'raise_hand', payload: { raised: true } });
  };

  const lowerHand = () => {
      setHandRaised(false);
      channelRef.current?.send({ type: 'broadcast', event: 'raise_hand', payload: { raised: false } });
  };

  const joinCall = async (roomKey: string, type: CallType) => {
    cleanupCall();
    setActiveRoomKey(roomKey);
    setCallType(type);
    setCallState('connected'); // Assume connecting
    
    console.log('[CallContext] Joining call:', roomKey, type);
    
    try {
      const stream = await getMediaStream(type);
      console.log('[CallContext] Got media stream for joining');
      
      const channel = supabase.channel(roomKey, { config: { broadcast: { self: false } } });
      channelRef.current = channel;
      
      channel.on('broadcast', { event: 'offer' }, async ({ payload }) => {
         console.log('[CallContext] Joiner received offer, SDP length:', payload.sdp?.sdp?.length || payload.sdp?.length);
         try {
           const peer = pcRef.current || createPeerConnection(roomKey);
           
           // Add our local tracks BEFORE setting remote description
           if (stream) {
               console.log('[CallContext] Joiner adding', stream.getTracks().length, 'local tracks');
               stream.getTracks().forEach(track => {
                   // Check if track already added
                   if (!peer.getSenders().find(s => s.track?.id === track.id)) {
                       console.log('[CallContext] Joiner adding track:', track.kind, track.id);
                       peer.addTrack(track, stream);
                   }
               });
           }
           
           // Set the remote description (the offer)
           console.log('[CallContext] Joiner setting remote description');
           await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
           
           // Create and send answer
           console.log('[CallContext] Joiner creating answer');
           const answer = await peer.createAnswer();
           await peer.setLocalDescription(answer);
           
           console.log('[CallContext] Joiner sending answer, SDP length:', answer.sdp?.length);
           channel.send({ type: 'broadcast', event: 'answer', payload: { sdp: answer } });
           setCallState('connected');
         } catch (e) {
           console.error('[CallContext] Error handling offer in joinCall:', e);
         }
      });

      channel.on('broadcast', { event: 'ice' }, async ({ payload }) => {
         try {
           await pcRef.current?.addIceCandidate(new RTCIceCandidate(payload.candidate));
         } catch (e) {
           console.error('[CallContext] Error adding ICE candidate:', e);
         }
      });
      
      channel.on('broadcast', { event: 'hangup' }, () => endCall());

      channel.subscribe((status) => {
          console.log('[CallContext] Joiner channel status:', status);
          if (status === 'SUBSCRIBED') {
              // Announce we are here so caller can send offer
              console.log('[CallContext] Joiner sending join event');
              channel.send({ type: 'broadcast', event: 'join', payload: {} });
          }
      });
      
    } catch (e) {
      console.error('[CallContext] Error in joinCall:', e);
      setCallState('idle');
    }
  };

  const endCall = () => {
    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'hangup', payload: {} });
    }
    if (remoteParticipantId) {
        logCallToChat(remoteParticipantId, 'ended');
    }
    cleanupCall();
  };

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => {
        t.enabled = !t.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => {
        t.enabled = !t.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const shareScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = stream.getVideoTracks()[0];
      
      if (pcRef.current) {
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      }
      
      screenTrack.onended = () => {
        stopScreenShare();
      };
      
      setIsScreenSharing(true);
    } catch (e) {
      console.error("Screen share failed:", e);
    }
  };

  const stopScreenShare = async () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (pcRef.current) {
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
        }
      }
    }
    setIsScreenSharing(false);
  };

  return (
    <CallContext.Provider value={{
      callState,
      callType,
      localStream,
      remoteStream,
      participants: [],
      isMuted,
      isVideoOff,
      isScreenSharing,
      activeRoomKey,
      startCall,
      joinCall,
      endCall,
      toggleAudio,
      toggleVideo,
      shareScreen,
      stopScreenShare,
      incomingCall,
      acceptCall,
      rejectCall,
      raiseHand,
      lowerHand,
      handRaised,
      devices,
      selectedAudioInput,
      selectedVideoInput,
      selectedAudioOutput,
      setAudioInput,
      setVideoInput,
      setAudioOutput,
      connectionQuality,
      isCaptionsEnabled,
      toggleCaptions,
      transcript
    }}>
      {children}
    </CallContext.Provider>
  );
};
