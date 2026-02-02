import React, { useMemo } from "react";
import { Box, useFlexSize } from "@react-three/flex";
import Text from "./text-box";
import View from "./view";
import sourceCodeProRegular from "../SourceCodePro-Regular.ttf";
import sourceCodeProSemiBold from "../SourceCodePro-SemiBold.ttf";

const regular = `${window.PUBLIC_PATH}${sourceCodeProRegular}`;
const bold = `${window.PUBLIC_PATH}${sourceCodeProSemiBold}`;

const SITES = [
    { name: "veroe.space", health: "99%", status: "COSMOS" },
    { name: "escosigns.veroe.fun", health: "100%", status: "MASTER" },
    { name: "velarixsolutions.nl", health: "99%", status: "SECURE" },
    { name: "farkle.velarixsolutions.nl", health: "98%", status: "GAMING" },
    { name: "spell.velarixsolutions.nl", health: "97%", status: "LEARNING" },
    { name: "spoti.veroe.fun", health: "98%", status: "STREAMING" },
    { name: "more.veroe.fun", health: "97%", status: "VAULT" },
];

const SiteHealth = ({ onSelect, selected }) => {
    return (
        <Box width="100%" flexDirection="column" padding={5}>
            <View
                width="100%"
                flexDirection="row"
                justifyContent="space-between"
                paddingBottom={10}
                marginBottom={5}
                backgroundColor="#00f2ff"
                opacity={0.1}
                onClick={() => onSelect("GLOBAL")}
                style={{ cursor: 'pointer' }}
            >
                <Text font={bold} fontSize={10} color="#00f2ff">
                    {selected === "GLOBAL" ? "> GLOBAL HUB" : "GLOBAL HUB"}
                </Text>
                <Text font={bold} fontSize={10} color="#00f2ff">
                    {selected === "GLOBAL" ? "[ACTIVE]" : "SELECT ALL"}
                </Text>
            </View>
            {SITES.map((site) => (
                <View
                    key={site.name}
                    width="100%"
                    flexDirection="row"
                    justifyContent="space-between"
                    paddingTop={4}
                    paddingBottom={4}
                    borderBottomWidth={1}
                    borderBottomColor="rgba(0, 242, 255, 0.2)"
                    onClick={() => onSelect(site.name)}
                    backgroundColor="#00f2ff"
                    opacity={selected === site.name ? 0.1 : 0}
                >
                    <Text font={regular} fontSize={9} color={selected === site.name ? "#00f2ff" : "#fff"}>
                        {site.name}
                    </Text>
                    <Box flexDirection="row" alignItems="center">
                        <Text font={bold} fontSize={9} color="#00f2ff">
                            {site.health}
                        </Text>
                    </Box>
                </View>
            ))}
        </Box>
    );
};

export default SiteHealth;
