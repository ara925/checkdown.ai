import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCall } from "@/contexts/CallContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Video } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function IncomingCallListener() {
  const navigate = useNavigate();
  const { incomingCall, acceptCall, rejectCall, callState } = useCall();
  
  const handleAccept = async () => {
    if (incomingCall) {
      const { roomKey, type } = incomingCall;
      await acceptCall();
      // Navigate to call page after accepting and setup is complete
      navigate(`/call/${type}/${encodeURIComponent(roomKey)}`);
    }
  };

  useEffect(() => {
    if (callState === 'incoming' && incomingCall) {
      // Simple ringtone using Web Audio API
      let ctx: AudioContext | null = null;
      let oscillator: OscillatorNode | null = null;
      let interval: NodeJS.Timeout | null = null;

      try {
        ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const gainNode = ctx.createGain();
        gainNode.connect(ctx.destination);
        
        oscillator = ctx.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, ctx.currentTime); // High pitch
        oscillator.connect(gainNode);
        
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        
        oscillator.start();

        // Rhythmic ringing
        const playTone = () => {
            if (!ctx) return;
            const t = ctx.currentTime;
            gainNode.gain.cancelScheduledValues(t);
            gainNode.gain.setValueAtTime(0, t);
            gainNode.gain.linearRampToValueAtTime(0.3, t + 0.1);
            gainNode.gain.linearRampToValueAtTime(0, t + 1);
        };

        playTone();
        interval = setInterval(playTone, 2000);

      } catch (e) {
        console.error("Audio context error:", e);
      }

      return () => {
        if (interval) clearInterval(interval);
        if (oscillator) {
            try { oscillator.stop(); } catch {}
        }
        if (ctx) {
            try { ctx.close(); } catch {}
        }
      };
    }
  }, [callState, incomingCall]);

  if (callState !== 'incoming' || !incomingCall) return null;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && rejectCall()}>
      <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-center">Incoming Call</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 py-6">
          <div className="relative">
             <Avatar className="h-24 w-24 ring-4 ring-indigo-500/20">
               <AvatarImage src={`https://avatar.vercel.sh/${incomingCall.caller.email}`} />
               <AvatarFallback>{incomingCall.caller.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
             </Avatar>
             {/* Pulse effect */}
             <div className="absolute inset-0 rounded-full animate-ping bg-indigo-500/20 -z-10" />
          </div>
          
          <div className="text-center">
            <h3 className="text-xl font-semibold">{incomingCall.caller.name || incomingCall.caller.email}</h3>
            <p className="text-zinc-400 flex items-center gap-2 justify-center mt-1">
              {incomingCall.type === 'video' ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
              Incoming {incomingCall.type} call...
            </p>
          </div>

          <div className="flex items-center gap-8 mt-4">
            <div className="flex flex-col items-center gap-2">
              <Button 
                size="lg" 
                variant="destructive" 
                className="h-14 w-14 rounded-full"
                onClick={rejectCall}
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
              <span className="text-xs text-zinc-400">Decline</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <Button 
                size="lg" 
                className="h-14 w-14 rounded-full bg-green-500 hover:bg-green-600 text-white animate-pulse"
                onClick={handleAccept}
              >
                {incomingCall.type === 'video' ? <Video className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
              </Button>
              <span className="text-xs text-zinc-400">Accept</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
