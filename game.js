let D = null,
    id = null,
    S = {};

// =========================
// BGM 系統
// =========================

// JSON 裡的 BGM ID 對應實際音檔
const BGM_FILES = {
    mystery: "assets/bgm/mystery.mp3",
    sad: "assets/bgm/sad.mp3"
};

// BGM 音量：0 ~ 1
const BGM_VOLUME = 0.35;

// BGM 切換時淡入淡出的時間（毫秒）
const BGM_FADE_MS = 800;

// 目前「應該播放」的 BGM。
// 即使使用者靜音，也保留這個值，解除靜音時才能恢復目前場景的音樂。
let currentBgm = null;

// 實際的 Audio 物件
let bgmAudio = null;

// 防止快速切換場景時，前一次切歌流程干擾後一次
let bgmSwitchToken = 0;

// 手機瀏覽器是否已經取得使用者互動
let audioUnlocked = false;

// 音樂開關：預設開啟。
// 這個狀態不會因為 render() / go() 換頁而重設。
let musicEnabled = true;


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

        S = JSON.parse(
            JSON.stringify(D.initialState || {})
        );

        id = D.settings.start;

        setupAudioUnlock();

        render();

    } catch (e) {

        A.innerHTML = `
            <section class="screen error">
                <h2>遊戲載入失敗</h2>
                <p>請確認 GitHub Pages 的檔案路徑。</p>
                <code>${esc(e.message)}</code>
            </section>
        `;
    }
}


function n() {
    return D.nodes[id];
}


function go(x) {
    id = x;
    render();
}


function resolve(x) {

    if (typeof x === "string") return x;

    for (let b of x.conditions || [])
        if (ok(b.if)) return b.go;

    return x.default;
}


// =========================
// BGM 初始化
// =========================

function setupAudioUnlock() {

    // 手機瀏覽器通常需要使用者先點擊畫面，
    // 才允許網頁播放有聲音的音樂。
    const unlock = () => {

        audioUnlocked = true;

        // 如果目前應該播放 BGM，且 Audio 因 autoplay 被阻擋，
        // 使用者第一次操作後重新播放。
        if (
            musicEnabled &&
            bgmAudio &&
            bgmAudio.paused &&
            currentBgm
        ) {

            bgmAudio.play()
                .then(() => {
                    fadeIn(
                        bgmAudio,
                        BGM_VOLUME,
                        BGM_FADE_MS
                    );
                })
                .catch(() => {});
        }

        document.removeEventListener(
            "pointerdown",
            unlock
        );

        document.removeEventListener(
            "keydown",
            unlock
        );

        document.removeEventListener(
            "touchstart",
            unlock
        );
    };

    document.addEventListener(
        "pointerdown",
        unlock,
        { passive: true }
    );

    document.addEventListener(
        "keydown",
        unlock
    );

    document.addEventListener(
        "touchstart",
        unlock,
        { passive: true }
    );
}


// =========================
// BGM 判斷
// =========================

function updateBgm(bgmId) {

    // JSON 沒有 bgm 欄位
    // → 維持目前的 BGM。
    if (typeof bgmId === "undefined") {
        return;
    }

    // JSON 寫 bgm: null
    // → 明確表示這個 node 不應有音樂。
    if (bgmId === null) {
        stopBgm();
        return;
    }

    const src = BGM_FILES[bgmId];

    if (!src) {
        console.warn(
            "找不到 BGM 設定：" + bgmId
        );
        return;
    }

    // 即使目前是靜音，也要記住
    // 「目前場景指定的 BGM」。
    currentBgm = bgmId;

    // 使用者目前是靜音狀態：
    // 不建立 / 播放新的 Audio，等解除靜音時再播放。
    if (!musicEnabled) {

        // 如果仍是同一首 BGM，
        // 就保留 Audio 與播放位置。
        //
        // 如果 scene 在靜音期間換了 BGM，
        // 則解除靜音時再建立新的 Audio。
        if (
            bgmAudio &&
            bgmAudio.src.endsWith(src)
        ) {
            bgmAudio.pause();
        }

        return;
    }

    // 同一首 BGM 已經在播放，
    // 不重新開始。
    if (
        bgmAudio &&
        bgmAudio.src.endsWith(src) &&
        !bgmAudio.paused
    ) {
        return;
    }

    switchBgm(
        bgmId,
        src
    );
}


