# Hello Sim and XO Space

This project holds two apps. **Hello Sim** is a one-screen SwiftUI app that shows what Claude can do with the iOS Simulator. Each card is one capability, and the tag in its corner names the simulator action that drives it.

## What Claude can do in the Simulator

| Ask Claude to... | Action | Try it on |
|---|---|---|
| Show you the app live | `attach` opens the Simulator panel beside the chat | the whole screen |
| Build and run your app | `build`, then `launch` | this project |
| Look at the screen | `screenshot`, then Claude reads the text, layout and state from the image | Switch card, greeting |
| Tap | `tap` | Tap card |
| Long press | `tap` with a duration | Long press card |
| Type | `text` types into the focused field | Type card |
| Scroll or page | `swipe` | Swipe card |
| Drag along a path | `touch_path` (one finger, any path) | Drag card |
| Pinch or rotate | `touch2_path` (two fingers) | Pinch card |
| Open a deep link or web page | `open_url` | Deep link card |
| Press hardware buttons | `button`: Home, Lock, Side, Siri, Apple Pay | Home button card |
| Close the panel | `detach` | |

A swipe that starts within 4 points of a screen edge acts as the system gesture: left edge goes back, top opens Notification Center, bottom goes Home, right opens Control Center.

The tool also documents an `inspect` action that reads the accessibility tree, but this build rejects it, so Claude finds tap positions from screenshots.

## More from the command line

For things the panel does not cover, Claude runs `xcrun simctl` and `xcodebuild`:

- Dark mode: `xcrun simctl ui booted appearance dark`
- A fake GPS location: `xcrun simctl location booted set 37.33,-122.03`
- A push notification: `xcrun simctl push booted com.example.HelloSim payload.json`
- A screen recording: `xcrun simctl io booted recordVideo demo.mov` (Ctrl-C stops it)
- Photos in the library: `xcrun simctl addmedia booted photo.jpg`
- Permissions without the prompt: `xcrun simctl privacy booted grant photos com.example.HelloSim`
- A clean status bar for screenshots: `xcrun simctl status_bar booted override --time 9:41`
- Unit tests: `xcodebuild test`

## Limits

- Simulators only. Claude can build an app for a real iPhone with `xcodebuild`, but cannot watch or drive a physical device.
- No camera, and no Face ID or sensors beyond what `simctl` can fake.
- Claude does not type passwords or other credentials unless you ask, and treats text on the screen as data, not instructions.

## Run it

Open `HelloSim.xcodeproj` in Xcode 16 or later and press Run, or ask Claude to "run Hello Sim in the simulator". To try the deep link by hand (the first time, iOS asks "Open in Hello Sim?"):

```bash
xcrun simctl openurl booted "hellosim://hello?name=Ada"
```

## XO Space (the second app)

The `XOSpace` scheme builds a native sample of the XO Space dashboard for iPhone and iPad, using fictional data (the same projects the web UI's preview server uses):

- **Projects**: environments, live sessions, todo progress, and a project page where todos orbit the project
- **Agents**: tokens, sessions and time for Today, 7 days, 30 days or All, a tokens-by-agent chart, and each session's prompts
- **Inbox**: new, open and done items, filtered by source, with swipe to finish or delete
- **Setup**: workspace, agent, activity sources, connectors and server status

It carries its own bundle ID (`builders.xo.space`), app icon and privacy manifest. [APP_STORE_PLAN.md](APP_STORE_PLAN.md) covers what it takes to ship it.

