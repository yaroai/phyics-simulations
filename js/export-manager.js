
const SHADERS = {
    spark: {
        geo: `new THREE.TetrahedronGeometry(0.25)`,
        mat: `new THREE.MeshBasicMaterial({ color: 0xffffff })`
    },
    vector: {
        geo: `new THREE.ConeGeometry(0.1, 0.5, 4).rotateX(Math.PI / 2)`,
        mat: `new THREE.MeshBasicMaterial({ color: 0x00aaff })`
    },
    cyber: {
        geo: `new THREE.BoxGeometry(0.3, 0.3, 0.3)`,
        mat: `new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true })`
    },
    plasma: {
        geo: `new THREE.PlaneGeometry(0.8, 0.8)`,
        mat: `new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 }
    },
    vertexShader: \`
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
            vUv = uv;
            vColor = instanceColor;
            vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
        }
    \`,
    fragmentShader: \`
        varying vec2 vUv;
        varying vec3 vColor;
        uniform float uTime;
        void main() {
            float dist = distance(vUv, vec2(0.5));
            float ring = smoothstep(0.4, 0.45, dist) - smoothstep(0.45, 0.5, dist);
            float core = 1.0 - smoothstep(0.0, 0.1, dist);
            float alpha = core + ring * (0.5 + 0.5 * sin(uTime * 3.0));
            if (alpha < 0.05) discard;
            gl_FragColor = vec4(vColor, alpha); 
        }
    \`,
    transparent: true,
    depthWrite: false,
    side: 2 // DoubleSide
})`
    },
    ink: {
        geo: `new THREE.PlaneGeometry(0.8, 0.8)`,
        mat: `new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: \`
        varying vec2 vUv;
        varying vec3 vColor;
        void main() { 
            vUv = uv; 
            vColor = instanceColor;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); 
        }
    \`,
    fragmentShader: \`
        varying vec2 vUv;
        varying vec3 vColor;
        uniform float uTime;
        float rand(vec2 n) { return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }
        float noise(vec2 p) { vec2 ip = floor(p); vec2 u = fract(p); u = u*u*(3.0-2.0*u); float res = mix(mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y); return res * res; }
        void main() {
            float dist = distance(vUv, vec2(0.5));
            float n = noise(vUv * 5.0 + uTime * 0.5);
            float alpha = (1.0 - smoothstep(0.2, 0.5, dist)) * (0.5 + 0.5 * n);
            if(alpha < 0.1) discard;
            gl_FragColor = vec4(vColor + 0.2, alpha * 0.8);
        }
    \`,
    transparent: true, depthWrite: false, side: 2, blending: 2
})`
    },
    paint: {
        geo: `new THREE.PlaneGeometry(0.8, 0.8)`,
        mat: `new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: \`
        varying vec2 vUv;
        varying vec3 vColor;
        void main() { 
            vUv = uv; 
            vColor = instanceColor;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); 
        }
    \`,
    fragmentShader: \`
        varying vec2 vUv;
        varying vec3 vColor;
        uniform float uTime;
        void main() {
            vec2 p = vUv * 2.0 - 1.0;
            for(int i=1; i<4; i++) {
                p.x += 0.3/float(i)*sin(float(i)*3.0*p.y + uTime*0.4);
                p.y += 0.3/float(i)*cos(float(i)*3.0*p.x + uTime*0.4);
            }
            float r = cos(p.x+p.y+1.0)*0.5+0.5;
            float pattern = (sin(p.x+p.y)+cos(p.x+p.y))*0.5+0.5;
            float dist = distance(vUv, vec2(0.5));
            if(dist > 0.5) discard;
            vec3 finalColor = mix(vColor, vec3(r, pattern, 1.0 - r), 0.3);
            gl_FragColor = vec4(finalColor, 1.0);
        }
    \`,
    side: 2
})`
    },
    steel: {
        geo: `new THREE.SphereGeometry(0.3, 16, 16)`,
        mat: `new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: \`
        varying vec3 vNormal;
        varying vec3 vColor;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vColor = instanceColor;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
    \`,
    fragmentShader: \`
        varying vec3 vNormal;
        varying vec3 vColor;
        void main() {
            vec3 viewDir = vec3(0.0, 0.0, 1.0);
            float metallic = dot(vNormal, viewDir) * 0.5 + 0.5;
            metallic = pow(metallic, 3.0);
            vec3 col = mix(vec3(0.1), vColor, 0.5) * metallic + vec3(0.2); 
            gl_FragColor = vec4(col, 1.0);
        }
    \`
})`
    },
    glass: {
        geo: `new THREE.SphereGeometry(0.3, 16, 16)`,
        mat: `new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: \`
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
    \`,
    fragmentShader: \`
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vColor;
        void main() {
            float fresnel = dot(vNormal, normalize(vViewPosition));
            fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
            fresnel = pow(fresnel, 2.0);
            vec3 col = vColor * fresnel + vec3(0.1); 
            gl_FragColor = vec4(col, 0.3 + fresnel * 0.7);
        }
    \`,
    transparent: true, blending: 2, depthWrite: false
})`
    }
};

