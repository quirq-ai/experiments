import SwiftUI
import Observation

// MARK: - Types

struct SpaceEnvironment: Identifiable, Hashable {
    let id: String
    let name: String
    let color: Color
}

enum TodoStatus: String, CaseIterable {
    case inProgress = "in progress"
    case pending
    case blocked
    case completed

    var color: Color {
        switch self {
        case .inProgress: return Grove.accent
        case .pending: return Grove.ink3
        case .blocked: return Grove.warn
        case .completed: return Grove.done
        }
    }
}

struct TodoItem: Identifiable, Hashable {
    let id: String
    let title: String
    var status: TodoStatus
    var runtime = "claude_code"
}

struct Project: Identifiable, Hashable {
    let id: String
    let name: String
    let about: String
    let environment: String
    let kind: String
    var todos: [TodoItem]
    var isLive: Bool
    var lastActive: Date
    var files: Int

    var doneCount: Int { todos.filter { $0.status == .completed }.count }

    /// "1 IN PROGRESS · 1 PENDING · 1 COMPLETED", like the web panel.
    var tally: String {
        TodoStatus.allCases
            .map { status in (status, todos.filter { $0.status == status }.count) }
            .filter { $0.1 > 0 }
            .map { "\($0.1) \($0.0.rawValue.uppercased())" }
            .joined(separator: " · ")
    }
}

enum AgentSource: String, CaseIterable, Identifiable, Hashable {
    case claudeCode = "Claude Code"
    case codex = "Codex"
    case cursor = "Cursor"

    var id: String { rawValue }

    /// Vendor tag colors from the Space Agents page.
    var color: Color {
        switch self {
        case .claudeCode: return Color(hex: 0xfb923c)
        case .codex: return Color(hex: 0x60a5fa)
        case .cursor: return Color(hex: 0xa78bfa)
        }
    }
}

struct AgentSession: Identifiable, Hashable {
    let id: String
    let projectID: String
    let source: AgentSource
    let model: String
    let started: Date
    let minutes: Int
    let turns: Int
    let inputTokens: Int
    let outputTokens: Int
    let cachedTokens: Int
    let cost: Double
    let prompts: [String]

    var tokens: Int { inputTokens + outputTokens + cachedTokens }
}

struct DailyUsage: Identifiable {
    let id: String
    let day: Date
    let source: AgentSource
    let tokens: Int
}

enum UsageWindow: String, CaseIterable, Identifiable {
    case today = "Today"
    case week = "7 days"
    case month = "30 days"
    case all = "All"

    var id: String { rawValue }

    var days: Double {
        switch self {
        case .today: return 1
        case .week: return 7
        case .month: return 30
        case .all: return 3650
        }
    }
}

struct UsageSummary {
    let tokens: Int
    let count: Int
    let minutes: Int
    let cost: Double
    let sources: [AgentSource]

    init(_ sessions: [AgentSession]) {
        tokens = sessions.reduce(0) { $0 + $1.tokens }
        count = sessions.count
        minutes = sessions.reduce(0) { $0 + $1.minutes }
        cost = sessions.reduce(0) { $0 + $1.cost }
        sources = AgentSource.allCases.filter { source in sessions.contains { $0.source == source } }
    }

    var perSession: Int { count == 0 ? 0 : tokens / count }
}

enum InboxSource: String, CaseIterable, Identifiable {
    case agents = "Agents"
    case issues = "Issues"
    case connections = "Connections"
    case workspace = "Workspace"
    case sharing = "Sharing"

    var id: String { rawValue }

    var symbol: String {
        switch self {
        case .agents: return "sparkles"
        case .issues: return "exclamationmark.circle"
        case .connections: return "link"
        case .workspace: return "folder"
        case .sharing: return "person.2"
        }
    }
}

struct InboxItem: Identifiable, Hashable {
    let id: String
    let source: InboxSource
    let title: String
    let projectID: String?
    let time: Date
    var isNew: Bool
    var isDone: Bool
}

struct ActivitySource: Identifiable {
    let id: String
    let name: String
    var collecting: Bool
}

struct Connector: Identifiable {
    enum State { case connected, attention, off }

    let id: String
    let name: String
    let symbol: String
    let status: String
    let state: State

    var color: Color {
        switch state {
        case .connected: return Grove.accent
        case .attention: return Grove.warn
        case .off: return Grove.ink4
        }
    }
}

