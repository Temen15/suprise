// ==========================================
// OUR PHOTO BOOTH - FIXED SCRIPT.JS
// ==========================================

let peer = null;
let connection = null;
let localStream = null;

let currentRoom = null;
let isHost = false;
let connected = false;

let currentMoment = 0;
let photos = [];
let currentTheme = "classic";

// ==========================================
// ELEMENTS
// ==========================================

const screens = document.querySelectorAll(".screen");

const homeScreen = document.getElementById("homeScreen");
const createScreen = document.getElementById("createScreen");
const waitingScreen = document.getElementById("waitingScreen");
const joinScreen = document.getElementById("joinScreen");
const boothScreen = document.getElementById("boothScreen");
const resultScreen = document.getElementById("resultScreen");

const startCreateBtn = document.getElementById("startCreateBtn");
const startJoinBtn = document.getElementById("startJoinBtn");
const joinBtn = document.getElementById("joinBtn");

const roomCode = document.getElementById("roomCode");
const inviteBtn = document.getElementById("inviteBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const connectionStatus = document.getElementById("connectionStatus");
const remoteWaiting = document.getElementById("remoteWaiting");

const captureBtn = document.getElementById("captureBtn");
const countdown = document.getElementById("countdown");
const momentLabel = document.getElementById("momentLabel");

const stripCanvas = document.getElementById("stripCanvas");


// ==========================================
// SCREEN FUNCTIONS
// ==========================================

function showScreen(screen) {
    screens.forEach(s => s.classList.remove("active"));

    if (screen) {
        screen.classList.add("active");
    }
}

function showHome() {
    showScreen(homeScreen);
}

function showCreate() {
    showScreen(createScreen);
}

function showWaiting() {
    showScreen(waitingScreen);
}

function showJoin() {
    showScreen(joinScreen);
}

function showBooth() {
    showScreen(boothScreen);
}

function showResult() {
    showScreen(resultScreen);
}


// ==========================================
// CAMERA
// ==========================================

async function openCamera() {
    try {
        if (localStream) {
            return localStream;
        }

        localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user",
                width: {
                    ideal: 1280
                },
                height: {
                    ideal: 720
                }
            },
            audio: false
        });

        localVideo.srcObject = localStream;
        localVideo.muted = true;
        localVideo.playsInline = true;

        await localVideo.play().catch(() => {});

        return localStream;

    } catch (error) {
        console.error("Camera error:", error);

        alert(
            "Camera access is required 📸\n\n" +
            "Please allow camera permission and try again."
        );

        throw error;
    }
}


// ==========================================
// RANDOM ROOM CODE
// ==========================================

function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }

    return code;
}


// ==========================================
// RANDOM PEER ID
// ==========================================

function generatePeerId() {
    return (
        "LM-" +
        Math.random().toString(36).substring(2, 10) +
        "-" +
        Date.now().toString(36)
    );
}


// ==========================================
// CREATE ROOM
// ==========================================

async function createRoom() {
    try {
        await openCamera();

        isHost = true;
        connected = false;
        currentMoment = 0;
        photos = [];

        currentRoom = generateRoomCode();

        roomCode.textContent = currentRoom;

        showWaiting();

        const peerId = generatePeerId();

        peer = new Peer(peerId, {
            debug: 1
        });

        peer.on("open", id => {
            console.log("Host Peer opened:", id);

            updateConnectionStatus(
                "Waiting for Babyy to join... 💕"
            );
        });

        peer.on("connection", conn => {
            console.log("Incoming data connection:", conn);

            connection = conn;

            setupConnection(conn);

            conn.on("open", () => {
                console.log("Data connection opened");
            });
        });

        peer.on("call", call => {
            console.log("Incoming video call");

            call.answer(localStream);

            call.on("stream", stream => {
                console.log("Remote stream received");

                remoteVideo.srcObject = stream;
                remoteVideo.playsInline = true;

                remoteVideo.play().catch(() => {});

                showConnected();
            });

            call.on("error", error => {
                console.error("Incoming call error:", error);
            });
        });

        peer.on("error", error => {
            console.error("Host PeerJS error:", error);

            updateConnectionStatus(
                "Connection error. Please refresh and try again."
            );
        });

        peer.on("disconnected", () => {
            console.log("Host peer disconnected");
        });

    } catch (error) {
        console.error("Create room error:", error);
    }
}


