import SwiftUI

struct SetupView: View {
    @Environment(SpaceModel.self) private var model

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            Form {
                Section("Workspace") {
                    LabeledContent("Name", value: model.workspaceName)
                    LabeledContent("Space ID") {
                        Text(model.spaceID).font(.callout.monospaced())
                    }
                    LabeledContent("Owner", value: model.owner)
                }
                .listRowBackground(Grove.bg2)

                Section {
                    Picker("Agent", selection: $model.activeAgent) {
                        ForEach(model.agentChoices, id: \.self) { agent in
                            Text(agent).tag(agent)
                        }
                    }
                    ForEach($model.activitySources) { $source in
                        Toggle(source.name, isOn: $source.collecting)
                    }
                } header: {
                    Text("Intelligence layer")
                } footer: {
                    Text("Connect an agent and choose the activity Space collects.")
                }
                .listRowBackground(Grove.bg2)

                Section("Connectors") {
                    ForEach(model.connectors) { connector in
                        HStack(spacing: 12) {
                            Image(systemName: connector.symbol)
                                .foregroundStyle(Grove.ink2)
                                .frame(width: 24)
                            Text(connector.name)
                            Spacer()
                            StatusDot(color: connector.color)
                            Text(connector.status)
                                .foregroundStyle(Grove.ink3)
                        }
                    }
                }
                .listRowBackground(Grove.bg2)

                Section {
                    HStack {
                        Text("Status")
                        Spacer()
                        StatusDot(color: Grove.accent)
                        Text("Online").foregroundStyle(Grove.ink3)
                    }
                    LabeledContent("Version", value: "Sample")
                } header: {
                    Text("Server")
                } footer: {
                    Text("Sample data: projects, people and activity are fictional, and nothing leaves this device.")
                }
                .listRowBackground(Grove.bg2)
            }
            .scrollContentBackground(.hidden)
            .background(Grove.bg)
            .navigationTitle("Setup")
        }
    }
}
