import * as THREE from 'three'
import { useMemo, useContext, createContext, useRef, useState, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, Merged, RenderTexture, PerspectiveCamera, Text, Environment, useVideoTexture, useTexture } from '@react-three/drei'

const context = createContext()

export function Instances({ children, ...props }) {
  const { nodes } = useGLTF('/computers_1-transformed.glb')
  const instances = useMemo(
    () => ({
      Object: nodes.Object_4,
      Object1: nodes.Object_16,
      Object3: nodes.Object_52,
      Object13: nodes.Object_172,
      Object14: nodes.Object_174,
      Object23: nodes.Object_22,
      Object24: nodes.Object_26,
      Object32: nodes.Object_178,
      Object36: nodes.Object_28,
      Object45: nodes.Object_206,
      Object46: nodes.Object_207,
      Object47: nodes.Object_215,
      Object48: nodes.Object_216,
      Sphere: nodes.Sphere
    }),
    [nodes]
  )
  return (
    <Merged castShadow receiveShadow meshes={instances} {...props}>
      {(instances) => <context.Provider value={instances} children={children} />}
    </Merged>
  )
}

export function Computers({ onSelect, ...props }) {
  const { nodes: n, materials: m } = useGLTF('/computers_1-transformed.glb')
  const instances = useContext(context)

  const projects = [
    { id: 'veroe', name: 'veroe.space', color: '#00ff88', url: 'https://veroe.space', video: '/quietembed.mp4' },
    { id: 'velarix', name: 'velarixsolutions.nl', color: '#0088ff', url: 'https://velarixsolutions.nl', video: '/velarix.mp4' },
    { id: 'esco', name: 'esco.sh', color: '#8800ff', url: 'https://esco.sh' },
    { id: 'tnt', name: 'tnt.veroe.fun', color: '#ff4444', url: 'https://tnt.veroe.fun/', video: '/lovense.mp4' },
    { id: 'spelling', name: 'spell.velarixsolutions.nl', color: '#00ffcc', url: 'https://spell.velarixsolutions.nl/', video: '/spellingbee.mp4' },
    { id: 'farkle', name: 'farkle.velarixsolutions.nl', color: '#ffaa00', url: 'https://farkle.velarixsolutions.nl/', video: '/farkle.mp4' },
    { id: 'spotify', name: 'spoti.veroe.fun', color: '#1DB954', url: 'https://spoti.veroe.fun/', image: '/spotify.png' },
  ]

  return (
    <group {...props} dispose={null}>
      {/* --- ORIGINAL DECORATIVE LAYOUT --- */}
      <instances.Object position={[0.16, 0.79, -1.97]} rotation={[-0.54, 0.93, -1.12]} scale={0.5} />
      <instances.Object position={[-2.79, 0.27, 1.82]} rotation={[-1.44, 1.22, 1.43]} scale={0.5} />
      <instances.Object position={[-5.6, 4.62, -0.03]} rotation={[-1.96, 0.16, 1.2]} scale={0.5} />
      <instances.Object position={[2.62, 1.98, -2.47]} rotation={[-0.42, -0.7, -1.85]} scale={0.5} />
      <instances.Object position={[4.6, 3.46, 1.19]} rotation={[-1.24, -0.72, 0.48]} scale={0.5} />

      <instances.Object1 position={[0.63, 0, -3]} rotation={[0, 0.17, 0]} scale={1.52} />
      <instances.Object1 position={[-2.36, 0.32, -2.02]} rotation={[0, 0.53, -Math.PI / 2]} scale={1.52} />
      <mesh castShadow receiveShadow geometry={n.Object_24.geometry} material={m.Texture} position={[-2.42, 0.94, -2.25]} rotation={[0, 0.14, Math.PI / 2]} scale={-1.52} />

      <instances.Object1 position={[-3.53, 0, 0.59]} rotation={[Math.PI, -1.09, Math.PI]} scale={1.52} />
      <instances.Object1 position={[-3.53, 1.53, 0.59]} rotation={[0, 0.91, 0]} scale={1.52} />
      <instances.Object1 position={[3.42, 0, 0]} rotation={[-Math.PI, 1.13, -Math.PI]} scale={1.52} />
      <instances.Object1 position={[4.09, 2.18, 2.41]} rotation={[0, -1.55, 1.57]} scale={1.52} />

      <instances.Object3 position={[4.31, 1.57, 2.34]} rotation={[0, -1.15, -Math.PI / 2]} scale={-1.52} />
      <instances.Object3 position={[-3.79, 0, 1.66]} rotation={[Math.PI, -1.39, 0]} scale={-1.52} />
      <instances.Object3 position={[-3.79, 1.53, 1.66]} rotation={[0, 1.22, -Math.PI]} scale={-1.52} />

      <instances.Object1 position={[-3.69, 0, 2.59]} rotation={[0, -1.57, 0]} scale={1.52} />
      <instances.Object1 position={[-5.36, 2.18, 0.81]} rotation={[0, 0.77, Math.PI / 2]} scale={1.52} />
      <instances.Object3 position={[-5.56, 1.57, 0.69]} rotation={[0, 1.17, -Math.PI / 2]} scale={-1.52} />
      <instances.Object1 position={[-5.47, 2.79, 0.74]} rotation={[Math.PI, -1.16, Math.PI / 2]} scale={1.52} />
      <instances.Object3 position={[-5.29, 3.41, 0.89]} rotation={[Math.PI, -0.76, -Math.PI / 2]} scale={-1.52} />

      <instances.Object23 position={[-2.29, 1.56, -2.26]} rotation={[0, -0.005, -Math.PI / 2]} scale={1.52} />
      <instances.Object24 position={[-2.19, 2.19, -1.87]} rotation={[0, 0.51, Math.PI / 2]} scale={-1.52} />

      {/* --- INTERACTIVE MONITOR GRID --- */}
      <ScreenWebsite
        frame="Object_206"
        panel="Object_207"
        project={projects[0]}
        onSelect={onSelect}
        position={[0.27, 1.53, -2.61]}
      />

      <ScreenWebsite
        frame="Object_215"
        panel="Object_216"
        project={projects[1]}
        onSelect={onSelect}
        position={[1.84, 0.38, -1.77]}
        rotation={[0, -Math.PI / 9, 0]}
      />

      <ScreenWebsite
        frame="Object_212"
        panel="Object_213"
        project={projects[2]}
        onSelect={onSelect}
        position={[-2.73, 0.63, -0.52]}
        rotation={[0, 1.09, 0]}
      />

      <ScreenWebsite
        frame="Object_209"
        panel="Object_210"
        project={projects[3]}
        onSelect={onSelect}
        position={[-1.43, 2.5, -1.8]}
        rotation={[0, 1, 0]}
      />

      <ScreenWebsite
        frame="Object_221"
        panel="Object_222"
        project={projects[4]}
        onSelect={onSelect}
        position={[-3.42, 3.06, 1.3]}
        rotation={[0, 1.22, 0]}
        scale={0.9}
      />

      <ScreenWebsite
        frame="Object_224"
        panel="Object_225"
        project={projects[5]}
        onSelect={onSelect}
        position={[-3.9, 4.29, -2.64]}
        rotation={[0, 0.54, 0]}
      />

      <ScreenWebsite
        frame="Object_227"
        panel="Object_228"
        project={projects[6]}
        onSelect={onSelect}
        position={[0.96, 4.28, -4.2]}
        rotation={[0, -0.65, 0]}
      />

      {/* Extra filler monitors */}
      <ScreenText frame="Object_230" panel="Object_231" position={[4.68, 4.29, -1.56]} rotation={[0, -Math.PI / 3, 0]} />

      {/* ADDITIONAL BACKGROUND FILLED SCREENS */}
      <instances.Object1 position={[-6.28, 0, -2.33]} rotation={[0, 0.75, 0]} scale={1.2} />
      <instances.Object1 position={[-6.49, 0, -1.38]} rotation={[Math.PI, -0.99, Math.PI]} scale={1.2} />
      <instances.Object1 position={[6.59, 0, -4]} rotation={[-Math.PI, 0, 0]} scale={-1.2} />
      <instances.Object23 position={[-7.95, 0, -0.64]} rotation={[0, 0.95, 0]} scale={1.2} />
      <instances.Object23 position={[7.53, 0, -0.85]} rotation={[-Math.PI, 0, 0]} scale={-1.2} />

      <Leds instances={instances} />
    </group>
  )
}

