function Atmosphere() {
  const ref = useRef(null);
  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    let w = window.innerWidth || 1;
    let h = window.innerHeight || 1;
    let mx = w / 2;
    let my = h / 2;
    let ripples = [];
    let animId;

    const particles = Array.from({ length: 48 }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: Math.random() * 0.6 + 0.2,
      vx: (Math.random() - 0.5) * 0.00025,
      vy: (Math.random() - 0.5) * 0.00025,
    }));

    const resize = () => {
      w = cvs.width = window.innerWidth || 1;
      h = cvs.height = window.innerHeight || 1;
      // keep mouse position valid after resize
      if (!isFinite(mx) || mx <= 0) mx = w / 2;
      if (!isFinite(my) || my <= 0) my = h / 2;
    };
    resize();

    const move = (e) => {
      if (typeof e.clientX === "number") mx = e.clientX;
      if (typeof e.clientY === "number") my = e.clientY;
    };
    const down = (e) => {
      if (typeof e.clientX === "number" && typeof e.clientY === "number") {
        ripples.push({ x: e.clientX, y: e.clientY, r: 0, a: 0.4 });
      }
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", move);
    window.addEventListener("mousedown", down);

    const loop = () => {
      // Safety guard — never draw with invalid values
      if (!isFinite(mx) || !isFinite(my) || w < 1 || h < 1) {
        animId = requestAnimationFrame(loop);
        return;
      }

      ctx.clearRect(0, 0, w, h);

      try {
        const grd = ctx.createRadialGradient(mx, my, 0, mx, my, 320);
        grd.addColorStop(0, "rgba(212,175,55,0.055)");
        grd.addColorStop(1, "transparent");
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
      } catch (err) {
        // silently skip this frame if gradient fails
      }

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > 1) p.vx *= -1;
        if (p.y < 0 || p.y > 1) p.vy *= -1;
        const px = p.x * w;
        const py = p.y * h;
        const dx = px - mx;
        const dy = py - my;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const pull = Math.max(0, 1 - dist / 280) * 8;

        const fx = px - (dx / dist) * pull;
        const fy = py - (dy / dist) * pull;

        if (!isFinite(fx) || !isFinite(fy)) return;

        ctx.beginPath();
        ctx.arc(fx, fy, p.z * 1.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212,175,55,${0.15 * p.z})`;
        ctx.fill();
      });

      ripples = ripples.filter(r => r.a > 0.02);
      ripples.forEach(r => {
        r.r += 5;
        r.a *= 0.93;
        if (!isFinite(r.x) || !isFinite(r.y) || !isFinite(r.r)) return;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(212,175,55,${r.a})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });

      animId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mousedown", down);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1 }}
    />
  );
}