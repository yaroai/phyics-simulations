import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- 3D LOADERS ---
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { PDBLoader } from 'three/addons/loaders/PDBLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';


// --- BLUEPRINT STATE ---
const BP_STATE = {
    source: null,
    threshold: 100,
    scale: 1.0,
    fill: false
};


import { initializeApp } from "firebase/app";
import { getFirestore, collection, setDoc, doc, addDoc, getDocs, query, orderBy, limit, where, getDoc, startAfter } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
    apiKey: "AIzaSyADPywVsfmTEslepJzWu8vbaX0YwbkdA2A",
    authDomain: "drone-swarm-1a6a2.firebaseapp.com",
    projectId: "drone-swarm-1a6a2",
    storageBucket: "drone-swarm-1a6a2.firebasestorage.app",
    messagingSenderId: "490149908800",
    appId: "1:490149908800:web:0aeee4b39214c97397eaa5",
    measurementId: "G-M9NYLJ2JPJ"
};

let db;
try {
    const app = initializeApp(firebaseConfig);
    // Enable debug token for local development to avoid ReCAPTCHA errors
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname === "") {
        console.log("Local environment detected: Firebase App Check (ReCAPTCHA) skipped to prevent errors.");
    } else {
        const appCheck = initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider('6Lc74RMsAAAAAF9r0FM3yT2L83nz9NJ3lgEuKAZe'),
            isTokenAutoRefreshEnabled: true
        });
    }
    db = getFirestore(app);
} catch (e) { console.warn("Connection Failed", e); }

THREE.Color.lerp = function (c1, c2, t) { return new THREE.Color(c1).lerp(new THREE.Color(c2), t); };

const CONFIG = { count: 20000, maxSize: 70, particleSize: 0.25, hoverStrength: 0.05 };
window.CONFIG = CONFIG; // Expose for Export Manager
const STATE = {
    mode: 'sphere',
    videoPlaying: false, videoGrid: null,
    customShapes: {}, customUpdateFunction: null,
    textAnim: 'static', textWidthWorld: 0,
    lastDraw: null, speed: 1.0, simTime: 0,
    showHUD: window.innerWidth > 768, showAnnotations: window.innerWidth > 768,
    customParams: {},
    controlsCreated: new Set(),
    controlKeys: [],
    // Render State
    renderStyle: 'spark', // spark, plasma, vector, cyber
    autoSpin: true, // NEW: Custom Auto Spin Flag
    // Model State
    loadedModel: null,
    mixer: null,
    modelMode: 0, // 0: Particles, 1: Solid
    // Hand Control State
    handControlEnabled: false,
    gestureParams: {
        lastRotateX: null,
        lastRotateY: null,
        lastRotateX: null,
        lastRotateY: null,
        lastPinchX: null,
        lastDist: null
    },
    activeCustomCode: null, // NEW: For Export
    activeSimId: 'sphere', // NEW: For Navigation Tracking
    favorites: JSON.parse(localStorage.getItem('swarm_favorites') || '[]'),
    showFavoritesOnly: false
};
window.STATE = STATE; // Expose for Export Manager

// --- HAND GESTURE CONTROL LOGIC (REVISED & FIXED) ---
let handCamera, hands;
const webcamCanvas = document.getElementById('webcam-canvas');
const webcamCtx = webcamCanvas.getContext('2d');
const videoElement = document.getElementById('webcam-raw');
const statusEl = document.getElementById('gesture-status');
const handIconBtn = document.getElementById('btn-hand-icon');
const gestureGuide = document.getElementById('gesture-guide');

window.closeHandGuide = () => {
    gestureGuide.style.display = 'none';
}

window.toggleHandControl = async () => {
    if (!STATE.handControlEnabled) {
        try {
            if (!hands) initHands();
            await handCamera.start();
            STATE.handControlEnabled = true;
            document.getElementById('gesture-layer').style.display = 'block';
            statusEl.style.display = 'block';
            gestureGuide.style.display = 'flex';
            handIconBtn.classList.add('active');
            controls.autoRotate = false;
            updateAutoRotateUI();
            resizeWebcamCanvas();
        } catch (e) { alert("Camera access denied."); console.error(e); }
    } else {
        if (handCamera) await handCamera.stop();
        STATE.handControlEnabled = false;
        document.getElementById('gesture-layer').style.display = 'none';
        statusEl.style.display = 'none';
        gestureGuide.style.display = 'none';
        handIconBtn.classList.remove('active');
        controls.autoRotate = true;
        updateAutoRotateUI();
    }
};

window.updateRenderStyle = (style) => {
    if (STATE.renderStyle === style) return;
    STATE.renderStyle = style;

    // Update UI Buttons
    document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`button[onclick="updateRenderStyle('${style}')"]`).classList.add('active');

    // Swap Geometry/Material WITHOUT resetting simulation
    if (mesh) {
        // 1. Capture current state
        const currentMatrix = mesh.instanceMatrix.clone();
        const currentColors = mesh.instanceColor ? mesh.instanceColor.clone() : null;
        const currentVisible = mesh.visible;

        // 2. Remove old mesh
        worldGroup.remove(mesh); // Remove from worldGroup
        scene.remove(mesh);      // Safety check
        mesh.dispose();

        // 3. Select New Assets
        let geo = sparkGeo;
        let mat = sparkMaterial;
        if (style === 'plasma') { geo = plasmaGeo; mat = plasmaMaterial; }
        else if (style === 'vector') { geo = vectorGeo; mat = vectorMaterial; }
        else if (style === 'cyber') { geo = cyberGeo; mat = cyberMaterial; }
        else if (style === 'ink') { geo = plasmaGeo; mat = inkMaterial; }
        else if (style === 'paint') { geo = plasmaGeo; mat = paintMaterial; }
        else if (style === 'steel') { geo = sphereGeo; mat = steelMaterial; }
        else if (style === 'glass') { geo = sphereGeo; mat = glassMaterial; }

        // 4. Create new Mesh
        mesh = new THREE.InstancedMesh(geo, mat, CONFIG.count);

        // 5. Restore State
        mesh.instanceMatrix.copy(currentMatrix);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        if (currentColors) mesh.instanceColor = currentColors;
        mesh.visible = currentVisible;

        // 6. Add to WorldGroup
        worldGroup.add(mesh);
    }
};

// --- SHADERS & MATERIALS ---
const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff }); // Default
const cyberMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true });
const vectorMaterial = new THREE.MeshBasicMaterial({ color: 0x00aaff });

const plasmaMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 }
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
            vUv = uv;
            vColor = instanceColor; // Read from InstancedMesh attribute
            vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        uniform float uTime;
        void main() {
            float dist = distance(vUv, vec2(0.5));
            float ring = smoothstep(0.4, 0.45, dist) - smoothstep(0.45, 0.5, dist);
            float core = 1.0 - smoothstep(0.0, 0.1, dist);
            float alpha = core + ring * (0.5 + 0.5 * sin(uTime * 3.0));
            if (alpha < 0.05) discard;
            // Mix neon green with instance color (allow blue/red/etc prompts to shine through)
            gl_FragColor = vec4(vColor, alpha); 
        }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
});

// --- NEW SHADERS ---

// 1. INK SHADER (Smoky/Diffused)
const inkMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        void main() { 
            vUv = uv; 
            vColor = instanceColor;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); 
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        uniform float uTime;
        
        // Simplex Noise (Approximation)
        float rand(vec2 n) { return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }
        float noise(vec2 p) { vec2 ip = floor(p); vec2 u = fract(p); u = u*u*(3.0-2.0*u); float res = mix(mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y); return res * res; }

        void main() {
            float dist = distance(vUv, vec2(0.5));
            float n = noise(vUv * 5.0 + uTime * 0.5);
            float alpha = (1.0 - smoothstep(0.2, 0.5, dist)) * (0.5 + 0.5 * n);
            if(alpha < 0.1) discard;
            // Use instance color but lighter/pastel for ink feel
            gl_FragColor = vec4(vColor + 0.2, alpha * 0.8);
        }
    `,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
});

// 2. PAINT SHADER (Oil Slick)
const paintMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        void main() { 
            vUv = uv; 
            vColor = instanceColor;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); 
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        uniform float uTime;
        void main() {
            vec2 p = vUv * 2.0 - 1.0;
            // Pattern generation
            for(int i=1; i<4; i++) {
                p.x += 0.3/float(i)*sin(float(i)*3.0*p.y + uTime*0.4);
                p.y += 0.3/float(i)*cos(float(i)*3.0*p.x + uTime*0.4);
            }
            float r = cos(p.x+p.y+1.0)*0.5+0.5;
            float pattern = (sin(p.x+p.y)+cos(p.x+p.y))*0.5+0.5;
            
            float dist = distance(vUv, vec2(0.5));
            if(dist > 0.5) discard;
            
            // Mix pattern with instance color
            vec3 finalColor = mix(vColor, vec3(r, pattern, 1.0 - r), 0.3); // 70% instance color, 30% pattern
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `,
    side: THREE.DoubleSide
});

// 3. STEEL SHADER (MatCap Approximation)
// Simple Lit Sphere approximation since we don't have a texture
const steelMaterial = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vColor;
        void main() {
            vNormal = normalize(normalMatrix * normal); // Normal in view space
            vColor = instanceColor;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vColor;
        void main() {
            vec3 viewDir = vec3(0.0, 0.0, 1.0);
            float metallic = dot(vNormal, viewDir) * 0.5 + 0.5;
            metallic = pow(metallic, 3.0); // Sharpen highlight
            
            // Tint reflections with instance color
            vec3 col = mix(vec3(0.1), vColor, 0.5) * metallic + vec3(0.2); 
            gl_FragColor = vec4(col, 1.0);
        }
    `
});

// 4. GLASS SHADER (Fresnel)
const glassMaterial = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vColor;
        void main() {
            vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vViewPosition = -mvPosition.xyz;
            vColor = instanceColor;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vColor;
        void main() {
            float fresnel = dot(vNormal, normalize(vViewPosition));
            fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
            fresnel = pow(fresnel, 2.0);
            
            // Glass tint based on instance color
            vec3 col = vColor * fresnel + vec3(0.1); 
            gl_FragColor = vec4(col, 0.3 + fresnel * 0.7); // Low alpha center, high alpha rim
        }
    `,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
});

// Geometries
const sparkGeo = new THREE.TetrahedronGeometry(CONFIG.particleSize);
const vectorGeo = new THREE.ConeGeometry(0.1, 0.5, 4);
vectorGeo.rotateX(Math.PI / 2); // Point forward
const plasmaGeo = new THREE.PlaneGeometry(0.8, 0.8);
const cyberGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
const sphereGeo = new THREE.SphereGeometry(0.3, 16, 16);

function resizeWebcamCanvas() {
    webcamCanvas.width = window.innerWidth;
    webcamCanvas.height = window.innerHeight;
}
window.addEventListener('resize', () => { if (STATE.handControlEnabled) resizeWebcamCanvas(); });

function initHands() {
    hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
    hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });
    hands.onResults(onHandResults);

    handCamera = new Camera(videoElement, {
        onFrame: async () => { await hands.send({ image: videoElement }); },
        width: 1280,
        height: 720,
        facingMode: "user"
    });
}

