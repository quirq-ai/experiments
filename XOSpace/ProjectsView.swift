import SwiftUI

struct ProjectsView: View {
    @Environment(SpaceModel.self) private var model
    @State private var search = ""
    @State private var environmentFilter: String?

    private var visible: [Project] {
        model.projects
            .filter { environmentFilter == nil || $0.environment == environmentFilter }
            .filter {
                search.isEmpty
                    || $0.name.localizedCaseInsensitiveContains(search)
                    || $0.about.localizedCaseInsensitiveContains(search)
            }
            .sorted { $0.lastActive > $1.lastActive }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    EnvironmentFilter(selection: $environmentFilter)
                        .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
                        .listRowBackground(Color.clear)
                }
                Section {
                    ForEach(visible) { project in
                        NavigationLink(value: project.id) {
                            ProjectRow(project: project)
                        }
                        .listRowBackground(Grove.bg2)
                    }
                } header: {
                    Text("\(visible.count) projects · \(visible.filter(\.isLive).count) live")
                }
            }
            .scrollContentBackground(.hidden)
            .background(Grove.bg)
            .navigationTitle("Projects")
            .searchable(text: $search, prompt: "Search projects")
            .navigationDestination(for: String.self) { id in
                ProjectDetailView(projectID: id)
            }
        }
    }
}

/// Environment chips: All, then one per environment with its hub color.
struct EnvironmentFilter: View {
    @Environment(SpaceModel.self) private var model
    @Binding var selection: String?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip("All", color: nil, id: nil)
                ForEach(model.environments) { environment in
                    chip(environment.name, color: environment.color, id: environment.id)
                }
            }
            .padding(.horizontal, 20)
        }
    }

    private func chip(_ label: String, color: Color?, id: String?) -> some View {
        let selected = selection == id
        return Button {
            selection = id
        } label: {
            HStack(spacing: 6) {
                if let color { StatusDot(color: color) }
                Text(label)
            }
            .font(.subheadline.weight(selected ? .semibold : .regular))
            .foregroundStyle(selected ? Grove.ink : Grove.ink2)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(Capsule().fill(selected ? Grove.bg3 : Color.clear))
            .overlay(Capsule().stroke(selected ? Grove.accent : Grove.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

struct ProjectRow: View {
    @Environment(SpaceModel.self) private var model
    let project: Project

    var body: some View {
        HStack(spacing: 12) {
            StatusDot(color: model.environment(project.environment).color, size: 10)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Text(project.name)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Grove.ink)
                    if project.isLive { LivePill() }
                }
                Text(project.about)
                    .font(.subheadline)
                    .foregroundStyle(Grove.ink3)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 3) {
                Text("\(project.doneCount)/\(project.todos.count)")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(Grove.ink2)
                Text(project.lastActive, format: .relative(presentation: .named))
                    .font(.caption)
                    .foregroundStyle(Grove.ink4)
            }
        }
        .padding(.vertical, 4)
    }
}

struct ProjectDetailView: View {
    @Environment(SpaceModel.self) private var model
    let projectID: String

    var body: some View {
        if let project = model.project(projectID) {
            let environment = model.environment(project.environment)
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("\(environment.name) · \(project.kind)".uppercased())
                            .font(.caption.monospaced())
                            .tracking(1.2)
                            .foregroundStyle(Grove.ink3)
                        Text(project.about)
                            .foregroundStyle(Grove.ink2)
                    }
                    TodoOrbit(todos: project.todos, nodeColor: environment.color)
                        .frame(height: 240)
                        .frame(maxWidth: .infinity)
                    Band(title: "Todos", trailing: project.tally) {
                        ForEach(project.todos) { todo in
                            TodoRow(todo: todo)
                        }
                    }
                    Band(title: "Activity") {
                        if project.isLive {
                            HStack(spacing: 8) {
                                LivePill()
                                Text("An agent session is open now")
                                    .foregroundStyle(Grove.ink)
                            }
                        }
                        LabeledContent("Last active") {
                            Text(project.lastActive, format: .relative(presentation: .named))
                        }
                        LabeledContent("Indexed files") {
                            Text("\(project.files)")
                        }
                    }
                    Band(title: "Connections") {
                        HStack(spacing: 8) {
                            StatusDot(color: environment.color)
                            Text(environment.name).foregroundStyle(Grove.ink)
                            Text("part of").foregroundStyle(Grove.ink4)
                        }
                    }
                }
                .padding(20)
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
            }
            .background(Grove.bg)
            .navigationTitle(project.name)
        } else {
            ContentUnavailableView("Project not found", systemImage: "questionmark.folder")
        }
    }
}