// ==========================================
// JOIN ROOM
// ==========================================

async function joinRoom() {
    try {
        await openCamera();

        isHost = false;
        connected = false;
        currentMoment = 0;
        photos = [];

        const params = new URLSearchParams(
            window.location.search
        );

        const urlRoom = params.get("room");
        const urlHost = params.get("host");

        const hostPeerId =
            urlHost ||
            sessionStorage.getItem("hostPeerId");

        if (urlRoom) {
            currentRoom = urlRoom;
        }

        if (!hostPeerId) {
            alert(
                "This invitation link is missing the booth connection information."
            );

            return;
        }

        sessionStorage.setItem(
            "hostPeerId",
            hostPeerId
        );

        if (currentRoom) {
            roomCode.textContent = currentRoom;
        }

        showBooth();

        updateConnectionStatus(
            "Connecting to Babyy... 💕"
        );

        const guestPeerId = generatePeerId();

        peer = new Peer(guestPeerId, {
            debug: 1
        });

        peer.on("open", id => {
            console.log("Guest Peer opened:", id);

            console.log(
                "Connecting to host:",
                hostPeerId
            );

            connection = peer.connect(
                hostPeerId,
                {
                    reliable: true
                }
            );

            setupConnection(connection);

            callHost(hostPeerId);
        });

        peer.on("error", error => {
            console.error("Guest PeerJS error:", error);

            updateConnectionStatus(
                "Could not connect. Please reopen the invitation link."
            );
        });

        peer.on("disconnected", () => {
            console.log("Guest peer disconnected");
        });

        peer.on("call", call => {
            console.log("Guest received call");

            call.answer(localStream);

            call.on("stream", stream => {
                console.log("Remote host stream received");

                remoteVideo.srcObject = stream;

                remoteVideo.play().catch(() => {});

                showConnected();
            });

            call.on("error", error => {
                console.error(
                    "Guest incoming call error:",
                    error
                );
            });
        });

    } catch (error) {
        console.error("Join room error:", error);
    }
}


// ==========================================
// CALL HOST
// ==========================================

function callHost(hostPeerId) {
    if (!peer || !localStream) {
        return;
    }

    console.log("Calling host:", hostPeerId);

    const call = peer.call(
        hostPeerId,
        localStream
    );

    if (!call) {
        console.error("Could not create PeerJS call");
        return;
    }

    call.on("stream", stream => {
        console.log("Host remote stream received");

        remoteVideo.srcObject = stream;

        remoteVideo.playsInline = true;

        remoteVideo.play().catch(() => {});

        showConnected();
    });

    call.on("close", () => {
        console.log("Video call closed");
    });

    call.on("error", error => {
        console.error(
            "Outgoing call error:",
            error
        );
    });
}


// ==========================================
// CONNECTION SETUP
// ==========================================

function setupConnection(conn) {
    if (!conn) {
        return;
    }

    connection = conn;

    conn.on("open", () => {
        console.log("Data connection connected");

        if (remoteVideo.srcObject) {
            showConnected();
        } else {
            updateConnectionStatus(
                "Connected! Starting camera... 💕"
            );
        }
    });

    conn.on("data", data => {
        console.log("Received data:", data);

        if (!data) {
            return;
        }

        // ----------------------------------
        // GUEST REQUESTS PHOTO
        // ----------------------------------

        if (
            data.type === "request-countdown"
        ) {
            if (
                isHost &&
                connected &&
                connection &&
                connection.open
            ) {
                console.log(
                    "Guest requested countdown"
                );

                connection.send({
                    type: "start-countdown"
                });

                runCountdown(true);
            }

            return;
        }

        // ----------------------------------
        // HOST STARTED COUNTDOWN
        // ----------------------------------

        if (
            data.type === "start-countdown"
        ) {
            console.log(
                "Countdown started remotely"
            );

            runCountdown(false);

            return;
        }

        // ----------------------------------
        // NEW MOMENT
        // ----------------------------------

        if (
            data.type === "new-moment"
        ) {
            currentMoment = data.moment;

            updateMomentLabel();

            return;
        }

        // ----------------------------------
        // FINISH
        // ----------------------------------

        if (
            data.type === "finish"
        ) {
            finishStrip();

            return;
        }
    });

    conn.on("close", () => {
        console.log("Data connection closed");

        connected = false;

        updateConnectionStatus(
            "Connection lost 💔"
        );

        captureBtn.disabled = true;
    });

    conn.on("error", error => {
        console.error(
            "Data connection error:",
            error
        );
    });
}