function onHandResults(results) {
    webcamCtx.clearRect(0, 0, webcamCanvas.width, webcamCanvas.height);

    let statusText = "GESTURE READY";

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0];

        // DRAW LANDMARKS
        drawConnectors(webcamCtx, lm, HAND_CONNECTIONS, { color: '#00ff88', lineWidth: 4 });
        drawLandmarks(webcamCtx, lm, { color: '#ffffff', lineWidth: 2, radius: 4 });

        // FINGER STATES (Tips vs PIP joints)
        // Y increases downwards (0=top, 1=bottom). Tip < PIP means finger is UP.
        const isIndexUp = lm[8].y < lm[6].y;
        const isMiddleUp = lm[12].y < lm[10].y;
        const isRingUp = lm[16].y < lm[14].y;
        const isPinkyUp = lm[20].y < lm[18].y;

        // 1. OPEN PALM (At least 4 fingers up)
        if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
            statusText = "✋ PALM ZOOM";

            // Track X Movement of the Wrist (lm[0]) or Palm Center (lm[9])
            const currentX = lm[9].x; // Middle Finger MCP (Palm Center)

            if (STATE.gestureParams.lastPinchX !== null) {
                const dx = currentX - STATE.gestureParams.lastPinchX;
                // dx > 0 (Moving Right) -> Zoom OUT
                // dx < 0 (Moving Left)  -> Zoom IN

                if (Math.abs(dx) > 0.002) {
                    const zoomSpeed = 200.0; // Sensitivity
                    const forward = new THREE.Vector3();
                    camera.getWorldDirection(forward);

                    // Left to Right (dx > 0) >> Zoom Out (Move Backwards)
                    // We consume dx directly. 
                    // To Zoom Out (move back opposite to lookDir), we SUBTRACT forward vector?
                    // forward points to target. 
                    // camera.position.sub(forward) -> moves back.
                    // If dx > 0, we want to move back.
                    // So: camera.position.sub(forward * dx * speed)
                    // Or: camera.position.add(forward * -dx * speed)

                    // But wait, "Left to Right >> Zoom Out". 
                    // Movement: L->R means `dx` is POSITIVE.
                    // Zoom Out means Camera moves AWAY from target.
                    // Vector: -forward.
                    // So if dx > 0, result should be -forward.
                    // Formula: position.add(forward * -dx) -> position.add(forward * -positive) -> position - forward. Correct.

                    // Fix: Use clone() to avoid mutating 'forward' in-place.
                    const cameraMove = forward.clone().multiplyScalar(-dx * zoomSpeed);
                    camera.position.add(cameraMove);

                    const targetMove = forward.clone().multiplyScalar(-dx * zoomSpeed * 0.1);
                    controls.target.add(targetMove);

                    controls.update();
                }
            }
            STATE.gestureParams.lastPinchX = currentX;
            STATE.gestureParams.lastRotateX = null;
            STATE.gestureParams.lastRotateY = null;
            STATE.gestureParams.lastDist = null;

        }
        // 2. PEACE SIGN (Index + Middle Only)
        else if (isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) {
            statusText = "✌️ SPEED X";

            // Track X Movement
            const currentX = (lm[8].x + lm[12].x) / 2;

            if (STATE.gestureParams.lastPinchX !== null) {
                const dx = currentX - STATE.gestureParams.lastPinchX;

                // dx > 0 (Right) -> Increase Speed
                // dx < 0 (Left)  -> Decrease Speed
                if (Math.abs(dx) > 0.005) {
                    STATE.speed += dx * 2.0; // Positive dx adds to speed
                    STATE.speed = Math.max(0.1, Math.min(3.0, STATE.speed));
                    const slider = document.getElementById('speedSlider');
                    if (slider) slider.value = STATE.speed;
                }
            }
            STATE.gestureParams.lastPinchX = currentX;
            STATE.gestureParams.lastRotateX = null;
            STATE.gestureParams.lastRotateY = null;
            STATE.gestureParams.lastDist = null;
        }
        // 3. POINT (Index Only)
        else if (isIndexUp && !isMiddleUp) {
            statusText = "👆 ROTATE";

            const x = lm[8].x;
            const y = lm[8].y;

            if (STATE.gestureParams.lastRotateX !== null) {
                const dx = (x - STATE.gestureParams.lastRotateX);
                const dy = (y - STATE.gestureParams.lastRotateY);

                if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
                    const rotateSpeed = 3.0;
                    const spherical = new THREE.Spherical();
                    spherical.setFromVector3(camera.position.clone().sub(controls.target));

                    // Standard Orbit control (Inverted from Object Spin).
                    spherical.theta += (dx * rotateSpeed);
                    spherical.phi -= (dy * rotateSpeed);
                    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

                    const offset = new THREE.Vector3().setFromSpherical(spherical);
                    camera.position.copy(controls.target).add(offset);
                    camera.lookAt(controls.target);
                    controls.update();
                }
            }
            STATE.gestureParams.lastRotateX = x;
            STATE.gestureParams.lastRotateY = y;
            STATE.gestureParams.lastPinchX = null;
            STATE.gestureParams.lastDist = null;
        }
        else {
            statusText = "✊ WAITING";
            STATE.gestureParams.lastRotateX = null;
            STATE.gestureParams.lastRotateY = null;
            STATE.gestureParams.lastPinchX = null;
            STATE.gestureParams.lastDist = null;
        }

        statusEl.innerText = `${statusText} | SPD: ${STATE.speed.toFixed(1)}`;
    } else {
        statusEl.innerText = "NO HANDS";
        STATE.gestureParams.lastRotateX = null;
        STATE.gestureParams.lastRotateY = null;
        STATE.gestureParams.lastPinchX = null;
        STATE.gestureParams.lastDist = null;
    }
}



// --- MUSIC PLAYER ---
const playlist = [
    { title: "Interstellar", src: "sounds/track1.mp3" },
    { title: "Oppenheimer", src: "sounds/track2.mp3" },
    { title: "Gladiator", src: "sounds/track3.mp3" }
];

let currentTrackIdx = 0;
let isMusicPlaying = false;
const audioObj = new Audio();
audioObj.volume = 0.5;

audioObj.addEventListener('ended', () => { nextTrack(); });
audioObj.addEventListener('error', (e) => { console.warn("Audio file missing."); });

window.togglePlay = () => {
    if (!audioObj.src) loadTrack(currentTrackIdx);
    if (isMusicPlaying) { audioObj.pause(); isMusicPlaying = false; }
    else { audioObj.play().catch(e => console.log("Audio play prevented")); isMusicPlaying = true; }
    updateMusicUI();
};

window.nextTrack = () => { currentTrackIdx = (currentTrackIdx + 1) % playlist.length; loadTrack(currentTrackIdx); if (isMusicPlaying) audioObj.play(); };
window.prevTrack = () => { currentTrackIdx = (currentTrackIdx - 1 + playlist.length) % playlist.length; loadTrack(currentTrackIdx); if (isMusicPlaying) audioObj.play(); };

function loadTrack(index) { audioObj.src = playlist[index].src; showTrackName(playlist[index].title); }
function updateMusicUI() { document.getElementById('icon-play').style.display = isMusicPlaying ? 'none' : 'block'; document.getElementById('icon-pause').style.display = isMusicPlaying ? 'block' : 'none'; }
function showTrackName(name) {
    const el = document.getElementById('track-info'); el.innerText = name; el.classList.add('show');
    setTimeout(() => { el.classList.remove('show'); }, 3000);
}
if (playlist.length > 0) audioObj.src = playlist[0].src;


// --- GLOBAL RESET ---
function resetScene() {
    document.getElementById('annotation-layer').innerHTML = ''; annotations.clear();
    document.getElementById('hud-title').innerText = ""; document.getElementById('hud-desc').innerText = "";
    document.getElementById('hud-panel').classList.remove('visible');
    document.getElementById('controls-container').innerHTML = '';
    document.getElementById('controls-panel').classList.remove('visible');
    STATE.controlsCreated.clear(); STATE.customParams = {}; STATE.controlKeys = [];

    // --- Media UI Reset (Conditional to allow active uploads) ---
    if (STATE.mode !== 'image') {
        document.getElementById('imgInput').value = '';
        document.getElementById('imgName').innerText = "";
        STATE.imgSource = null;
    }
    if (STATE.mode !== 'video') {
        document.getElementById('vidInput').value = '';
        document.getElementById('vidName').innerText = "";
        STATE.vidSource = null;
        document.getElementById('video-proc').pause();
        STATE.videoPlaying = false;
    }
    if (STATE.mode !== 'model') {
        document.getElementById('modelInput').value = '';
        document.getElementById('modelName').innerText = "(GLB, OBJ, PDB)";
    }
    if (STATE.mode !== 'blueprint') {
        document.getElementById('blueprintInput').value = '';
        document.getElementById('blueprintName').innerText = "";
        BP_STATE.source = null;
    }

    // Clean up Loaded Model
    if (STATE.loadedModel) {
        scene.remove(STATE.loadedModel);
        STATE.loadedModel = null;
        STATE.mixer = null;
        STATE.modelMode = 0;
    }
    mesh.visible = true; // Default back to particles

    if (!STATE.handControlEnabled) {
        controls.autoRotate = STATE.autoSpin; // Restore saved preference
        updateAutoRotateUI();
    }

    // --- DEEP SANITATION ---
    // If a previous simulation leaked NaN into the vectors, we must purge them
    for (let i = 0; i < CONFIG.count; i++) {
        if (positions.current[i] && (isNaN(positions.current[i].x) || !isFinite(positions.current[i].x))) {
            positions.current[i].set(0, 0, 0);
        }
        if (positions.target[i] && (isNaN(positions.target[i].x) || !isFinite(positions.target[i].x))) {
            positions.target[i].set(0, 0, 0);
        }
    }
}


window.toggleInfo = () => {
    STATE.showHUD = !STATE.showHUD;
    const el = document.getElementById('hud-panel');
    if (document.getElementById('hud-title').innerText !== "") { if (STATE.showHUD) el.classList.add('visible'); else el.classList.remove('visible'); }
    document.getElementById('btn-toggle-info').classList.toggle('active');
};

window.toggleAnnotations = () => {
    STATE.showAnnotations = !STATE.showAnnotations;
    document.getElementById('annotation-layer').style.opacity = STATE.showAnnotations ? '1' : '0';
    document.getElementById('btn-toggle-anno').classList.toggle('active');
};

window.setInfo = (title, desc) => {
    const tEl = document.getElementById('hud-title');
    if (tEl.innerText !== title) { tEl.innerText = title; document.getElementById('hud-desc').innerText = desc; if (STATE.showHUD) document.getElementById('hud-panel').classList.add('visible'); }
};

window.toggleControls = () => {
    const el = document.getElementById('controls-panel');
    const btn = document.getElementById('btn-toggle-controls');
    el.classList.toggle('visible');
    btn.classList.toggle('active');
};

// --- UI UTILS ---
window.toggleAutoRotate = () => {
    STATE.autoSpin = !STATE.autoSpin;
    controls.autoRotate = STATE.autoSpin;
    updateAutoRotateUI();
};

function updateAutoRotateUI() {
    const btn = document.getElementById('btn-auto-rotate');
    if (STATE.autoSpin) btn.classList.add('active');
    else btn.classList.remove('active');
}
window.addControl = (id, label, min, max, initial) => {
    if (STATE.controlsCreated.has(id)) return STATE.customParams[id];
    STATE.controlsCreated.add(id); STATE.customParams[id] = initial;
    STATE.controlKeys.push(id);

    const container = document.getElementById('controls-container');
    const div = document.createElement('div'); div.className = 'control-item';
    div.innerHTML = `<div class="control-label"><span>${label}</span> <span class="control-val" id="val-${id}">${initial}</span></div><input type="range" min="${min}" max="${max}" step="${(max - min) / 100}" value="${initial}">`;
    div.querySelector('input').addEventListener('input', (e) => { const v = parseFloat(e.target.value); STATE.customParams[id] = v; div.querySelector(`#val-${id}`).innerText = v.toFixed(2); });
    container.appendChild(div);
    document.getElementById('controls-panel').classList.add('visible');
    document.getElementById('btn-toggle-controls').classList.add('active');
    return initial;
};

// Helper to add Dropdown to Custom Controls
function addDropdown(id, label, options, callback) {
    const container = document.getElementById('controls-container');
    const div = document.createElement('div'); div.className = 'control-item';

    let optsHTML = '';
    options.forEach((opt, idx) => { optsHTML += `<option value="${idx}">${opt}</option>`; });

    div.innerHTML = `<div class="control-label"><span>${label}</span></div><select id="${id}">${optsHTML}</select>`;
    div.querySelector('select').addEventListener('change', (e) => { callback(parseInt(e.target.value)); });

    container.appendChild(div);
    document.getElementById('controls-panel').classList.add('visible');
    document.getElementById('btn-toggle-controls').classList.add('active');
}

const annotations = new Map();
window.annotate = (id, vector, label) => {
    if (!annotations.has(id)) {
        const div = document.createElement('div'); div.className = 'annotation';
        div.innerHTML = `<div class="anno-dot"></div><div class="anno-line"></div><div class="anno-text">${label}</div>`;
        document.getElementById('annotation-layer').appendChild(div); annotations.set(id, { pos: vector.clone(), label: label, element: div });
    } else {
        const anno = annotations.get(id); anno.pos.copy(vector);
        if (anno.label !== label) { anno.label = label; anno.element.querySelector('.anno-text').innerText = label; }
    }
};

// --- THREE JS ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.01);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 0, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// WORLD GROUP (For Object-Centric Rotation)
const worldGroup = new THREE.Group();
scene.add(worldGroup);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableRotate = true; // RE-ENABLED
controls.enablePan = false;   // DISABLED to lock pivot to object center (Fixes "Flag" effect)
controls.enableZoom = true;
controls.autoRotate = true;   // Default ON
controls.autoRotateSpeed = 2.0;
window.controls = controls;   // Expose for auto-demo / attract mode

// TOUCH/MOUSE EVENTS (REMOVED CUSTOM LOGIC)
// We rely on standard OrbitControls for stable, consistent rotation.

// Lighting for Solid Models
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(50, 50, 50);
scene.add(dirLight); // Light stays static in World (camera relative) or Scene? Scene. 
// If we want light to rotate WITH object, add to worldGroup.
// Usually light is fixed or camera relative. Fixed in scene means object rotates under light. OK.