function Screen({ frame, panel, children, onSelect, project, ...props }) {
  const { nodes, materials } = useGLTF('/computers_1-transformed.glb')
  const [hovered, setHovered] = useState(false)

  return (
    <group
      {...props}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation()
        if (onSelect && project) onSelect(project)
      }}
    >
      <mesh castShadow receiveShadow geometry={nodes[frame].geometry} material={materials.Texture}>
        {hovered && <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={0.5} />}
      </mesh>
      <mesh geometry={nodes[panel].geometry}>
        <meshBasicMaterial toneMapped={false}>
          <RenderTexture width={512} height={512} attach="map" anisotropy={16}>
            {children}
          </RenderTexture>
        </meshBasicMaterial>
      </mesh>
    </group>
  )
}

function ScreenWebsite({ project, onSelect, ...props }) {
  return (
    <Screen {...props} onSelect={onSelect} project={project}>
      <PerspectiveCamera makeDefault manual aspect={1 / 1} position={[0, 0, 10]} />
      <color attach="background" args={['#050505']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} />

      <Text
        position={[0, 4.3, 0.2]}
        fontSize={0.65}
        color={project.color}
        font="/fonts/Poppins-Black.ttf"
        anchorY="bottom"
      >
        {`LINK // ${project.name.toUpperCase()}`}
      </Text>

      <Suspense fallback={
        <group>
          <mesh scale={[10, 10, 1]}>
            <planeGeometry />
            <meshBasicMaterial color={project.color} opacity={0.2} transparent />
          </mesh>
          <Center position={[0, 0, 0]}>
            <Text
              font="/fonts/Poppins-Black.ttf"
              fontSize={0.8}
              color={project.color}
              maxWidth={8}
              textAlign="center"
            >
              LOADING_DATA...
            </Text>
          </Center>
        </group>
      }>
        {project.video ? (
          <VideoScreen url={project.video} />
        ) : project.image ? (
          <ImageScreen url={project.image} />
        ) : (
          <Center position={[0, 0, 0]}>
            <Text
              font="/fonts/Poppins-Black.ttf"
              fontSize={1}
              color={project.color}
              maxWidth={8}
              textAlign="center"
            >
              {project.name.toUpperCase()}
            </Text>
          </Center>
        )}
      </Suspense>

      <Text
        position={[0, -4.3, 0.2]}
        font="/fonts/Poppins-Black.ttf"
        fontSize={0.45}
        color="white"
        opacity={0.6}
        anchorY="top"
      >
        [ DATA_SHARD_ACCESS ]
      </Text>


      {!project.video && (
        <group position={[0, 0, -2]}>
          <mesh rotation={[0.5, 0.5, 0]}>
            <boxGeometry args={[4, 4, 4]} />
            <meshStandardMaterial color={project.color} wireframe />
          </mesh>
        </group>
      )}
    </Screen>
  )
}