// ==========================================
// SHOW CONNECTED
// ==========================================

function showConnected() {
    connected = true;

    if (remoteWaiting) {
        remoteWaiting.style.display = "none";
    }

    if (connectionStatus) {
        connectionStatus.textContent =
            "Babyy is here ❤️";
    }

    // IMPORTANT:
    // Force the shutter button to become clickable

    captureBtn.disabled = false;
    captureBtn.removeAttribute("disabled");

    captureBtn.style.pointerEvents = "auto";
    captureBtn.style.opacity = "1";

    updateMomentLabel();

    console.log(
        "CONNECTED - PHOTO BUTTON ENABLED"
    );
}


// ==========================================
// CONNECTION STATUS
// ==========================================

function updateConnectionStatus(message) {
    if (connectionStatus) {
        connectionStatus.textContent = message;
    }
}


// ==========================================
// MOMENT LABEL
// ==========================================

function updateMomentLabel() {
    if (!momentLabel) {
        return;
    }

    momentLabel.textContent =
        `Photo ${Math.min(currentMoment + 1, 4)} of 4`;
}


// ==========================================
// CAPTURE BUTTON
// ==========================================

if (captureBtn) {
    captureBtn.addEventListener(
        "click",
        () => {

            console.log(
                "PHOTO BUTTON CLICKED"
            );

            if (!connected) {
                alert(
                    "Wait for Babyy to connect first ❤️"
                );

                return;
            }

            if (
                connection &&
                connection.open === false
            ) {
                alert(
                    "Connection was lost. Please reconnect."
                );

                return;
            }

            // Prevent double tapping
            captureBtn.disabled = true;

            // ----------------------------------
            // GUEST
            // ----------------------------------

            if (!isHost) {

                console.log(
                    "Guest requesting countdown"
                );

                if (
                    connection &&
                    connection.open
                ) {
                    connection.send({
                        type:
                            "request-countdown"
                    });
                } else {
                    captureBtn.disabled =
                        false;

                    alert(
                        "Connection is not ready."
                    );
                }

                return;
            }

            // ----------------------------------
            // HOST
            // ----------------------------------

            console.log(
                "Host starting countdown"
            );

            if (
                connection &&
                connection.open
            ) {
                connection.send({
                    type:
                        "start-countdown"
                });
            }

            runCountdown(true);
        }
    );
}


// ==========================================
// COUNTDOWN
// ==========================================

async function runCountdown(isInitiator) {

    console.log(
        "Countdown:",
        isInitiator
    );

    countdown.classList.add("show");

    const numbers = [
        "3",
        "2",
        "1"
    ];

    for (const number of numbers) {

        countdown.textContent = number;

        await wait(700);
    }

    countdown.textContent = "❤️";

    await wait(350);

    countdown.classList.remove("show");

    await capturePhoto();

    currentMoment++;

    if (isHost && connection && connection.open) {
        connection.send({
            type: "new-moment",
            moment: currentMoment
        });
    }

    updateMomentLabel();

    // ----------------------------------
    // MORE PHOTOS
    // ----------------------------------

    if (currentMoment < 4) {

        captureBtn.disabled = false;

    } else {

        captureBtn.disabled = true;

        setTimeout(() => {
            finishStrip();
        }, 700);
    }
}


// ==========================================
// WAIT
// ==========================================

function wait(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}


// ==========================================
// CAPTURE PHOTO
// ==========================================