// Sync UI with Initial State
if (STATE.showHUD) document.getElementById('btn-toggle-info').classList.add('active');
if (STATE.showAnnotations) document.getElementById('btn-toggle-anno').classList.add('active');

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.strength = 1.8; bloomPass.radius = 0.4; bloomPass.threshold = 0;
composer.addPass(bloomPass);

// Expose WebGL references for Image Export
window.THREE = THREE;
window.scene = scene;
window.camera = camera;
window.renderer = renderer;
window.composer = composer;
window.GLTFExporter = GLTFExporter;
window.OBJExporter = OBJExporter;

let mesh;
const dummy = new THREE.Object3D();
const color = new THREE.Color();
const positions = { current: [], target: [] };
window.positions = positions; // Expose for Export Manager
const extras = [];
// Removed static geometry/material assignment here, moved to initParticles

function initParticles(count) {
    document.getElementById('loader').style.display = 'block';
    setTimeout(() => {
        if (mesh) {
            scene.remove(mesh);
            worldGroup.remove(mesh); // Ensure removal from worldGroup too
            mesh.dispose();
        }
        CONFIG.count = parseInt(count);
        positions.current = []; positions.target = []; extras.length = 0;

        // Select Geometry & Material based on STATE.renderStyle
        let geo = sparkGeo;
        let mat = sparkMaterial;

        if (STATE.renderStyle === 'plasma') { geo = plasmaGeo; mat = plasmaMaterial; }
        else if (STATE.renderStyle === 'vector') { geo = vectorGeo; mat = vectorMaterial; }
        else if (STATE.renderStyle === 'cyber') { geo = cyberGeo; mat = cyberMaterial; }
        else if (STATE.renderStyle === 'ink') { geo = plasmaGeo; mat = inkMaterial; }
        else if (STATE.renderStyle === 'paint') { geo = plasmaGeo; mat = paintMaterial; }
        else if (STATE.renderStyle === 'steel') { geo = sphereGeo; mat = steelMaterial; }
        else if (STATE.renderStyle === 'glass') { geo = sphereGeo; mat = glassMaterial; }

        mesh = new THREE.InstancedMesh(geo, mat, CONFIG.count);
        window.mesh = mesh; // Expose for export
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        // scene.add(mesh); // REMOVED
        worldGroup.add(mesh); // ADDED TO WORLD GROUP

        for (let i = 0; i < CONFIG.count; i++) {
            const x = (Math.random() - 0.5) * 100; const y = (Math.random() - 0.5) * 100; const z = (Math.random() - 0.5) * 100;
            positions.current.push(new THREE.Vector3(x, y, z)); positions.target.push(new THREE.Vector3(x, y, z));
            extras.push({ id: i, seed: Math.random() * 100, ox: 0, oy: 0, oz: 0 });
            dummy.position.set(x, y, z); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, color.setHex(0x00ff88));
        }

        if (STATE.mode === 'custom' && STATE.customShapes[STATE.customName]) runCustom(STATE.customShapes[STATE.customName], STATE.customName);
        else setShape(STATE.mode);

        document.getElementById('loader').style.display = 'none';
    }, 100);
}
initParticles(CONFIG.count);

// --- 3D MODEL PROCESSING (PARTICLES OR SOLID) ---
// --- 3D MODEL PROCESSING (PARTICLES OR SOLID) ---
// --- 3D MODEL PROCESSING (PARTICLES OR SOLID) ---
function processModel(file) {
    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop().toLowerCase();
    document.getElementById('loader').innerText = "PROCESSING 3D DATA...";
    document.getElementById('loader').style.display = 'block';

    let loader;
    if (ext === 'glb' || ext === 'gltf') loader = new GLTFLoader();
    else if (ext === 'obj') loader = new OBJLoader();
    else if (ext === 'pdb') loader = new PDBLoader();
    else if (ext === 'ply') loader = new PLYLoader();
    else { alert("Unsupported format"); document.getElementById('loader').style.display = 'none'; return; }

    loader.load(url, (object) => {
        STATE.mode = 'model';
        resetScene();
        STATE.currentFile = file; // Persist for re-processing
        STATE.videoPlaying = false;
        STATE.customUpdateFunction = null;


        const isLowPerf = (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) ||
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        console.log("Hardware Concurrency:", navigator.hardwareConcurrency, "LowPerf Mode:", isLowPerf);

        // Case: PDB (Molecular)
        if (ext === 'pdb') {
            // PDBLoader returns { geometryAtoms, geometryBonds, json }, NOT a scene graph
            const atomGeo = object.geometryAtoms;
            const bondGeo = object.geometryBonds;
            const json = object.json; // Access raw atom data structure

            // Create Visual Reference (Solid)
            const group = new THREE.Group();
            const atoms = new THREE.Points(atomGeo, new THREE.PointsMaterial({ size: 1, vertexColors: true }));
            const bonds = new THREE.LineSegments(bondGeo, new THREE.LineBasicMaterial({ color: 0xffffff }));
            group.add(atoms); group.add(bonds);
            STATE.loadedModel = group; scene.add(group);

            atomGeo.computeBoundingBox();
            const center = new THREE.Vector3(); atomGeo.boundingBox.getCenter(center);
            const size = new THREE.Vector3(); atomGeo.boundingBox.getSize(size);
            const scale = 70 / Math.max(size.x, size.y, size.z);
            group.position.copy(center).multiplyScalar(-scale); group.scale.set(scale, scale, scale);

            // --- BACKBONE & RIBBON EXTRACTION ---
            // Filter for Alpha-Carbons ("CA") to trace the main chain
            // Since parsing "CA" from geometry is hard without the raw JSON or parsing order,
            // we will assume the Geometry is ordered (Atom 1, Atom 2...).
            // We will create a "Ribbon" by sampling the curve with OUTRIGGERS (Binormals).

            const positionsRaw = [];
            const colorsRaw = [];
            const posAttr = atomGeo.getAttribute('position');
            const colAttr = atomGeo.getAttribute('color');

            // Collect all atoms (simplified backbone assumption: sequence of atoms traces structure)
            // Real PDB backbone is N-CA-C...
            // But just connecting all atoms gives a jagged mess.
            // Connecting every ~3rd atom (approx CA spacing) gives a smoother backbone.
            for (let k = 0; k < posAttr.count; k++) {
                positionsRaw.push(new THREE.Vector3(posAttr.getX(k), posAttr.getY(k), posAttr.getZ(k)));
                colorsRaw.push(new THREE.Color(colAttr.getX(k), colAttr.getY(k), colAttr.getZ(k)));
            }

            // Create Spline from "Backbone" atoms (Every 2nd or 3rd to smooth)
            const backbonePoints = [];
            const backboneColors = [];
            const step = 2; // Sample every 2nd atom for the main curve
            for (let k = 0; k < positionsRaw.length; k += step) {
                backbonePoints.push(positionsRaw[k]);
                backboneColors.push(colorsRaw[k]);
            }
            const curve = new THREE.CatmullRomCurve3(backbonePoints);

            // Frenet Frames for Ribbon Orientation
            // We need ~CONFIG.count particles total.
            // ALLOCATION: 
            // 60% Ribbon (3 strands: Main, Left, Right)
            // 40% Side Chains (Stick sticking out)

            const ribbonCount = Math.floor(CONFIG.count * 0.6);
            const sideChainCount = CONFIG.count - ribbonCount;

            // RIBBON GENERATION
            // We need points along the curve.
            const ribbonSteps = Math.floor(ribbonCount / 3); // 3 strands
            const curvePoints = curve.getSpacedPoints(ribbonSteps - 1);
            const frames = curve.computeFrenetFrames(ribbonSteps, true);

            let pIdx = 0;
            const ribbonWidth = 2.0; // Angstroms approx

            for (let i = 0; i < ribbonSteps; i++) {
                if (pIdx >= ribbonCount) break;

                const p = curvePoints[i];
                const N = frames.normals[i];
                const B = frames.binormals[i];

                // Color: Interpolate from raw data
                // Map i (0..ribbonSteps) to raw index
                const rawIdx = Math.floor((i / ribbonSteps) * backboneColors.length);
                const colorVal = backboneColors[rawIdx] || new THREE.Color(1, 1, 1);

                // Strand 1: Center
                const pCenter = p.clone().sub(center).multiplyScalar(scale);
                if (pIdx < CONFIG.count) {
                    positions.target[pIdx].copy(pCenter);
                    mesh.setColorAt(pIdx, colorVal);
                    // Store original color for animation toggle
                    extras[pIdx] = extras[pIdx] || {}; extras[pIdx].baseColor = colorVal.clone();
                    pIdx++;
                }

                // Strand 2: Left (Offset along Binormal)
                const pLeft = p.clone().addScaledVector(B, -ribbonWidth).sub(center).multiplyScalar(scale);
                if (pIdx < CONFIG.count) {
                    positions.target[pIdx].copy(pLeft);
                    mesh.setColorAt(pIdx, colorVal);
                    extras[pIdx] = extras[pIdx] || {}; extras[pIdx].baseColor = colorVal.clone();
                    pIdx++;
                }

                // Strand 3: Right (Offset along Binormal)
                const pRight = p.clone().addScaledVector(B, ribbonWidth).sub(center).multiplyScalar(scale);
                if (pIdx < CONFIG.count) {
                    positions.target[pIdx].copy(pRight);
                    mesh.setColorAt(pIdx, colorVal);
                    extras[pIdx] = extras[pIdx] || {}; extras[pIdx].baseColor = colorVal.clone();
                    pIdx++;
                }
            }

            // SIDE CHAIN GENERATION
            // Stick out along Normal vector
            const chainLen = 4.0; // Angstroms length of side chain
            const particlesPerChain = 4;
            const numChains = Math.floor(sideChainCount / particlesPerChain);

            // Distribute chains along the curve
            for (let c = 0; c < numChains; c++) {
                // Pick a point along curve
                const t = c / numChains;
                const point = curve.getPointAt(t);

                // Get rotation frame generally
                const tan = curve.getTangentAt(t);
                const norm = new THREE.Vector3(0, 1, 0).applyAxisAngle(tan, Math.random() * Math.PI * 2); // Random rotation around tangent

                // Get Color
                const rawIdx = Math.floor(t * backboneColors.length);
                const colorVal = backboneColors[rawIdx] || new THREE.Color(1, 1, 1);

                for (let k = 1; k <= particlesPerChain; k++) {
                    if (pIdx >= CONFIG.count) break;

                    const offset = k * (chainLen / particlesPerChain);
                    const pChain = point.clone().addScaledVector(norm, offset).sub(center).multiplyScalar(scale);

                    positions.target[pIdx].copy(pChain);
                    mesh.setColorAt(pIdx, colorVal); // Use model color
                    extras[pIdx] = extras[pIdx] || {}; extras[pIdx].baseColor = colorVal.clone();
                    pIdx++;
                }
            }

            // Fill remaining
            for (; pIdx < CONFIG.count; pIdx++) positions.target[pIdx].set(0, -500, 0);

            STATE.isPDB = true;
            STATE.pdbAnimStartTime = STATE.simTime; // Start animation now
            STATE.pdbAnimEnabled = true; // Default ON

            // UI FOR PDB
            addControl("pdbFold", "Simulate Folding", 0, 1, 1, (v) => {
                STATE.pdbAnimEnabled = (v > 0.5);
                mesh.instanceColor.needsUpdate = true;
            });

            setInfo("PROTEIN FOLD", "Ribbon & Side-Chains Generated.");
        }
        else {
            // Case: PLY (Often points only) or Standard Meshes
            let modelScene;
            if (ext === 'ply') {
                // PLYLoader returns a BufferGeometry directly
                const mat = new THREE.PointsMaterial({ size: 0.1, vertexColors: true });
                modelScene = new THREE.Points(object, mat);
            } else {
                modelScene = (ext === 'glb' || ext === 'gltf') ? object.scene : object;
            }

            STATE.isAnimated = false; STATE.skinnedMeshes = [];

            // Handle Animations and Skinning
            if (object.animations && object.animations.length > 0) {
                STATE.mixer = new THREE.AnimationMixer(modelScene);
                object.animations.forEach(clip => STATE.mixer.clipAction(clip).play());
                addControl("animSpeed", "Anim Speed", 0, 2, 1);

                if (!isLowPerf) {
                    STATE.isAnimated = true;
                    setInfo("ANIMATED MODEL", "Swarm following animation.");
                } else {
                    setInfo("ANIMATED MODEL", "Static Idle (Low Perf Mode).");
                }
            } else {
                setInfo("3D MODEL", `Loaded: ${file.name}`);
            }

            // Normalize Scale/Position
            const box = new THREE.Box3().setFromObject(modelScene);
            const center = new THREE.Vector3(); box.getCenter(center);
            const size = new THREE.Vector3(); box.getSize(size);
            const scale = 70 / Math.max(size.x, size.y, size.z);

            modelScene.position.copy(center).multiplyScalar(-scale);
            modelScene.scale.set(scale, scale, scale);

            const group = new THREE.Group();
            group.add(modelScene);
            STATE.loadedModel = group;
            scene.add(group);

            // 1. Collect ALL Meshes & Calculate Weights (Area-based)
            const meshes = [];
            let totalArea = 0;

            // Helper to get Surface Area of a Mesh (Estimate via Faces)
            // For SkinnedMesh, we MUST access 'position' geometry attribute.
            // Indices might be indexed.

            modelScene.traverse((child) => {
                if (child.isMesh) {
                    // Ensure geometry has index for likely better sampling
                    if (!child.geometry.index) child.geometry = child.geometry.toNonIndexed();

                    // CALCULATE AREA
                    const posAttr = child.geometry.attributes.position;
                    const indexAttr = child.geometry.index;
                    let area = 0;

                    // Simple triangle area sum
                    if (indexAttr) {
                        const tempA = new THREE.Vector3(), tempB = new THREE.Vector3(), tempC = new THREE.Vector3();
                        const tempBox = new THREE.Box3();
                        const faceAreas = [];
                        let accumArea = 0;

                        for (let i = 0; i < indexAttr.count; i += 3) {
                            const a = indexAttr.getX(i);
                            const b = indexAttr.getX(i + 1);
                            const c = indexAttr.getX(i + 2);
                            tempA.fromBufferAttribute(posAttr, a);
                            tempB.fromBufferAttribute(posAttr, b);
                            tempC.fromBufferAttribute(posAttr, c);
                            const faceArea = 0.5 * tempA.sub(tempB).cross(tempC.sub(tempB)).length();
                            accumArea += faceArea;
                            faceAreas.push(accumArea);
                        }
                        area = accumArea;
                        child.userData.faceCDF = faceAreas;
                    } else {
                        const count = posAttr.count;
                        const tempA = new THREE.Vector3(), tempB = new THREE.Vector3(), tempC = new THREE.Vector3();
                        let accumArea = 0;
                        const faceAreas = [];
                        for (let i = 0; i < count; i += 3) {
                            tempA.fromBufferAttribute(posAttr, i);
                            tempB.fromBufferAttribute(posAttr, i + 1);
                            tempC.fromBufferAttribute(posAttr, i + 2);
                            const faceArea = 0.5 * tempA.sub(tempB).cross(tempC.sub(tempB)).length();
                            accumArea += faceArea;
                            faceAreas.push(accumArea);
                        }
                        area = accumArea;
                        child.userData.faceCDF = faceAreas;
                    }

                    // ADD ALL MESHES (Animated context)
                    if (STATE.isAnimated) {
                        STATE.skinnedMeshes.push({
                            mesh: child,
                            area: area,
                            count: child.geometry.attributes.position.count,
                            type: child.isSkinnedMesh ? 'skinned' : 'static'
                        });
                    }

                    meshes.push({ mesh: child, weight: area });
                    totalArea += area;
                }
            });

            // Prevent div by zero
            if (totalArea === 0) totalArea = 1;

            // 1. Initial Sampling (Static / Rest Pose)
            if (!STATE.isAnimated || STATE.skinnedMeshes.length === 0) {
                STATE.samplers = meshes.map(m => {
                    // Safety check: MeshSurfaceSampler REQUIRES faces (index or position count divisible by 3)
                    // If no faces, we skip the sampler and mark as vertex-only
                    let hasFaces = false;
                    const pos = m.mesh.geometry.attributes.position;
                    if (m.mesh.geometry.index || pos.count >= 3) {
                        try {
                            const sampler = new MeshSurfaceSampler(m.mesh).build();
                            hasFaces = true;
                            return { sampler, weight: m.weight / totalArea, mesh: m.mesh, hasFaces: true };
                        } catch (e) {
                            console.warn("Sampler build failed for mesh:", m.mesh.name, e);
                        }
                    }
                    return { weight: m.weight / totalArea, mesh: m.mesh, hasFaces: false };
                });

                let currentIdx = 0;
                const dummyPos = new THREE.Vector3(); const dummyNorm = new THREE.Vector3(); const dummyColor = new THREE.Color();
                STATE.samplers.forEach(s => {
                    const count = Math.floor(CONFIG.count * s.weight);
                    const posAttr = s.mesh.geometry.attributes.position;

                    for (let j = 0; j < count; j++) {
                        if (currentIdx >= CONFIG.count) break;

                        if (s.hasFaces) {
                            s.sampler.sample(dummyPos, dummyNorm, dummyColor);
                        } else {
                            // FALLBACK: Direct Vertex Sampling for Point Clouds
                            const vIdx = Math.floor(Math.random() * posAttr.count);
                            dummyPos.fromBufferAttribute(posAttr, vIdx);
                        }

                        modelScene.updateMatrixWorld(true);
                        dummyPos.applyMatrix4(s.mesh.matrixWorld);
                        
                        let baseColor = s.mesh.material.color ? s.mesh.material.color.clone() : new THREE.Color(0xffffff);
                        if (s.mesh.material.map) baseColor.setHex(0xffffff);
                        
                        // If choosing color from vertex (important for PLY)
                        if (s.mesh.geometry.attributes.color) {
                            const cAttr = s.mesh.geometry.attributes.color;
                            const vIdx = s.hasFaces ? 0 : Math.floor(Math.random() * cAttr.count); // Approximate
                            if (!s.hasFaces) dummyColor.fromBufferAttribute(cAttr, vIdx);
                            else {
                                // Sampler fills dummyColor if geometry has color attribute? 
                                // Actually MeshSurfaceSampler doesn't always fill color reliably if not set up correctly.
                                // Let's favor geometry colors if they exist.
                                dummyColor.fromBufferAttribute(cAttr, Math.floor(Math.random() * cAttr.count));
                            }
                            baseColor.copy(dummyColor);
                        }

                        positions.target[currentIdx].copy(dummyPos);
                        mesh.setColorAt(currentIdx, baseColor);
                        currentIdx++;
                    }
                });
                for (let i = currentIdx; i < CONFIG.count; i++) positions.target[i].set(0, -500, 0);
            }
            // 2. PROFESSIONAL SKINNED MESH SETUP (Area-Weighted Vertex Binding)
            else {
                STATE.skinnedParticles = [];
                let currentIdx = 0;

                // Remainder Accumulation for Perfect Distribution
                let particlesRemaining = CONFIG.count;
                let weightRemaining = totalArea;

                STATE.skinnedMeshes.forEach(m => {
                    // Smart calculation to handle rounding and ensure sum matches exactly
                    let pCount = Math.floor(particlesRemaining * (m.area / weightRemaining));
                    if (pCount < 0) pCount = 0;

                    // Optimization: If weight remaining is tiny, just take all (last mesh)
                    if (m.area >= weightRemaining - 0.001) pCount = particlesRemaining;

                    particlesRemaining -= pCount;
                    weightRemaining -= m.area;
                    if (weightRemaining < 0.0001) weightRemaining = 0.0001;

                    const geo = m.mesh.geometry;
                    const indexAttr = geo.index;
                    const cdf = m.mesh.userData.faceCDF;
                    const maxArea = cdf[cdf.length - 1];

                    for (let k = 0; k < pCount; k++) {
                        if (currentIdx >= CONFIG.count) break;

                        const r = Math.random() * maxArea;
                        let low = 0, high = cdf.length - 1;
                        let faceIdx = -1;
                        while (low <= high) {
                            const mid = (low + high) >>> 1;
                            if (cdf[mid] >= r) {
                                faceIdx = mid;
                                high = mid - 1;
                            } else {
                                low = mid + 1;
                            }
                        }
                        if (faceIdx === -1) faceIdx = cdf.length - 1;

                        let vIdx;
                        const triOffset = faceIdx * 3;
                        if (indexAttr) {
                            const sub = Math.floor(Math.random() * 3);
                            vIdx = indexAttr.getX(triOffset + sub);
                        } else {
                            vIdx = triOffset + Math.floor(Math.random() * 3);
                        }

                        STATE.skinnedParticles.push({
                            particleIdx: currentIdx,
                            mesh: m.mesh,
                            vertexIdx: vIdx,
                            type: m.type // 'skinned' or 'static'
                        });

                        let baseColor = m.mesh.material.color ? m.mesh.material.color.clone() : new THREE.Color(0xffffff);
                        if (m.mesh.material.map) baseColor.setHex(0xffffff);
                        mesh.setColorAt(currentIdx, baseColor);
                        currentIdx++;
                    }
                });
                // Fill redundant if specific rounding failed
                for (let i = currentIdx; i < CONFIG.count; i++) positions.target[i].set(0, -9999, 0);
            }
        }

        // Apply
        for (let i = 0; i < CONFIG.count; i++) {
            if (positions.target[i]) positions.current[i].lerp(positions.target[i], 0.5);
        }
        mesh.instanceColor.needsUpdate = true;

        addDropdown("renderMode", "RENDER MODE", ["PARTICLES", "SOLID 3D"], (val) => {
            STATE.modelMode = val;
            mesh.visible = (val === 0);
            STATE.loadedModel.visible = (val === 1);
        });
        mesh.visible = true; STATE.loadedModel.visible = false;
        document.getElementById('loader').style.display = 'none';

    }, undefined, (err) => { console.error(err); alert("Error loading model"); document.getElementById('loader').style.display = 'none'; });
}

