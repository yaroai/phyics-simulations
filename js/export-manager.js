
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
    document.getElementById('exportPlatform').value = platform;

    // UI Update
    document.querySelectorAll('.platform-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('btn-platform-' + platform).classList.add('active');

    // Section Visibility
    const codeArea = document.getElementById('code-settings-area');
    const imageArea = document.getElementById('image-settings-area');
    const previewArea = document.getElementById('export-preview');
    const primaryBtn = document.getElementById('btn-primary-export');
    const copyBtn = document.getElementById('btn-copy-export');

    if (platform === 'image') {
        codeArea.style.display = 'none';
        previewArea.style.display = 'none';
        imageArea.style.display = 'block';
        primaryBtn.innerText = "Download Image";
        copyBtn.style.display = 'none';
        updatePreview();
    } else if (platform === 'ply') {
        codeArea.style.display = 'none';
        previewArea.style.display = 'none';
        imageArea.style.display = 'none';
        primaryBtn.innerText = "Download 3D PLY";
        copyBtn.style.display = 'none';
        document.getElementById('ply-options').style.display = 'block';
        updatePreview();
    } else if (platform === 'glb' || platform === 'obj') {
        codeArea.style.display = 'none';
        previewArea.style.display = 'none';
        imageArea.style.display = 'none';
        document.getElementById('ply-options').style.display = 'none';
        primaryBtn.innerText = platform === 'glb' ? "Download GLB" : "Download OBJ";
        copyBtn.style.display = 'none';
        updatePreview();
    } else {
        document.getElementById('ply-options').style.display = 'none';
        codeArea.style.display = 'block';
        previewArea.style.display = 'block';
        imageArea.style.display = 'none';
        primaryBtn.innerText = "Download Code";
        copyBtn.style.display = 'inline-block';
        updatePreview();
    }
};

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
            const aspectString = document.getElementById('exportAspect').value;
            const resVal = parseInt(document.getElementById('exportResolution').value); // 1080, 1440, 2160
            const format = document.getElementById('exportFormat').value; // image/png, etc.

            let targetW, targetH;

            if (aspectString === 'custom') {
                targetW = parseInt(document.getElementById('customWidth').value) || 1920;
                targetH = parseInt(document.getElementById('customHeight').value) || 1080;
            } else {
                let widthMult, heightMult;
                switch(aspectString) {
                    case '16:9': widthMult = 16; heightMult = 9; break;
                    case '9:16': widthMult = 9; heightMult = 16; break;
                    case '4:3': widthMult = 4; heightMult = 3; break;
                    case '3:4': widthMult = 3; heightMult = 4; break;
                    case '1:1': default: widthMult = 1; heightMult = 1; break;
                }

                // Target height is our 'resVal' (e.g. 1080p -> 1080px). If we are in 9:16, width is smaller. Or if portrait, usually height is the larger dimension...
                // Let's standardise: resVal is the larger dimension.
                if (widthMult >= heightMult) {
                    // Landscape or square: resVal is height. (Wait, 1080p 16:9 is 1920x1080 => height is 1080)
                    // Let's keep resVal as "height basis" for landscape, "width basis" for portrait to keep pixel count sane.
                    if(widthMult > heightMult) {
                        targetH = resVal;
                        targetW = Math.round(targetH * (widthMult / heightMult));
                    } else {
                        targetW = resVal;
                        targetH = resVal;
                    }
                } else {
                    // Portrait (e.g. 9:16). A 1080p port is usually 1080x1920. So width is resVal, height is larger.
                    targetW = resVal;
                    targetH = Math.round(targetW * (heightMult / widthMult));
                }
            }

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
