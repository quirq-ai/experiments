import SwiftUI
import Charts

struct AgentsView: View {
    @Environment(SpaceModel.self) private var model
    @State private var window = UsageWindow.week

    var body: some View {
        NavigationStack {
            ScrollView {
                let sessions = model.sessions(in: window)
                let summary = UsageSummary(sessions)
                VStack(alignment: .leading, spacing: 16) {
                    Picker("Window", selection: $window) {
                        ForEach(UsageWindow.allCases) { option in
                            Text(option.rawValue).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)

                    HStack(alignment: .top, spacing: 10) {
                        HeroStat(label: "Total tokens", value: summary.tokens.compact,
                                 detail: "\(summary.perSession.compact) per session")
                        HeroStat(label: "Sessions", value: "\(summary.count)",
                                 detail: summary.sources.map(\.rawValue).joined(separator: ", "))
                        HeroStat(label: "Time in sessions", value: durationText(minutes: summary.minutes),
                                 detail: "\(summary.cost.approxCost) est. cost")
                    }
                    .fixedSize(horizontal: false, vertical: true)

                    Band(title: "Tokens over time") {
                        Chart(model.usage(in: window)) { item in
                            BarMark(x: .value("Day", item.day, unit: .day),
                                    y: .value("Tokens", item.tokens))
                                .foregroundStyle(by: .value("Source", item.source.rawValue))
                                .cornerRadius(2)
                        }
                        .chartForegroundStyleScale(domain: AgentSource.allCases.map(\.rawValue),
                                                   range: AgentSource.allCases.map(\.color))
                        .chartYAxis {
                            AxisMarks(position: .leading) { value in
                                AxisGridLine().foregroundStyle(Grove.line)
                                AxisValueLabel {
                                    Text((value.as(Int.self) ?? 0).compact)
                                }
                            }
                        }
                        .chartLegend(position: .bottom, alignment: .leading)
                        .frame(height: 190)
                    }

                    Band(title: "Sessions", trailing: "\(sessions.count)") {
                        if sessions.isEmpty {
                            Text("No sessions in this window.")
                                .foregroundStyle(Grove.ink3)
                        }
                        ForEach(sessions) { session in
                            NavigationLink(value: session) {
                                SessionRow(session: session)
                            }
                            .buttonStyle(.plain)
                            if session.id != sessions.last?.id {
                                Rectangle().fill(Grove.line).frame(height: 1)
                            }
                        }
                    }
                }
                .padding(20)
                .frame(maxWidth: 900)
                .frame(maxWidth: .infinity)
            }
            .background(Grove.bg)
            .navigationTitle("Agents")
            .navigationDestination(for: AgentSession.self) { session in
                SessionDetailView(session: session)
            }
        }
    }
}

struct SessionRow: View {
    @Environment(SpaceModel.self) private var model
    let session: AgentSession

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(session.source.rawValue)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(session.source.color)
                    Text(model.project(session.projectID)?.name ?? session.projectID)
                        .foregroundStyle(Grove.ink)
                        .lineLimit(1)
                }
                Text(session.model)
                    .font(.caption.monospaced())
                    .foregroundStyle(Grove.ink4)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 4) {
                Text(session.tokens.compact)
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(Grove.ink2)
                Text(session.started, format: .relative(presentation: .named))
                    .font(.caption)
                    .foregroundStyle(Grove.ink4)
            }
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Grove.ink4)
        }
        .contentShape(Rectangle())
    }
}

struct SessionDetailView: View {
    @Environment(SpaceModel.self) private var model
    let session: AgentSession

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 8) {
                    Chip(text: session.source.rawValue, tint: session.source.color)
                    Text(session.model)
                        .font(.caption.monospaced())
                        .foregroundStyle(Grove.ink3)
                }
                HStack(alignment: .top, spacing: 10) {
                    HeroStat(label: "Session tokens", value: session.tokens.compact, detail: "\(session.turns) turns")
                    HeroStat(label: "Cost (est.)", value: session.cost.approxCost,
                             detail: durationText(minutes: session.minutes))
                }
                .fixedSize(horizontal: false, vertical: true)
                Band(title: "Token breakdown") {
                    TokenBreakdown(session: session)
                }
                Band(title: "Prompts by turn", trailing: "\(session.prompts.count)") {
                    Text("What you typed, one exchange per turn")
                        .font(.footnote)
                        .foregroundStyle(Grove.ink3)
                    ForEach(Array(session.prompts.enumerated()), id: \.offset) { index, prompt in
                        HStack(alignment: .firstTextBaseline, spacing: 12) {
                            Text("\(index + 1)")
                                .font(.caption.monospaced())
                                .foregroundStyle(Grove.ink4)
                                .frame(width: 18, alignment: .trailing)
                            Text(prompt)
                                .foregroundStyle(Grove.ink)
                        }
                    }
                }
            }
            .padding(20)
            .frame(maxWidth: 760)
            .frame(maxWidth: .infinity)
        }
        .background(Grove.bg)
        .navigationTitle(model.project(session.projectID)?.name ?? "Session")
    }
}

/// One stacked bar for input, output and cache reads, with a legend under it.
struct TokenBreakdown: View {
    let session: AgentSession

    private var parts: [(String, Int, Color)] {
        [("Input", session.inputTokens, Grove.accent),
         ("Output", session.outputTokens, Grove.chartBlue),
         ("Cache read", session.cachedTokens, Grove.chartSand)]
    }

    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 2) {
                ForEach(parts, id: \.0) { part in
                    Rectangle()
                        .fill(part.2)
                        .frame(width: max(2, geometry.size.width * Double(part.1) / Double(max(session.tokens, 1)) - 2))
                }
            }
        }
        .frame(height: 10)
        .clipShape(Capsule())
        ForEach(parts, id: \.0) { part in
            HStack(spacing: 8) {
                StatusDot(color: part.2)
                Text(part.0).foregroundStyle(Grove.ink2)
                Spacer()
                Text(part.1.compact)
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(Grove.ink)
            }
        }
    }
}