// --- SHAPES ---
const shapes = {
    sphere: () => {
        setInfo("GEODESIC SPHERE", "Perfect distribution of points. Radius is adjustable.");

        const r = 30;
        for (let i = 0; i < CONFIG.count; i++) {
            const phi = Math.acos(-1 + (2 * i) / CONFIG.count); const theta = Math.sqrt(CONFIG.count * Math.PI) * phi;
            positions.target[i].set(r * Math.cos(theta) * Math.sin(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(phi));
            mesh.setColorAt(i, color.setHex(0x00ff88));
        }
        mesh.instanceColor.needsUpdate = true;
    },
    cube: () => {
        const s = Math.ceil(Math.cbrt(CONFIG.count));
        const sep = 2.5; const off = (s * sep) / 2; let idx = 0;
        for (let x = 0; x < s; x++) for (let y = 0; y < s; y++) for (let z = 0; z < s; z++) {
            if (idx >= CONFIG.count) break; positions.target[idx].set(x * sep - off, y * sep - off, z * sep - off); mesh.setColorAt(idx, color.setHex(0x00aaff)); idx++;
        }
        mesh.instanceColor.needsUpdate = true;
    },
    helix: () => {
        setInfo("DNA STRUCTURE", "Double Helix formation.");

        const r = 15; const h = CONFIG.count * 0.003; const off = h / 2;
        for (let i = 0; i < CONFIG.count; i++) {
            const t = i * 0.05; positions.target[i].set(Math.cos(t) * r, (i * 0.003) - off, Math.sin(t) * r); mesh.setColorAt(i, color.setHSL(i / CONFIG.count, 1, 0.5));
        }
        mesh.instanceColor.needsUpdate = true;
    },
    torus: () => {
        const R = 25; const r = 8;

        for (let i = 0; i < CONFIG.count; i++) {
            const u = (i / CONFIG.count) * Math.PI * 2 * 40; const v = (i / CONFIG.count) * Math.PI * 2;
            positions.target[i].set((R + r * Math.cos(u)) * Math.cos(v), (R + r * Math.cos(u)) * Math.sin(v), r * Math.sin(u));
            mesh.setColorAt(i, color.setHex(0xff0055));
        }
        mesh.instanceColor.needsUpdate = true;
    }
};

window.setShape = (name) => {
    STATE.videoPlaying = false; document.getElementById('video-proc').pause();
    if (shapes[name]) {
        STATE.mode = name;
        STATE.activeSimId = name; // UNIQUE ID for default
        STATE.customUpdateFunction = null;
        resetScene();
        shapes[name]();
        updateNavFooter(name);
    }
    else if (STATE.customShapes[name]) {
        STATE.mode = name;
        STATE.activeSimId = 'local-' + name;
        resetScene();
        runCustom(STATE.customShapes[name], name, 'local-' + name);
        updateNavFooter(name);
    }
    syncMainLikeUI();
};




const procCanvas = document.createElement('canvas');
const procCtx = procCanvas.getContext('2d', { willReadFrequently: true });
function mapToGrid(width, height, isVideo = false) {
    const ratio = width / height; const gridH = Math.floor(Math.sqrt(CONFIG.count / ratio)); const gridW = Math.floor(gridH * ratio);
    if (isVideo) { procCanvas.width = gridW; procCanvas.height = gridH; STATE.videoGrid = { w: gridW, h: gridH }; }
    const wW = CONFIG.maxSize; const wH = wW / ratio; let idx = 0;
    for (let y = 0; y < gridH; y++) for (let x = 0; x < gridW; x++) {
        if (idx >= CONFIG.count) break; positions.target[idx].set((x / gridW - 0.5) * wW, ((1 - y / gridH) - 0.5) * wH, 0); idx++;
    }
    for (let i = idx; i < CONFIG.count; i++) positions.target[i].set(0, -500, 0);
    controls.autoRotate = false; camera.position.set(0, 0, 100); controls.target.set(0, 0, 0);
    updateAutoRotateUI();
    return { w: gridW, h: gridH };
}

function processImage(src) {
    STATE.mode = 'image'; resetScene(); STATE.imgSource = src; STATE.videoPlaying = false; STATE.customUpdateFunction = null;

    const { w, h } = mapToGrid(src.naturalWidth, src.naturalHeight);
    procCanvas.width = w; procCanvas.height = h; procCtx.drawImage(src, 0, 0, w, h);
    const data = procCtx.getImageData(0, 0, w, h).data; let idx = 0;
    for (let i = 0; i < data.length; i += 4) { if (idx >= CONFIG.count) break; mesh.setColorAt(idx, color.setRGB(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255)); idx++; }
    mesh.instanceColor.needsUpdate = true;
}

function processVideo(src) {
    STATE.mode = 'video'; resetScene(); STATE.vidSource = src; STATE.videoPlaying = true; STATE.customUpdateFunction = null;

    mapToGrid(src.videoWidth, src.videoHeight, true);
}

window.processText = () => {
    STATE.mode = 'text'; resetScene(); const text = document.getElementById('textInput').value || "PARTICLES";
    STATE.textAnim = document.getElementById('animSelect').value; STATE.videoPlaying = false; STATE.customUpdateFunction = null;

    const font = document.getElementById('fontSelect').value; const userSize = parseInt(document.getElementById('textSizeSlider').value);
    const tW = 1024; const tH = 1024; procCanvas.width = tW; procCanvas.height = tH;
    procCtx.fillStyle = 'black'; procCtx.fillRect(0, 0, tW, tH);
    procCtx.fillStyle = 'white'; procCtx.textAlign = 'center'; procCtx.textBaseline = 'middle'; procCtx.font = `bold ${userSize}px "${font}"`;
    const words = text.split(' '); let line = ''; const lines = []; const maxW = tW * 0.9;
    for (let n = 0; n < words.length; n++) { const testLine = line + words[n] + ' '; if (procCtx.measureText(testLine).width > maxW && n > 0) { lines.push(line); line = words[n] + ' '; } else { line = testLine; } }
    lines.push(line); const lineHeight = userSize * 1.1; const totalH = lines.length * lineHeight; let startY = (tH - totalH) / 2 + (lineHeight / 2);
    lines.forEach((l, i) => { procCtx.fillText(l.trim(), tW / 2, startY + (i * lineHeight)); });
    const data = procCtx.getImageData(0, 0, tW, tH).data; const valid = []; const step = 4; const wH = 60; const wW = 60; STATE.textWidthWorld = wW;
    for (let y = 0; y < tH; y += step) for (let x = 0; x < tW; x += step) { if (data[(y * tW + x) * 4] > 128) valid.push({ x: (x / tW - 0.5) * wW, y: ((1 - y / tH) - 0.5) * wH }); }
    valid.sort(() => Math.random() - 0.5);
    for (let i = 0; i < CONFIG.count; i++) {
        if (i < valid.length) { const p = valid[i]; positions.target[i].set(p.x, p.y, 0); extras[i].ox = p.x; extras[i].oy = p.y; mesh.setColorAt(i, color.setHex(0x00ff88)); }
        else { positions.target[i].set(0, -500, 0); }
    }
    mesh.instanceColor.needsUpdate = true; controls.autoRotate = false; camera.position.set(0, 0, 120); controls.target.set(0, 0, 0); updateAutoRotateUI();
};

window.cachedDrawPixels = [];

window.processDraw = () => {
    STATE.mode = 'draw';
    STATE.lastDraw = window.dCanvas; // Reference global from drawing-pad.js

    const depth = parseFloat(document.getElementById('drawDepth').value) || 0;
    const scale = parseFloat(document.getElementById('drawScale').value) || 1;
    const rotateDeg = parseFloat(document.getElementById('drawRotate').value) || 0;
    const fill = document.getElementById('drawFill').checked;

    // Do heavy image extraction
    processDrawInternal(window.dCanvas, depth, scale, rotateDeg, fill);
    window.closeDraw();
};

window.updateDrawLive = () => {
    if (STATE.mode !== 'draw' || !window.cachedDrawPixels.length) return;

    const depth = parseFloat(document.getElementById('drawDepth').value) || 0;
    const scale = parseFloat(document.getElementById('drawScale').value) || 1;
    const rotateDeg = parseFloat(document.getElementById('drawRotate').value) || 0;
    const fill = document.getElementById('drawFill').checked;

    // Apply Transformations live without re-extracting pixels
    const angleRad = (rotateDeg * Math.PI) / 180;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);

    for (let i = 0; i < CONFIG.count; i++) {
        const p = window.cachedDrawPixels[i % window.cachedDrawPixels.length];

        // Z Depth mapping
        let z = 0;
        if (depth > 0) {
            if (fill) {
                const r = Math.random();
                if (r < 0.4) z = depth / 2;
                else if (r < 0.8) z = -depth / 2;
                else z = (Math.random() - 0.5) * depth;
            } else {
                z = (Math.random() - 0.5) * depth;
            }
        }

        let tx = p.x * scale;
        let ty = p.y * scale;
        let rotX = tx * cosA - ty * sinA;
        let rotY = tx * sinA + ty * cosA;

        positions.target[i].set(
            rotX + (Math.random() - 0.5) * 0.15,
            rotY + (Math.random() - 0.5) * 0.15,
            z
        );
        mesh.setColorAt(i, color.setRGB(p.r / 255, p.g / 255, p.b / 255));
    }

    mesh.instanceColor.needsUpdate = true;
};

