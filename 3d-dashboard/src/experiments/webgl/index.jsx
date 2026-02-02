import React, {
  Suspense,
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import * as THREE from "three";
import { Canvas, useThree, useFrame } from "react-three-fiber";
import { Stats } from "drei";

import sourceCodeProRegular from "./SourceCodePro-Regular.ttf";
import sourceCodeProBold from "./SourceCodePro-Bold.ttf";

import TextBox from "./components/text-box";
import SciFiPanel from "./components/panel";
import Geo from "./components/geo";
import Detail from "./components/detail";
import Activity from "./components/activity";
import Graph from "./components/graph";
import Languages from "./components/languages";
import Effects from "./components/effects";
import Files from "./components/files";
import SiteHealth from "./components/health";
import Loader from "./components/loader";
import escoVideo from "../../previews/esconeon.mp4";

const regular = `${window.PUBLIC_PATH || ''}${sourceCodeProRegular}`;
const bold = `${window.PUBLIC_PATH || ''}${sourceCodeProBold}`;

// --- STABILIZED HUD COMPONENTS ---

const PixelPanel = ({ width, height, color = "#00f2ff", children, ...props }) => {
  return (
    <group {...props}>
      <SciFiPanel color={color} width={width} height={height}>
        {children}
      </SciFiPanel>
    </group>
  );
};

const VideoHeader = ({ width }) => {
  const [video] = useState(() => {
    const vid = document.createElement("video");
    vid.src = escoVideo;
    vid.crossOrigin = "Anonymous";
    vid.loop = true;
    vid.muted = true;
    vid.play();
    return vid;
  });

  return (
    <group position={[-width / 2 + 20, 0, 0]}>
      <mesh position={[90, 0, 1]}>
        <planeBufferGeometry args={[180, 100]} />
        <meshBasicMaterial transparent opacity={0.9}>
          <videoTexture attach="map" args={[video]} />
        </meshBasicMaterial>
      </mesh>
      <group position={[200, 10, 0]}>
        <TextBox font={bold} fontSize={18} color="#fff" anchorX="left">ESCO COMMANDER</TextBox>
        <TextBox font={regular} fontSize={9} color="#00f2ff" anchorX="left" position={[0, -25, 0]}>LIVE FEED // SYSTEM OPERATOR</TextBox>
      </group>
    </group>
  );
};

const AvatarCard = ({ color }) => {
  const texture = useMemo(() => new THREE.TextureLoader().load("/public/esco_avatar.png"), []);

  return (
    <group>
      <mesh position={[0, 20, 1]}>
        <circleBufferGeometry args={[45, 32]} />
        <meshBasicMaterial map={texture} transparent opacity={1} />
      </mesh>
      <TextBox font={bold} fontSize={14} color="#fff" position={[0, -45, 0]}>ESCO COMMANDER</TextBox>
      <TextBox font={regular} fontSize={8} color={color} position={[0, -65, 0]}>STATION : ALPHA-ONE</TextBox>
    </group>
  );
};

const AdminCommand = ({ width, lockdown, toggleLockdown, threats }) => {
  return (
    <group>
      <mesh position={[0, 30, 0]}>
        <planeBufferGeometry args={[width - 20, 30]} />
        <meshBasicMaterial color={lockdown ? "#ff0000" : "#00f2ff"} transparent opacity={0.15} />
      </mesh>
      <TextBox font={bold} fontSize={10} color={lockdown ? "#ff0000" : "#00f2ff"} position={[0, 30, 1]}>
        {lockdown ? "NETWORK UNDER LOCKDOWN" : "STATION SECURE"}
      </TextBox>

      <TextBox font={regular} fontSize={8} color="#aaa" position={[-width / 2 + 20, 5, 1]} anchorX="left">SUSPICIOUS NODES:</TextBox>
      <TextBox font={bold} fontSize={8} color="#ff0000" position={[width / 2 - 20, 5, 1]} anchorX="right">{threats}</TextBox>

      <mesh position={[0, -25, 0]} onClick={toggleLockdown}>
        <planeBufferGeometry args={[width - 20, 25]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.15} />
      </mesh>
      <TextBox font={bold} fontSize={9} color="#fff" position={[0, -25, 1]}>
        {lockdown ? "DISABLE LOCKDOWN" : "INITIATE PROTOCOL [X]"}
      </TextBox>
    </group>
  );
};

// --- DATA ENGINE ---

const Dashboard = () => {
  const { size } = useThree();
  const [loading, setLoading] = useState(true);
  const [selectedSite, setSelectedSite] = useState("GLOBAL");

  const SITE_COLORS = {
    "GLOBAL": "#00f2ff",
    "veroe.space": "#00f2ff",
    "escosigns.veroe.fun": "#ff5e00",
    "velarixsolutions.nl": "#00ffbb",
    "farkle.velarixsolutions.nl": "#ffcc00",
    "spell.velarixsolutions.nl": "#00aaff",
    "spoti.veroe.fun": "#ff0000",
    "more.veroe.fun": "#ffcc00",
  };

  const [allHits, setAllHits] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lockdown, setLockdown] = useState(false);
  const [threats, setThreats] = useState(0);

  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/universal-telemetry');
      if (!res.ok) return;
      const data = await res.json();
      setAllHits(data.filter(h => typeof h.lat === 'number' && !isNaN(h.lat)).map(h => ({
        pos: new THREE.Vector3().setFromSphericalCoords(1.05, (90 - h.lat) * (Math.PI / 180), (h.lon + 180) * (Math.PI / 180)),
        size: h.is_blocked ? 0.03 : 0.015,
        hostname: h.hostname,
        isBlocked: h.is_blocked
      })));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    fetch('/api/auth/status').then(r => r.json()).then(data => setIsAdmin(data.isAuthenticated));
    fetch('/api/firewall/settings').then(r => r.json()).then(data => {
      setLockdown(data.find(s => s.key === 'lockdown_active')?.value === '1');
    });
    fetch('/api/analytics/threat-intel').then(r => r.json()).then(data => setThreats(data.suspiciousIPs?.length || 0));

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 10000);
    return () => clearInterval(interval);
  }, [fetchTelemetry]);

  const toggleLockdown = async () => {
    const newVal = lockdown ? '0' : '1';
    await fetch('/api/firewall/settings/lockdown_active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: newVal })
    });
    setLockdown(!lockdown);
  };

  const filteredHits = useMemo(() => {
    if (selectedSite === "GLOBAL") return allHits;
    return allHits.filter(h => h.hostname === selectedSite);
  }, [allHits, selectedSite]);

  const currentColor = SITE_COLORS[selectedSite] || "#00f2ff";

  // Layout calculations
  const width = size.width;
  const height = size.height;
  const sidebarWidth = 380;
  const colP = 20;

  if (loading) {
    return <Loader onFinished={() => setLoading(false)} />;
  }

  return (
    <group>
      {/* Background Ambience */}
      <ambientLight args={[0xffffff, 0.4]} />
      <directionalLight position={[0, 0, 100]} intensity={0.5} />

      {/* Header HUD */}
      <group position={[0, height / 2 - 70, 0]}>
        <VideoHeader width={width} />
      </group>

      {/* Left Control Cluster */}
      <group position={[-width / 2 + sidebarWidth / 2 + colP, -40, 0]}>
        <PixelPanel width={sidebarWidth} height={160} position={[0, 180, 0]} color={currentColor}>
          <AvatarCard color={currentColor} />
        </PixelPanel>

        <PixelPanel width={sidebarWidth} height={100} position={[0, 40, 0]} color={currentColor}>
          <group position={[0, 15, 0]}>
            <Detail
              title={selectedSite === "GLOBAL" ? "GLOBAL HUB" : "SITE NODE"}
              subtitle={selectedSite === "GLOBAL" ? "network.veroe.fun" : selectedSite.toLowerCase()}
              color={currentColor}
            />
          </group>
        </PixelPanel>

        <PixelPanel width={sidebarWidth} height={200} position={[0, -120, 0]} color={currentColor}>
          {/* Files / Sites List would go here - simplified for stability */}
          <group position={[0, 60, 0]}>
            <TextBox font={bold} fontSize={12} color="#fff">ACTIVE NODES</TextBox>
            <SiteHealth onSelect={setSelectedSite} selected={selectedSite} />
          </group>
        </PixelPanel>

        {isAdmin && (
          <PixelPanel width={sidebarWidth} height={140} position={[0, -300, 0]} color="#ff0000">
            <AdminCommand width={sidebarWidth} lockdown={lockdown} toggleLockdown={toggleLockdown} threats={threats} />
          </PixelPanel>
        )}
      </group>

      {/* Right Intelligence Cluster */}
      <group position={[width / 2 - sidebarWidth / 2 - colP, -40, 0]}>
        <PixelPanel width={sidebarWidth} height={250} position={[0, 135, 0]} color={currentColor}>
          <group position={[0, 0, 0]}>
            <TextBox font={bold} fontSize={12} color="#fff" position={[0, 100, 1]}>CORE INTELLIGENCE</TextBox>
            <Suspense fallback={null}><Languages /></Suspense>
          </group>
        </PixelPanel>

        <PixelPanel width={sidebarWidth} height={350} position={[0, -180, 0]} color={currentColor}>
          <group position={[0, 0, 0]}>
            <TextBox font={bold} fontSize={12} color="#fff" position={[0, 150, 1]}>PROPAGATION GRAPH</TextBox>
            <Suspense fallback={null}><Graph /></Suspense>
          </group>
        </PixelPanel>
      </group>

      {/* Central Tactical Globe */}
      <group position={[0, -50, -200]}>
        <Geo
          hits={filteredHits}
          color={currentColor}
          scale={[
            Math.min(width, height) / 3.5,
            Math.min(width, height) / 3.5,
            Math.min(width, height) / 3.5,
          ]}
        />
      </group>
    </group>
  );
};

// --- MAIN ENTRY ---

export default function WebGL() {
  return (
    <div style={{ background: "#050505", height: "100vh", width: "100vw", margin: 0, overflow: "hidden" }}>
      <Canvas
        orthographic={false}
        colorManagement={false}
        pixelRatio={window.devicePixelRatio}
        camera={{ position: [0, 0, 800], fov: 60 }}
        gl={{ powerPreference: "high-performance", antialias: true, stencil: false, depth: true }}
      >
        <Suspense fallback={null}>
          <Dashboard />
        </Suspense>
        <Stats />
        <Suspense fallback={null}><Effects /></Suspense>
      </Canvas>
      {/* City on Fire Glow Overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        background: 'radial-gradient(circle at 50% 110%, rgba(255, 60, 0, 0.3) 0%, transparent 70%)',
        boxShadow: 'inset 0 0 150px rgba(0, 0, 0, 0.95)',
        zIndex: 10
      }} />
    </div>
  );
}