const EXPORT_TEMPLATES = {
    vanilla: (code, settings) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Particles Swarm Export</title>
    <style>body { margin: 0; overflow: hidden; background: #000; }</style>
    <script type="importmap">
    {
        "imports": {
            "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
            "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
        }
    }
    </script>
</head>
<body>
    <script type="module">
        import * as THREE from 'three';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
        import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
        import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

        // CONFIG
        const COUNT = ${settings.count};
        const SPEED_MULT = ${settings.speed};
        const AUTO_SPIN = ${settings.autoSpin};

        // SETUP
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x000000, 0.01);
        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(0, 0, 100);
        
        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.autoRotate = AUTO_SPIN;
        controls.autoRotateSpeed = 2.0;

        // POST PROCESSING
        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        bloomPass.strength = 1.8; bloomPass.radius = 0.4; bloomPass.threshold = 0;
        composer.addPass(bloomPass);

        // SWARM OBJECTS
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        const target = new THREE.Vector3();
        const pColor = new THREE.Color(); // Kept for safety, for potential references
        
        // INSTANCED MESH
        const geometry = ${settings.geoCode};
        const material = ${settings.matCode};
        
        const instancedMesh = new THREE.InstancedMesh(geometry, material, COUNT);
        instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(instancedMesh);

        // DATA ARRAYS
        const positions = [];
        for(let i=0; i<COUNT; i++) {
            positions.push(new THREE.Vector3((Math.random()-0.5)*100, (Math.random()-0.5)*100, (Math.random()-0.5)*100));
            instancedMesh.setColorAt(i, color.setHex(0x00ff88)); // Init Color
        }

        // CONTROL STUBS
        const PARAMS = ${JSON.stringify(settings.customParams)};
        const addControl = (id, label, min, max, val) => {
            return PARAMS[id] !== undefined ? PARAMS[id] : val;
        };
        const setInfo = () => {};
        const annotate = () => {};

        // ANIMATION LOOP
        const clock = new THREE.Clock();
        
        function animate() {
            requestAnimationFrame(animate);
            const delta = clock.getDelta();
            const time = clock.getElapsedTime() * SPEED_MULT;
            
            // Shader Time Update
            if(material.uniforms && material.uniforms.uTime) {
                material.uniforms.uTime.value = time;
            }

            controls.update();

            // SWARM LOGIC
            const count = COUNT; // Alias for user code compatibility
            for(let i=0; i<COUNT; i++) {
                 // USER CODE INJECTION START
                 ${code.split('\n').join('\n                 ')}
                 // USER CODE INJECTION END

                 // LERP & UPDATE
                 positions[i].lerp(target, 0.1);
                 dummy.position.copy(positions[i]);
                 dummy.updateMatrix();
                 instancedMesh.setMatrixAt(i, dummy.matrix);
                 instancedMesh.setColorAt(i, color); // Fix: Use 'color' which user modifies
            }
            instancedMesh.instanceMatrix.needsUpdate = true;
            instancedMesh.instanceColor.needsUpdate = true;

            composer.render();
        }
        animate();

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            composer.setSize(window.innerWidth, window.innerHeight);
        });
    </script>
</body>
</html>`,

    // React and Three templates would be similarly updated with settings injection
    // For brevity in this artifact, reusing simplified structure but injecting settings
    react: (code, settings) => `import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, Effects } from '@react-three/drei';
import { UnrealBloomPass } from 'three-stdlib';
import * as THREE from 'three';

extend({ UnrealBloomPass });

const ParticleSwarm = () => {
  const meshRef = useRef();
  const count = ${settings.count};
  const speedMult = ${settings.speed};
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const pColor = useMemo(() => new THREE.Color(), []);
  const color = pColor; // Alias for user code compatibility
  
  const positions = useMemo(() => {
     const pos = [];
     for(let i=0; i<count; i++) pos.push(new THREE.Vector3((Math.random()-0.5)*100, (Math.random()-0.5)*100, (Math.random()-0.5)*100));
     return pos;
  }, []);

  // Material & Geom
  const material = useMemo(() => ${settings.matCode}, []);
  const geometry = useMemo(() => ${settings.geoCode}, []);

  const PARAMS = useMemo(() => (${JSON.stringify(settings.customParams)}), []);
  const addControl = (id, l, min, max, val) => {
      return PARAMS[id] !== undefined ? PARAMS[id] : val;
  };
  const setInfo = () => {};
  const annotate = () => {};

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime() * speedMult;
    const THREE_LIB = THREE;

    if(material.uniforms && material.uniforms.uTime) {
         material.uniforms.uTime.value = time;
    }

    for (let i = 0; i < count; i++) {
        // USER CODE START
        ${code.split('\n').join('\n        ')}
        // USER CODE END

        positions[i].lerp(target, 0.1);
        dummy.position.copy(positions[i]);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        meshRef.current.setColorAt(i, pColor);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, count]} />
  );
};

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas camera={{ position: [0, 0, 100], fov: 60 }}>
        <fog attach="fog" args={['#000000', 0.01]} />
        <ParticleSwarm />
        <OrbitControls autoRotate={${settings.autoSpin}} />
        <Effects disableGamma>
            <unrealBloomPass threshold={0} strength={1.8} radius={0.4} />
        </Effects>
      </Canvas>
    </div>
  );
}`,

    three: (code, settings) => `import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export class ParticlesSwarm {
    constructor(container, count = ${settings.count}) {
        this.count = count;
        this.container = container;
        this.speedMult = ${settings.speed};
        
        // SETUP
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.01);
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.camera.position.set(0, 0, 100);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);

        // POST PROCESSING
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        bloomPass.strength = 1.8; bloomPass.radius = 0.4; bloomPass.threshold = 0;
        this.composer.addPass(bloomPass);

        // OBJECTS
        this.dummy = new THREE.Object3D();
        this.color = new THREE.Color();
        this.target = new THREE.Vector3();
        this.pColor = new THREE.Color();
        
        this.geometry = ${settings.geoCode};
        this.material = ${settings.matCode};
        
        this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.count);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.add(this.mesh);
        
        this.positions = [];
        for(let i=0; i<this.count; i++) {
            this.positions.push(new THREE.Vector3((Math.random()-0.5)*100, (Math.random()-0.5)*100, (Math.random()-0.5)*100));
            this.mesh.setColorAt(i, this.color.setHex(0x00ff88));
        }
        
        this.clock = new THREE.Clock();
        this.animate = this.animate.bind(this);
        this.animate();
    }

    animate() {
        requestAnimationFrame(this.animate);
        const time = this.clock.getElapsedTime() * this.speedMult;
        
        if(this.material.uniforms && this.material.uniforms.uTime) {
            this.material.uniforms.uTime.value = time;
        }

        // API Stubs
        const PARAMS = ${JSON.stringify(settings.customParams)};
        const addControl = (id, l, min, max, val) => {
             return PARAMS[id] !== undefined ? PARAMS[id] : val;
        };
        const setInfo = () => {};
        const annotate = () => {};
        let THREE_LIB = THREE;
        
        let THREE_LIB = THREE;
        const count = this.count; // Alias for user code
        
        for(let i=0; i<this.count; i++) {
            let target = this.target;
            let color = this.pColor;
            
            // INJECTED CODE
            ${code.split('\n').join('\n            ')}
            
            // UPDATE
            this.positions[i].lerp(this.target, 0.1);
            this.dummy.position.copy(this.positions[i]);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
            this.mesh.setColorAt(i, this.pColor);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.mesh.instanceColor.needsUpdate = true;
        
        this.composer.render();
    }
    
    dispose() {
        this.geometry.dispose();
        this.material.dispose();
        this.scene.remove(this.mesh);
        this.renderer.dispose();
    }
}`
};

// --- DATA EXTRACTION ---
function getExportSettings() {
    const s = {
        count: window.CONFIG ? window.CONFIG.count : 20000,
        speed: window.STATE ? window.STATE.speed : 1.0,
        autoSpin: window.STATE ? window.STATE.autoSpin : true,
        renderStyle: window.STATE ? window.STATE.renderStyle : 'spark',
        geoCode: `new THREE.TetrahedronGeometry(0.25)`,
        matCode: `new THREE.MeshBasicMaterial({ color: 0xffffff })`,
        customParams: window.STATE && window.STATE.customParams ? window.STATE.customParams : {}
    };

    if (SHADERS[s.renderStyle]) {
        s.geoCode = SHADERS[s.renderStyle].geo;
        s.matCode = SHADERS[s.renderStyle].mat;
    }
    return s;
}

function getExportCode() {
    // 0. Use Active Code (Community or Custom)
    if (window.STATE && window.STATE.mode === 'custom' && window.STATE.activeCustomCode) {
        return window.STATE.activeCustomCode;
    }

    // 0.5. Static Modes (Draw, Text, Image, Model, Blueprint) - Serialize Positions & Colors
    if (window.STATE && ['draw', 'text', 'image', 'model', 'blueprint'].includes(window.STATE.mode) && window.positions) {
        // Serialize current target positions & colors
        const count = window.CONFIG.count;
        const coords = [];
        const colors = [];

        let colorArray = null;
        if (window.mesh && window.mesh.instanceColor && window.mesh.instanceColor.array) {
            colorArray = window.mesh.instanceColor.array;
        }

        for (let i = 0; i < count; i++) {
            const p = window.positions.target[i];
            // Round to 2 decimal places to save space
            coords.push(Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, Math.round(p.z * 100) / 100);

            if (colorArray) {
                colors.push(
                    Math.round(colorArray[i * 3] * 255),
                    Math.round(colorArray[i * 3 + 1] * 255),
                    Math.round(colorArray[i * 3 + 2] * 255)
                );
            } else {
                colors.push(0, 255, 136); // Default 0x00ff88
            }
        }

        return `// STATIC FORMATION EXPORT