function processDrawInternal(source, depth = 0, scale = 1, rotateDeg = 0, fill = false) {
    if (!source) return;
    STATE.mode = 'draw'; resetScene(); STATE.videoPlaying = false; STATE.customUpdateFunction = null;


    // Higher Resolution Sampling for Smoother Shapes
    const w = 400;
    const h = Math.floor(400 * (source.height / source.width));
    procCanvas.width = w; procCanvas.height = h;
    procCtx.clearRect(0, 0, w, h);
    procCtx.drawImage(source, 0, 0, w, h);

    const data = procCtx.getImageData(0, 0, w, h).data;
    const valid = [];

    // Threshold check (Any color drawn, not just green)
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];

            // If significantly active and opaque
            if (a > 50 && (r > 15 || g > 15 || b > 15)) {
                valid.push({
                    x: (x / w - 0.5) * 60,
                    y: ((1 - y / h) - 0.5) * 60 * (h / w),
                    r: r,
                    g: g,
                    b: b
                });
            }
        }
    }

    if (valid.length === 0) return; // Empty drawing

    // Shuffle only once
    valid.sort(() => Math.random() - 0.5);

    // Cache for live updating
    window.cachedDrawPixels = valid;

    // Instead of duplicating 3D mapping logic, just call live update
    window.updateDrawLive();

    controls.autoRotate = false;
    camera.position.set(0, 0, 80);
    updateAutoRotateUI();
}

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY: User Code Validator
// Stage 1 – Forbidden pattern scan (blocks dangerous browser/Node APIs)
// Stage 2 – Dry-run execution to catch syntax/runtime errors before save/publish
// ─────────────────────────────────────────────────────────────────────────────
const FORBIDDEN_PATTERNS = [
    { pattern: /\bdocument\b/, label: 'document' },
    { pattern: /\bwindow\b/, label: 'window' },
    { pattern: /\bfetch\b/, label: 'fetch' },
    { pattern: /\bXMLHttpRequest\b/, label: 'XMLHttpRequest' },
    { pattern: /\bWebSocket\b/, label: 'WebSocket' },
    { pattern: /\beval\s*\(/, label: 'eval()' },
    { pattern: /new\s+Function\s*\(/, label: 'new Function()' },
    { pattern: /\bimport\s*\(/, label: 'import()' },
    { pattern: /\brequire\s*\(/, label: 'require()' },
    { pattern: /\bprocess\b/, label: 'process' },
    { pattern: /__proto__/, label: '__proto__' },
    { pattern: /\.prototype/, label: '.prototype' },
    { pattern: /\bglobalThis\b/, label: 'globalThis' },
    { pattern: /\bself\b/, label: 'self' },
    { pattern: /\blocation\b/, label: 'location' },
    { pattern: /\bnavigator\b/, label: 'navigator' },
    { pattern: /\blocalStorage\b/, label: 'localStorage' },
    { pattern: /\bsessionStorage\b/, label: 'sessionStorage' },
    { pattern: /\bindexedDB\b/, label: 'indexedDB' },
    { pattern: /\bcrypto\b/, label: 'crypto' },
    { pattern: /\bsetTimeout\b/, label: 'setTimeout' },
    { pattern: /\bsetInterval\b/, label: 'setInterval' },
    { pattern: /\balert\s*\(/, label: 'alert()' },
    { pattern: /\bconfirm\s*\(/, label: 'confirm()' },
    { pattern: /\bprompt\s*\(/, label: 'prompt()' },
];

function validateUserCode(code) {
    if (!code || !code.trim()) return { ok: false, reason: 'Code cannot be empty.' };

    // ── Stage 1: Forbidden pattern scan ──────────────────────────────────────
    for (const { pattern, label } of FORBIDDEN_PATTERNS) {
        if (pattern.test(code)) {
            return {
                ok: false,
                reason: `🚫 Forbidden keyword detected: \`${label}\`\n\n` +
                    `Only the simulation API is allowed:\n` +
                    `  target, color, i, count, time, THREE, Math,\n` +
                    `  addControl(), setInfo(), annotate()`
            };
        }
    }

    // ── Stage 2: Dry-run execution (catch syntax + runtime errors) ───────────
    try {
        // Compile — catches SyntaxErrors
        const fn = new Function('i', 'count', 'target', 'color', 'THREE', 'time',
            'setInfo', 'annotate', 'addControl', code);

        // Mock environment — minimal safe stubs
        const mockTarget = { set: () => { }, copy: () => { }, x: 0, y: 0, z: 0 };
        const mockColor = {
            setHex: () => { }, setHSL: () => { }, setRGB: () => { }, set: () => { },
            r: 1, g: 1, b: 1
        };
        const mockMath = Math;
        const mockThree = {
            Vector3: class { constructor() { return mockTarget; } },
            Color: class { constructor() { return mockColor; } },
            MathUtils: THREE.MathUtils
        };
        const noop = () => { };
        const mockAddControl = (id, label, min, max, val) => val;

        // Execute once with i=0, small count — catches most runtime errors
        fn(0, 100, mockTarget, mockColor, mockThree, 0.0, noop, noop, mockAddControl);

    } catch (e) {
        return {
            ok: false,
            reason: `❌ Code Error (simulation cannot run):\n\n${e.message}\n\n` +
                `Fix the error before saving or publishing.`
        };
    }

    return { ok: true };
}

window.addCustomFormation = () => {
    let name = document.getElementById('customName').value.trim();
    const code = document.getElementById('customCode').value;
    if (!name || !code) return;

    // ── Security gate ────────────────────────────────────────────────────────
    const check = validateUserCode(code);
    if (!check.ok) {
        alert('⚠️ Cannot Save — Code Failed Security Check:\n\n' + check.reason);
        return;
    }

    name = name.toUpperCase(); // ENFORCE UPPERCASE
    STATE.customShapes[name] = code;
    saveCustom();
    renderCustomButtons();
    setShape(name);
};

window.showError = (msg) => {
    const modal = document.getElementById('error-modal');
    const msgEl = document.getElementById('error-message');
    if (modal && msgEl) {
        msgEl.innerText = msg;
        modal.style.display = 'block';
    } else {
        alert("Error: " + msg);
    }
};

window.copyError = () => {
    const msg = document.getElementById('error-message').innerText;
    navigator.clipboard.writeText(msg).then(() => {
        const btn = document.getElementById('btn-copy-error');
        const orig = btn.innerText;
        btn.innerText = "Copied!";
        setTimeout(() => btn.innerText = orig, 2000);
    });
};

window.validatePublish = () => {
    const pubName = document.getElementById('publisherName');
    const btn = document.getElementById('btn-publish');
    const confirmCheckbox = document.getElementById('confirmSharing');
    
    if (pubName && pubName.value.trim() !== '' && confirmCheckbox && confirmCheckbox.checked) {
        btn.disabled = false;
        btn.style.borderColor = '#00aaff';
        btn.style.color = '#00aaff';
        btn.style.cursor = 'pointer';
    } else {
        btn.disabled = true;
        btn.style.borderColor = '#555';
        btn.style.color = '#555';
        btn.style.cursor = 'not-allowed';
    }
};


window.publishFormation = async () => {
    const btn = document.getElementById('btn-publish');
    let name = document.getElementById('customName').value.trim();
    const code = document.getElementById('customCode').value;
    const publisher = document.getElementById('publisherName').value.trim();
    const confirmCheckbox = document.getElementById('confirmSharing');

    if (!name || !code) return alert("Missing Name or Code");
    if (!publisher) return alert("Missing Publisher Name");
    if (!confirmCheckbox || !confirmCheckbox.checked) return alert("Please confirm: THIS IS WORTH SHARING");
    if (!db) return showError("Database Offline: Firebase failed to initialize. Check your connection or App Check status.");

    // Disable button immediately to prevent double-clicks
    btn.disabled = true;
    btn.innerText = "Publishing...";
    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";

    name = name.toUpperCase(); // ENFORCE UPPERCASE

    const reEnable = () => {
        btn.disabled = false;
        btn.innerText = "Publish to Community Cloud";
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
    };

    // ── Security gate: validate before ANY cloud interaction ─────────────────
    const check = validateUserCode(code);
    if (!check.ok) {
        showError('⚠️ Code Failed Security Check:\n\n' + check.reason);
        reEnable();
        return;
    }

    try {
        // CASE-INSENSITIVE UNIQUENESS CHECK
        // Since we enforce upper-case for new saves, we check against the upper-case version.
        const q = query(collection(db, "formations"), where("name", "==", name), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            showError(`Error: the name "${name}" already exists in the Community Cloud. Please choose a unique name.`);
            reEnable();
            return;
        }

        if (!confirm(`Publish "${name}" to the Community Cloud as ${publisher}?`)) {
            reEnable();
            return;
        }

        // Use Name as Document ID to enforce uniqueness at the database level
        await setDoc(doc(db, "formations", name), {
            name: name,
            code: code,
            publisher: publisher,
            timestamp: Date.now()
        });


        alert("Successfully Published!");
        reEnable();
        loadCommunity();

    } catch (e) {
        console.error("Publishing Failed:", e);
        showError(`Error Publishing to Cloud: ${e.message}\n\nCommon causes: Firebase Rule violations, App Check failure, or Connection issues.`);
        reEnable();
    }
};



// --- BLUEPRINT LOGIC ---
// --- BLUEPRINT LOGIC ---
window.updateBlueprintParams = () => {
    BP_STATE.threshold = parseInt(document.getElementById('bpThreshold').value);
    // BP_STATE.height removed
    BP_STATE.scale = parseFloat(document.getElementById('bpScale').value);
    BP_STATE.fill = document.getElementById('bpFill').checked;
    if (STATE.mode === 'blueprint' && BP_STATE.source) processBlueprint();
};

window.processBlueprint = () => {
    if (!BP_STATE.source) return;
    const src = BP_STATE.source;
    STATE.mode = 'blueprint';
    resetScene();

    // SETUP
    STATE.videoPlaying = false;

    STATE.customUpdateFunction = null;
    // REMOVED: updateRenderStyle('cyber'); (User request: Use current style)

    // Use higher res for processing
    const w = 512;
    const h = Math.floor(512 * (src.naturalHeight / src.naturalWidth));
    procCanvas.width = w; procCanvas.height = h;
    procCtx.drawImage(src, 0, 0, w, h);

    const imgData = procCtx.getImageData(0, 0, w, h);
    const data = imgData.data;
    let candidates = [];

    // AUTO-DETECT BACKGROUND (Dark or Light?)
    let totalBright = 0;
    for (let i = 0; i < w * h; i++) {
        totalBright += (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
    }
    const avgBright = totalBright / (w * h);
    const isDarkBg = avgBright < 100; // If avg < 100, assuming dark background

    // Convert to Grayscale & Analyze
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
        gray[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
    }

    // FILL MODE vs EDGE MODE
    if (BP_STATE.fill) {
        // --- FILL LOGIC (Brightness Threshold) ---
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = (y * w + x) * 4;
                const r = data[idx] / 255;
                const g = data[idx + 1] / 255;
                const b = data[idx + 2] / 255;
                const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

                // Diff from background
                let diff = 0;
                if (isDarkBg) diff = brightness; // Light pixels on dark
                else diff = 255 - brightness;    // Dark pixels on light

                // Thresholding for Fill
                const fillThreshold = Math.max(10, 255 - BP_STATE.threshold);

                if (diff > fillThreshold) {
                    candidates.push({
                        x: (x / w - 0.5) * 120 * (BP_STATE.scale || 1.0),
                        y: ((1 - y / h) - 0.5) * 120 * (h / w) * (BP_STATE.scale || 1.0),
                        mag: diff, // Use contrast as magnitude
                        r: r, g: g, b: b
                    });
                }
            }
        }
    } else {
        // --- EDGE LOGIC (Sobel) ---
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                // Sobel Kernels
                const i00 = (y - 1) * w + (x - 1); const i01 = (y - 1) * w + x; const i02 = (y - 1) * w + (x + 1);
                const i10 = y * w + (x - 1); const i12 = y * w + (x + 1);
                const i20 = (y + 1) * w + (x - 1); const i21 = (y + 1) * w + x; const i22 = (y + 1) * w + (x + 1);

                const Gx = -gray[i00] + gray[i02] - 2 * gray[i10] + 2 * gray[i12] - gray[i20] + gray[i22];
                const Gy = -gray[i00] - 2 * gray[i01] - gray[i02] + gray[i20] + 2 * gray[i21] + gray[i22];
                const mag = Math.sqrt(Gx * Gx + Gy * Gy);

                const idx = (y * w + x) * 4;
                const r = data[idx] / 255;
                const g = data[idx + 1] / 255;
                const b = data[idx + 2] / 255;

                candidates.push({
                    x: (x / w - 0.5) * 120 * (BP_STATE.scale || 1.0),
                    y: ((1 - y / h) - 0.5) * 120 * (h / w) * (BP_STATE.scale || 1.0),
                    mag: mag,
                    r: r, g: g, b: b
                });
            }
        }
    }

    // SORTING & FILTERING
    candidates.sort((a, b) => b.mag - a.mag);

    // Filter by Threshold (for Edge mode primarily, Fill mode already filtered)
    if (!BP_STATE.fill) {
        const userThreshold = Math.max(10, 255 - BP_STATE.threshold);
        candidates = candidates.filter(c => c.mag > userThreshold);
    }

    // Filter Top K for Density (Higher Limit for Fill?)
    let valid = candidates;
    const MAX_ACTIVE = 15000; // Allow more particles for Fill
    if (valid.length > MAX_ACTIVE) {
        valid = valid.slice(0, MAX_ACTIVE);
    }

    if (valid.length === 0) { console.warn("No geometry detected."); return; }

    // RE-CENTERING LOGIC
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    valid.forEach(p => {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    valid.forEach(p => { p.x -= centerX; p.y -= centerY; });

    // PROJECTION
    let particleIdx = 0;
    valid.sort(() => Math.random() - 0.5);

    // Fixed Height
    const fixedHeight = 5;

    while (particleIdx < CONFIG.count) {
        const p = valid[particleIdx % valid.length];

        // Stack vertically - NO EXTRUSION (Flat 2D Hologram)
        const z = 0;
        positions.target[particleIdx].set(p.x, p.y, z);
        mesh.setColorAt(particleIdx, color.setRGB(p.r, p.g, p.b));
        particleIdx++;
    }

    mesh.instanceColor.needsUpdate = true;
    controls.autoRotate = STATE.autoSpin;
    camera.position.set(0, 0, 100);
    updateAutoRotateUI();
};

window.loadCommunity = async (append = false) => {
    if (!db) return; 
    const list = document.getElementById('community-list'); 

    if (!append) {
        list.innerHTML = 'Loading...';
        STATE.lastVisibleCommunityDoc = null;
        STATE.isCommunityLoading = true;
        STATE.hasMoreCommunity = true;
    } else {
        if (STATE.isCommunityLoading || !STATE.hasMoreCommunity) return;
        STATE.isCommunityLoading = true;
        
        // Add a temporary loading indicator at the bottom
        // Only if we aren't silently fetching all
        if (!STATE.isFetchingAll) {
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'community-loading-more';
            loadingDiv.style.textAlign = 'center';
            loadingDiv.style.padding = '10px';
            loadingDiv.style.color = 'var(--accent)';
            loadingDiv.innerText = 'Loading more...';
            list.appendChild(loadingDiv);
        }
    }
    
    try {
        let q;
        if (append && STATE.lastVisibleCommunityDoc) {
            q = query(collection(db, "formations"), orderBy("timestamp", "desc"), startAfter(STATE.lastVisibleCommunityDoc), limit(30));
        } else {
            q = query(collection(db, "formations"), orderBy("timestamp", "desc"), limit(30)); 
        }

        const snap = await getDocs(q); 
        
        if (!append) list.innerHTML = '';
        else {
            const loader = document.getElementById('community-loading-more');
            if(loader) loader.remove();
        }

        if (snap.empty) {
            STATE.hasMoreCommunity = false;
            // Only show message if it's the very first load
            if (!append && list.innerHTML === '') {
                list.innerHTML = '<div style="text-align:center; color:#aaa; padding:10px;">No formations found.</div>';
            }
            STATE.isCommunityLoading = false;
            return;
        }

        STATE.lastVisibleCommunityDoc = snap.docs[snap.docs.length - 1];

        // Ensure we don't attach duplicate event listeners if reloading
        const sidebarScroll = document.querySelector('.scroll-area');
        if (!append && sidebarScroll) {
            sidebarScroll.removeEventListener('scroll', window.handleCommunityScroll);
            sidebarScroll.addEventListener('scroll', window.handleCommunityScroll);
        }

        snap.forEach(doc => {
            const d = doc.data(); const div = document.createElement('div'); div.className = 'custom-item';
            const loadBtn = document.createElement('button'); loadBtn.className = 'shape-btn'; loadBtn.style.borderLeft = "3px solid #00aaff";

            const pubText = d.publisher ? `<span style="font-size:8px; color:#aaa; margin-left:5px;">by ${d.publisher}</span>` : '';
            loadBtn.innerHTML = `<svg class="btn-icon" viewBox="0 0 24 24" style="stroke:#00aaff;"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg> <span>${d.name} ${pubText}</span>`;
            loadBtn.setAttribute('data-sim-id', doc.id);
            loadBtn.onclick = () => runCustom(d.code, d.name, doc.id);

            const copyBtn = document.createElement('button'); copyBtn.className = 'icon-btn copy-btn'; copyBtn.innerHTML = `<svg class="btn-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`; copyBtn.onclick = () => copyCustom(d.name, d.code);
            copyBtn.title = "Copy Code";

            const likeBtn = document.createElement('button');
            likeBtn.className = 'icon-btn like-btn';
            const isFav = STATE.favorites.includes(doc.id);
            if (isFav) likeBtn.classList.add('liked');
            likeBtn.innerHTML = `<svg class="btn-icon" viewBox="0 0 24 24"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.51 4.05 3 5.5l7 7Z"></path></svg>`;
            likeBtn.onclick = (e) => { e.stopPropagation(); toggleLike(doc.id, likeBtn); };
            likeBtn.title = "Add to Favorites";

            const shareBtn = document.createElement('button'); shareBtn.className = 'icon-btn share-btn'; shareBtn.innerHTML = `<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`; shareBtn.onclick = (e) => shareCustom(d.name, e);
            shareBtn.title = "Share Link";

            div.appendChild(loadBtn); div.appendChild(copyBtn); div.appendChild(likeBtn); div.appendChild(shareBtn); list.appendChild(div);
        });
        updateFavCounter();
        if (window.filterCommunity) window.filterCommunity();
    } catch (e) { 
        list.innerHTML = 'Cloud Error'; 
        console.error(e);
    } finally {
        STATE.isCommunityLoading = false;
    }

    if(!append) {
        // Check URL for shared simulation on load (only strictly needed on first load)
        const urlParams = new URLSearchParams(window.location.search);
        let sharedSim = urlParams.get('sim');
        if (sharedSim) {
            try {
                // URLSearchParams.get() handles basic decoding, but just in case, ensure it's clean and matches the case format
                sharedSim = decodeURIComponent(sharedSim).trim();
                // We query by the 'name' field, because older submissions may have random Document IDs rather than their name as the ID.
                const q = query(collection(db, "formations"), where("name", "==", sharedSim), limit(1));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const data = snap.docs[0].data();
                    console.log("Loading shared simulation:", data.name);
                    runCustom(data.code, data.name);
                    // Open sidebar so user sees it loaded (optional, but helpful)
                    document.getElementById('sidebar').classList.remove('collapsed');
                } else {
                    console.warn("Shared simulation not found:", sharedSim);
                }
            } catch (e) {
                console.error("Error loading shared simulation:", e);
            }
        }
    }
};

window.handleCommunityScroll = () => {
    const searchInput = document.getElementById('communitySearch').value;
    // Don't paginate via scroll if user is actively searching
    if (searchInput.trim() !== '' || STATE.isFetchingAll) return;

    const scrollArea = document.querySelector('.scroll-area');
    // Check if scrolled near bottom (within 50px)
    if (scrollArea.scrollTop + scrollArea.clientHeight >= scrollArea.scrollHeight - 50) {
        loadCommunity(true);
    }
};

window.autoFetchAllCommunity = async () => {
    if (STATE.isFetchingAll || !STATE.hasMoreCommunity) return;
    STATE.isFetchingAll = true;
    
    // Change placeholder to show status
    const input = document.getElementById('communitySearch');
    const origPlaceholder = input.placeholder;
    input.placeholder = "FETCHING ALL FROM CLOUD...";

    while (STATE.hasMoreCommunity) {
        await loadCommunity(true);
        // Small delay to prevent Firebase throttling
        await new Promise(r => setTimeout(r, 200));
        // If user cleared search or changed focus, we could stop, 
        // but it's better to just finish since we want global search.
    }
    
    input.placeholder = origPlaceholder;
    STATE.isFetchingAll = false;
};

window.filterCommunity = () => {
    const term = document.getElementById('communitySearch').value.toLowerCase();
    const items = document.getElementById('community-list').querySelectorAll('.custom-item');
    items.forEach(item => {
        const shapeBtn = item.querySelector('.shape-btn');
        const name = shapeBtn.innerText.toLowerCase();
        const simId = shapeBtn.getAttribute('data-sim-id');
        
        let visible = name.includes(term);
        if (STATE.showFavoritesOnly) {
            visible = visible && STATE.favorites.includes(simId);
        }
        
        item.style.display = visible ? '' : 'none';
    });
};

// --- FAVORITES LOGIC ---
window.toggleLike = (id, btnEl) => {
    const idx = STATE.favorites.indexOf(id);
    if (idx > -1) {
        STATE.favorites.splice(idx, 1);
    } else {
        STATE.favorites.push(id);
    }
    localStorage.setItem('swarm_favorites', JSON.stringify(STATE.favorites));
    
    // Update individual button if provided
    if (btnEl) {
        const isFav = STATE.favorites.includes(id);
        btnEl.classList.toggle('liked', isFav);
    }
    
    // Sync main nav heart if this is the active sim
    if (id === STATE.activeSimId) syncMainLikeUI();
    
    updateFavCounter();
    if (STATE.showFavoritesOnly) window.filterCommunity();
};

window.toggleLikeMain = () => {
    const id = STATE.activeSimId;
    if (!id || id === 'sphere' || id === 'torus' || id === 'heart') return; // Only for custom/community
    window.toggleLike(id);
    // UI update in list happens via sync if item exists
    const listItems = document.getElementById('community-list').querySelectorAll('.custom-item');
    listItems.forEach(item => {
        const btn = item.querySelector('.shape-btn');
        if (btn.getAttribute('data-sim-id') === id) {
            const likeBtn = item.querySelector('.like-btn');
            const isFav = STATE.favorites.includes(id);
            likeBtn.classList.toggle('liked', isFav);
        }
    });
};

function syncMainLikeUI() {
    const id = STATE.activeSimId;
    const btn = document.getElementById('btn-like-main');
    if (!btn) return;
    
    // Hide for internal shapes or local simulations, show ONLY for community
    // Added 'cube' and 'helix' which were missing
    const internal = ['sphere', 'cube', 'helix', 'torus', 'heart', 'box', 'text', 'image', 'video', 'blueprint', 'model', 'dna', 'attractor', 'field', 'smoke', 'galaxy'];
    if (internal.includes(id) || (id && id.startsWith('local-'))) {
        btn.style.display = 'none';
        btn.style.pointerEvents = 'none';
    } else {
        btn.style.display = 'flex';
        btn.style.pointerEvents = 'all';
        const isFav = STATE.favorites.includes(id);
        btn.classList.toggle('liked', isFav);
    }
}

function updateFavCounter() {
    const count = STATE.favorites.length;
    document.getElementById('fav-count').innerText = count;
}

window.toggleFavoritesFilter = async () => {
    STATE.showFavoritesOnly = !STATE.showFavoritesOnly;
    const tab = document.getElementById('favorites-tab');
    if (STATE.showFavoritesOnly) {
        tab.style.background = 'rgba(255,10,10,0.2)';
        tab.style.borderColor = '#ff4d4d';
        // Proactively fetch all to ensure favorites are found
        await window.autoFetchAllCommunity();
    } else {
        tab.style.background = 'rgba(255,10,10,0.05)';
        tab.style.borderColor = 'rgba(255,10,10,0.1)';
    }
    window.filterCommunity();
};

setTimeout(loadCommunity, 1500);

function saveCustom() { localStorage.setItem('particles_shapes', JSON.stringify(STATE.customShapes)); }
function loadCustom() { const s = localStorage.getItem('particles_shapes'); if (s) STATE.customShapes = JSON.parse(s); renderCustomButtons(); }
function renderCustomButtons() {
    const list = document.getElementById('custom-list'); list.innerHTML = '';
    Object.keys(STATE.customShapes).forEach(k => {
        const div = document.createElement('div'); div.className = 'custom-item';
        const btn = document.createElement('button'); btn.className = 'shape-btn'; btn.innerText = k; 
        btn.setAttribute('data-sim-id', 'local-' + k);
        btn.onclick = () => setShape(k);
        const copyBtn = document.createElement('button'); copyBtn.className = 'icon-btn copy-btn'; copyBtn.innerHTML = `<svg class="btn-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`; copyBtn.onclick = () => copyCustom(k);
        const delBtn = document.createElement('button'); delBtn.className = 'icon-btn del-btn'; delBtn.innerHTML = `<svg class="btn-icon" viewBox="0 0 24 24" style="stroke:#ff4444;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`; delBtn.onclick = () => deleteCustom(k);
        div.appendChild(btn); div.appendChild(copyBtn); div.appendChild(delBtn); list.appendChild(div);
    });
}
window.deleteCustom = (k) => { delete STATE.customShapes[k]; saveCustom(); renderCustomButtons(); };
window.copyCustom = (name, codeInput) => {
    let code = codeInput; if (!code) code = STATE.customShapes[name];
    if (!code) { alert("Error: Code not found for " + name); return; }
    document.getElementById('customName').value = name; document.getElementById('customCode').value = code;
};

window.shareCustom = (name, e) => {
    e.stopPropagation();
    const url = new URL(window.location.href);
    url.searchParams.set('sim', encodeURIComponent(name));
    navigator.clipboard.writeText(url.toString()).then(() => {
        const btn = e.currentTarget;
        const origColor = btn.style.color;
        btn.style.color = '#00ff88';
        const origTitle = btn.title;
        btn.title = 'Link Copied!';
        
        setTimeout(() => {
            btn.style.color = origColor;
            btn.title = origTitle;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy link: ', err);
        prompt("Copy this link to share:", url.toString());
    });
};

window.runCustom = (code, name, id) => {
    resetScene();
    try {
        const f = new Function('i', 'count', 'target', 'color', 'THREE', 'time', 'setInfo', 'annotate', 'addControl', code);
        STATE.customUpdateFunction = f; STATE.mode = 'custom'; STATE.customName = name;
        STATE.activeCustomCode = code; // SAVE FOR EXPORT
        STATE.activeSimId = id || name; // IMPORTANT: Unique ID tracking
        updateNavFooter(name);
        syncMainLikeUI();
    } catch (e) { console.error(e); alert("Code Error"); }
}

loadCustom();

const clock = new THREE.Clock(); const tempV = new THREE.Vector3();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    STATE.simTime += delta * STATE.speed;
    const time = STATE.simTime;

    // Apply Custom Auto Spin (Object-Centric) -> REMOVED. Using OrbitControls.autoRotate instead.
    // if (STATE.autoSpin && !STATE.handControlEnabled && STATE.mode !== 'text') {
    //    worldGroup.rotation.y += STATE.speed * 0.002;
    // }

    // --- UPDATE ANIMATIONS FOR SOLID MODEL ---
    if (STATE.mode === 'model' && STATE.mixer) {
        // Check if user has an animation speed control
        let animSpeed = 1.0;
        if (STATE.customParams && STATE.customParams['animSpeed'] !== undefined) {
            animSpeed = STATE.customParams['animSpeed'];
        }
        STATE.mixer.update(delta * animSpeed * STATE.speed);

        // --- ANIMATED PARTICLE RESAMPLING ---
        // NEW: Professional Skinned Animation Update Loop
        if (STATE.mode === 'model' && STATE.isAnimated && STATE.skinnedParticles && STATE.skinnedParticles.length > 0 && mesh.visible) {

            // 1. Update Skeleton
            STATE.mixer.update(0); // We update mixer in main loop, but ensure world matrices are fresh
            STATE.loadedModel.updateMatrixWorld(true);

            // 2. Update Particles based on Vertex Binding
            // This is huge for performance (CPU Skinning 20k points is fine)
            // Much better than re-sampling 20k points per frame

            const tempV = new THREE.Vector3();
            const tempPos = new THREE.Vector3();

            for (let i = 0; i < STATE.skinnedParticles.length; i++) {
                const state = STATE.skinnedParticles[i];
                const pIdx = state.particleIdx;

                // Get Vertex Local Position
                // We could cache this but V8 is fast
                state.posAttr = state.mesh.geometry.attributes.position; // Optimization
                tempV.fromBufferAttribute(state.posAttr, state.vertexIdx);

                // APPLY TRANSFORM
                if (state.type === 'skinned') {
                    // CPU Skinning
                    // RELIABLE METHOD:
                    // 1. boneTransform gives us the Vertex deformed by Bones.
                    // 2. We often need to apply the Mesh's World Matrix on top if the Bones 
                    //    don't fully encode the Mesh's scene graph transform (parent offsets).

                    state.mesh.boneTransform(state.vertexIdx, tempV);

                    // CRITICAL FIX: Apply the Mesh's World Transform.
                    // If the model has multiple characters at different positions, 
                    // boneTransform might be local to the character's root.
                    tempV.applyMatrix4(state.mesh.matrixWorld);

                } else {
                    // Static Mesh part of animated group (e.g. Prop)
                    tempV.applyMatrix4(state.mesh.matrixWorld);
                }

                positions.target[pIdx].copy(tempV);
            }
            mesh.instanceColor.needsUpdate = true;
        }
    }

    // --- PDB FOLDING ANIMATION ---
    if (STATE.mode === 'model' && STATE.isPDB && mesh.visible) {
        if (!STATE.pdbAnimEnabled) {
            // Force visibility of all valid particles
            for (let i = 0; i < CONFIG.count; i++) {
                if (positions.target[i].y > -400) {
                    if (extras[i] && extras[i].baseColor) mesh.setColorAt(i, extras[i].baseColor);
                    else mesh.setColorAt(i, color.setHex(0xffffff));
                }
            }
            mesh.instanceColor.needsUpdate = true;
        } else {
            // Animate visibility based on time
            // e.g. reveal 100 atoms per second
            const speed = 400;
            const elapsed = time - (STATE.pdbAnimStartTime || 0);
            const visibleCount = Math.floor(elapsed * speed);

            for (let i = 0; i < CONFIG.count; i++) {
                if (i < visibleCount) {
                    // Visible
                    if (extras[i] && extras[i].baseColor) mesh.setColorAt(i, extras[i].baseColor);
                    else mesh.setColorAt(i, color.setHex(0xffffff));
                } else {
                    // Hidden
                    mesh.setColorAt(i, color.setHex(0x000000));
                }
            }
            mesh.instanceColor.needsUpdate = true;

            // Loop animation
            if (visibleCount > CONFIG.count + 500) {
                STATE.pdbAnimStartTime = time;
            }
        }
    }

    const activeCount = Math.min(CONFIG.count, positions.current.length, positions.target.length);

    // Update Plasma Uniforms
    if (STATE.renderStyle === 'plasma') plasmaMaterial.uniforms.uTime.value = time;
    if (STATE.renderStyle === 'ink') inkMaterial.uniforms.uTime.value = time;
    if (STATE.renderStyle === 'paint') paintMaterial.uniforms.uTime.value = time;

    // If Particles Active
    if (activeCount > 0 && mesh.visible) {

        if (STATE.mode === 'custom' && STATE.customUpdateFunction) {
            const v = new THREE.Vector3();
            for (let i = 0; i < activeCount; i++) {
                color.setHex(0xffffff);
                try {
                    STATE.customUpdateFunction(i, CONFIG.count, v, color, THREE, time, window.setInfo, window.annotate, window.addControl);
                } catch (e) {
                    console.error("CUSTOM KERNEL ERROR:", e);
                    alert("Runtime Error in Custom Code:\n" + e.message + "\n\nSimulation Reverted.");
                    STATE.customUpdateFunction = null;
                    setShape('sphere');
                    break;
                }
                positions.target[i].copy(v); mesh.setColorAt(i, color);
            }
            mesh.instanceColor.needsUpdate = true;
        }

        if (STATE.mode === 'video' && STATE.videoPlaying && STATE.videoGrid) {
            const v = document.getElementById('video-proc'); const { w, h } = STATE.videoGrid;
            procCtx.drawImage(v, 0, 0, w, h); const data = procCtx.getImageData(0, 0, w, h).data;
            let idx = 0;
            for (let i = 0; i < data.length; i += 4) { if (idx >= activeCount) break; mesh.setColorAt(idx, color.setRGB(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255)); idx++; }
            mesh.instanceColor.needsUpdate = true;
        }

        for (let i = 0; i < activeCount; i++) {
            if (!positions.current[i] || !positions.target[i]) continue;

            // --- SANITATION LOCK ---
            // Catch invalid coords from custom code immediately
            if (isNaN(positions.target[i].x) || !isFinite(positions.target[i].x)) {
                positions.target[i].set(0, 0, 0);
            }

            positions.current[i].lerp(positions.target[i], 0.1); 
            
            // Final safety for current position
            if (isNaN(positions.current[i].x)) positions.current[i].set(0, 0, 0);

            dummy.position.copy(positions.current[i]);

            if (['sphere', 'cube', 'helix', 'torus', 'model'].includes(STATE.mode)) {
                dummy.position.y += Math.sin(time + extras[i].seed) * CONFIG.hoverStrength;
            } else if (STATE.mode === 'text') {
                const ox = extras[i].ox; const oy = extras[i].oy;
                if (STATE.textAnim === 'scroll') {
                    let newX = ox - (time * 20) % (STATE.textWidthWorld * 2); if (newX < -STATE.textWidthWorld) newX += STATE.textWidthWorld * 2; dummy.position.x = newX;
                } else if (STATE.textAnim === 'wave') {
                    dummy.position.y = oy + Math.sin(time * 4 + ox * 0.2) * 2;
                } else if (STATE.textAnim === 'pulse') {
                    dummy.position.z = Math.sin(time * 5) * 2;
                } else if (STATE.textAnim === 'rain') { let drop = (oy - (time * 20) % 60); if (drop < -30) drop += 60; dummy.position.y = drop; }
            }

            // Render Style Special Logic
            if (STATE.renderStyle === 'vector') {
                // Look at next position (Velocity alignment)
                // We fake "velocity" by looking at target, or just lerped + delta
                const lookTarget = positions.target[i].clone().sub(positions.current[i]).normalize().multiplyScalar(2).add(dummy.position);
                if (positions.target[i].distanceToSquared(positions.current[i]) > 0.1) {
                    dummy.lookAt(lookTarget);
                }
            } else if (STATE.renderStyle === 'plasma' || STATE.renderStyle === 'ink' || STATE.renderStyle === 'paint') {
                dummy.lookAt(camera.position); // Billboard
            } else {
                dummy.rotation.set(0, 0, 0); // Reset rotation for others
            }

            dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    }

    if (STATE.showAnnotations) {
        annotations.forEach((anno) => {
            tempV.copy(anno.pos); tempV.project(camera);
            const x = (tempV.x * .5 + .5) * window.innerWidth; const y = (-(tempV.y * .5) + .5) * window.innerHeight;
            if (tempV.z < 1 && x > 0 && x < window.innerWidth && y > 0 && y < window.innerHeight) {
                anno.element.style.display = 'flex'; anno.element.style.transform = `translate(${x}px, ${y}px)`;
            } else { anno.element.style.display = 'none'; }
        });
    }
    controls.update(); composer.render();
}

window.addEventListener('resize', () => { 
    camera.aspect = window.innerWidth / window.innerHeight; 
    camera.updateProjectionMatrix(); 
    renderer.setSize(window.innerWidth, window.innerHeight); 
    composer.setSize(window.innerWidth, window.innerHeight); 
    if (bloomPass) {
        bloomPass.resolution.set(window.innerWidth, window.innerHeight);
    }
});

// Sidebar Toggle with Icon Swap
const sidebarEl = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggle-sidebar');

// Icons
const iconClose = `
<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" style="fill:none;stroke:white;stroke-width:2"></rect>
    <line x1="9" y1="3" x2="9" y2="21" style="stroke:white;stroke-width:2"></line>
    <path d="M17 16l-4-4 4-4" style="stroke:white;stroke-width:2"></path>
</svg>`;

const iconOpen = `
<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" style="fill:none;stroke:white;stroke-width:2"></rect>
    <line x1="15" y1="3" x2="15" y2="21" style="stroke:white;stroke-width:2"></line>
    <path d="M7 8l4 4-4 4" style="stroke:white;stroke-width:2"></path>
</svg>`;

// Initialize State (Sidebar always starts collapsed for a clean first view)
sidebarEl.classList.add('collapsed');
toggleBtn.innerHTML = iconOpen;

toggleBtn.onclick = () => {
    sidebarEl.classList.toggle('collapsed');
    const isCollapsed = sidebarEl.classList.contains('collapsed');
    // If Collapsed, show Open Icon. If Open, show Close Icon.
    toggleBtn.innerHTML = isCollapsed ? iconOpen : iconClose;
};


document.getElementById('densitySlider').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('densityVal').innerText = val.toLocaleString() + " UNITS";

    const currentMode = STATE.mode; // Capture current mode

    initParticles(val); // This resets scene/mode in some implementations, ensure it doesn't break everything

    // Restore Mode Logic
    if (currentMode === 'draw' && STATE.lastDraw) {
        const depth = parseFloat(document.getElementById('drawDepth').value) || 0;
        const fill = document.getElementById('drawFill').checked;
        processDrawInternal(STATE.lastDraw, depth, fill);
    } else if (currentMode === 'text') {
        const txt = document.getElementById('textInput').value;
        if (txt) processText();
    } else if (currentMode === 'sphere' || currentMode === 'cube' || currentMode === 'helix' || currentMode === 'grid') {
        setShape(currentMode);
    } else if (currentMode === 'model' && STATE.currentFile) { // Added this else if for model
        processModel(STATE.currentFile);
    } else {
        // Default fallbacks
        setShape('sphere');
    }
});
document.getElementById('speedSlider').addEventListener('input', e => STATE.speed = parseFloat(e.target.value));
// --- FILE INPUT LISTENERS ---
document.getElementById('imgInput').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        document.getElementById('imgName').innerText = file.name;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const img = new Image();
            img.onload = () => processImage(img);
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('vidInput').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        document.getElementById('vidName').innerText = file.name;
        const url = URL.createObjectURL(file);
        const video = document.getElementById('video-proc'); // Use existing video element
        video.src = url;
        video.volume = document.getElementById('volSlider').value;
        video.play();
        video.onloadedmetadata = () => processVideo(video);
    }
});

document.getElementById('modelInput').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        document.getElementById('modelName').innerText = file.name;
        processModel(file);
    }
});