async function capturePhoto() {

    console.log("Capturing photo...");

    const canvas =
        document.createElement("canvas");

    canvas.width = 1200;
    canvas.height = 800;

    const ctx =
        canvas.getContext("2d");

    // ----------------------------------
    // BACKGROUND
    // ----------------------------------

    ctx.fillStyle = "#111";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    // ----------------------------------
    // LOCAL VIDEO
    // ----------------------------------

    const halfWidth =
        canvas.width / 2;

    if (
        localVideo.readyState >= 2 &&
        localVideo.videoWidth > 0
    ) {

        drawVideoCover(
            ctx,
            localVideo,
            0,
            0,
            halfWidth,
            canvas.height
        );
    }

    // ----------------------------------
    // REMOTE VIDEO
    // ----------------------------------

    if (
        remoteVideo.readyState >= 2 &&
        remoteVideo.videoWidth > 0
    ) {

        drawVideoCover(
            ctx,
            remoteVideo,
            halfWidth,
            0,
            halfWidth,
            canvas.height
        );

    } else {

        // fallback if remote video isn't ready

        ctx.fillStyle = "#222";

        ctx.fillRect(
            halfWidth,
            0,
            halfWidth,
            canvas.height
        );

        ctx.fillStyle = "white";

        ctx.font =
            "32px Arial";

        ctx.textAlign =
            "center";

        ctx.fillText(
            "❤️",
            halfWidth + halfWidth / 2,
            canvas.height / 2
        );
    }

    // ----------------------------------
    // HEART DECORATION
    // ----------------------------------

    ctx.font = "48px Arial";

    ctx.fillText(
        "♡",
        40,
        70
    );

    ctx.fillText(
        "♡",
        canvas.width - 80,
        70
    );

    // ----------------------------------
    // SAVE
    // ----------------------------------

    const image =
        canvas.toDataURL(
            "image/jpeg",
            0.92
        );

    photos[currentMoment] = image;

    console.log(
        "Photo saved:",
        currentMoment
    );
}


// ==========================================
// DRAW VIDEO COVER
// ==========================================

function drawVideoCover(
    ctx,
    video,
    x,
    y,
    width,
    height
) {

    const videoWidth =
        video.videoWidth;

    const videoHeight =
        video.videoHeight;

    if (
        !videoWidth ||
        !videoHeight
    ) {
        return;
    }

    const videoRatio =
        videoWidth / videoHeight;

    const boxRatio =
        width / height;

    let sourceWidth =
        videoWidth;

    let sourceHeight =
        videoHeight;

    let sourceX = 0;
    let sourceY = 0;

    if (videoRatio > boxRatio) {

        sourceWidth =
            videoHeight * boxRatio;

        sourceX =
            (videoWidth - sourceWidth) / 2;

    } else {

        sourceHeight =
            videoWidth / boxRatio;

        sourceY =
            (videoHeight - sourceHeight) / 2;
    }

    ctx.save();

    // Mirror selfie camera
    if (video === localVideo) {

        ctx.translate(
            x + width,
            y
        );

        ctx.scale(-1, 1);

        x = 0;
    }

    ctx.drawImage(
        video,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        x,
        y,
        width,
        height
    );

    ctx.restore();
}


// ==========================================
// FINISH STRIP
// ==========================================

function finishStrip() {

    console.log(
        "Finishing photo strip..."
    );

    if (isHost && connection && connection.open) {
        connection.send({
            type: "finish"
        });
    }

    createPhotoStrip();

    showResult();
}


// ==========================================
// CREATE PHOTO STRIP
// ==========================================

function createPhotoStrip() {

    if (!stripCanvas) {
        return;
    }

    const canvas =
        stripCanvas;

    const ctx =
        canvas.getContext("2d");

    const width = 700;

    const photoWidth = 620;

    const photoHeight = 420;

    const gap = 30;

    const topSpace = 100;

    const bottomSpace = 120;

    canvas.width = width;

    canvas.height =
        topSpace +
        photoHeight * 4 +
        gap * 3 +
        bottomSpace;

    // Background

    ctx.fillStyle = "#fff";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    // Title

    ctx.fillStyle = "#111";

    ctx.font =
        "bold 38px Arial";

    ctx.textAlign =
        "center";

    ctx.fillText(
        "Our Moments ♡",
        width / 2,
        58
    );

    // Photos

    for (
        let i = 0;
        i < 4;
        i++
    ) {

        if (!photos[i]) {
            continue;
        }

        const img =
            new Image();

        img.onload = () => {

            const x =
                (width - photoWidth) / 2;

            const y =
                topSpace +
                i * (photoHeight + gap);

            ctx.drawImage(
                img,
                x,
                y,
                photoWidth,
                photoHeight
            );

            ctx.strokeStyle =
                "#eee";

            ctx.lineWidth = 4;

            ctx.strokeRect(
                x,
                y,
                photoWidth,
                photoHeight
            );

            drawStripFooter(
                ctx,
                width,
                canvas.height
            );
        };

        img.src = photos[i];
    }

    if (
        photos.filter(Boolean).length === 0
    ) {
        drawStripFooter(
            ctx,
            width,
            canvas.height
        );
    }
}


