import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCall } from "@/contexts/CallContext";
import { Button } from "@/components/ui/button";
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, 
  Users, MessageSquare, MoreVertical, Settings, Hand,
  SignalHigh, SignalMedium, SignalLow, WifiOff, Captions
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function CallPage() {
  const { type, roomKey } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    callState,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    joinCall,
    endCall,
    toggleAudio,
    toggleVideo,
    shareScreen,
    stopScreenShare,
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
  } = useCall();

  const [showSettings, setShowSettings] = useState(false);
  const [duration, setDuration] = useState(0);
  const [otherUser, setOtherUser] = useState<{ name: string; email: string } | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (roomKey && type) {
      console.log('[CallPage] Initializing with roomKey:', roomKey, 'type:', type, 'callState:', callState);
      
      if (callState === 'idle') {
        joinCall(roomKey, type as 'audio' | 'video');
      }
      
      // Parse roomKey to get other user ID
      const parts = roomKey.replace("call:dm:", "").split("-");
      const userData = localStorage.getItem("user");
      if (userData) {
        const me = JSON.parse(userData);
        const otherId = parts.find(id => Number(id) !== me.id);
        if (otherId) {
          fetchUser(Number(otherId));
        }
      }
    }
  }, [roomKey, type]);

  const fetchUser = async (id: number) => {
    const { data } = await supabase.from("users").select("name, email").eq("id", id).single();
    if (data) setOtherUser(data);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let audioCtx: AudioContext | null = null;

    if (callState === 'calling') {
        // Ringback tone
        try {
            audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
            osc.start();
            
            const playRingback = () => {
                 if (!audioCtx) return;
                 const t = audioCtx.currentTime;
                 gain.gain.cancelScheduledValues(t);
                 gain.gain.setValueAtTime(0, t);
                 gain.gain.linearRampToValueAtTime(0.1, t + 0.1);
                 gain.gain.linearRampToValueAtTime(0, t + 2);
            };
            
            playRingback();
            interval = setInterval(playRingback, 4000);
        } catch (e) {
            console.error("Audio context error:", e);
        }
    }

    if (callState === 'connected') {
      interval = setInterval(() => setDuration(d => d + 1), 1000);
    }
    
    return () => {
        if (interval) clearInterval(interval);
        if (audioCtx) audioCtx.close();
    };
  }, [callState]);

  // Attach streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      console.log('[CallPage] Attaching local stream to video element');
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    if (videoEl && remoteStream) {
      console.log('[CallPage] Attaching remote stream to video element');
      console.log('[CallPage] Remote stream tracks:', remoteStream.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        readyState: t.readyState,
        muted: t.muted
      })));
      
      videoEl.srcObject = remoteStream;
      
      // Ensure audio plays - handle autoplay restrictions
      const playMedia = async () => {
        try {
          // Ensure video is not muted for remote stream
          videoEl.muted = false;
          videoEl.volume = 1.0;
          
          await videoEl.play();
          console.log('[CallPage] Remote video/audio playing successfully');
        } catch (err: any) {
          console.error('[CallPage] Autoplay failed:', err);
          // If autoplay fails, we may need user interaction
          // Show a toast to prompt user to click
          if (err.name === 'NotAllowedError') {
            toast({
              title: 'Click to enable audio',
              description: 'Browser blocked autoplay. Click anywhere to enable audio.',
              duration: 5000
            });
            
            // Add one-time click handler to start playback
            const handleClick = async () => {
              try {
                await videoEl.play();
                console.log('[CallPage] Audio started after user interaction');
              } catch (e) {
                console.error('[CallPage] Still cannot play:', e);
              }
              document.removeEventListener('click', handleClick);
            };
            document.addEventListener('click', handleClick, { once: true });
          }
        }
      };
      
      playMedia();
    }
  }, [remoteStream]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    endCall();
    navigate('/chat');
  };

  return (
    <div className="h-screen w-screen bg-zinc-950 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${otherUser?.name || 'User'}`} />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-sm font-semibold">{otherUser?.name || 'Unknown User'}</h2>
            <div className="flex items-center gap-2">
                <p className="text-xs text-zinc-400">{callState === 'connected' ? formatDuration(duration) : callState}</p>
                {callState === 'connected' && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                {connectionQuality === 'good' && <SignalHigh className="h-3 w-3 text-green-500" />}
                                {connectionQuality === 'poor' && <SignalMedium className="h-3 w-3 text-yellow-500" />}
                                {connectionQuality === 'bad' && <SignalLow className="h-3 w-3 text-red-500" />}
                                {connectionQuality === 'unknown' && <WifiOff className="h-3 w-3 text-zinc-500" />}
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>Connection: {connectionQuality}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
            <Users className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
            <MessageSquare className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Main Stage */}
      <div className="flex-1 p-4 relative flex items-center justify-center">
        {callState === 'connected' || callState === 'calling' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full max-w-6xl mx-auto">
            {/* Remote Video */}
            <div className="relative bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center border border-zinc-800">
              {remoteStream ? (
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <Avatar className="h-20 w-20 mx-auto mb-4">
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${otherUser?.name || 'User'}`} />
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                  <p className="text-zinc-400 animate-pulse">
                    {callState === 'calling' ? 'Calling...' : 'Waiting for others to join...'}
                  </p>
                </div>
              )}
              <div className="absolute bottom-4 left-4 bg-black/50 px-2 py-1 rounded text-xs">
                {otherUser?.name || 'Remote User'}
              </div>
              {/* Captions Overlay */}
              {isCaptionsEnabled && transcript && (
                <div className="absolute bottom-12 left-0 right-0 mx-auto max-w-2xl bg-black/70 p-4 rounded text-center text-lg font-medium">
                    {transcript}
                </div>
              )}
            </div>

            {/* Local Video */}
            <div className="relative bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center border border-zinc-800">
              {localStream && !isVideoOff ? (
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
              ) : (
                <div className="text-center">
                  <Avatar className="h-20 w-20 mx-auto mb-4">
                    <AvatarFallback>Me</AvatarFallback>
                  </Avatar>
                  <p className="text-zinc-400">Camera is off</p>
                </div>
              )}
              <div className="absolute bottom-4 left-4 bg-black/50 px-2 py-1 rounded text-xs">
                You
              </div>
            </div>
          </div>
        ) : (
           <div className="text-center">
             <h1 className="text-2xl font-bold mb-2">Ready to join?</h1>
             <Button onClick={() => joinCall(roomKey || '', type as any)}>Join Now</Button>
           </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="h-20 bg-zinc-900 border-t border-zinc-800 flex items-center justify-center gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={isMuted ? "destructive" : "secondary"} 
                size="icon" 
                className="rounded-full h-12 w-12"
                onClick={toggleAudio}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isMuted ? "Unmute" : "Mute"}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={isVideoOff ? "destructive" : "secondary"} 
                size="icon" 
                className="rounded-full h-12 w-12"
                onClick={toggleVideo}
              >
                {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isVideoOff ? "Turn camera on" : "Turn camera off"}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={isScreenSharing ? "default" : "secondary"} 
                size="icon" 
                className="rounded-full h-12 w-12"
                onClick={isScreenSharing ? stopScreenShare : shareScreen}
              >
                <Monitor className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isScreenSharing ? "Stop sharing" : "Share screen"}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={handRaised ? "default" : "secondary"} 
                size="icon" 
                className="rounded-full h-12 w-12"
                onClick={handRaised ? lowerHand : raiseHand}
              >
                <Hand className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{handRaised ? "Lower hand" : "Raise hand"}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={isCaptionsEnabled ? "default" : "secondary"} 
                size="icon" 
                className="rounded-full h-12 w-12"
                onClick={toggleCaptions}
              >
                <Captions className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isCaptionsEnabled ? "Turn off captions" : "Turn on captions"}</p>
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full h-12 w-12">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-zinc-900 border-zinc-800 text-white">
              <DropdownMenuLabel>Call Settings</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem className="focus:bg-zinc-800" onSelect={() => setShowSettings(true)}>
                <Settings className="mr-2 h-4 w-4" /> Device Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="focus:bg-zinc-800">
                <Users className="mr-2 h-4 w-4" /> Participants
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-8 bg-zinc-700 mx-2" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="destructive" 
                size="icon" 
                className="rounded-full h-12 w-12 w-16" // Wider end call button
                onClick={handleEndCall}
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Leave call</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Device Settings</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Microphone</Label>
              <Select value={selectedAudioInput} onValueChange={setAudioInput}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue placeholder="Select microphone" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                  {devices.filter(d => d.kind === 'audioinput').map(device => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Camera</Label>
              <Select value={selectedVideoInput} onValueChange={setVideoInput}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue placeholder="Select camera" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                  {devices.filter(d => d.kind === 'videoinput').map(device => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Speaker</Label>
              <Select value={selectedAudioOutput} onValueChange={setAudioOutput}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue placeholder="Select speaker" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                  {devices.filter(d => d.kind === 'audiooutput').map(device => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Speaker ${device.deviceId.slice(0, 5)}...`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2 pt-4 border-t border-zinc-800">
                <Label>Background Effects</Label>
                <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" className="h-16 flex flex-col items-center justify-center gap-1 border-zinc-700 hover:bg-zinc-800">
                        <div className="w-6 h-6 rounded-full border-2 border-zinc-500 bg-zinc-900"></div>
                        <span className="text-[10px]">None</span>
                    </Button>
                    <Button variant="outline" className="h-16 flex flex-col items-center justify-center gap-1 border-zinc-700 hover:bg-zinc-800">
                        <div className="w-6 h-6 rounded-full border-2 border-zinc-500 bg-zinc-800 blur-[2px]"></div>
                        <span className="text-[10px]">Blur</span>
                    </Button>
                    <Button variant="outline" disabled className="h-16 flex flex-col items-center justify-center gap-1 border-zinc-700 opacity-50 cursor-not-allowed">
                        <div className="w-6 h-6 rounded-full border-2 border-zinc-500 bg-gradient-to-br from-blue-500 to-purple-500"></div>
                        <span className="text-[10px]">Image</span>
                    </Button>
                </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
