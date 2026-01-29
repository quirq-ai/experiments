import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";

// XO Theme Colors
const XO_THEME = {
  background: "#0a0a0a",
  primary: "#38bdf8", // sky-400
  secondary: "#a78bfa", // violet-400
  accent: "#34d399", // emerald-400
  warning: "#fbbf24", // amber-400
  danger: "#f87171", // red-400
  text: "#ffffff",
  textMuted: "#a3a3a3", // neutral-400
  cardBg: "#171717", // neutral-900
  border: "#262626", // neutral-800
};

// Intro Scene
const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12 },
  });

  const titleOpacity = interpolate(frame, [0.5 * fps, 1 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleY = interpolate(frame, [0.5 * fps, 1 * fps], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  const subtitleOpacity = interpolate(frame, [1 * fps, 1.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: XO_THEME.background,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Lobster Emoji as Logo */}
      <div
        style={{
          fontSize: 120,
          transform: `scale(${logoScale})`,
          marginBottom: 30,
        }}
      >
        🦞
      </div>

      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: 72,
            fontWeight: "bold",
            color: XO_THEME.text,
            margin: 0,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          Clawdbot
        </h1>
      </div>

      <div
        style={{
          opacity: subtitleOpacity,
          marginTop: 20,
        }}
      >
        <p
          style={{
            fontSize: 28,
            color: XO_THEME.textMuted,
            margin: 0,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          Your Personal AI Assistant
        </p>
      </div>
    </AbsoluteFill>
  );
};

// Stats Scene
const StatsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stats = [
    { value: "9K+", label: "GitHub Stars", color: XO_THEME.primary },
    { value: "50+", label: "Integrations", color: XO_THEME.accent },
    { value: "24/7", label: "Memory", color: XO_THEME.secondary },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: XO_THEME.background,
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
      }}
    >
      <h2
        style={{
          fontSize: 48,
          fontWeight: "bold",
          color: XO_THEME.text,
          marginBottom: 60,
          fontFamily: "Inter, system-ui, sans-serif",
          opacity: interpolate(frame, [0, 0.3 * fps], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        By The Numbers
      </h2>

      <div
        style={{
          display: "flex",
          gap: 40,
          justifyContent: "center",
        }}
      >
        {stats.map((stat, index) => {
          const delay = index * 0.2 * fps;
          const scale = spring({
            frame: frame - delay,
            fps,
            config: { damping: 12 },
          });

          const opacity = interpolate(
            frame,
            [delay, delay + 0.3 * fps],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }
          );

          return (
            <div
              key={index}
              style={{
                backgroundColor: XO_THEME.cardBg,
                border: `1px solid ${XO_THEME.border}`,
                borderRadius: 16,
                padding: "40px 50px",
                textAlign: "center",
                transform: `scale(${Math.max(0, scale)})`,
                opacity,
              }}
            >
              <div
                style={{
                  fontSize: 56,
                  fontWeight: "bold",
                  color: stat.color,
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: 20,
                  color: XO_THEME.textMuted,
                  marginTop: 10,
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
              >
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// Features Scene
const FeaturesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const features = [
    {
      icon: "💬",
      title: "Multi-Platform",
      desc: "WhatsApp, Discord, Slack, Telegram",
      color: XO_THEME.primary,
    },
    {
      icon: "🧠",
      title: "Persistent Memory",
      desc: "Remembers everything in Markdown",
      color: XO_THEME.accent,
    },
    {
      icon: "⚡",
      title: "Proactive",
      desc: "Reaches out with alerts & briefings",
      color: XO_THEME.warning,
    },
    {
      icon: "🔧",
      title: "Extensible",
      desc: "Skills system + ClawdHub marketplace",
      color: XO_THEME.secondary,
    },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: XO_THEME.background,
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
      }}
    >
      <h2
        style={{
          fontSize: 48,
          fontWeight: "bold",
          color: XO_THEME.text,
          marginBottom: 50,
          fontFamily: "Inter, system-ui, sans-serif",
          opacity: interpolate(frame, [0, 0.3 * fps], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        Key Features
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 30,
        }}
      >
        {features.map((feature, index) => {
          const delay = index * 0.15 * fps;
          const slideX = interpolate(
            frame,
            [delay, delay + 0.4 * fps],
            [index % 2 === 0 ? -100 : 100, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.quad),
            }
          );

          const opacity = interpolate(
            frame,
            [delay, delay + 0.3 * fps],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }
          );

          return (
            <div
              key={index}
              style={{
                backgroundColor: XO_THEME.cardBg,
                border: `1px solid ${XO_THEME.border}`,
                borderTop: `4px solid ${feature.color}`,
                borderRadius: 12,
                padding: "30px 40px",
                transform: `translateX(${slideX}px)`,
                opacity,
                display: "flex",
                alignItems: "center",
                gap: 20,
              }}
            >
              <span style={{ fontSize: 40 }}>{feature.icon}</span>
              <div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: "bold",
                    color: feature.color,
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                >
                  {feature.title}
                </div>
                <div
                  style={{
                    fontSize: 16,
                    color: XO_THEME.textMuted,
                    marginTop: 5,
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                >
                  {feature.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// Installation Scene
const InstallScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const codeOpacity = interpolate(frame, [0.3 * fps, 0.6 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const line1Opacity = interpolate(frame, [0.6 * fps, 0.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const line2Opacity = interpolate(frame, [1 * fps, 1.2 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: XO_THEME.background,
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
      }}
    >
      <h2
        style={{
          fontSize: 48,
          fontWeight: "bold",
          color: XO_THEME.text,
          marginBottom: 50,
          fontFamily: "Inter, system-ui, sans-serif",
          opacity: interpolate(frame, [0, 0.3 * fps], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        Get Started in Seconds
      </h2>

      <div
        style={{
          backgroundColor: "#1e1e1e",
          borderRadius: 16,
          padding: 40,
          width: "80%",
          maxWidth: 800,
          opacity: codeOpacity,
        }}
      >
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 24,
            lineHeight: 2,
          }}
        >
          <div style={{ opacity: line1Opacity }}>
            <span style={{ color: "#9cdcfe" }}>$</span>{" "}
            <span style={{ color: "#ce9178" }}>
              npm install -g clawdbot@latest
            </span>
          </div>
          <div style={{ opacity: line2Opacity }}>
            <span style={{ color: "#9cdcfe" }}>$</span>{" "}
            <span style={{ color: "#ce9178" }}>
              clawdbot onboard --install-daemon
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 40,
          display: "flex",
          gap: 30,
          opacity: interpolate(frame, [1.5 * fps, 1.8 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: XO_THEME.textMuted,
            fontSize: 18,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <span style={{ color: XO_THEME.accent }}>✓</span> Node.js 22+
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: XO_THEME.textMuted,
            fontSize: 18,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <span style={{ color: XO_THEME.accent }}>✓</span> 2GB+ RAM
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: XO_THEME.textMuted,
            fontSize: 18,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <span style={{ color: XO_THEME.accent }}>✓</span> API Key
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Outro Scene with XO branding
const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 15 },
  });

  const textOpacity = interpolate(frame, [0.5 * fps, 1 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ctaOpacity = interpolate(frame, [1.2 * fps, 1.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: XO_THEME.background,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          marginBottom: 30,
        }}
      >
        <div
          style={{
            fontSize: 80,
            fontWeight: "bold",
            color: XO_THEME.primary,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          XO
        </div>
      </div>

      <div style={{ opacity: textOpacity, textAlign: "center" }}>
        <p
          style={{
            fontSize: 32,
            color: XO_THEME.text,
            margin: 0,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          Build Agentic Workspaces
        </p>
        <p
          style={{
            fontSize: 20,
            color: XO_THEME.textMuted,
            marginTop: 15,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          Enterprise-grade infrastructure for AI agents
        </p>
      </div>

      <div
        style={{
          opacity: ctaOpacity,
          marginTop: 50,
          backgroundColor: XO_THEME.primary,
          padding: "15px 40px",
          borderRadius: 8,
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontWeight: "bold",
            color: XO_THEME.background,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          xo.builders
        </span>
      </div>
    </AbsoluteFill>
  );
};

// Main Composition
export const ClawdbotVideo: React.FC = () => {
  const { fps } = useVideoConfig();

  const sceneDuration = 3 * fps; // 3 seconds per scene

  return (
    <AbsoluteFill style={{ backgroundColor: XO_THEME.background }}>
      <Sequence durationInFrames={sceneDuration} premountFor={fps}>
        <IntroScene />
      </Sequence>

      <Sequence
        from={sceneDuration}
        durationInFrames={sceneDuration}
        premountFor={fps}
      >
        <StatsScene />
      </Sequence>

      <Sequence
        from={2 * sceneDuration}
        durationInFrames={sceneDuration}
        premountFor={fps}
      >
        <FeaturesScene />
      </Sequence>

      <Sequence
        from={3 * sceneDuration}
        durationInFrames={sceneDuration}
        premountFor={fps}
      >
        <InstallScene />
      </Sequence>

      <Sequence
        from={4 * sceneDuration}
        durationInFrames={sceneDuration}
        premountFor={fps}
      >
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};

export default ClawdbotVideo;
