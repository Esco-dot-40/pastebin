import React from "react";

import { BoxBufferGeometry, Box3 } from "three";

import { Flex, Box, useFlexSize } from "@react-three/flex";
import { extend } from "react-three-fiber";
import Text from './text-box';
import View from './view';
import sourceCodeProRegular from "../SourceCodePro-Regular.ttf";
import sourceCodeProSemiBold from "../SourceCodePro-SemiBold.ttf";

const regular = `${window.PUBLIC_PATH}${sourceCodeProRegular}`
const bold = `${window.PUBLIC_PATH}${sourceCodeProSemiBold}`

function Stat({ title, value, color = '#fff' }) {
  return (
    <View flexDirection="column">
      <Text font={regular} color="#ccc" fontSize={8} >{title}</Text>
      <Text font={bold} color={color} fontSize={12} >{value}</Text>
    </View>
  )
}

export default function Detail({ title = "ESCO-2049", subtitle = "esco.veroe.fun", color = "rgb(0, 242, 255)", ...props }) {
  return (
    <Box width="100%" height={100} flexDirection="row" alignItems="stretch">
      <Box
        width="auto"
        height="auto"
        flexGrow={1}
        flexBasis={0}
        alignItems="stretch"
        flexDirection="column"
      >
        <View
          width="100%"
          flexBasis={1}
          flexGrow={1}
          flexShrink={0}
          paddingLeft={8}
          alignItems="center"
          flexDirection="row"
          justifyContent="space-between"
          backgroundColor={color}
        >
          <Box flexDirection="column">
            <Text font={bold} color="#000" fontSize={18}>{title}</Text>
            <Text font={regular} color="#000" fontSize={10}>{subtitle}</Text>
          </Box>
          <View marginRight={8} width="auto" paddingLeft={3} paddingRight={3} paddingTop={1} paddingBottom={1} height="auto" backgroundColor="#000">
            <Text font={regular} color="#fff" fontSize={8}>PREMIUM ACCESS</Text>
          </View>
        </View>
        <View
          width="100%"
          flexBasis={1}
          flexGrow={1}
          flexShrink={0}
          alignItems="center"
          flexDirection="row"
          justifyContent="space-between"
        >
          <Stat title="Websites" value="12" />
          <Stat title="Performance" color="rgb(0, 242, 255)" value="99%" />
          <Stat title="Security" value="SAFE" />
          <Stat title="Uptime" value="100%" />
        </View>
      </Box>
    </Box>
  );
}