/// The dashboard's signature view: todos orbit their project like satellites.
/// In progress is lime with a spoke to the project, pending is hollow,
/// blocked is amber and completed is a small dim dot.
struct TodoOrbit: View {
    let todos: [TodoItem]
    let nodeColor: Color

    var body: some View {
        TimelineView(.animation) { context in
            GeometryReader { geometry in
                OrbitCanvas(todos: todos, nodeColor: nodeColor, size: geometry.size,
                            turn: Self.turn(at: context.date))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(todos.count) todos orbiting the project")
    }

    /// One full orbit every 90 seconds.
    static func turn(at date: Date) -> Double {
        date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 90) / 90
    }
}

private struct OrbitCanvas: View {
    let todos: [TodoItem]
    let nodeColor: Color
    let size: CGSize
    let turn: Double

    private var center: CGPoint { CGPoint(x: size.width / 2, y: size.height / 2) }
    private var radius: CGFloat { min(size.width, size.height) / 2 - 20 }

    private func point(for index: Int) -> CGPoint {
        let fraction = Double(index) / Double(max(todos.count, 1))
        let angle = (turn + fraction) * 2 * Double.pi
        return CGPoint(x: center.x + CGFloat(cos(angle)) * radius,
                       y: center.y + CGFloat(sin(angle)) * radius)
    }

    var body: some View {
        ZStack {
            ring
            ForEach(todos.indices, id: \.self) { index in
                satellite(index)
            }
            node
            label
        }
    }

    private var ring: some View {
        Circle()
            .stroke(Grove.accent.opacity(0.3), style: StrokeStyle(lineWidth: 1.2, dash: [3, 7]))
            .frame(width: radius * 2, height: radius * 2)
            .position(center)
    }

    @ViewBuilder
    private func satellite(_ index: Int) -> some View {
        let todo = todos[index]
        let spot = point(for: index)
        if todo.status == .inProgress {
            Path { path in
                path.move(to: center)
                path.addLine(to: spot)
            }
            .stroke(Grove.accent.opacity(0.7), lineWidth: 1.5)
        }
        SatelliteDot(status: todo.status)
            .position(spot)
    }

    private var node: some View {
        Circle()
            .fill(nodeColor)
            .frame(width: 22, height: 22)
            .overlay(Circle().stroke(Grove.ink, lineWidth: 1.8).padding(-6))
            .position(center)
    }

    private var label: some View {
        Text("\(todos.count) TODOS")
            .font(.caption2.monospaced())
            .tracking(1.4)
            .foregroundStyle(Grove.accent)
            .position(x: center.x, y: center.y + radius + 14)
    }
}

struct SatelliteDot: View {
    let status: TodoStatus

    var body: some View {
        switch status {
        case .inProgress:
            Circle().fill(Grove.accent).frame(width: 16, height: 16)
                .shadow(color: Grove.accent.opacity(0.6), radius: 6)
        case .pending:
            Circle().stroke(Grove.ink.opacity(0.75), lineWidth: 2).frame(width: 13, height: 13)
                .background(Circle().fill(Grove.bg))
        case .blocked:
            Circle().fill(Grove.warn).frame(width: 13, height: 13)
        case .completed:
            Circle().fill(Grove.done).frame(width: 10, height: 10)
        }
    }
}

struct TodoRow: View {
    let todo: TodoItem

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Chip(text: todo.status.rawValue, tint: todo.status.color, filled: todo.status == .inProgress)
                .frame(width: 100, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text(todo.title)
                    .strikethrough(todo.status == .completed, color: Grove.ink4)
                    .foregroundStyle(todo.status == .completed ? Grove.ink4 : Grove.ink)
                Text(todo.runtime)
                    .font(.caption.monospaced())
                    .foregroundStyle(Grove.ink4)
            }
            Spacer(minLength: 0)
        }
    }
}
