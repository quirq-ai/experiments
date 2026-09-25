import SwiftUI

@main
struct XOSpaceApp: App {
    @State private var model = SpaceModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .preferredColorScheme(.dark)
                .tint(Grove.accent)
        }
    }
}

enum SpaceTab: Hashable {
    case projects, agents, inbox, setup
}

/// The four primary tabs of the Space dashboard: Projects, Agents, Inbox, Setup.
struct RootView: View {
    @Environment(SpaceModel.self) private var model
    @State private var tab = SpaceTab.projects

    var body: some View {
        TabView(selection: $tab) {
            Tab("Projects", systemImage: "square.grid.2x2", value: SpaceTab.projects) {
                ProjectsView()
            }
            Tab("Agents", systemImage: "sparkles", value: SpaceTab.agents) {
                AgentsView()
            }
            Tab("Inbox", systemImage: "tray", value: SpaceTab.inbox) {
                InboxView()
            }
            .badge(model.newInboxCount)
            Tab("Setup", systemImage: "gearshape", value: SpaceTab.setup) {
                SetupView()
            }
        }
        .tabViewStyle(.sidebarAdaptable)
    }
}
