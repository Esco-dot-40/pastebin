import React, { useState, useEffect } from "react";
import { Canvas } from "react-three-fiber";
import { ThreeLoader } from "./ThreeLoader";

export default function Loader() {
    const [progress, setProgress] = useState(0);
    const [started, setStarted] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    return 100;
                }
                return prev + 1;
            });
        }, 40); // Completes in about 4 seconds

        return () => clearInterval(interval);
    }, []);

    const handleStart = () => {
        setStarted(true);
        // Redirect to main app after loader
        setTimeout(() => {
            window.location.href = "/";
        }, 1500);
    };

    return (
        <div style={{
            width: "100vw",
            height: "100vh",
            background: "#000",
            margin: 0,
            padding: 0,
            overflow: "hidden",
            position: "relative"
        }}>
            <Canvas
                camera={{ position: [0, 0, 5.5], fov: 75 }}
                gl={{
                    antialias: true,
                    alpha: false,
                    powerPreference: "high-performance"
                }}
            >
                <color attach="background" args={["#000000"]} />
                <ThreeLoader progress={progress} />
            </Canvas>

            {/* Access Button Overlay */}
            {progress === 100 && !started && (
                <div
                    style={{
                        position: "absolute",
                        bottom: "15%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 9999,
                    }}
                >
                    <button
                        onClick={handleStart}
                        style={{
                            cursor: "pointer",
                            background: "transparent",
                            border: "2px solid #00ff88",
                            color: "#00ff88",
                            padding: "12px 30px",
                            fontSize: "1rem",
                            fontWeight: "bold",
                            boxShadow: "0 0 15px #00ff88",
                            transition: "all 0.3s ease",
                            fontFamily: "monospace",
                            textTransform: "uppercase",
                            letterSpacing: "2px",
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.backgroundColor = "#00ff88";
                            e.target.style.color = "#000";
                            e.target.style.transform = "scale(1.1)";
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.backgroundColor = "transparent";
                            e.target.style.color = "#00ff88";
                            e.target.style.transform = "scale(1)";
                        }}
                    >
                        ACCESS CORE
                    </button>
                </div>
            )}
        </div>
    );
}