// ==========================================
// STRIP FOOTER
// ==========================================

function drawStripFooter(
    ctx,
    width,
    height
) {

    ctx.fillStyle =
        "#111";

    ctx.font =
        "24px Arial";

    ctx.textAlign =
        "center";

    ctx.fillText(
        "Together, even from miles away ❤️",
        width / 2,
        height - 55
    );
}


// ==========================================
// INVITATION LINK
// ==========================================

function getInviteLink() {

    if (!peer || !peer.id) {
        return "";
    }

    return (
        window.location.origin +
        window.location.pathname +
        "?room=" +
        encodeURIComponent(
            currentRoom
        ) +
        "&host=" +
        encodeURIComponent(
            peer.id
        )
    );
}


// ==========================================
// INVITE
// ==========================================

if (inviteBtn) {

    inviteBtn.addEventListener(
        "click",
        async () => {

            const link =
                getInviteLink();

            if (!link) {
                return;
            }

            if (
                navigator.share
            ) {

                try {

                    await navigator.share({
                        title:
                            "Our Photo Booth ❤️",
                        text:
                            "Come take cute photos with me 🥹❤️",
                        url: link
                    });

                } catch (error) {

                    console.log(
                        "Share cancelled"
                    );
                }

            } else {

                await navigator.clipboard.writeText(
                    link
                );

                alert(
                    "Invitation link copied ❤️"
                );
            }
        }
    );
}


// ==========================================
// COPY INVITE
// ==========================================

if (copyInviteBtn) {

    copyInviteBtn.addEventListener(
        "click",
        async () => {

            const link =
                getInviteLink();

            if (!link) {
                return;
            }

            try {

                await navigator.clipboard.writeText(
                    link
                );

                const oldText =
                    copyInviteBtn.textContent;

                copyInviteBtn.textContent =
                    "Copied ❤️";

                setTimeout(() => {

                    copyInviteBtn.textContent =
                        oldText;

                }, 1800);

            } catch (error) {

                console.error(
                    "Copy failed:",
                    error
                );

                prompt(
                    "Copy this invitation link:",
                    link
                );
            }
        }
    );
}


// ==========================================
// CREATE BUTTON
// ==========================================

if (startCreateBtn) {

    startCreateBtn.addEventListener(
        "click",
        async () => {

            await createRoom();
        }
    );
}


// ==========================================
// JOIN BUTTON
// ==========================================

if (startJoinBtn) {

    startJoinBtn.addEventListener(
        "click",
        () => {

            showJoin();
        }
    );
}


if (joinBtn) {

    joinBtn.addEventListener(
        "click",
        async () => {

            await joinRoom();
        }
    );
}


// ==========================================
// PAGE LOAD
// ==========================================

window.addEventListener(
    "DOMContentLoaded",
    () => {

        const params =
            new URLSearchParams(
                window.location.search
            );

        const room =
            params.get("room");

        const host =
            params.get("host");

        // ----------------------------------
        // OPENED FROM INVITATION
        // ----------------------------------

        if (room && host) {

            currentRoom = room;

            sessionStorage.setItem(
                "hostPeerId",
                host
            );

            showJoin();

            console.log(
                "Invitation detected:",
                room,
                host
            );

        } else {

            showHome();
        }
    }
);


// ==========================================
// CLEANUP
// ==========================================

window.addEventListener(
    "beforeunload",
    () => {

        if (localStream) {

            localStream
                .getTracks()
                .forEach(track => {
                    track.stop();
                });
        }

        if (peer) {
            peer.destroy();
        }
    }
);