// =========================
// 切換 BGM
// =========================

async function switchBgm(bgmId, src) {

    // 使用者在切歌流程開始前後若關閉音樂，
    // 就不要繼續播放。
    if (!musicEnabled) {
        return;
    }

    const token = ++bgmSwitchToken;

    // 如果原本有音樂，先淡出
    if (
        bgmAudio &&
        !bgmAudio.paused
    ) {

        await fadeOut(
            bgmAudio,
            BGM_FADE_MS
        );

        if (
            token !== bgmSwitchToken ||
            !musicEnabled
        ) {
            return;
        }
    }

    // 停止舊音樂
    if (bgmAudio) {

        bgmAudio.pause();

        bgmAudio.currentTime = 0;
    }

    // 記錄目前「應該播放」的 BGM
    currentBgm = bgmId;

    // 建立新的 Audio
    const audio = new Audio(src);

    // 短音樂自動循環
    audio.loop = true;

    // 從 0 音量開始，準備淡入
    audio.volume = 0;

    // 預先載入
    audio.preload = "auto";

    bgmAudio = audio;

    // 尚未取得使用者互動
    // → 暫時不播放，等第一次點擊
    if (
        !audioUnlocked ||
        !musicEnabled
    ) {
        return;
    }

    try {

        await audio.play();

        if (
            token !== bgmSwitchToken ||
            !musicEnabled
        ) {
            return;
        }

        await fadeIn(
            audio,
            BGM_VOLUME,
            BGM_FADE_MS
        );

    } catch (e) {

        console.warn(
            "BGM 播放被瀏覽器阻擋，等待使用者互動後重試。",
            e
        );
    }
}


// =========================
// 停止 BGM
// =========================

function stopBgm() {

    bgmSwitchToken++;

    // null 代表目前 node 不指定任何音樂。
    currentBgm = null;

    if (!bgmAudio) {
        return;
    }

    const audio = bgmAudio;

    fadeOut(
        audio,
        BGM_FADE_MS
    ).then(() => {

        audio.pause();

        audio.currentTime = 0;

        if (bgmAudio === audio) {
            bgmAudio = null;
        }
    });
}


// =========================
// 淡出
// =========================

function fadeOut(audio, duration) {

    return new Promise(resolve => {

        if (!audio) {
            resolve();
            return;
        }

        const startVolume = Math.max(
            0,
            Math.min(
                1,
                audio.volume
            )
        );

        // 已經沒有聲音
        if (
            audio.paused ||
            startVolume <= 0
        ) {

            audio.volume = 0;

            resolve();

            return;
        }

        const startTime =
            performance.now();

        function step(now) {

            // 強制限制在 0 ~ 1
            const progress =
                Math.max(
                    0,
                    Math.min(
                        (now - startTime) /
                            duration,
                        1
                    )
                );

            // 再次強制限制音量在 0 ~ 1
            audio.volume =
                Math.max(
                    0,
                    Math.min(
                        1,
                        startVolume *
                            (1 - progress)
                    )
                );

            if (progress >= 1) {

                audio.volume = 0;

                resolve();

            } else {

                requestAnimationFrame(
                    step
                );
            }
        }

        requestAnimationFrame(step);
    });
}


// =========================
// 淡入
// =========================

function fadeIn(
    audio,
    targetVolume,
    duration
) {

    return new Promise(resolve => {

        if (!audio) {
            resolve();
            return;
        }

        // 確保目標音量一定在 0 ~ 1
        targetVolume = Math.max(
            0,
            Math.min(
                1,
                targetVolume
            )
        );

        audio.volume = 0;

        const startTime =
            performance.now();

        function step(now) {

            // 強制限制在 0 ~ 1
            const progress =
                Math.max(
                    0,
                    Math.min(
                        (now - startTime) /
                            duration,
                        1
                    )
                );

            audio.volume =
                Math.max(
                    0,
                    Math.min(
                        1,
                        targetVolume *
                            progress
                    )
                );

            if (progress >= 1) {

                audio.volume =
                    targetVolume;

                resolve();

            } else {

                requestAnimationFrame(
                    step
                );
            }
        }

        requestAnimationFrame(step);
    });
}


// =========================
// 音樂開關
// =========================