const POS_DATA = [${coords.join(',')}];
const COL_DATA = [${colors.join(',')}];
const idx = i * 3;
target.set(POS_DATA[idx], POS_DATA[idx+1], POS_DATA[idx+2]);
color.setRGB(COL_DATA[idx]/255, COL_DATA[idx+1]/255, COL_DATA[idx+2]/255);`;
    }

    // 0.6 Video Export Mode - Provide HTML5 video base player simulator
    if (window.STATE && window.STATE.mode === 'video' && window.positions && window.STATE.videoGrid) {
        const count = window.CONFIG.count;
        const w = window.STATE.videoGrid.w;
        const h = window.STATE.videoGrid.h;
        const coords = [];
        for (let i = 0; i < count; i++) {
            const p = window.positions.target[i];
            coords.push(Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, Math.round(p.z * 100) / 100);
        }

        return `// VIDEO FORMATION EXPORT
// NOTE: Due to browser security restrictions, the actual video file cannot be bundled in this text script. 
// You must provide your own <video id="export-video" loop autoplay playsinline src="YOUR_VIDEO.mp4" style="display:none;"></video> in your HTML.

// Initialize Canvas globally once on first run
if (!window.vCanvas) {
    window.vCanvas = document.createElement('canvas');
    window.vCanvas.width = ${w}; window.vCanvas.height = ${h};
    window.vCtx = window.vCanvas.getContext('2d', { willReadFrequently: true });
}

// Fixed positions grid
const POS_DATA = [${coords.join(',')}];
const idx = i * 3;
target.set(POS_DATA[idx], POS_DATA[idx+1], POS_DATA[idx+2]);

// Sample Video 
const vid = document.getElementById('export-video') || document.querySelector('video');
if(vid && vid.readyState >= 2 && i === 0) {
    window.vCtx.drawImage(vid, 0, 0, ${w}, ${h});
    window.vData = window.vCtx.getImageData(0, 0, ${w}, ${h}).data;
}

// Apply colors
if(window.vData && i < (${w}*${h})) {
    const dIdx = i * 4;
    color.setRGB(window.vData[dIdx]/255, window.vData[dIdx+1]/255, window.vData[dIdx+2]/255);
} else {
    color.setRGB(0,0,0);
}
        `;
    }

    // 1. Try Custom Shape (Legacy Fallback)
    if (window.STATE && window.STATE.mode === 'custom' && window.STATE.customShapes && window.STATE.customName) {
        return window.STATE.customShapes[window.STATE.customName];
    }

    // 2. Try Standard Shapes (Fallback to known algorithms matching main.js)
    if (window.STATE && window.STATE.mode) {
        switch (window.STATE.mode) {
            case 'sphere':
                return `const r = 30;
