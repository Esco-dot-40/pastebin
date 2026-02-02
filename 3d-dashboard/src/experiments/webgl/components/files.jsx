import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useFrame, useLoader } from "react-three-fiber";
import * as THREE from "three";
import { Box, useFlexSize } from "@react-three/flex";
import Text from "./text-box";
import View from "./view";
import sourceCodeProRegular from "../SourceCodePro-Regular.ttf";
import sourceCodeProSemiBold from "../SourceCodePro-SemiBold.ttf";

// Import previews
import velarixImg from "../../../previews/velarix.png";
import escosignsImg from "../../../previews/escosigns.png";
import spotiImg from "../../../previews/spoti.png";
import moreImg from "../../../previews/more.png";
import veroeSpaceImg from "../../../previews/veroe_space.png";
import farkleImg from "../../../previews/farkle.png";
import spellImg from "../../../previews/spell.png";
import hubImg from "../../../previews/hub_preview.png";

const regular = `${window.PUBLIC_PATH}${sourceCodeProRegular}`;
const bold = `${window.PUBLIC_PATH}${sourceCodeProSemiBold}`;

const WEBSITES = [
  { name: "GLOBAL", url: "#", preview: hubImg, desc: "Esco.io Universal Command Center & Analytics Hub." },
  { name: "veroe.space", url: "https://veroe.space", preview: veroeSpaceImg, desc: "A futuristic digital cosmos portfolio & hub." },
  { name: "escosigns.veroe.fun", url: "https://escosigns.veroe.fun", preview: escosignsImg, desc: "Digital signage & futuristic branding hub." },
  { name: "velarixsolutions.nl", url: "https://velarixsolutions.nl", preview: velarixImg, desc: "High-end corporate technology studio." },
  { name: "farkle.velarixsolutions.nl", url: "https://farkle.velarixsolutions.nl", preview: farkleImg, desc: "Ready to Roll? Custom Farkle experience." },
  { name: "spell.velarixsolutions.nl", url: "https://spell.velarixsolutions.nl", preview: spellImg, desc: "NYT-style Spelling Bee daily challenges." },
  { name: "spoti.veroe.fun", url: "https://spoti.veroe.fun", preview: spotiImg, desc: "Custom star-field Spotify visualization." },
  { name: "more.veroe.fun", url: "https://more.veroe.fun", preview: moreImg, desc: "Personal project archive & vault." },
];

const Row = ({ name, url, selected, onSelect }) => {
  const nameColor = selected ? "#00f2ff" : "#ffffff";

  return (
    <View
      paddingLeft={10}
      paddingRight={10}
      height={30}
      flexBasis={30}
      flexShrink={0}
      backgroundColor={selected ? "#00f2ff" : "#ffffff"}
      opacity={selected ? 0.1 : 0}
      alignItems="center"
      width="100%"
      flexDirection="row"
      justifyContent="space-between"
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
        if (url !== "#") window.open(url, "_blank");
      }}
      onPointerOver={() => onSelect()}
      style={{ cursor: 'pointer' }}
    >
      <Text font={selected ? bold : regular} fontSize={selected ? 10 : 9} color={nameColor}>
        {name}
      </Text>
      {selected && (
        <Text font={regular} fontSize={8} color="#fec903">
          {" ACTIVE"}
        </Text>
      )}
    </View>
  );
};

const PreviewContent = ({ website }) => {
  const texture = useLoader(THREE.TextureLoader, website.preview);
  return (
    <mesh position={[0, -10, 0]}>
      <planeBufferGeometry args={[340, 191]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
};

const PreviewBox = ({ website }) => {
  const size = useFlexSize();
  const width = size[0] || 300;
  const height = size[1] || 400;

  const mesh = React.useRef();
  const glow = React.useRef();

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.position.y = THREE.MathUtils.lerp(mesh.current.position.y, -height / 2 + Math.sin(state.clock.elapsedTime * 2) * 8, 0.1);
      mesh.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.03;
      mesh.current.position.x = THREE.MathUtils.lerp(mesh.current.position.x, width + 150, 0.1);
    }
    if (glow.current) {
      glow.current.opacity = 0.1 + Math.sin(state.clock.elapsedTime * 4) * 0.05;
    }
  });

  return (
    <mesh ref={mesh} position={[width + 400, -height / 2, 60]}>
      <planeBufferGeometry args={[370, 280]} />
      <meshBasicMaterial color="#00f2ff" transparent opacity={0.05} />

      {/* Glow effect */}
      <mesh position={[0, 0, -1]}>
        <planeBufferGeometry args={[390, 300]} />
        <meshBasicMaterial ref={glow} color="#00f2ff" transparent opacity={0.1} />
      </mesh>

      {/* Frame border */}
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneBufferGeometry(370, 280)]} />
        <meshBasicMaterial color="#00f2ff" />
      </lineSegments>

      <group position={[0, 0, 1]}>
        <Text font={bold} fontSize={16} color="#fff" position={[0, 120, 0]}>
          {website.name.toUpperCase()}
        </Text>

        <Suspense fallback={<mesh position={[0, -10, 0]}><planeBufferGeometry args={[340, 191]} /><meshBasicMaterial color="#111" /></mesh>}>
          <PreviewContent website={website} />
        </Suspense>

        <Text font={regular} fontSize={8} color="#aaa" position={[0, -120, 0]}>
          {website.desc}
        </Text>

        <mesh position={[0, -10, 2]}>
          <planeBufferGeometry args={[340, 191]} />
          <meshBasicMaterial color="#fff" transparent opacity={0.03} />
        </mesh>
      </group>
    </mesh>
  );
};

const Files = ({ selectedSite, onSelect }) => {
  const selectedIndex = useMemo(() => {
    const idx = WEBSITES.findIndex(s => s.name === selectedSite);
    return idx === -1 ? 0 : idx;
  }, [selectedSite]);

  return (
    <Box width="100%" flexDirection="column">
      <Box width="100%" flexDirection="column">
        {WEBSITES.map((site, index) => (
          <Row
            key={site.name}
            {...site}
            selected={index === selectedIndex}
            onSelect={() => onSelect(site.name)}
          />
        ))}
      </Box>
      <PreviewBox website={WEBSITES[selectedIndex]} />
    </Box>
  );
};

export default Files;