function VideoScreen({ url }) {
  const texture = useVideoTexture(url, {
    muted: true,
    loop: true,
    start: true,
    crossOrigin: "Anonymous"
  })
  return (
    <mesh scale={[10, 10, 1]}>
      <planeGeometry />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}

function ImageScreen({ url }) {
  const tex = useTexture(url)
  return (
    <mesh scale={[10, 10, 1]}>
      <planeGeometry />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  )
}

function ScreenText({ ...props }) {
  return (
    <Screen {...props}>
      <PerspectiveCamera makeDefault manual aspect={1 / 1} position={[0, 0, 15]} />
      <color attach="background" args={['black']} />
      <Text font="/fonts/Poppins-Black.ttf" fontSize={3} color="#00ff88" opacity={0.2}>
        SYSTEM_IDLE
      </Text>
    </Screen>
  )
}

function Center({ children, ...props }) {
  const ref = useRef()
  return (
    <group ref={ref} {...props}>
      {children}
    </group>
  )
}

function Leds({ instances }) {
  const ref = useRef()
  useFrame((state) => {
    if (ref.current) {
      ref.current.children.forEach((instance) => {
        const rand = Math.abs(2 + instance.position.x)
        const t = Math.round((1 + Math.sin(rand * 10000 + state.clock.elapsedTime * rand)) / 2)
        instance.color.setRGB(0, t * 1.1, t)
      })
    }
  })
  return (
    <group ref={ref}>
      <instances.Sphere position={[-0.41, 1.1, -2.21]} scale={0.005} color={[1, 2, 1]} />
      <instances.Sphere position={[0.59, 1.32, -2.22]} scale={0.005} color={[1, 2, 1]} />
      <instances.Sphere position={[1.77, 1.91, -1.17]} scale={0.005} color={[1, 2, 1]} />
      <instances.Sphere position={[2.44, 1.1, -0.79]} scale={0.005} color={[1, 2, 1]} />
      <instances.Sphere position={[4.87, 3.8, -0.1]} scale={0.005} color={[1, 2, 1]} />
      <instances.Sphere position={[1.93, 3.8, -3.69]} scale={0.005} color={[1, 2, 1]} />
      <instances.Sphere position={[-2.35, 3.8, -3.48]} scale={0.005} color={[1, 2, 1]} />
    </group>
  )
}