// BLUEPRINT LISTENER
document.getElementById('blueprintInput').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        document.getElementById('blueprintName').innerText = file.name;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const img = new Image();
            img.onload = () => {
                BP_STATE.source = img;
                processBlueprint();
            };
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('volSlider').addEventListener('input', e => document.getElementById('video-proc').volume = e.target.value);
document.getElementById('bloomSlider').addEventListener('input', e => bloomPass.strength = e.target.value);
window.toggleFullscreen = () => {
    const doc = window.document;
    const docEl = doc.documentElement;

    const requestFS = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.webkitRequestFullScreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
    const exitFS = doc.exitFullscreen || doc.webkitExitFullscreen || doc.webkitCancelFullScreen || doc.mozCancelFullScreen || doc.msExitFullscreen;

    if (!doc.fullscreenElement && !doc.webkitFullscreenElement && !doc.mozFullScreenElement && !doc.msFullscreenElement) {
        if (requestFS) {
            const promise = requestFS.call(docEl);
            if (promise && promise.catch) {
                promise.catch(err => {
                    console.warn("Fullscreen request failed:", err);
                    // Often happens if not triggered by a direct user gesture or if blocked by browser settings
                });
            }
        } else {
            alert("Fullscreen is not supported on this device or browser. (Note: iOS Safari often restricts fullscreen to video elements only)");
        }
    } else {
        if (exitFS) {
            exitFS.call(doc);
        }
    }
};


