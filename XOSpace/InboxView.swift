import SwiftUI

enum InboxFilter: String, CaseIterable, Identifiable {
    case open = "Open"
    case done = "Done"
    case all = "All"

    var id: String { rawValue }
}

struct InboxView: View {
    @Environment(SpaceModel.self) private var model
    @State private var filter = InboxFilter.open
    @State private var source: InboxSource?

    private var items: [InboxItem] {
        model.inbox
            .filter { item in
                switch filter {
                case .open: return !item.isDone
                case .done: return item.isDone
                case .all: return true
                }
            }
            .filter { source == nil || $0.source == source }
            .sorted { $0.time > $1.time }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("Show", selection: $filter) {
                        ForEach(InboxFilter.allCases) { option in
                            Text(option.rawValue).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets(top: 4, leading: 20, bottom: 4, trailing: 20))
                    SourceFilter(selection: $source)
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
                }
                Section {
                    if items.isEmpty {
                        ContentUnavailableView("Nothing in the inbox.", systemImage: "tray",
                                               description: Text("Sessions, todos and shares arriving in the workspace land here."))
                            .listRowBackground(Color.clear)
                    }
                    ForEach(items) { item in
                        InboxRow(item: item)
                            .listRowBackground(Grove.bg2)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    model.delete(item.id)
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                                Button {
                                    model.toggleDone(item.id)
                                } label: {
                                    Label(item.isDone ? "Reopen" : "Done",
                                          systemImage: item.isDone ? "arrow.uturn.backward" : "checkmark")
                                }
                                .tint(Grove.accentStrong)
                            }
                    }
                } header: {
                    Text(model.inboxSummary)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Grove.bg)
            .navigationTitle("Inbox")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Mark all seen") { model.markAllSeen() }
                        .disabled(model.newInboxCount == 0)
                }
            }
        }
    }
}

struct SourceFilter: View {
    @Binding var selection: InboxSource?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip("All", source: nil)
                ForEach(InboxSource.allCases) { source in
                    chip(source.rawValue, source: source)
                }
            }
            .padding(.horizontal, 20)
        }
    }

    private func chip(_ label: String, source: InboxSource?) -> some View {
        let selected = selection == source
        return Button {
            selection = source
        } label: {
            Text(label.uppercased())
                .font(.caption.monospaced())
                .tracking(0.8)
                .foregroundStyle(selected ? Grove.ink : Grove.ink3)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Capsule().fill(selected ? Grove.bg3 : Color.clear))
                .overlay(Capsule().stroke(selected ? Grove.accent : Grove.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

struct InboxRow: View {
    @Environment(SpaceModel.self) private var model
    let item: InboxItem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: item.source.symbol)
                .foregroundStyle(item.isNew ? Grove.accent : Grove.ink3)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 4) {
                Text(item.title)
                    .foregroundStyle(item.isDone ? Grove.ink3 : Grove.ink)
                    .lineLimit(2)
                HStack(spacing: 6) {
                    Text(item.source.rawValue)
                    if let projectID = item.projectID, let project = model.project(projectID) {
                        Text("·")
                        Text(project.name)
                    }
                    Text("·")
                    Text(item.time, format: .relative(presentation: .named))
                }
                .font(.caption)
                .foregroundStyle(Grove.ink4)
                .lineLimit(1)
            }
            Spacer(minLength: 0)
            if item.isNew {
                StatusDot(color: Grove.accent)
                    .padding(.top, 6)
                    .accessibilityLabel("New")
            }
        }
        .padding(.vertical, 4)
    }
}
