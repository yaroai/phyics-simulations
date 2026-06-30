/* ============================================================
   AUTO-DEMO / ATTRACT MODE
   Automatically drives the simulation when left untouched:
   sliders drift, camera spins, dollies in/out, and cycles
   through formations. Yields instantly when the user interacts,
   resumes after a few seconds of inactivity. Toggle button bottom-left.
   ============================================================ */
(function () {
    "use strict";

    const IDLE_RESUME_MS = 7000;   // resume this long after the last user input
    const START_DELAY_MS = 3500;   // let "CALIBRATING PARTICLES..." finish first

    const state = {
        enabled: true,     // master toggle (user can switch off)
        lastInput: 0,      // timestamp of last real user interaction
        running: false,
        t0: 0,
        // ramp targets for sliders
        targets: {},
        nextSimAt: 0,
        nextDensityAt: 0,
        nextTargetsAt: 0,
        spinDir: 1,
        wasActive: false,
    };

    const now = () => performance.now();
    const rand = (a, b) => a + Math.random() * (b - a);

    function $(id) { return document.getElementById(id); }

    // ---- helpers ---------------------------------------------------------
    function setSlider(id, value, fire) {
        const el = $(id);
        if (!el) return;
        const min = parseFloat(el.min), max = parseFloat(el.max);
        value = Math.max(min, Math.min(max, value));
        el.value = value;
        if (fire) el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    function getSlider(id) {
        const el = $(id);
        return el ? parseFloat(el.value) : null;
    }

    // ---- per-frame ramp of a slider toward its target --------------------
    function rampSlider(id, smooth) {
        const el = $(id);
        if (!el || state.targets[id] == null) return;
        const cur = parseFloat(el.value);
        const tgt = state.targets[id];
        const next = cur + (tgt - cur) * smooth;
        if (Math.abs(next - cur) > 1e-4) setSlider(id, next, true);
    }

    function pickTargets() {
        // gentle, watchable ranges within each slider's bounds
        state.targets.speedSlider = rand(0.5, 2.0);
        state.targets.bloomSlider = rand(1.2, 3.0);
        state.nextTargetsAt = now() + rand(4000, 8000);
    }

    // ---- camera dolly (cooperates with OrbitControls.autoRotate) ---------
    function dollyToward(camera, controls, desiredR, smooth) {
        const tx = controls.target.x, ty = controls.target.y, tz = controls.target.z;
        const ox = camera.position.x - tx, oy = camera.position.y - ty, oz = camera.position.z - tz;
        const curR = Math.sqrt(ox * ox + oy * oy + oz * oz);
        if (curR < 1e-3) return;
        const k = desiredR / curR;
        const f = 1 + (k - 1) * smooth;   // ease the radius change
        camera.position.x = tx + ox * f;
        camera.position.y = ty + oy * f;
        camera.position.z = tz + oz * f;
    }

    // ---- main loop -------------------------------------------------------
    function tick() {
        requestAnimationFrame(tick);
        const camera = window.camera, controls = window.controls;
        if (!camera || !controls) return;

        const tNow = now();
        const idle = (tNow - state.lastInput) > IDLE_RESUME_MS;
        const active = state.enabled && idle && (tNow - state.t0 > START_DELAY_MS);

        // Open the control sidebar whenever attract mode (re)activates, so the
        // sliders are actually visible while they drift. The app collapses it by
        // default for a clean first view.
        if (active && !state.wasActive) {
            const sb = $("sidebar");
            if (sb) sb.classList.remove("collapsed");
        }
        state.wasActive = active;

        if (!active) return;

        const t = (tNow - state.t0) / 1000; // seconds

        // 1) SPIN — keep autoRotate on, gently breathe its speed + occasionally reverse
        controls.autoRotate = true;
        const spinBase = 1.6 + Math.sin(t * 0.13) * 1.4; // ~0.2 .. 3.0
        controls.autoRotateSpeed = state.spinDir * spinBase;

        // 2) ZOOM — dolly in/out on a slow sine
        const desiredR = 110 + Math.sin(t * 0.35) * 55; // ~55 .. 165
        dollyToward(camera, controls, desiredR, 0.05);

        // 3) SLIDERS — drift toward random targets
        if (tNow > state.nextTargetsAt) pickTargets();
        rampSlider("speedSlider", 0.04);
        rampSlider("bloomSlider", 0.04);

        // 4) PARTICLE COUNT — occasional jump (heavier, so infrequent)
        if (tNow > state.nextDensityAt) {
            const el = $("densitySlider");
            if (el) {
                const min = parseFloat(el.min), max = parseFloat(el.max);
                const step = parseFloat(el.step) || 1000;
                let v = Math.round(rand(min + step, max - step) / step) * step;
                setSlider("densitySlider", v, true);
            }
            state.nextDensityAt = tNow + rand(18000, 26000);
        }

        // 5) FORMATION — cycle to the next shape now and then
        if (tNow > state.nextSimAt) {
            state.spinDir = Math.random() < 0.4 ? -state.spinDir : state.spinDir; // sometimes flip spin too
            if (typeof window.nextSim === "function") window.nextSim();
            state.nextSimAt = tNow + rand(14000, 20000);
        }
    }

    // ---- user-interaction = yield ----------------------------------------
    function markInput() { state.lastInput = now(); }
    ["pointerdown", "wheel", "keydown", "touchstart", "mousedown"].forEach(ev =>
        window.addEventListener(ev, markInput, { capture: true, passive: true })
    );

    // ---- toggle button ---------------------------------------------------
    function buildButton() {
        const btn = document.createElement("button");
        btn.id = "auto-demo-toggle";
        btn.style.cssText = [
            "position:fixed", "left:16px", "bottom:16px", "z-index:9999",
            "font:600 11px/1 system-ui,sans-serif", "letter-spacing:.12em",
            "padding:9px 13px", "border-radius:20px", "cursor:pointer",
            "background:rgba(10,12,18,.72)", "backdrop-filter:blur(8px)",
            "color:var(--accent,#00e5ff)", "border:1px solid var(--accent,#00e5ff)",
            "box-shadow:0 0 14px -2px var(--accent,#00e5ff)", "transition:opacity .2s",
            "user-select:none"
        ].join(";");
        function render() {
            btn.innerHTML = (state.enabled ? "● AUTO ON" : "○ AUTO OFF");
            btn.style.opacity = state.enabled ? "1" : ".55";
        }
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            state.enabled = !state.enabled;
            if (state.enabled) state.lastInput = 0; // resume immediately
            render();
        });
        render();
        document.body.appendChild(btn);
    }

    // ---- boot ------------------------------------------------------------
    function boot() {
        state.t0 = now();
        state.nextSimAt = state.t0 + START_DELAY_MS + 9000;
        state.nextDensityAt = state.t0 + START_DELAY_MS + 12000;
        pickTargets();
        buildButton();
        requestAnimationFrame(tick);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
