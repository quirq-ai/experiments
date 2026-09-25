import SwiftUI

extension Color {
    init(hex: UInt32) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xff) / 255,
                  green: Double((hex >> 8) & 0xff) / 255,
                  blue: Double(hex & 0xff) / 255)
    }
}

/// The XO Space "Grove" theme, taken from space_ui/css/base.css.
enum Grove {
    static let bg = Color(hex: 0x0b0c0f)
    static let bg2 = Color(hex: 0x101318)
    static let bg3 = Color(hex: 0x161a20)
    static let line = Color(hex: 0x242832)
    static let ink = Color(hex: 0xe9e4d9)
    static let ink2 = Color(hex: 0xbeb9ac)
    static let ink3 = Color(hex: 0xa6a094)
    static let ink4 = Color(hex: 0x898478)
    static let accent = Color(hex: 0xa8d94f)
    static let accentStrong = Color(hex: 0x4d8a24)
    static let warn = Color(hex: 0xe0b04c)
    static let done = Color(hex: 0x7d786d)
    // chart colors from space_ui/css/shadcn.css
    static let chartBlue = Color(hex: 0x7eb6ff)
    static let chartSand = Color(hex: 0xd7a75d)
}

extension Int {
    /// 1_240_000 becomes "1.2M".
    var compact: String { formatted(.number.notation(.compactName)) }
}

extension Double {
    /// Costs are estimates, so they always carry a tilde.
    var approxCost: String { "~" + formatted(.currency(code: "USD")) }
}

func durationText(minutes: Int) -> String {
    let hours = minutes / 60
    let rest = minutes % 60
    return hours > 0 ? "\(hours)h \(rest)m" : "\(rest)m"
}

struct StatusDot: View {
    var color: Color
    var size: CGFloat = 8

    var body: some View {
        Circle().fill(color).frame(width: size, height: size)
    }
}

/// A small monospaced status chip, like the web UI's todo chips.
struct Chip: View {
    let text: String
    var tint: Color = Grove.ink3
    var filled = false

    var body: some View {
        Text(text)
            .font(.caption.monospaced())
            .foregroundStyle(tint)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(RoundedRectangle(cornerRadius: 6).fill(filled ? tint.opacity(0.1) : Color.clear))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(tint.opacity(filled ? 1 : 0.45), lineWidth: 1))
    }
}

struct LivePill: View {
    var body: some View {
        Text("Live")
            .font(.caption2.weight(.semibold))
            .foregroundStyle(Grove.bg)
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .background(Capsule().fill(Grove.accent))
    }
}

struct SectionLabel: View {
    let text: String

    var body: some View {
        Text(text.uppercased())
            .font(.caption2.monospaced())
            .tracking(1.4)
            .foregroundStyle(Grove.ink3)
    }
}

/// A card made of bands: a labelled header band, then the content band.
/// The bands carry their own padding so the divider runs edge to edge.
struct Band<Content: View>: View {
    let title: String
    var trailing: String? = nil
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                SectionLabel(text: title)
                Spacer()
                if let trailing {
                    Text(trailing)
                        .font(.caption2.monospaced())
                        .foregroundStyle(Grove.ink3)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            Rectangle().fill(Grove.line).frame(height: 1)
            VStack(alignment: .leading, spacing: 12) { content }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(RoundedRectangle(cornerRadius: 16).fill(Grove.bg2))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Grove.line))
    }
}

/// A hero figure: bold primary number, one small secondary line under a divider.
/// On a phone the three cards share a row, so labels may wrap and figures shrink.
struct HeroStat: View {
    @Environment(\.horizontalSizeClass) private var sizeClass
    let label: String
    let value: String
    let detail: String

    private var compact: Bool { sizeClass == .compact }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(label)
                .font(compact ? .caption : .footnote)
                .foregroundStyle(Grove.ink3)
                .lineLimit(compact ? 2 : 1, reservesSpace: compact)
            Text(value)
                .font(.system(size: compact ? 26 : 32, design: .serif))
                .foregroundStyle(Grove.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .padding(.top, 6)
            Rectangle().fill(Grove.line).frame(height: 1).padding(.vertical, 10)
            Text(detail)
                .font(.caption)
                .foregroundStyle(Grove.ink2)
                .lineLimit(compact ? 3 : 2, reservesSpace: true)
        }
        .padding(compact ? 12 : 14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Grove.bg2))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Grove.line))
    }
}
