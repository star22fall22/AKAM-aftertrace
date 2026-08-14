let D = null,
    id = null,
    S = {};
const A = document.getElementById("app"),
    DBG = document.getElementById("debug");

const SHOW_DEBUG = false;

async function init() {
    try {
        let r = await fetch("data/story.json", {
            cache: "no-store"
        });
        if (!r.ok) throw Error("story.json HTTP " + r.status);
        D = await r.json();
        S = JSON.parse(JSON.stringify(D.initialState || {}));
        id = D.settings.start;
        render()
    } catch (e) {
        A.innerHTML = `<section class="screen error"><h2>遊戲載入失敗</h2><p>請確認 GitHub Pages 的檔案路徑。</p><code>${esc(e.message)}</code></section>`
    }
}

function n() {
    return D.nodes[id]
}

function go(x) {
    id = x;
    render()
}

function resolve(x) {
    if (typeof x === "string") return x;
    for (let b of x.conditions || [])
        if (ok(b.if)) return b.go;
    return x.default
}

function render() {
    let x = n();
    if (!x) return initError("找不到節點：" + id);
    if (x.type === "story") story(x);
    else if (x.type === "choice") choice(x);
    else if (x.type === "cg") cg(x);
    else if (x.type === "ending") end(x);
    else initError("未知 type：" + x.type);
    DBG.style.display = (SHOW_DEBUG && D.settings.debug) ? "block" : "none";
    DBG.textContent = Object.entries(S).map(([k, v]) => k + "=" + v).join(" | ")
}

function story(x) {
    A.innerHTML = `<section class="screen story" style="background-image:url('${x.background||""}')"><div class="top"><span class="pill">${esc(x.chapter||"")}</span></div><div class="box"><div class="speaker">${esc(x.speaker||"")}</div><div class="text">${fmt(x.text||"")}</div>${x.next?`<button class="next" onclick='go(resolve(${JSON.stringify(x.next)}))'>繼續　›</button>`:""}</div></section>`
}

function choice(x) {
    let bg = x.background ? `style="background-image:linear-gradient(#0003,#000c),url('${x.background}');background-size:cover"` : "";
    A.innerHTML = `<section class="screen choiceScreen" ${bg}><div class="choiceTitle">${fmt(x.text||"")}</div><div class="choices">${x.options.map((o,i)=>`<button class="choice" ${o.condition&&!ok(o.condition)?"disabled":""} onclick="choose(${i})">${fmt(o.text)}</button>`).join("")}</div></section>`
}

function choose(i) {
    let o = n().options[i];
    if (o.condition && !ok(o.condition)) return;
    (o.effects || []).forEach(e => {
        if (!(e.variable in S)) S[e.variable] = 0;
        let v = Number(e.value || 0);
        S[e.variable] = e.operation === "set" ? v : e.operation === "subtract" ? S[e.variable] - v : S[e.variable] + v
    });
    go(resolve(o.next))
}

function cg(x) {
    A.innerHTML = `<section class="screen cg" onclick='go(resolve(${JSON.stringify(x.next)}))'><img src="${esc(x.image)}"><div class="hint">點擊畫面繼續　›</div></section>`
}

function end(x) {
    A.innerHTML = `<section class="screen ending"><div><h1>${fmt(x.title||"結局")}</h1><p>${fmt(x.text||"")}</p><button class="restart" onclick="restart()">重新開始</button><div class="ending-links"><a class="ending-link"href="你的噗浪網址"target="_blank"rel="noopener"><img src="assets/icon/plurk.png"alt="作者噗浪"></a><a class="ending-link"href="你的心得表單網址"target="_blank"rel="noopener"><img src="assets/icon/feedback.png"alt="心得與指教"></a></div></div></section>`
}

function restart() {
    S = JSON.parse(JSON.stringify(D.initialState || {}));
    id = D.settings.start;
    render()
}

function ok(c) {
    let a = S[c.variable],
        b = c.value;
    return c.operator === ">" ? a > b : c.operator === ">=" ? a >= b : c.operator === "<" ? a < b : c.operator === "<=" ? a <= b : c.operator === "==" ? a == b : c.operator === "!=" ? a != b : false
}

function fmt(x) {
    return esc(x).replace(/\n/g, "<br>")
}

function esc(x) {
    return String(x).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;")
}

function initError(x) {
    A.innerHTML = `<section class="screen error"><h2>遊戲錯誤</h2><code>${esc(x)}</code></section>`
}
init();
