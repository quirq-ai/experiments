import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Img,
  staticFile,
} from "remotion";

// XO Theme Colors
const XO = {
  bg: "#0a0a0a",
  bgCard: "#171717",
  border: "#262626",
  sky: "#38bdf8",
  violet: "#a78bfa",
  emerald: "#34d399",
  amber: "#fbbf24",
  red: "#f87171",
  white: "#ffffff",
  muted: "#a3a3a3",
};

// ============================================
// SCENE 1: Hook
// ============================================
const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12 } });
  const textOpacity = interpolate(frame, [0.8 * fps, 1.3 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const textY = interpolate(frame, [0.8 * fps, 1.3 * fps], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <AbsoluteFill
      style={{ backgroundColor: XO.bg, justifyContent: "center", alignItems: "center" }}
    >
      <div style={{ transform: `scale(${logoScale})`, marginBottom: 40 }}>
        <Img src={staticFile("xo-logo.svg")} style={{ width: 180, height: 180 }} />
      </div>
      <div style={{ opacity: textOpacity, transform: `translateY(${textY}px)` }}>
        <h1 style={{ fontSize: 56, fontWeight: "bold", color: XO.white, fontFamily: "Inter, system-ui", textAlign: "center" }}>
          What if your agency
          <br />
          <span style={{ color: XO.sky }}>never slept?</span>
        </h1>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 2: The Problem
// ============================================
const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const problems = [
    "Clients in every timezone",
    "Deadlines that don't wait",
    "Work that never stops",
  ];

  return (
    <AbsoluteFill
      style={{ backgroundColor: XO.bg, justifyContent: "center", alignItems: "center" }}
    >
      <div style={{ textAlign: "center" }}>
        {problems.map((problem, i) => {
          const delay = i * 0.4 * fps;
          const opacity = interpolate(frame, [delay, delay + 0.3 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const x = interpolate(frame, [delay, delay + 0.3 * fps], [i % 2 === 0 ? -50 : 50, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.quad),
          });

          return (
            <p
              key={i}
              style={{
                fontSize: 42,
                color: XO.red,
                fontFamily: "Inter, system-ui",
                fontWeight: 600,
                margin: "20px 0",
                opacity,
                transform: `translateX(${x}px)`,
              }}
            >
              {problem}
            </p>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 3: Introducing XO
// ============================================
const IntroXOScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 15 } });
  const titleOpacity = interpolate(frame, [0.5 * fps, 1 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subtitleOpacity = interpolate(frame, [1 * fps, 1.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: XO.bg, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `scale(${logoScale})`, marginBottom: 30 }}>
        <Img src={staticFile("xo-logo.svg")} style={{ width: 150, height: 150 }} />
      </div>
      <h1 style={{ fontSize: 64, fontWeight: "bold", color: XO.white, fontFamily: "Inter, system-ui", opacity: titleOpacity, textAlign: "center" }}>
        The <span style={{ color: XO.sky }}>Autonomous</span> Digital Agency
      </h1>
      <p style={{ fontSize: 28, color: XO.muted, fontFamily: "Inter, system-ui", marginTop: 20, opacity: subtitleOpacity }}>
        Powered by AI. Built for scale.
      </p>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 4: Client Channels (NEW)
// ============================================
const ClientChannelsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const channels = [
    { name: "WhatsApp", icon: "📱", color: "#25D366" },
    { name: "Telegram", icon: "✈️", color: "#0088cc" },
    { name: "Slack", icon: null, logo: "logos/slack.svg", color: "#4A154B" },
    { name: "Email", icon: "📧", color: XO.amber },
  ];

  const titleOpacity = interpolate(frame, [0, 0.3 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: XO.bg, justifyContent: "center", alignItems: "center", padding: 60 }}>
      <h2 style={{ fontSize: 48, fontWeight: "bold", color: XO.white, fontFamily: "Inter, system-ui", marginBottom: 50, opacity: titleOpacity }}>
        Clients Connect <span style={{ color: XO.emerald }}>Anywhere</span>
      </h2>
      <div style={{ display: "flex", gap: 40 }}>
        {channels.map((channel, i) => {
          const delay = 0.3 * fps + i * 0.2 * fps;
          const scale = spring({ frame: frame - delay, fps, config: { damping: 12 } });
          const opacity = interpolate(frame, [delay, delay + 0.2 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                backgroundColor: XO.bgCard,
                border: `2px solid ${channel.color}`,
                borderRadius: 16,
                padding: "30px 40px",
                textAlign: "center",
                transform: `scale(${Math.max(0, scale)})`,
                opacity,
              }}
            >
              {channel.logo ? (
                <Img src={staticFile(channel.logo)} style={{ width: 60, height: 60, margin: "0 auto" }} />
              ) : (
                <span style={{ fontSize: 50 }}>{channel.icon}</span>
              )}
              <p style={{ fontSize: 20, color: XO.white, fontFamily: "Inter, system-ui", marginTop: 15, fontWeight: 600 }}>
                {channel.name}
              </p>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 5a: Agent - Clawdbot Manager
// ============================================
const AgentManagerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12 } });
  const features = ["Persistent memory across all clients", "Proactive updates via WhatsApp & Slack", "Never forgets a deadline"];

  return (
    <AbsoluteFill style={{ backgroundColor: XO.bg, justifyContent: "center", alignItems: "center", padding: 80 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 60 }}>
        <div style={{ transform: `scale(${logoScale})`, textAlign: "center" }}>
          <span style={{ fontSize: 120 }}>🦞</span>
          <h3 style={{ fontSize: 36, fontWeight: "bold", color: XO.sky, fontFamily: "Inter, system-ui", marginTop: 20 }}>
            Clawdbot
          </h3>
          <p style={{ fontSize: 20, color: XO.muted, fontFamily: "Inter, system-ui" }}>24/7 Project Manager</p>
        </div>
        <div>
          {features.map((feature, i) => {
            const delay = 0.3 * fps + i * 0.25 * fps;
            const opacity = interpolate(frame, [delay, delay + 0.2 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const x = interpolate(frame, [delay, delay + 0.2 * fps], [30, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <p key={i} style={{ fontSize: 28, color: XO.white, fontFamily: "Inter, system-ui", margin: "15px 0", opacity, transform: `translateX(${x}px)`, display: "flex", alignItems: "center", gap: 15 }}>
                <span style={{ color: XO.sky }}>→</span> {feature}
              </p>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 5b: Agent - Claude Code Builder
// ============================================
const AgentBuilderScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12 } });
  const features = ["Builds AI agents autonomously", "Deploys to production", "Debugs & maintains 24/7"];

  return (
    <AbsoluteFill style={{ backgroundColor: XO.bg, justifyContent: "center", alignItems: "center", padding: 80 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 60 }}>
        <div style={{ transform: `scale(${logoScale})`, textAlign: "center" }}>
          <Img src={staticFile("logos/claude.svg")} style={{ width: 100, height: 100 }} />
          <h3 style={{ fontSize: 36, fontWeight: "bold", color: XO.violet, fontFamily: "Inter, system-ui", marginTop: 20 }}>
            Claude Code
          </h3>
          <p style={{ fontSize: 20, color: XO.muted, fontFamily: "Inter, system-ui" }}>Senior Developer</p>
        </div>
        <div>
          {features.map((feature, i) => {
            const delay = 0.3 * fps + i * 0.25 * fps;
            const opacity = interpolate(frame, [delay, delay + 0.2 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const x = interpolate(frame, [delay, delay + 0.2 * fps], [30, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <p key={i} style={{ fontSize: 28, color: XO.white, fontFamily: "Inter, system-ui", margin: "15px 0", opacity, transform: `translateX(${x}px)`, display: "flex", alignItems: "center", gap: 15 }}>
                <span style={{ color: XO.violet }}>→</span> {feature}
              </p>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 5c: Agent - GPT Codex Creative
// ============================================
const AgentCreativeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12 } });
  const features = ["Case studies on autopilot", "Social content pipeline", "Architecture diagrams"];

  return (
    <AbsoluteFill style={{ backgroundColor: XO.bg, justifyContent: "center", alignItems: "center", padding: 80 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 60 }}>
        <div style={{ transform: `scale(${logoScale})`, textAlign: "center" }}>
          <Img src={staticFile("logos/openai.svg")} style={{ width: 100, height: 100 }} />
          <h3 style={{ fontSize: 36, fontWeight: "bold", color: XO.emerald, fontFamily: "Inter, system-ui", marginTop: 20 }}>
            GPT Codex
          </h3>
          <p style={{ fontSize: 20, color: XO.muted, fontFamily: "Inter, system-ui" }}>Creative Director</p>
        </div>
        <div>
          {features.map((feature, i) => {
            const delay = 0.3 * fps + i * 0.25 * fps;
            const opacity = interpolate(frame, [delay, delay + 0.2 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const x = interpolate(frame, [delay, delay + 0.2 * fps], [30, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <p key={i} style={{ fontSize: 28, color: XO.white, fontFamily: "Inter, system-ui", margin: "15px 0", opacity, transform: `translateX(${x}px)`, display: "flex", alignItems: "center", gap: 15 }}>
                <span style={{ color: XO.emerald }}>→</span> {feature}
              </p>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 6: Workflow
// ============================================
const WorkflowScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const steps = [
    { label: "Client", icon: "💬", color: XO.white },
    { label: "Clawdbot", icon: "🦞", color: XO.sky },
    { label: "Claude", icon: "🤖", color: XO.violet },
    { label: "GPT", icon: "🎨", color: XO.emerald },
    { label: "Deliver", icon: "✅", color: XO.amber },
  ];

  const titleOpacity = interpolate(frame, [0, 0.3 * fps], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: XO.bg, justifyContent: "center", alignItems: "center", padding: 60 }}>
      <h2 style={{ fontSize: 42, fontWeight: "bold", color: XO.white, fontFamily: "Inter, system-ui", marginBottom: 50, opacity: titleOpacity }}>
        Seamless <span style={{ color: XO.sky }}>Orchestration</span>
      </h2>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {steps.map((step, i) => {
          const delay = 0.3 * fps + i * 0.2 * fps;
          const scale = spring({ frame: frame - delay, fps, config: { damping: 15 } });
          const opacity = interpolate(frame, [delay, delay + 0.15 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div
                style={{
                  backgroundColor: XO.bgCard,
                  border: `2px solid ${step.color}`,
                  borderRadius: 12,
                  padding: "20px 25px",
                  textAlign: "center",
                  transform: `scale(${Math.max(0, scale)})`,
                  opacity,
                }}
              >
                <span style={{ fontSize: 36 }}>{step.icon}</span>
                <p style={{ fontSize: 16, color: step.color, fontFamily: "Inter, system-ui", marginTop: 10, fontWeight: 600 }}>
                  {step.label}
                </p>
              </div>
              {i < steps.length - 1 && (
                <span style={{ fontSize: 30, color: XO.muted, opacity }}>→</span>
              )}
            </div>
          );
        })}
      </div>
      <p style={{
        fontSize: 24,
        color: XO.muted,
        fontFamily: "Inter, system-ui",
        marginTop: 40,
        opacity: interpolate(frame, [1.5 * fps, 1.8 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        Zero handoffs. Maximum velocity.
      </p>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 7: Pricing Tiers (NEW)
// ============================================
const PricingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const tiers = [
    { name: "Starter", price: "$2,500", period: "/month", features: ["1 agent project", "Email support"], color: XO.muted },
    { name: "Pro", price: "$7,500", period: "/month", features: ["3 agent projects", "Priority support"], color: XO.sky, featured: true },
    { name: "Enterprise", price: "Custom", period: "", features: ["Unlimited projects", "Dedicated team"], color: XO.violet },
  ];

  const titleOpacity = interpolate(frame, [0, 0.3 * fps], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: XO.bg, justifyContent: "center", alignItems: "center", padding: 60 }}>
      <h2 style={{ fontSize: 42, fontWeight: "bold", color: XO.white, fontFamily: "Inter, system-ui", marginBottom: 40, opacity: titleOpacity }}>
        Simple <span style={{ color: XO.emerald }}>Pricing</span>
      </h2>
      <div style={{ display: "flex", gap: 30 }}>
        {tiers.map((tier, i) => {
          const delay = 0.3 * fps + i * 0.2 * fps;
          const scale = spring({ frame: frame - delay, fps, config: { damping: 12 } });
          const opacity = interpolate(frame, [delay, delay + 0.2 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                backgroundColor: tier.featured ? `${tier.color}15` : XO.bgCard,
                border: `2px solid ${tier.color}`,
                borderRadius: 16,
                padding: "30px 35px",
                textAlign: "center",
                transform: `scale(${Math.max(0, scale)})`,
                opacity,
                minWidth: 200,
              }}
            >
              <p style={{ fontSize: 18, color: tier.color, fontFamily: "Inter, system-ui", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                {tier.name}
              </p>
              <p style={{ fontSize: 40, color: XO.white, fontFamily: "Inter, system-ui", fontWeight: "bold", margin: "15px 0 5px" }}>
                {tier.price}
              </p>
              <p style={{ fontSize: 16, color: XO.muted, fontFamily: "Inter, system-ui" }}>{tier.period}</p>
              <div style={{ marginTop: 20 }}>
                {tier.features.map((f, j) => (
                  <p key={j} style={{ fontSize: 14, color: XO.muted, fontFamily: "Inter, system-ui", margin: "8px 0" }}>
                    {f}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 8: CTA
// ============================================
const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12 } });
  const textOpacity = interpolate(frame, [0.5 * fps, 1 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaScale = spring({ frame: frame - 1 * fps, fps, config: { damping: 15 } });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${XO.bg} 0%, #0c1929 100%)`,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ transform: `scale(${logoScale})`, marginBottom: 30 }}>
        <Img src={staticFile("xo-logo.svg")} style={{ width: 120, height: 120 }} />
      </div>
      <h1 style={{ fontSize: 52, fontWeight: "bold", color: XO.white, fontFamily: "Inter, system-ui", textAlign: "center", opacity: textOpacity }}>
        Build Your <span style={{ color: XO.sky }}>Autonomous</span> Agency
      </h1>
      <div
        style={{
          marginTop: 40,
          backgroundColor: XO.sky,
          padding: "18px 50px",
          borderRadius: 12,
          transform: `scale(${Math.max(0, ctaScale)})`,
        }}
      >
        <span style={{ fontSize: 28, fontWeight: "bold", color: XO.bg, fontFamily: "Inter, system-ui" }}>
          xo.builders
        </span>
      </div>
      <p style={{
        fontSize: 20,
        color: XO.muted,
        fontFamily: "Inter, system-ui",
        marginTop: 30,
        opacity: interpolate(frame, [1.5 * fps, 2 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        AI Agents. Real Clients. 24/7.
      </p>
    </AbsoluteFill>
  );
};

// ============================================
// MAIN COMPOSITION
// ============================================
export const XOAgencyVideo: React.FC = () => {
  const { fps } = useVideoConfig();

  // Scene durations in seconds
  const scenes = [
    { duration: 5, component: HookScene },           // 0:00-0:05
    { duration: 5, component: ProblemScene },        // 0:05-0:10
    { duration: 6, component: IntroXOScene },        // 0:10-0:16
    { duration: 6, component: ClientChannelsScene }, // 0:16-0:22
    { duration: 6, component: AgentManagerScene },   // 0:22-0:28
    { duration: 6, component: AgentBuilderScene },   // 0:28-0:34
    { duration: 6, component: AgentCreativeScene },  // 0:34-0:40
    { duration: 6, component: WorkflowScene },       // 0:40-0:46
    { duration: 6, component: PricingScene },        // 0:46-0:52
    { duration: 8, component: CTAScene },            // 0:52-1:00
  ];

  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: XO.bg }}>
      {scenes.map((scene, i) => {
        const from = currentFrame;
        const durationInFrames = scene.duration * fps;
        currentFrame += durationInFrames;
        const SceneComponent = scene.component;

        return (
          <Sequence key={i} from={from} durationInFrames={durationInFrames} premountFor={fps}>
            <SceneComponent />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export default XOAgencyVideo;