window.clearMedia = (type) => {
    if (type === 'image') {
        document.getElementById('imgInput').value = '';
        document.getElementById('imgName').innerText = "";
        STATE.imgSource = null;
        if (STATE.mode === 'image') setShape('sphere');
    } else if (type === 'video') {
        document.getElementById('vidInput').value = '';
        document.getElementById('vidName').innerText = "";
        STATE.vidSource = null;
        const v = document.getElementById('video-proc');
        v.pause();
        STATE.videoPlaying = false;
        if (STATE.mode === 'video') setShape('sphere');
    } else if (type === 'model') {
        document.getElementById('modelInput').value = '';
        document.getElementById('modelName').innerText = "(GLB, OBJ, PDB)";
        if (STATE.mode === 'model') setShape('sphere');
    } else if (type === 'blueprint') {
        document.getElementById('blueprintInput').value = '';
        document.getElementById('blueprintName').innerText = "";
        BP_STATE.source = null;
        if (STATE.mode === 'blueprint') setShape('sphere');
    }
};
window.openGuide = () => document.getElementById('guide-modal').style.display = 'flex';
window.closeGuide = () => document.getElementById('guide-modal').style.display = 'none';
window.copyPrompt = () => { navigator.clipboard.writeText(document.getElementById('prompt-text').innerText); alert("Copied!"); };

