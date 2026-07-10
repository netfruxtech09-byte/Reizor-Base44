import { useEffect, useRef } from "react";
import { ArrowLeft, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VideoChatRoom({ room, displayName, onLeave }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const domain = "meet.jit.si";
    const options = {
      roomName: room.room_id,
      parentNode: containerRef.current,
      userInfo: { displayName },
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        prejoinPageEnabled: false,
      },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: ["microphone","camera","desktop","chat","tileview","hangup"],
        SHOW_JITSI_WATERMARK: false,
        SHOW_BRAND_WATERMARK: false,
        DEFAULT_BACKGROUND: "#0a0e1a",
      },
    };

    const script = document.createElement("script");
    script.src = "https://meet.jit.si/external_api.js";
    script.onload = () => {
      const api = new window.JitsiMeetExternalAPI(domain, options);
      api.addEventListener("readyToClose", onLeave);
      containerRef.current._jitsiApi = api;
    };
    document.head.appendChild(script);

    return () => {
      if (containerRef.current?._jitsiApi) {
        containerRef.current._jitsiApi.dispose();
      }
      document.head.removeChild(script);
    };
  }, [room.room_id, displayName]);

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center gap-3 p-4 border-b border-border/50">
        <Button variant="ghost" size="sm" onClick={onLeave} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Leave
        </Button>
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-green-400" />
          <p className="font-display font-bold">{room.title}</p>
          <span className="font-mono text-[10px] font-bold uppercase text-green-400 bg-green-400/10 px-2 py-0.5 rounded animate-pulse">LIVE</span>
        </div>
      </div>
      <div ref={containerRef} className="flex-1" style={{ height: "calc(100vh - 65px)" }} />
    </div>
  );
}