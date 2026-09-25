import SwiftUI

/// One screen of small cards. Each card is one thing Claude can do to an app
/// running in the iOS Simulator, so driving this screen exercises every capability.
struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase

    @State private var name = ""
    @State private var taps = 0
    @State private var lightsOn = false
    @State private var held = false
    @State private var page = 0
    @State private var dotOffset = CGSize.zero
    @State private var dotStart = CGSize.zero
    @State private var zoom: CGFloat = 1
    @State private var zoomStart: CGFloat = 1
    @State private var lastLink = "none yet"
    @State private var returns = 0
    @State private var wasInBackground = false

    private let columns = [GridItem(.adaptive(minimum: 280), spacing: 16)]
    private let pageColors: [Color] = [.blue, .purple, .orange]

    private var greeting: String {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? "Hello, World!" : "Hello, \(trimmed)!"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(greeting)
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                        .accessibilityIdentifier("greeting")
                    Text("Every card is something Claude can do in the iOS Simulator.")
                        .foregroundStyle(.secondary)
                }
                LazyVGrid(columns: columns, spacing: 16) {
                    tapCard
                    typeCard
                    switchCard
                    longPressCard
                    swipeCard
                    dragCard
                    pinchCard
                    linkCard
                    homeCard
                }
            }
            .padding(24)
            .frame(maxWidth: 1000)
            .frame(maxWidth: .infinity)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .onOpenURL(perform: open)
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { wasInBackground = true }
            if phase == .active, wasInBackground {
                returns += 1
                wasInBackground = false
            }
        }
    }

    // MARK: - Cards

    private var tapCard: some View {
        Card(title: "Tap", action: "tap") {
            Button("Tap me") { taps += 1 }
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("tapButton")
            Text("Tapped \(taps) \(taps == 1 ? "time" : "times")")
                .font(.title3.monospacedDigit())
        }
    }

    private var typeCard: some View {
        Card(title: "Type", action: "text") {
            TextField("Your name", text: $name)
                .textFieldStyle(.roundedBorder)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .accessibilityIdentifier("nameField")
            Text("The greeting above follows what you type.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private var switchCard: some View {
        Card(title: "Switch", action: "tap + screenshot") {
            Toggle("Lights", isOn: $lightsOn)
                .accessibilityIdentifier("lightsToggle")
            Image(systemName: lightsOn ? "lightbulb.max.fill" : "lightbulb")
                .font(.system(size: 44))
                .foregroundStyle(lightsOn ? Color.yellow : Color.secondary)
                .frame(maxWidth: .infinity)
                .accessibilityHidden(true)
        }
    }

    private var longPressCard: some View {
        Card(title: "Long press", action: "tap, 1s hold") {
            RoundedRectangle(cornerRadius: 14)
                .fill(held ? Color.green : Color.gray.opacity(0.2))
                .frame(height: 90)
                .overlay(Text(held ? "Held!" : "Hold me").font(.title3.bold()))
                .onLongPressGesture(minimumDuration: 0.6) { held.toggle() }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(held ? "Held" : "Hold me")
                .accessibilityAddTraits(.isButton)
        }
    }

    private var swipeCard: some View {
        Card(title: "Swipe", action: "swipe") {
            TabView(selection: $page) {
                ForEach(0..<3, id: \.self) { index in
                    RoundedRectangle(cornerRadius: 14)
                        .fill(pageColors[index].gradient)
                        .overlay(
                            Text("Page \(index + 1) of 3")
                                .font(.title3.bold())
                                .foregroundStyle(.white))
                        .padding(.bottom, 28)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .indexViewStyle(.page(backgroundDisplayMode: .always))
            .frame(height: 120)
        }
    }

    private var dragCard: some View {
        Card(title: "Drag", action: "touch_path") {
            GeometryReader { box in
                let limitX = box.size.width / 2 - 22
                let limitY = box.size.height / 2 - 22
                ZStack {
                    RoundedRectangle(cornerRadius: 14).fill(Color.gray.opacity(0.12))
                    Circle()
                        .fill(Color.accentColor)
                        .frame(width: 44, height: 44)
                        .offset(dotOffset)
                        .gesture(
                            DragGesture()
                                .onChanged { value in
                                    dotOffset = CGSize(
                                        width: min(max(dotStart.width + value.translation.width, -limitX), limitX),
                                        height: min(max(dotStart.height + value.translation.height, -limitY), limitY))
                                }
                                .onEnded { _ in dotStart = dotOffset })
                        .accessibilityLabel("Drag dot")
                }
            }
            .frame(height: 100)
            Text("Moved \(Int(dotOffset.width)), \(Int(dotOffset.height))")
                .font(.footnote.monospacedDigit())
                .foregroundStyle(.secondary)
        }
    }

    private var pinchCard: some View {
        Card(title: "Pinch", action: "touch2_path") {
            ZStack {
                RoundedRectangle(cornerRadius: 14).fill(Color.gray.opacity(0.12))
                Image(systemName: "star.fill")
                    .font(.system(size: 40))
                    .foregroundStyle(.orange)
                    .scaleEffect(zoom)
            }
            .frame(height: 100)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .contentShape(Rectangle())
            .gesture(
                MagnifyGesture()
                    .onChanged { value in zoom = min(max(zoomStart * value.magnification, 0.5), 2.5) }
                    .onEnded { _ in zoomStart = zoom })
            .accessibilityLabel("Pinch area")
            Text("Zoom \(Int((zoom * 100).rounded()))%")
                .font(.footnote.monospacedDigit())
                .foregroundStyle(.secondary)
        }
    }

    private var linkCard: some View {
        Card(title: "Deep link", action: "open_url") {
            Text("hellosim://hello?name=Ada")
                .font(.callout.monospaced())
            Text("Last link: \(lastLink)")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .accessibilityIdentifier("lastLink")
        }
    }

    private var homeCard: some View {
        Card(title: "Home button", action: "button HOME") {
            Image(systemName: "house")
                .font(.system(size: 36))
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
            Text("Back from the Home Screen \(returns) \(returns == 1 ? "time" : "times")")
                .accessibilityIdentifier("returns")
        }
    }

    // MARK: - Deep links

    /// hellosim://hello?name=Ada sets the name, which updates the greeting.
    private func open(_ url: URL) {
        lastLink = url.absoluteString
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        if let value = items.first(where: { $0.name == "name" })?.value {
            name = value
        }
    }
}

/// A titled card with a small tag naming the simulator action that drives it.
private struct Card<Content: View>: View {
    let title: String
    let action: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title).font(.headline)
                Spacer()
                Text(action)
                    .font(.caption.monospaced())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(Color.accentColor.opacity(0.12)))
            }
            content
            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, minHeight: 210, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 20).fill(Color(uiColor: .secondarySystemGroupedBackground)))
    }
}

#Preview {
    ContentView()
}