// MARK: - Model

/// Everything the app shows. This sample build fills it with fictional data
/// (the same projects the web UI's preview server uses); a live build would
/// load the same shapes from a Space's API instead.
@Observable
final class SpaceModel {
    let workspaceName = "Aurora"
    let spaceID = "demo-workspace-aurora"
    let owner = "demo-owner"
    let agentChoices = ["Claude Code", "Codex", "OpenClaw", "Hermes", "Antigravity"]

    var environments: [SpaceEnvironment]
    var projects: [Project]
    var sessions: [AgentSession]
    var usage: [DailyUsage]
    var inbox: [InboxItem]
    var connectors: [Connector]
    var activitySources: [ActivitySource]
    var activeAgent = "Claude Code"

    init(now: Date = .now) {
        func ago(_ minutes: Double) -> Date { now.addingTimeInterval(-minutes * 60) }
        func todo(_ id: String, _ title: String, _ status: TodoStatus) -> TodoItem {
            TodoItem(id: id, title: title, status: status)
        }

        environments = [
            SpaceEnvironment(id: "engineering", name: "Engineering", color: Color(hex: 0x6fb7e0)),
            SpaceEnvironment(id: "ops", name: "Ops", color: Color(hex: 0xe8a15c)),
            SpaceEnvironment(id: "documentation", name: "Documentation", color: Color(hex: 0xc792ea)),
            SpaceEnvironment(id: "research", name: "Research", color: Color(hex: 0x7fd0a8)),
            SpaceEnvironment(id: "marketing", name: "Marketing", color: Color(hex: 0xe0708a)),
        ]

        projects = [
            Project(id: "aurora-console", name: "Aurora Console",
                    about: "A calm control room for releases, services, and customer signals.",
                    environment: "engineering", kind: "App",
                    todos: [todo("a1", "Map release checks to services", .completed),
                            todo("a2", "Finish the release dashboard", .inProgress),
                            todo("a3", "Add alert thresholds per service", .pending)],
                    isLive: true, lastActive: ago(6), files: 9),
            Project(id: "orbit-api", name: "Orbit API",
                    about: "Typed service contracts and a reliable event delivery pipeline.",
                    environment: "engineering", kind: "App",
                    todos: [todo("o1", "Write contract tests for events", .completed),
                            todo("o2", "Retry webhook deliveries with backoff", .inProgress),
                            todo("o3", "Rotate the signing key", .blocked),
                            todo("o4", "Document the v2 endpoints", .pending)],
                    isLive: true, lastActive: ago(25), files: 9),
            Project(id: "field-notes", name: "Field Notes",
                    about: "An offline notebook for teams working beyond the office.",
                    environment: "engineering", kind: "App",
                    todos: [todo("f1", "Agree on the acceptance criteria", .completed),
                            todo("f2", "Sync notes when the device comes online", .inProgress),
                            todo("f3", "Check narrow layouts", .pending)],
                    isLive: true, lastActive: ago(48), files: 9),
            Project(id: "harbor-infra", name: "Harbor Infrastructure",
                    about: "Repeatable environments, deployment recipes, and recovery plans.",
                    environment: "ops", kind: "Unknown",
                    todos: [todo("h1", "Pin provider versions", .completed),
                            todo("h2", "Renew the staging certificates", .blocked),
                            todo("h3", "Write the recovery runbook", .pending)],
                    isLive: false, lastActive: ago(1450), files: 8),
            Project(id: "signal-watch", name: "Signal Watch",
                    about: "Useful alerts and runbooks for the systems people depend on.",
                    environment: "ops", kind: "App",
                    todos: [todo("s1", "Group noisy alerts", .completed),
                            todo("s2", "Add runbook links to alerts", .pending)],
                    isLive: false, lastActive: ago(5800), files: 8),
            Project(id: "atlas-handbook", name: "Atlas Handbook",
                    about: "The team's working agreements, onboarding guide, and decisions.",
                    environment: "documentation", kind: "Docs",
                    todos: [todo("t1", "Record the review decisions", .completed),
                            todo("t2", "Refresh the onboarding guide", .inProgress)],
                    isLive: false, lastActive: ago(190), files: 8),
            Project(id: "developer-guide", name: "Developer Guide",
                    about: "Practical examples that turn a first API call into a shipped feature.",
                    environment: "documentation", kind: "Docs",
                    todos: [todo("d1", "Fix broken links", .completed),
                            todo("d2", "Add a first API call example", .pending)],
                    isLive: false, lastActive: ago(13000), files: 8),
            Project(id: "retrieval-lab", name: "Retrieval Lab",
                    about: "Small, reproducible studies of search quality and citation accuracy.",
                    environment: "research", kind: "Unknown",
                    todos: [todo("r1", "Run the citation accuracy study", .inProgress),
                            todo("r2", "Compare two rankers", .pending)],
                    isLive: false, lastActive: ago(300), files: 8),
            Project(id: "latency-study", name: "Latency Study",
                    about: "Measure where requests wait and test the changes that help.",
                    environment: "research", kind: "One-pager",
                    todos: [todo("l1", "Trace the slow requests", .completed),
                            todo("l2", "Write up the findings", .pending)],
                    isLive: false, lastActive: ago(9000), files: 8),
            Project(id: "launch-studio", name: "Launch Studio",
                    about: "Product stories, release notes, and the next launch presentation.",
                    environment: "marketing", kind: "Slides",
                    todos: [todo("m1", "Draft the launch story", .inProgress),
                            todo("m2", "Collect release notes", .pending)],
                    isLive: false, lastActive: ago(2900), files: 8),
        ]

        sessions = [
            AgentSession(id: "s-aurora", projectID: "aurora-console", source: .claudeCode, model: "claude-opus-5-5",
                         started: ago(6), minutes: 42, turns: 18, inputTokens: 182_000, outputTokens: 41_000,
                         cachedTokens: 1_240_000, cost: 3.92,
                         prompts: ["Finish the release dashboard", "Show failing checks first", "Add a filter for services"]),
            AgentSession(id: "s-orbit", projectID: "orbit-api", source: .codex, model: "gpt-5-codex",
                         started: ago(25), minutes: 31, turns: 12, inputTokens: 96_000, outputTokens: 28_000,
                         cachedTokens: 610_000, cost: 1.84,
                         prompts: ["Retry webhook deliveries with backoff", "Cap retries at five", "Add a test for the backoff"]),
            AgentSession(id: "s-field", projectID: "field-notes", source: .claudeCode, model: "claude-sonnet-5",
                         started: ago(48), minutes: 26, turns: 11, inputTokens: 74_000, outputTokens: 19_000,
                         cachedTokens: 402_000, cost: 0.96,
                         prompts: ["Sync notes when the device comes online", "Keep both copies when they conflict"]),
            AgentSession(id: "s-atlas", projectID: "atlas-handbook", source: .cursor, model: "cursor-auto",
                         started: ago(190), minutes: 18, turns: 7, inputTokens: 38_000, outputTokens: 9_000,
                         cachedTokens: 120_000, cost: 0.41,
                         prompts: ["Refresh the onboarding guide"]),
            AgentSession(id: "s-retrieval", projectID: "retrieval-lab", source: .claudeCode, model: "claude-opus-5-5",
                         started: ago(300), minutes: 64, turns: 22, inputTokens: 240_000, outputTokens: 52_000,
                         cachedTokens: 1_880_000, cost: 5.10,
                         prompts: ["Run the citation accuracy study", "Plot precision by query type"]),
            AgentSession(id: "s-harbor", projectID: "harbor-infra", source: .codex, model: "gpt-5-codex",
                         started: ago(1450), minutes: 22, turns: 9, inputTokens: 61_000, outputTokens: 14_000,
                         cachedTokens: 280_000, cost: 0.88,
                         prompts: ["Renew the staging certificates", "Why does the renewal fail?"]),
            AgentSession(id: "s-launch", projectID: "launch-studio", source: .claudeCode, model: "claude-sonnet-5",
                         started: ago(2900), minutes: 35, turns: 14, inputTokens: 88_000, outputTokens: 33_000,
                         cachedTokens: 350_000, cost: 1.22,
                         prompts: ["Draft the launch story", "Make it shorter"]),
            AgentSession(id: "s-signal", projectID: "signal-watch", source: .cursor, model: "cursor-auto",
                         started: ago(5800), minutes: 15, turns: 6, inputTokens: 29_000, outputTokens: 7_000,
                         cachedTokens: 90_000, cost: 0.32,
                         prompts: ["Group noisy alerts"]),
            AgentSession(id: "s-guide", projectID: "developer-guide", source: .claudeCode, model: "claude-haiku-4-5",
                         started: ago(13000), minutes: 12, turns: 5, inputTokens: 21_000, outputTokens: 6_000,
                         cachedTokens: 60_000, cost: 0.08,
                         prompts: ["Fix broken links"]),
        ]

        let today = Calendar.current.startOfDay(for: now)
        usage = (0..<14).flatMap { day -> [DailyUsage] in
            let date = Calendar.current.date(byAdding: .day, value: -day, to: today) ?? today
            return [
                DailyUsage(id: "c\(day)", day: date, source: .claudeCode, tokens: 300_000 + (day * 37 % 11) * 60_000),
                DailyUsage(id: "x\(day)", day: date, source: .codex, tokens: 120_000 + (day * 53 % 7) * 40_000),
                DailyUsage(id: "u\(day)", day: date, source: .cursor, tokens: 40_000 + (day * 29 % 5) * 20_000),
            ]
        }

        inbox = [
            InboxItem(id: "i1", source: .agents, title: "Session started in Aurora Console (claude_code)",
                      projectID: "aurora-console", time: ago(6), isNew: true, isDone: false),
            InboxItem(id: "i2", source: .agents, title: "Todo blocked in Harbor Infrastructure: Renew the staging certificates",
                      projectID: "harbor-infra", time: ago(18), isNew: true, isDone: false),
            InboxItem(id: "i3", source: .issues, title: "Issue #42 in Orbit API: Retry webhook deliveries with backoff",
                      projectID: "orbit-api", time: ago(64), isNew: true, isDone: false),
            InboxItem(id: "i4", source: .connections, title: "Vercel needs you to sign in again",
                      projectID: nil, time: ago(190), isNew: false, isDone: false),
            InboxItem(id: "i5", source: .sharing, title: "Atlas Handbook is shared with demo-workspace-summit",
                      projectID: "atlas-handbook", time: ago(1500), isNew: false, isDone: true),
            InboxItem(id: "i6", source: .workspace, title: "Retrieval Lab was added to the workspace",
                      projectID: "retrieval-lab", time: ago(2900), isNew: false, isDone: true),
        ]

        connectors = [
            Connector(id: "github", name: "GitHub", symbol: "chevron.left.forwardslash.chevron.right",
                      status: "demo-developer", state: .connected),
            Connector(id: "gdrive", name: "Google Drive", symbol: "externaldrive", status: "1 folder", state: .connected),
            Connector(id: "vercel", name: "Vercel", symbol: "triangle", status: "Sign in again", state: .attention),
            Connector(id: "onedrive", name: "OneDrive", symbol: "cloud", status: "Not connected", state: .off),
        ]

        activitySources = [
            ActivitySource(id: "claude_code", name: "Claude Code", collecting: true),
            ActivitySource(id: "codex", name: "Codex", collecting: true),
            ActivitySource(id: "cursor", name: "Cursor", collecting: false),
        ]
    }