function toggleMusic() {

    musicEnabled = !musicEnabled;

    if (!musicEnabled) {

        // =========================
        // 關閉音樂
        // =========================
        //
        // 靜音只「暫停」，
        // 不重設 currentTime，
        // 也不把 bgmAudio 設成 null。
        //
        // 因此之後重新開啟時，
        // 可以從原本的位置繼續。

        bgmSwitchToken++;

        if (bgmAudio) {

            bgmAudio.pause();
        }

    } else {

        // =========================
        // 開啟音樂
        // =========================

        // 如果保留的 Audio 就是目前場景的 BGM，
        // 直接從原本的 currentTime 繼續播放。
        const currentSrc =
            currentBgm
                ? BGM_FILES[currentBgm]
                : null;

        if (
            audioUnlocked &&
            currentBgm &&
            bgmAudio &&
            currentSrc &&
            bgmAudio.src.endsWith(currentSrc)
        ) {

            bgmAudio.play()
                .then(() => {

                    fadeIn(
                        bgmAudio,
                        BGM_VOLUME,
                        BGM_FADE_MS
                    );
                })
                .catch(() => {});

        } else {

            // 如果場景在靜音期間
            // 換了另一首 BGM，
            // 舊 Audio 不能拿來繼續播放。
            //
            // 因此丟掉舊 Audio，
            // 改建立目前場景的 BGM。
            if (bgmAudio) {

                bgmAudio.pause();

                bgmAudio = null;
            }

            const x = n();

            if (
                x &&
                typeof x.bgm !== "undefined"
            ) {

                updateBgm(x.bgm);
            }

            if (
                musicEnabled &&
                audioUnlocked &&
                currentBgm &&
                !bgmAudio &&
                BGM_FILES[currentBgm]
            ) {

                switchBgm(
                    currentBgm,
                    BGM_FILES[currentBgm]
                );
            }
        }
    }

    updateMusicButtons();
}


// =========================
// 音樂按鈕 HTML
// =========================

function musicButtonHtml() {

    return `
        <button
            class="music-toggle"
            type="button"
            aria-label="${
                musicEnabled
                    ? "關閉音樂"
                    : "開啟音樂"
            }"
            onclick="
                event.stopPropagation();
                toggleMusic()
            "
        >${
            musicEnabled
                ? "♫"
                : "♩̸"
        }</button>
    `;
}


// =========================
// 更新所有音樂按鈕
// =========================

function updateMusicButtons() {

    document
        .querySelectorAll(".music-toggle")
        .forEach(btn => {

            btn.innerHTML =
                musicEnabled
                    ? "♫"
                    : "♩̸";

            btn.setAttribute(
                "aria-label",
                musicEnabled
                    ? "關閉音樂"
                    : "開啟音樂"
            );
        });
}


// =========================
// Render
// =========================

function render() {

    let x = n();

    if (!x) {
        return initError(
            "找不到節點：" + id
        );
    }

    // 根據目前 node 的 BGM 設定更新音樂
    updateBgm(x.bgm);

    if (x.type === "story") {
        story(x);
    }
    else if (x.type === "choice") {
        choice(x);
    }
    else if (x.type === "cg") {
        cg(x);
    }
    else if (x.type === "ending") {
        end(x);
    }

    DBG.style.display =
        (
            SHOW_DEBUG &&
            D.settings.debug
        )
            ? "block"
            : "none";

    DBG.textContent =
        Object.entries(S)
            .map(
                ([k, v]) =>
                    k + "=" + v
            )
            .join(" | ");
}


// =========================
// Story
// =========================

function story(x) {

    A.innerHTML = `
        <section
            class="screen story"
            style="
                background-image:url(
                    '${x.background || ""}'
                )
            "
        >

            <div class="top">

                <span class="pill">
                    ${esc(x.chapter || "")}
                </span>

                ${musicButtonHtml()}

            </div>

            <div class="box">

                <div class="speaker">
                    ${esc(x.speaker || "")}
                </div>

                <div class="text">
                    ${fmt(x.text || "")}
                </div>

                ${
                    x.next
                        ? `
                            <button
                                class="next"
                                onclick='go(
                                    resolve(
                                        ${JSON.stringify(x.next)}
                                    )
                                )'
                            >
                                繼續　›
                            </button>
                        `
                        : ""
                }

            </div>

        </section>
    `;
}


