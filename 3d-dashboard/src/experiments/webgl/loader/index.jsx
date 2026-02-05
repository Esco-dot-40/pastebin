import React from "react";

export default function Loader() {
    return (
        <div style={{
            width: "100vw",
            height: "100vh",
            background: "#000",
            margin: 0,
            padding: 0,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            color: "#00ff88",
            fontFamily: "monospace"
        }}>
            <h1 style={{ fontSize: "3rem", marginBottom: "2rem" }}>
                LOADER TEST
            </h1>
            <p style={{ fontSize: "1.5rem" }}>
                If you see this, React is working!
            </p>
        </div>
    );
}
