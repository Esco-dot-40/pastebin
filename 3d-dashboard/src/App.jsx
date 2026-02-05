import { Canvas } from "@react-three/fiber";
import { Loader } from "./components/Loader";
import { useState, Suspense, useEffect } from "react";
import { ThreeLoader } from "./components/ThreeLoader";
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from "@react-three/postprocessing";

function App() {
  const [started, setStarted] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const handleEnter = () => {
    window.location.href = '/home';
  };

  return (
    <>
      <Loader started={started} onStarted={handleEnter} progress={progress} />

      <div style={{ width: "100vw", height: "100vh", background: "#000" }}>
        <Canvas
          shadows
          camera={{ position: [0, 0, 15], fov: 50 }}
        >
          <color attach="background" args={["#000000"]} />
          <fog attach="fog" args={["#000500", 10, 30]} />

          <Suspense fallback={<mesh><boxGeometry /><meshBasicMaterial color="red" /></mesh>}>
            <ThreeLoader progress={progress} />
          </Suspense>

          <EffectComposer disableNormalPass>
            <Bloom
              intensity={0.6}
              luminanceThreshold={0.1}
              luminanceSmoothing={0.9}
              mipmapBlur
            />
            <ChromaticAberration offset={[0.001, 0.001]} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
          </EffectComposer>
        </Canvas>
      </div>
    </>
  );
}

export default App;