const phi = Math.acos(-1 + (2 * i) / count);
const theta = Math.sqrt(count * Math.PI) * phi;
target.set(r * Math.cos(theta) * Math.sin(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(phi));
color.setHex(0x00ff88);`;
            case 'cube':
                return `const s = Math.ceil(Math.pow(count, 1/3));
const sep = 2.5; const off = (s * sep) / 2;
let z = Math.floor(i / (s*s));
let y = Math.floor((i % (s*s)) / s);
let x = i % s;
target.set(x * sep - off, y * sep - off, z * sep - off);
color.setHex(0x00aaff);`;
            case 'helix':
                return `const r = 15;
const h = count * 0.003;
const off = h / 2;
const t = i * 0.05;
target.set(Math.cos(t) * r, (i * 0.003) - off, Math.sin(t) * r);
color.setHSL((i / count), 1, 0.5);`;
            case 'torus':
                return `const R = 25; const r = 8;
const u = (i / count) * Math.PI * 2 * 40;
const v = (i / count) * Math.PI * 2;
target.set((R + r * Math.cos(u)) * Math.cos(v), (R + r * Math.cos(u)) * Math.sin(v), r * Math.sin(u));
color.setHex(0xff0055);`;
        }
    }

    return `// Default
const t = time + i * 0.0001;
target.set(Math.cos(t * 3) * 30, Math.sin(t * 2) * 30, Math.sin(t * 5) * 30);
color.setHSL(i/count, 1, 0.5);`;
}

// --- UI HANDLERS ---
window.openExport = () => {
    document.getElementById('export-modal').style.display = 'flex';
    updatePreview();
};

window.closeExport = () => {
    document.getElementById('export-modal').style.display = 'none';
};

window.updatePreview = () => {
    const code = getExportCode();
    document.getElementById('export-preview').innerText = code;
}

window.copyExport = () => {
    const code = getExportCode();
    const settings = getExportSettings();
    const platform = document.getElementById('exportPlatform').value;
    const fullCode = EXPORT_TEMPLATES[platform](code, settings);

    navigator.clipboard.writeText(fullCode).then(() => {
        const btn = document.querySelector('button[onclick="copyExport()"]');
        const orig = btn.innerText;
        btn.innerText = "Copied!";
        setTimeout(() => btn.innerText = orig, 2000);
    });
};

window.exportCode = () => {
    const code = getExportCode();
    const settings = getExportSettings();
    const platform = document.getElementById('exportPlatform').value;
    const fullCode = EXPORT_TEMPLATES[platform](code, settings);

    let filename = "ParticlesSwarm";

    if (window.STATE && window.STATE.mode) {
        if (window.STATE.mode === 'image' && window.STATE.imgSource) {
            filename = document.getElementById('imgName').innerText.split('.')[0] || "image_formation";
        } else if (window.STATE.mode === 'video' && window.STATE.vidSource) {
            filename = document.getElementById('vidName').innerText.split('.')[0] || "video_formation";
        } else if (window.STATE.mode === 'model') {
            filename = document.getElementById('modelName').innerText.split('.')[0] || "model_formation";
        } else if (window.STATE.mode === 'blueprint') {
            filename = document.getElementById('blueprintName').innerText.split('.')[0] || "blueprint_formation";
        } else if (window.STATE.mode === 'draw') {
            filename = "custom_drawing";
        } else if (window.STATE.mode === 'text') {
            filename = (document.getElementById('textInput').value || "text").substring(0, 10) + "_formation";
        } else if (window.STATE.mode === 'custom' && window.STATE.customName) {
            filename = window.STATE.customName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        } else {
            filename = window.STATE.mode;
        }
    }

    // Cleanup filename spacing/characters
    filename = filename.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    let type = "text/plain";

    if (platform === 'vanilla') { filename += ".html"; type = "text/html"; }
    else if (platform === 'react') { filename += ".jsx"; type = "text/javascript"; }
    else if (platform === 'three') { filename += ".js"; type = "text/javascript"; }

    const blob = new Blob([fullCode], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// Add listeners
// document.getElementById('exportPlatform') ? document.getElementById('exportPlatform').addEventListener('change', window.updatePreview) : null;

window.setExportPlatform = (platform) => {
    if (activeRecording) return; // don't swap formats mid-recording

    document.getElementById('exportPlatform').value = platform;

    // UI Update
    document.querySelectorAll('.platform-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('btn-platform-' + platform).classList.add('active');

    // Section Visibility
    const codeArea = document.getElementById('code-settings-area');
    const imageArea = document.getElementById('image-settings-area');
    const videoArea = document.getElementById('video-settings-area');
    const formatRow = document.getElementById('row-format');
    const previewArea = document.getElementById('export-preview');
    const primaryBtn = document.getElementById('btn-primary-export');
    const copyBtn = document.getElementById('btn-copy-export');

    // The aspect / resolution block is shared by the image and video exporters;
    // only the image exporter has a file-format row.
    const isImage = platform === 'image';
    const isVideo = platform === 'video';
    const isCode = ['vanilla', 'react', 'three'].includes(platform);

    codeArea.style.display = isCode ? 'block' : 'none';
    previewArea.style.display = isCode ? 'block' : 'none';
    copyBtn.style.display = isCode ? 'inline-block' : 'none';
    imageArea.style.display = (isImage || isVideo) ? 'block' : 'none';
    videoArea.style.display = isVideo ? 'block' : 'none';
    formatRow.style.display = isImage ? 'flex' : 'none';
    document.getElementById('ply-options').style.display = platform === 'ply' ? 'block' : 'none';

    if (isVideo) setupVideoUI();

    if (isImage) primaryBtn.innerText = "Download Image";
    else if (isVideo) primaryBtn.innerText = "Record MP4";
    else if (platform === 'ply') primaryBtn.innerText = "Download 3D PLY";
    else if (platform === 'glb') primaryBtn.innerText = "Download GLB";
    else if (platform === 'obj') primaryBtn.innerText = "Download OBJ";
    else primaryBtn.innerText = "Download Code";

    updatePreview();
};

// Reflect codec support + whether the current scene has an audio source to capture.
function setupVideoUI() {
    const audioRow = document.getElementById('row-video-audio');
    const note = document.getElementById('video-codec-note');
    const hasVideoSource = !!(window.STATE && window.STATE.mode === 'video' && window.STATE.vidSource);

    audioRow.style.display = hasVideoSource ? 'flex' : 'none';

    const base = "Records the live canvas exactly as it looks on screen &mdash; keep the simulation running while it captures.";
    note.innerHTML = window.isMp4RecordingSupported()
        ? base
        : base + "<br><span style='color:#e0a030;'>This browser can't encode MP4, so the clip will be saved as .webm instead.</span>";
}

window.setExportAspect = (aspect) => {
    document.getElementById('exportAspect').value = aspect;
    document.querySelectorAll('.aspect-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('btn-aspect-' + aspect.replace(':', '-')).classList.add('active');

    // Toggle custom res inputs
    const customArea = document.getElementById('custom-res-area');
    const resRow = document.getElementById('row-resolution');
    if (aspect === 'custom') {
        customArea.style.display = 'block';
        resRow.style.display = 'none';
    } else {
        customArea.style.display = 'none';
        resRow.style.display = 'flex';
    }
};

window.exportCode = () => {
    const platform = document.getElementById('exportPlatform').value;
    if (platform === 'image') {
        window.exportImage();
        return;
    }
    if (platform === 'video') {
        window.exportVideo();
        return;
    }
    if (platform === 'ply') {
        window.exportPLY();
        return;
    }
    if (platform === 'glb') {
        window.exportGLB();
        return;
    }
    if (platform === 'obj') {
        window.exportOBJ();
        return;
    }

    const code = getExportCode();
    const settings = getExportSettings();
    const fullCode = EXPORT_TEMPLATES[platform](code, settings);

    let filename = "ParticlesSwarm";

    if (window.STATE && window.STATE.mode) {
        if (window.STATE.mode === 'image' && window.STATE.imgSource) {
            filename = document.getElementById('imgName').innerText.split('.')[0] || "image_formation";
        } else if (window.STATE.mode === 'video' && window.STATE.vidSource) {
            filename = document.getElementById('vidName').innerText.split('.')[0] || "video_formation";
        } else if (window.STATE.mode === 'model') {
            filename = document.getElementById('modelName').innerText.split('.')[0] || "model_formation";
        } else if (window.STATE.mode === 'blueprint') {
            filename = document.getElementById('blueprintName').innerText.split('.')[0] || "blueprint_formation";
        } else if (window.STATE.mode === 'draw') {
            filename = "custom_drawing";
        } else if (window.STATE.mode === 'text') {
            filename = (document.getElementById('textInput').value || "text").substring(0, 10) + "_formation";
        } else if (window.STATE.mode === 'custom' && window.STATE.customName) {
            filename = window.STATE.customName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        } else {
            filename = window.STATE.mode;
        }
    }

    // Cleanup filename spacing/characters
    filename = filename.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    let type = "text/plain";

    if (platform === 'vanilla') { filename += ".html"; type = "text/html"; }
    else if (platform === 'react') { filename += ".jsx"; type = "text/javascript"; }
    else if (platform === 'three') { filename += ".js"; type = "text/javascript"; }

    const blob = new Blob([fullCode], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// --- SHARED DIMENSIONS (Image + Video) ---
// Reads the aspect / resolution controls and returns the pixel size to render at.
// "resVal" is the height basis for landscape & square, the width basis for portrait,
// so a "1080p" portrait clip comes out 1080x1920 rather than 607x1080.
function getExportDimensions() {
    const aspectString = document.getElementById('exportAspect').value;
    const resVal = parseInt(document.getElementById('exportResolution').value);

    if (aspectString === 'custom') {
        return {
            w: parseInt(document.getElementById('customWidth').value) || 1920,
            h: parseInt(document.getElementById('customHeight').value) || 1080
        };
    }

    let widthMult, heightMult;
    switch (aspectString) {
        case '16:9': widthMult = 16; heightMult = 9; break;
        case '9:16': widthMult = 9; heightMult = 16; break;
        case '4:3': widthMult = 4; heightMult = 3; break;
        case '3:4': widthMult = 3; heightMult = 4; break;
        case '1:1': default: widthMult = 1; heightMult = 1; break;
    }

    if (widthMult > heightMult) {
        return { w: Math.round(resVal * (widthMult / heightMult)), h: resVal };
    }
    if (widthMult === heightMult) {
        return { w: resVal, h: resVal };
    }
    return { w: resVal, h: Math.round(resVal * (heightMult / widthMult)) };
}

window.exportImage = () => {
    if(!window.renderer || !window.camera || !window.scene || !window.composer) {
        console.error("Missing WebGL references to export image.");
        return;
    }

    const btn = document.getElementById('btn-primary-export');
    const origText = btn.innerText;
    btn.innerText = 'Rendering...';
    btn.disabled = true;

    // Wait a tiny bit to allow UI update before locking thread
    setTimeout(() => {
        try {
            const format = document.getElementById('exportFormat').value; // image/png, etc.
            const { w: targetW, h: targetH } = getExportDimensions();

            // Store active config
            const origW = window.innerWidth;
            const origH = window.innerHeight;
            const origAspect = window.camera.aspect;
            const origRatio = window.renderer.getPixelRatio();

            // Apply new config
            window.renderer.setPixelRatio(1);
            window.renderer.setSize(targetW, targetH, false);
            window.composer.setSize(targetW, targetH);
            window.camera.aspect = targetW / targetH;
            window.camera.updateProjectionMatrix();

            // Render single frame
            window.composer.render();

            // Grab DataUrl
            const imgData = window.renderer.domElement.toDataURL(format, 1.0);

            // Trigger download
            const ext = format.split('/')[1];
            let filename = "particle_architect_4k_" + format + "." + ext;
            if(window.STATE && window.STATE.customName) {
                filename = window.STATE.customName.replace(/[^a-z0-9]/gi, '_').toLowerCase() + "_" + targetW + "x" + targetH + "." + ext;
            } else {
                filename = "particle_simulator_" + targetW + "x" + targetH + "." + ext;
            }

            const a = document.createElement('a');
            a.href = imgData;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Restore Config
            window.renderer.setPixelRatio(window.devicePixelRatio);
            window.renderer.setSize(origW, origH, false);
            window.composer.setSize(origW, origH);
            window.camera.aspect = origAspect;
            window.camera.updateProjectionMatrix();

            btn.innerText = "Success!";
            setTimeout(() => {
                btn.innerText = origText;
                btn.disabled = false;
            }, 2000);

        } catch (e) {
            console.error("Image Export Error:", e);
            btn.innerText = "Error (See console)";
            setTimeout(() => {
                btn.innerText = origText;
                btn.disabled = false;
            }, 3000);
        }
    }, 100);
};

window.exportPLY = () => {
    if(!window.mesh) {
        console.error("No mesh found to export.");
        return;
    }

    const btn = document.getElementById('btn-primary-export');
    const origText = btn.innerText;
    btn.innerText = 'Processing...';
    btn.disabled = true;

    const exportMode = document.querySelector('input[name="plyMode"]:checked').value;

    setTimeout(() => {
        try {
            const count = window.CONFIG.count;
            const mesh = window.mesh;
            const matrix = new THREE.Matrix4();
            const position = new THREE.Vector3();
            let plyContent = "ply\nformat ascii 1.0\n";

            if (exportMode === 'points') {
                // LIGHTWEIGHT POINT CLOUD (Existing logic)
                plyContent += `element vertex ${count}\n`;
                plyContent += "property float x\nproperty float y\nproperty float z\n";
                plyContent += "property uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n";

                let colorArray = mesh.instanceColor ? mesh.instanceColor.array : null;

                for (let i = 0; i < count; i++) {
                    mesh.getMatrixAt(i, matrix);
                    position.setFromMatrixPosition(matrix);
                    let r = 0, g = 255, b = 136;
                    if (colorArray) {
                        r = Math.round(colorArray[i * 3] * 255);
                        g = Math.round(colorArray[i * 3 + 1] * 255);
                        b = Math.round(colorArray[i * 3 + 2] * 255);
                    }
                    plyContent += `${position.x.toFixed(4)} ${position.y.toFixed(4)} ${position.z.toFixed(4)} ${r} ${g} ${b}\n`;
                }
            } else {
                // SOLID MESH (Consolidated Geometry)
                const geo = mesh.geometry;
                const posAttr = geo.attributes.position;
                const indexAttr = geo.index;
                const vertCount = posAttr.count;
                const faceCount = indexAttr ? indexAttr.count / 3 : vertCount / 3;
                
                const totalVertices = vertCount * count;
                const totalFaces = faceCount * count;

                plyContent += `element vertex ${totalVertices}\n`;
                plyContent += "property float x\nproperty float y\nproperty float z\n";
                plyContent += "property uchar red\nproperty uchar green\nproperty uchar blue\n";
                plyContent += `element face ${totalFaces}\n`;
                plyContent += "property list uchar int vertex_indices\nend_header\n";

                let colorArray = mesh.instanceColor ? mesh.instanceColor.array : null;
                const v = new THREE.Vector3();

                // 1. VERTICES
                for (let i = 0; i < count; i++) {
                    mesh.getMatrixAt(i, matrix);
                    let r = 0, g = 255, b = 136;
                    if (colorArray) {
                        r = Math.round(colorArray[i * 3] * 255);
                        g = Math.round(colorArray[i * 3 + 1] * 255);
                        b = Math.round(colorArray[i * 3 + 2] * 255);
                    }

                    for (let j = 0; j < vertCount; j++) {
                        v.fromBufferAttribute(posAttr, j);
                        v.applyMatrix4(matrix);
                        plyContent += `${v.x.toFixed(4)} ${v.y.toFixed(4)} ${v.z.toFixed(4)} ${r} ${g} ${b}\n`;
                    }
                }

                // 2. FACES
                for (let i = 0; i < count; i++) {
                    const offset = i * vertCount;
                    if (indexAttr) {
                        for (let j = 0; j < indexAttr.count; j += 3) {
                            plyContent += `3 ${indexAttr.getX(j) + offset} ${indexAttr.getX(j + 1) + offset} ${indexAttr.getX(j + 2) + offset}\n`;
                        }
                    } else {
                        for (let j = 0; j < vertCount; j += 3) {
                            plyContent += `3 ${j + offset} ${j + 1 + offset} ${j + 2 + offset}\n`;
                        }
                    }
                }
            }

            const blob = new Blob([plyContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            let filename = (window.STATE && window.STATE.customName ? window.STATE.customName : (window.STATE && window.STATE.mode ? window.STATE.mode : "formation")).replace(/[^a-z0-9]/gi, '_').toLowerCase();
            filename += "_" + exportMode + ".ply";

            const a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);

            btn.innerText = "Success!";
            setTimeout(() => { btn.innerText = origText; btn.disabled = false; }, 2000);
        } catch (e) {
            console.error("PLY Export Error:", e);
            btn.innerText = "Error";
            setTimeout(() => { btn.innerText = origText; btn.disabled = false; }, 2000);
        }
    }, 50);
};

window.exportGLB = () => {
    if(!window.mesh) return;
    const btn = document.getElementById('btn-primary-export');
    const origText = btn.innerText;
    btn.innerText = 'Extracting...';
    btn.disabled = true;

    setTimeout(() => {
        try {
            const mesh = window.mesh;
            const count = window.CONFIG.count;
            const geo = mesh.geometry;
            const mat = mesh.material.clone();
            
            // Create a group of meshes to export (GLTFExporter handles groups well)
            const group = new THREE.Group();
            const matrix = new THREE.Matrix4();
            
            // For GLB, we could try to use InstancedMesh directly if Exporter supports it,
            // but for reliability across all viewers, consolidating into a group of meshes 
            // is "Heavy" but works everywhere.
            // BETTER: Use a single merged geometry for performance.
            const mergedGeo = new THREE.BufferGeometry();
            const posAttr = geo.attributes.position;
            const vertCount = posAttr.count;
            const totalVerts = vertCount * count;
            
            const positions = new Float32Array(totalVerts * 3);
            const colors = new Float32Array(totalVerts * 3);
            const indices = geo.index ? new Uint32Array((geo.index.count) * count) : null;
            
            const v = new THREE.Vector3();
            let colorArray = mesh.instanceColor ? mesh.instanceColor.array : null;

            for (let i = 0; i < count; i++) {
                mesh.getMatrixAt(i, matrix);
                const offset = i * vertCount;
                
                let r = 1, g = 1, b = 1;
                if (colorArray) {
                    r = colorArray[i * 3];
                    g = colorArray[i * 3 + 1];
                    b = colorArray[i * 3 + 2];
                }

                for (let j = 0; j < vertCount; j++) {
                    v.fromBufferAttribute(posAttr, j);
                    v.applyMatrix4(matrix);
                    positions[(offset + j) * 3] = v.x;
                    positions[(offset + j) * 3 + 1] = v.y;
                    positions[(offset + j) * 3 + 2] = v.z;
                    
                    colors[(offset + j) * 3] = r;
                    colors[(offset + j) * 3 + 1] = g;
                    colors[(offset + j) * 3 + 2] = b;
                }
                
                if (indices && geo.index) {
                    const indexOffset = i * geo.index.count;
                    for (let j = 0; j < geo.index.count; j++) {
                        indices[indexOffset + j] = geo.index.array[j] + offset;
                    }
                }
            }

            mergedGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            mergedGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            if (indices) mergedGeo.setIndex(new THREE.BufferAttribute(indices, 1));
            
            const finalMesh = new THREE.Mesh(mergedGeo, new THREE.MeshStandardMaterial({ vertexColors: true }));
            
            const exporter = new window.GLTFExporter();
            exporter.parse(finalMesh, (result) => {
                const blob = new Blob([result], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const filename = (window.STATE && window.STATE.customName ? window.STATE.customName : "formation").replace(/[^a-z0-9]/gi, '_').toLowerCase() + ".glb";
                
                const a = document.createElement('a');
                a.href = url; a.download = filename;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                btn.innerText = "Success!";
                setTimeout(() => { btn.innerText = origText; btn.disabled = false; }, 2000);
            }, (err) => {
                console.error("GLB Export Error:", err);
                btn.innerText = "Error";
                btn.disabled = false;
            }, { binary: true });

        } catch (e) {
            console.error(e);
            btn.innerText = "Error";
            btn.disabled = false;
        }
    }, 50);
};

window.exportOBJ = () => {
    if(!window.mesh) return;
    const btn = document.getElementById('btn-primary-export');
    const origText = btn.innerText;
    btn.innerText = 'Extracting...';
    btn.disabled = true;

    setTimeout(() => {
        try {
            const mesh = window.mesh;
            const count = window.CONFIG.count;
            const geo = mesh.geometry;
            const matrix = new THREE.Matrix4();
            
            // For OBJ, we need to create real mesh objects for the exporter
            const group = new THREE.Group();
            
            // To prevent massive group sizes, we'll use the same merging logic as GLB
            // but OBJExporter works on Objects.
            const mergedGeo = new THREE.BufferGeometry();
            const posAttr = geo.attributes.position;
            const vertCount = posAttr.count;
            const totalVerts = vertCount * count;
            const positions = new Float32Array(totalVerts * 3);
            const indices = geo.index ? new Uint32Array((geo.index.count) * count) : null;
            const v = new THREE.Vector3();

            for (let i = 0; i < count; i++) {
                mesh.getMatrixAt(i, matrix);
                const offset = i * vertCount;
                for (let j = 0; j < vertCount; j++) {
                    v.fromBufferAttribute(posAttr, j);
                    v.applyMatrix4(matrix);
                    positions[(offset + j) * 3] = v.x;
                    positions[(offset + j) * 3 + 1] = v.y;
                    positions[(offset + j) * 3 + 2] = v.z;
                }
                if (indices && geo.index) {
                    const indexOffset = i * geo.index.count;
                    for (let j = 0; j < geo.index.count; j++) {
                        indices[indexOffset + j] = geo.index.array[j] + offset;
                    }
                }
            }
            mergedGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            if (indices) mergedGeo.setIndex(new THREE.BufferAttribute(indices, 1));
            
            const finalMesh = new THREE.Mesh(mergedGeo, new THREE.MeshStandardMaterial());
            
            const exporter = new window.OBJExporter();
            const result = exporter.parse(finalMesh);
            
            const blob = new Blob([result], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const filename = (window.STATE && window.STATE.customName ? window.STATE.customName : "formation").replace(/[^a-z0-9]/gi, '_').toLowerCase() + ".obj";
            
            const a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            btn.innerText = "Success!";
            setTimeout(() => { btn.innerText = origText; btn.disabled = false; }, 2000);
        } catch (e) {
            console.error(e);
            btn.innerText = "Error";
            btn.disabled = false;
        }
    }, 50);
};

// --- VIDEO (MP4) EXPORT ---
// Records the live WebGL canvas with MediaRecorder. MP4/H.264 is preferred; a browser
// that cannot mux MP4 (e.g. older Firefox) falls back to WebM and the file is named honestly.
const MP4_MIME_TYPES = [
    'video/mp4;codecs=avc1.640029,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.640029',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1',
    'video/mp4'
];
const WEBM_MIME_TYPES = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm'
];

function pickRecorderMime(withAudio) {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return null;

    const hasAudioCodec = (mime) => /mp4a|opus/.test(mime);
    const candidates = MP4_MIME_TYPES.concat(WEBM_MIME_TYPES)
        .filter(mime => withAudio ? true : !hasAudioCodec(mime));

    return candidates.find(mime => MediaRecorder.isTypeSupported(mime)) || null;
}

window.isMp4RecordingSupported = () => {
    const mime = pickRecorderMime(false);
    return !!mime && mime.indexOf('video/mp4') === 0;
};

function getVideoFilenameBase() {
    let name = "particle_simulation";
    const label = (id) => ((document.getElementById(id) || {}).innerText || "");

    if (window.STATE && window.STATE.mode) {
        if (window.STATE.mode === 'image' && window.STATE.imgSource) {
            name = label('imgName').split('.')[0] || "image_formation";
        } else if (window.STATE.mode === 'video' && window.STATE.vidSource) {
            name = label('vidName').split('.')[0] || "video_formation";
        } else if (window.STATE.mode === 'model') {
            name = label('modelName').split('.')[0] || "model_formation";
        } else if (window.STATE.mode === 'blueprint') {
            name = label('blueprintName').split('.')[0] || "blueprint_formation";
        } else if (window.STATE.mode === 'draw') {
            name = "custom_drawing";
        } else if (window.STATE.mode === 'text') {
            name = ((document.getElementById('textInput') || {}).value || "text").substring(0, 10) + "_formation";
        } else if (window.STATE.mode === 'custom' && window.STATE.customName) {
            name = window.STATE.customName;
        } else {
            name = window.STATE.mode;
        }
    }

    return name.replace(/[^a-z0-9_]/gi, '_').toLowerCase() || "particle_simulation";
}

// Set while a recording is in flight, so the primary button doubles as "Stop & Save".
let activeRecording = null;

window.stopVideoExport = () => {
    if (activeRecording && activeRecording.state === 'recording') activeRecording.stop();
};

window.exportVideo = () => {
    const btn = document.getElementById('btn-primary-export');

    if (activeRecording) { window.stopVideoExport(); return; }

    if (!window.renderer || !window.camera || !window.composer) {
        console.error("Missing WebGL references to record video.");
        return;
    }

    const canvas = window.renderer.domElement;
    if (!canvas.captureStream || typeof MediaRecorder === 'undefined') {
        alert("This browser cannot record the canvas (MediaRecorder / captureStream unavailable). Try Chrome, Edge or Safari.");
        return;
    }

    const duration = Math.min(120, Math.max(1, parseInt(document.getElementById('videoDuration').value) || 10));
    const fps = parseInt(document.getElementById('videoFps').value) || 30;
    const bitrate = (parseInt(document.getElementById('videoBitrate').value) || 16) * 1000000;

    // H.264 needs even dimensions.
    const dims = getExportDimensions();
    const targetW = Math.max(2, dims.w - (dims.w % 2));
    const targetH = Math.max(2, dims.h - (dims.h % 2));

    const progress = document.getElementById('video-progress');
    const fill = document.getElementById('video-progress-fill');
    const status = document.getElementById('video-progress-text');
    const origText = "Record MP4";

    // Render at export size for the duration of the capture. updateStyle=false leaves the
    // on-screen element alone, so only the backing store (what captureStream reads) changes.
    const origSize = window.renderer.getSize(new THREE.Vector2());
    const origRatio = window.renderer.getPixelRatio();
    const origAspect = window.camera.aspect;

    const restore = () => {
        window.renderer.setPixelRatio(origRatio);
        window.renderer.setSize(origSize.x, origSize.y, false);
        window.composer.setSize(origSize.x, origSize.y);
        window.camera.aspect = origAspect;
        window.camera.updateProjectionMatrix();
        window.EXPORT_RECORDING = false;
    };

    window.EXPORT_RECORDING = true; // main.js skips its resize handler while this is set
    window.renderer.setPixelRatio(1);
    window.renderer.setSize(targetW, targetH, false);
    window.composer.setSize(targetW, targetH);
    window.camera.aspect = targetW / targetH;
    window.camera.updateProjectionMatrix();

    let stream;
    try {
        stream = canvas.captureStream(fps);
    } catch (e) {
        console.error("Canvas capture failed:", e);
        restore();
        alert("Could not capture the canvas for recording.");
        return;
    }

    // Carry the uploaded clip's audio when the swarm is being driven by a video.
    const audioBox = document.getElementById('videoAudio');
    const vid = document.getElementById('video-proc');
    let audioAdded = false;
    if (audioBox && audioBox.checked && window.STATE && window.STATE.mode === 'video' && vid && vid.captureStream) {
        try {
            vid.captureStream().getAudioTracks().forEach(track => {
                stream.addTrack(track);
                audioAdded = true;
            });
        } catch (e) {
            console.warn("Could not capture video audio:", e);
        }
    }

    const mime = pickRecorderMime(audioAdded);
    let recorder = null;
    if (mime) {
        try {
            recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
        } catch (e) {
            console.error("MediaRecorder init failed:", e);
        }
    }
    if (!recorder) {
        restore();
        stream.getVideoTracks().forEach(t => t.stop());
        alert("This browser has no supported video recording codec.");
        return;
    }

    const chunks = [];
    const startedAt = performance.now();
    let timer = null;

    const cleanup = () => {
        if (timer) clearInterval(timer);
        activeRecording = null;
        restore();
        stream.getVideoTracks().forEach(t => t.stop()); // canvas track only — leave the <video> element's audio running
        progress.style.display = 'none';
        fill.style.width = '0%';
        btn.disabled = false;
    };

    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

    recorder.onstop = () => {
        cleanup();

        const isMp4 = mime.indexOf('video/mp4') === 0;
        const blob = new Blob(chunks, { type: mime.split(';')[0] });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = getVideoFilenameBase() + "_" + targetW + "x" + targetH + (isMp4 ? ".mp4" : ".webm");
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        btn.innerText = isMp4 ? "Saved!" : "Saved as WebM";
        setTimeout(() => { btn.innerText = origText; }, 2500);
    };

    recorder.onerror = (e) => {
        console.error("Recorder error:", e);
        cleanup();
        btn.innerText = "Record Error";
        setTimeout(() => { btn.innerText = origText; }, 2500);
    };

    activeRecording = recorder;
    recorder.start(200);

    progress.style.display = 'block';
    fill.style.width = '0%';
    status.innerText = `Recording ${targetW}x${targetH} @ ${fps}fps`;
    btn.innerText = `Stop & Save (${duration.toFixed(1)}s)`;

    timer = setInterval(() => {
        if (!activeRecording) return;
        const elapsed = (performance.now() - startedAt) / 1000;
        fill.style.width = Math.min(100, (elapsed / duration) * 100) + '%';

        if (elapsed >= duration) {
            status.innerText = "Encoding...";
            btn.innerText = "Encoding...";
            btn.disabled = true;
            clearInterval(timer);
            timer = null;
            if (recorder.state === 'recording') recorder.stop();
            return;
        }
        btn.innerText = `Stop & Save (${(duration - elapsed).toFixed(1)}s)`;
    }, 100);
};
