import React, { useEffect, useState } from "react";

import { connectToMain } from "../communication/renderercomm";
import Main from "./main";

export default function App() {

    const [connected, setConnected] = useState<boolean>(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        let closed = false;
        let disconnector: {disconnect: () => void} = null;
        connectToMain(params.get("uniqueid")).then((inDisconnector) => {
            if (closed) {
                return;
            }
            disconnector = inDisconnector;
            setConnected(true);
        });
        return () => {
            if (disconnector != null) {
                disconnector.disconnect();
            }
            closed = true;
        };
    }, []);

    if (connected) {
        return (
            <Main />
        );
    } else {
        return null;
    }
}
