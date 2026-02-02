import React from "react";
import { BoxBufferGeometry, Box3 } from "three";
import { extend } from "react-three-fiber";

import { Box } from "@react-three/flex";

// Same as BoxBuffer but with an empty boundingBox.
// This ensures it doesn't impact the flex/box layout.

class BoundlessBoxBufferGeometry extends BoxBufferGeometry {
  computeBoundingBox() {
    if (!this.boundingBox) {
      this.boundingBox = new Box3();
    }
    this.boundingBox.makeEmpty();
  }
}

extend({ BoundlessBoxBufferGeometry });

const SizedView = React.memo(
  ({ width, height, backgroundColor, opacity, children }) => {
    const isVisible = backgroundColor && backgroundColor !== "transparent" && backgroundColor !== "none";
    return (
      <group position={[0, 0, 0.1]}>
        {isVisible && (
          <mesh position={[width / 2, -height / 2, -0.3]}>
            <boundlessBoxBufferGeometry
              args={[width, height, 0.1]}
              attach="geometry"
            />
            <meshBasicMaterial
              attach="material"
              depthTest
              color={backgroundColor}
              transparent={opacity < 1}
              opacity={opacity}
            />
          </mesh>
        )}
        {children}
      </group>
    );
  }
);

const View = React.memo(({ backgroundColor, opacity, children, ...props }) => {
  return (
    <Box {...props}>
      {(width, height) => {
        const w = Math.round(width);
        const h = Math.round(height);
        return (
          <SizedView
            width={w}
            height={h}
            opacity={opacity}
            backgroundColor={backgroundColor}
          >
            {children}
          </SizedView>
        );
      }}
    </Box>
  );
});

export default View;
