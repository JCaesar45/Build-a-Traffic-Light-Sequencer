(function () {
  const TICK_COUNT = 60;
  const ticksGroup = document.getElementById("hour-ticks");
  const cx = 200,
    cy = 200,
    rOuter = 176,
    rInnerMinor = 160,
    rInnerMajor = 152;

  for (let i = 0; i < TICK_COUNT; i++) {
    const angle = (i / TICK_COUNT) * Math.PI * 2 - Math.PI / 2;
    const isMajor = i % 5 === 0;
    const rInner = isMajor ? rInnerMajor : rInnerMinor;
    const x1 = cx + Math.cos(angle) * rOuter;
    const y1 = cy + Math.sin(angle) * rOuter;
    const x2 = cx + Math.cos(angle) * rInner;
    const y2 = cy + Math.sin(angle) * rInner;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1.toFixed(2));
    line.setAttribute("y1", y1.toFixed(2));
    line.setAttribute("x2", x2.toFixed(2));
    line.setAttribute("y2", y2.toFixed(2));
    line.setAttribute("class", isMajor ? "tick tick-major" : "tick");
    ticksGroup.appendChild(line);
  }

  const hourHand = document.getElementById("hand-hour");
  const minuteHand = document.getElementById("hand-minute");
  const secondHand = document.getElementById("hand-second");
  const reserveArc = document.getElementById("reserve-arc");

  const ATELIER_EPOCH = Date.UTC(2026, 0, 1);
  const RESERVE_HOURS = 70;

  function describeArc(cx, cy, r, startAngle, endAngle) {
    const toXY = (angle) => ({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle)
    });
    const start = toXY(startAngle);
    const end = toXY(endAngle);
    const largeArc = endAngle - startAngle <= Math.PI ? 0 : 1;
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(
      2
    )} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  function renderFrame() {
    const now = new Date();
    const h = now.getHours() % 12;
    const m = now.getMinutes();
    const s = now.getSeconds();
    const ms = now.getMilliseconds();

    const secondDeg = ((s + ms / 1000) / 60) * 360;
    const minuteDeg = ((m + s / 60) / 60) * 360;
    const hourDeg = ((h + m / 60) / 12) * 360;

    hourHand.style.transform = `rotate(${hourDeg}deg)`;
    minuteHand.style.transform = `rotate(${minuteDeg}deg)`;
    secondHand.style.transform = `rotate(${secondDeg}deg)`;

    const elapsedHours =
      ((now.getTime() - ATELIER_EPOCH) / 3600000) % RESERVE_HOURS;
    const reserveFraction = 1 - elapsedHours / RESERVE_HOURS;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + reserveFraction * Math.PI * 1.5;
    reserveArc.setAttribute(
      "d",
      describeArc(
        cx,
        cy,
        132,
        startAngle,
        Math.max(endAngle, startAngle + 0.001)
      )
    );

    requestAnimationFrame(renderFrame);
  }

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (prefersReducedMotion) {
    renderFrame();
  } else {
    requestAnimationFrame(renderFrame);
  }

  const revealTargets = document.querySelectorAll(
    ".manifesto h2, .manifesto p, .movement h2, .spec-row, .allocation h2, .allocation-steps li, .apply h2, .apply-lede, #application-form"
  );
  revealTargets.forEach((el) => el.setAttribute("data-reveal", ""));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  revealTargets.forEach((el) => observer.observe(el));
})();