// --- SIMULATION NAVIGATION ---
function getSimList() {
    const list = [];
    
    // 1. Default Shapes
    ['sphere', 'cube', 'helix', 'torus'].forEach(id => {
        list.push({ type: 'shape', name: id, id: id });
    });

    // 2. Local Formations
    Object.keys(STATE.customShapes).forEach(k => {
        list.push({ type: 'local', name: k, id: 'local-' + k });
    });

    // 3. Community Formations (from DOM) - Only pick the load buttons
    document.querySelectorAll('#community-list .shape-btn').forEach(btn => {
        const id = btn.getAttribute('data-sim-id');
        if (!id) return;
        const fullText = btn.innerText;
        const name = fullText.split('by')[0].trim();
        list.push({ type: 'community', name: name, id: id, btn: btn });
    });

    return list;
}


window.updateNavFooter = (name) => {
    const el = document.getElementById('nav-sim-name');
    if (el) el.innerText = name.toUpperCase();
};

window.nextSim = () => {
    const sims = getSimList();
    const activeId = STATE.activeSimId;
    
    let currentIndex = sims.findIndex(s => s.id === activeId);
    if (currentIndex === -1) currentIndex = 0;

    // --- AUTO-PAGINATION LOGIC ---
    // If we are getting close to the end of the loaded simulations list (within last 5)
    // and there's potentially more to load from community cloud...
    if (currentIndex >= sims.length - 5 && STATE.hasMoreCommunity && !STATE.isCommunityLoading) {
        // Proactively fetch next batch in background
        window.loadCommunity(true);
    }
    
    let nextIndex = (currentIndex + 1) % sims.length;
    const next = sims[nextIndex];
    
    if (next.type === 'shape' || next.type === 'local') {
        window.setShape(next.name);
    } else if (next.type === 'community') {
        next.btn.click();
    }
};

window.prevSim = () => {
    const sims = getSimList();
    const activeId = STATE.activeSimId;
    
    let currentIndex = sims.findIndex(s => s.id === activeId);
    if (currentIndex === -1) currentIndex = 0;
    
    let prevIndex = (currentIndex - 1 + sims.length) % sims.length;
    const prev = sims[prevIndex];
    
    if (prev.type === 'shape' || prev.type === 'local') {
        window.setShape(prev.name);
    } else if (prev.type === 'community') {
        prev.btn.click();
    }
};


window.anchorToSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    const activeId = STATE.activeSimId;
    
    // Open sidebar if closed
    if (sidebar.classList.contains('collapsed')) {
        document.getElementById('toggle-sidebar').click();
    }
    
    setTimeout(() => {
        const btn = document.querySelector(`.shape-btn[data-sim-id="${activeId}"]`);
        if (btn) {
            const scrollArea = document.querySelector('.scroll-area');
            const targetSection = btn.closest('.section');
            
            if (scrollArea && targetSection) {
                // Manually calculate scroll to avoid displacing the sidebar header (which happens with scrollIntoView)
                const targetPos = targetSection.offsetTop - 20; // 20px padding
                scrollArea.scrollTo({ top: targetPos, behavior: 'smooth' });
            }
            
            // Highlight the section or button
            if (targetSection) {
                targetSection.style.background = 'rgba(0, 255, 136, 0.05)';
                setTimeout(() => targetSection.style.background = '', 2000);
            }
            
            btn.style.boxShadow = '0 0 15px var(--accent)';
            setTimeout(() => btn.style.boxShadow = '', 2000);
        }
    }, 300);
}


animate();
