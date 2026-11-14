/*
 * Animated orange "flame curtain" background, same look as the LinkedIn banner:
 * vertical orange streaks of different widths and heights that slowly shimmer.
 *   <canvas class="flames" data-dir="up">   → streaks rise from the bottom (hero)
 *   <canvas class="flames" data-dir="down"> → streaks hang from the top (mid CTA)
 *   data-env="left-dim" / "center-dim"      → softer behind the text so it stays readable
 * Drawn on the GPU (WebGL) at full screen resolution, so the streaks are sharp.
 * Falls back to a lighter 2D version if WebGL is unavailable.
 * Pauses when off-screen; draws one still frame for reduced-motion users.
 */
(() => {
  const canvases = [...document.querySelectorAll("canvas.flames")];
  if (!canvases.length) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DPR = () => Math.min(window.devicePixelRatio || 1, 2);
  const ENV = { "": 0, "left-dim": 1, "center-dim": 2 };

  const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
  const FRAG = `
    precision highp float;
    uniform vec2 uRes; uniform float uTime, uDir, uEnv, uDpr, uSeed;
    const float TAU = 6.2831853;

    float env(float u) {
      if (uEnv < 0.5) return 1.0;
      if (uEnv < 1.5) return 0.45 + 0.55 * clamp((u - 0.2) / 0.4, 0.0, 1.0);
      return 0.5 + 0.5 * clamp(abs(u - 0.5) / 0.32, 0.0, 1.0);
    }
    vec3 ramp(float v) {
      vec3 c0 = vec3(60.0, 12.0, 4.0) / 255.0;
      vec3 c1 = vec3(150.0, 32.0, 8.0) / 255.0;
      vec3 c2 = vec3(235.0, 78.0, 22.0) / 255.0;
      vec3 c3 = vec3(255.0, 132.0, 56.0) / 255.0;
      if (v < 0.35) return mix(c0, c1, v / 0.35);
      if (v < 0.65) return mix(c1, c2, (v - 0.35) / 0.30);
      return mix(c2, c3, (v - 0.65) / 0.35);
    }
    void main() {
      float t = uTime + uSeed;
      float x = gl_FragCoord.x / uDpr;                 // css pixels → same streak width on any screen
      float u = gl_FragCoord.x / uRes.x;
      float v = gl_FragCoord.y / uRes.y;               // 0 at the bottom
      if (uDir < 0.0) v = 1.0 - v;                     // hang from the top instead

      // three families of streaks: wide, medium and fine, each gently wobbling sideways
      float a = 0.5 + 0.5 * sin(x * TAU / 58.0 + 1.6 * sin(x * TAU / 700.0 + t * 0.35) + t * 0.55);
      float b = 0.5 + 0.5 * sin(x * TAU / 36.0 - 1.2 * sin(x * TAU / 420.0 - t * 0.28) - t * 0.40);
      float c = 0.5 + 0.5 * sin(x * TAU / 17.0 + 0.9 * sin(x * TAU / 260.0 + t * 0.22) + t * 0.30);
      float s = clamp(pow(a, 3.0) * 0.72 + pow(b, 5.0) * 0.55 + pow(c, 8.0) * 0.32, 0.0, 1.0);

      // streak heights rise and fall like slow waves
      float h = 0.56 + 0.2 * sin(x * TAU / 820.0 + t * 0.32) + 0.12 * sin(x * TAU / 330.0 - t * 0.53) + 0.18 * s;
      float f = 1.0 - v / h;
      if (f <= 0.0) { gl_FragColor = vec4(0.0); return; }
      f = f * f * (3.0 - 2.0 * f);                     // smooth fade toward the tips

      float inten = f * (0.22 + 0.95 * s) * env(u);
      vec3 col = ramp(clamp(inten * 1.3, 0.0, 1.0));
      float alpha = clamp(inten * 1.5, 0.0, 1.0);
      gl_FragColor = vec4(col * alpha, alpha);         // premultiplied
    }`;

  function makeGL(cv) {
    const gl = cv.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(prog, n);
    const u = { res: U("uRes"), time: U("uTime"), dir: U("uDir"), env: U("uEnv"), dpr: U("uDpr"), seed: U("uSeed") };
    gl.uniform1f(u.dir, cv.dataset.dir === "down" ? -1 : 1);
    gl.uniform1f(u.env, ENV[cv.dataset.env || ""] ?? 0);
    gl.uniform1f(u.seed, Math.random() * 100);
    return {
      gl: true,
      resize(w, h, dpr) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); gl.uniform2f(u.res, w, h); gl.uniform1f(u.dpr, dpr); },
      draw(t) { gl.uniform1f(u.time, t); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); },
    };
  }

  // 2D fallback: same idea on the CPU at half resolution
  function make2D(cv) {
    const ctx = cv.getContext("2d");
    const TAU = Math.PI * 2, dir = cv.dataset.dir === "down" ? -1 : 1, envK = ENV[cv.dataset.env || ""] ?? 0, seed = Math.random() * 100;
    let img = null, W = 0, H = 0, dpr = 1;
    const scale = 2;
    return {
      resize(w, h, d) { dpr = d; W = Math.round(w / scale); H = Math.round(h / scale); cv.width = W; cv.height = H; img = ctx.createImageData(W, H); },
      draw(t) {
        const px = img.data, T = t + seed;
        for (let x = 0; x < W; x++) {
          const cx = (x * scale) / dpr, u = x / W;
          const a = 0.5 + 0.5 * Math.sin(cx * TAU / 58 + 1.6 * Math.sin(cx * TAU / 700 + T * 0.35) + T * 0.55);
          const b = 0.5 + 0.5 * Math.sin(cx * TAU / 36 - 1.2 * Math.sin(cx * TAU / 420 - T * 0.28) - T * 0.4);
          const s = Math.min(1, a ** 3 * 0.72 + b ** 5 * 0.55);
          const h = 0.56 + 0.2 * Math.sin(cx * TAU / 820 + T * 0.32) + 0.12 * Math.sin(cx * TAU / 330 - T * 0.53) + 0.18 * s;
          const e = envK === 1 ? 0.45 + 0.55 * Math.min(1, Math.max(0, (u - 0.2) / 0.4))
                  : envK === 2 ? 0.5 + 0.5 * Math.min(1, Math.abs(u - 0.5) / 0.32) : 1;
          for (let y = 0; y < H; y++) {
            let v = 1 - y / (H - 1); if (dir < 0) v = 1 - v;
            let f = 1 - v / h; const i = (y * W + x) * 4;
            if (f <= 0) { px[i + 3] = 0; continue; }
            f = f * f * (3 - 2 * f);
            const k = Math.min(1, f * (0.22 + 0.95 * s) * e * 1.3);
            px[i] = 60 + 195 * k; px[i + 1] = 12 + 120 * k * k; px[i + 2] = 4 + 52 * k * k; px[i + 3] = Math.min(255, k * 300);
          }
        }
        ctx.putImageData(img, 0, 0);
      },
    };
  }

  const states = canvases.map((cv) => {
    let r = null;
    try { r = makeGL(cv); } catch (e) { r = null; }
    const st = { r: r || make2D(cv), visible: true };
    const resize = () => {
      const rect = cv.getBoundingClientRect(), dpr = DPR();
      st.r.resize(Math.max(2, Math.round(rect.width * dpr)), Math.max(2, Math.round(rect.height * dpr)), dpr);
      if (reduce) st.r.draw(4);
    };
    resize();
    new ResizeObserver(resize).observe(cv);
    new IntersectionObserver(([e]) => { st.visible = e.isIntersecting; }).observe(cv);
    return st;
  });
  if (reduce) return;

  function loop(now) {
    requestAnimationFrame(loop);
    const t = now / 1000;
    for (const s of states) if (s.visible && !document.hidden) s.r.draw(t);
  }
  requestAnimationFrame(loop);
})();