    // MARK: Lookups

    func environment(_ id: String) -> SpaceEnvironment {
        environments.first { $0.id == id } ?? SpaceEnvironment(id: id, name: id, color: Grove.ink3)
    }

    func project(_ id: String) -> Project? {
        projects.first { $0.id == id }
    }

    func sessions(in window: UsageWindow) -> [AgentSession] {
        let cutoff = Date.now.addingTimeInterval(-window.days * 86_400)
        return sessions.filter { $0.started >= cutoff }.sorted { $0.started > $1.started }
    }

    func usage(in window: UsageWindow) -> [DailyUsage] {
        let cutoff = Calendar.current.startOfDay(for: .now).addingTimeInterval(-(window.days - 1) * 86_400)
        return usage.filter { $0.day >= cutoff }
    }

    // MARK: Inbox

    var newInboxCount: Int { inbox.filter(\.isNew).count }

    var inboxSummary: String {
        let open = inbox.filter { !$0.isDone }.count
        let done = inbox.filter(\.isDone).count
        return "\(newInboxCount) new · \(open) open · \(done) done"
    }

    func toggleDone(_ id: String) {
        guard let index = inbox.firstIndex(where: { $0.id == id }) else { return }
        inbox[index].isDone.toggle()
        inbox[index].isNew = false
    }

    func delete(_ id: String) {
        inbox.removeAll { $0.id == id }
    }

    func markAllSeen() {
        for index in inbox.indices { inbox[index].isNew = false }
    }
}
