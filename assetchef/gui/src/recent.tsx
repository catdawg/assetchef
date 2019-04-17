import React, { useState } from "react";

export default function Recent() {

    // Declare a new state variable, which we'll call "count"
    const [recent, setRecent] = useState(["apath/test", "anotherpath/test"]);

    const listItems = recent.map((path) => <button key={path}>{path}</button>);

    return (
        <div>
            <h6>Recent:</h6>
            {listItems}
        </div>
    );
}
