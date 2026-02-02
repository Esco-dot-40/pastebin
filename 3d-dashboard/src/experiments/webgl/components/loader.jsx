import React, { useState, useEffect } from "react";
import { Box } from "@react-three/flex";
import TextBox from "./text-box";
import sourceCodeProBold from "../SourceCodePro-Bold.ttf";

const bold = `${window.PUBLIC_PATH}${sourceCodeProBold}`;

const Loader = ({ onFinished }) => {
    const [percent, setPercent] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setPercent(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    onFinished();
                    return 100;
                }
                return prev + 2;
            });
        }, 30);
        return () => clearInterval(interval);
    }, [onFinished]);

    return (
        <Box
            width="100%"
            height="100%"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            centerAnchor
        >
            <TextBox font={bold} fontSize={12} color="#00f2ff">
                {`INITIALIZING ESCO-HUB: ${percent}%`}
            </TextBox>
            <Box marginTop={10} width={200} height={2} backgroundColor="#00f2ff" opacity={0.2}>
                <Box width={`${percent}%`} height="100%" backgroundColor="#00f2ff" />
            </Box>
        </Box>
    );
};

export default Loader;