// =========================
// Choice
// =========================

function choice(x) {

    let bg = x.background
        ? `
            style="
                background-image:
                    linear-gradient(
                        #0003,
                        #000c
                    ),
                    url('${x.background}');
                background-size:cover
            "
        `
        : "";

    A.innerHTML = `
        <section
            class="screen choiceScreen"
            ${bg}
        >

            <div class="screen-top-right">
                ${musicButtonHtml()}
            </div>

            <div class="choiceTitle">
                ${fmt(x.text || "")}
            </div>

            <div class="choices">

                ${
                    x.options
                        .map(
                            (o, i) => `
                                <button
                                    class="choice"
                                    ${
                                        o.condition &&
                                        !ok(o.condition)
                                            ? "disabled"
                                            : ""
                                    }
                                    onclick="
                                        choose(${i})
                                    "
                                >
                                    ${fmt(o.text)}
                                </button>
                            `
                        )
                        .join("")
                }

            </div>

        </section>
    `;
}


// =========================
// Choice 選擇
// =========================

function choose(i) {

    let o = n().options[i];

    if (
        o.condition &&
        !ok(o.condition)
    ) {
        return;
    }

    (o.effects || []).forEach(e => {

        if (!(e.variable in S)) {
            S[e.variable] = 0;
        }

        let v =
            Number(
                e.value || 0
            );

        S[e.variable] =
            e.operation === "set"
                ? v
                : e.operation === "subtract"
                    ? S[e.variable] - v
                    : S[e.variable] + v;
    });

    go(
        resolve(o.next)
    );
}


// =========================
// CG
// =========================

function cg(x) {

    A.innerHTML = `
        <section
            class="screen cg"
            onclick='go(
                resolve(
                    ${JSON.stringify(x.next)}
                )
            )'
        >

            <img
                src="${esc(x.image)}"
            >

            <div class="screen-top-right">
                ${musicButtonHtml()}
            </div>

            <div class="hint">
                點擊畫面繼續　›
            </div>

        </section>
    `;
}


// =========================
// Ending
// =========================

function end(x) {

    A.innerHTML = `
        <section
            class="screen ending"
        >

            <div class="screen-top-right">
                ${musicButtonHtml()}
            </div>

            <div>

                <h1>
                    ${fmt(x.title || "結局")}
                </h1>

                <p>
                    ${fmt(x.text || "")}
                </p>

                <button
                    class="ending-restart"
                    onclick="restart()"
                >
                    重新開始
                </button>

                <div class="ending-links">

                    <a
                        class="ending-link"
                        href="https://www.plurk.com/u/star_fall22"
                        target="_blank"
                        rel="noopener"
                    >
                        <img
                            src="assets/icon/plurk.png"
                            alt="噗浪"
                        >
                    </a>

                    <a
                        class="ending-link"
                        href="https://forms.gle/JPThCWhk1pzBziP8A"
                        target="_blank"
                        rel="noopener"
                    >
                        <img
                            src="assets/icon/feedback.png"
                            alt="心得與指教"
                        >
                    </a>

                </div>

            </div>

        </section>
    `;
}


// =========================
// Restart
// =========================

function restart() {

    S = JSON.parse(
        JSON.stringify(
            D.initialState || {}
        )
    );

    id = D.settings.start;

    render();
}


// =========================
// 條件判斷
// =========================

function ok(c) {

    let a = S[c.variable],
        b = c.value;

    return c.operator === ">"
        ? a > b
        : c.operator === ">="
            ? a >= b
            : c.operator === "<"
                ? a < b
                : c.operator === "<="
                    ? a <= b
                    : c.operator === "=="
                        ? a == b
                        : c.operator === "!="
                            ? a != b
                            : false;
}


// =========================
// 格式化文字
// =========================

function fmt(x) {

    return esc(x)
        .replace(/\n/g, "<br>");
}


// =========================
// HTML Escape
// =========================

function esc(x) {

    return String(x)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


// =========================
// 錯誤
// =========================

function initError(x) {

    A.innerHTML = `
        <section class="screen error">

            <h2>
                遊戲錯誤
            </h2>

            <code>
                ${esc(x)}
            </code>

        </section>
    `;
}


init();
