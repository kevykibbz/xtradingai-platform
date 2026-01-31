export function createLabel({ x, y, type }) {
        const el = document.createElement("div");
        el.style.position = "absolute";
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.transform = "translate(-50%, -100%)";
        el.style.pointerEvents = "none";
        el.style.fontFamily = "Arial";

        const box = document.createElement("div");
        box.style.padding = "5px 10px";
        box.style.fontWeight = "700";
        box.style.fontSize = "13px";
        box.style.borderRadius = "5px";

        if (type === "buy") {
            box.style.background = "#1DFF28";
            box.style.color = "#000";
            box.textContent = "BUY";
        } else {
            box.style.background = "#FF0000";
            box.style.color = "#fff";
            box.textContent = "SELL";
        }

        const arrow = document.createElement("div");
        arrow.style.width = "0";
        arrow.style.height = "0";

        if (type === "buy") {
            arrow.style.borderLeft = "6px solid transparent";
            arrow.style.borderRight = "6px solid transparent";
            arrow.style.borderTop = "6px solid #1DFF28";
            arrow.style.margin = "3px auto 0 auto";
        } else {
            arrow.style.borderLeft = "6px solid transparent";
            arrow.style.borderRight = "6px solid transparent";
            arrow.style.borderBottom = "6px solid #FF0000";
            arrow.style.margin = "0 auto 3px auto";
        }

        el.appendChild(box);
        el.appendChild(arrow);

        return el;
    }