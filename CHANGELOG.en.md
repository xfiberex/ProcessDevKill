# Changelog

What changed in each version of ProcessDevKill, written for the people who use it. This is the
English translation of [CHANGELOG.md](CHANGELOG.md), which is the original: when the two disagree,
the Spanish one is right.

**It starts at v1.10.0.** That is the first version whose release notes are published in both
languages, so that the app can show them in its own (T13-04). Earlier versions are only in
[CHANGELOG.md](CHANGELOG.md), in Spanish.

The publishing script takes the `## [X.Y.Z]` section of this file and adds it to the release notes
under the heading “English”. Without that section, the release is not cut. The tags in parentheses
are tasks from the [ROADMAP](ROADMAP.md).

## [Unreleased]

## [1.10.5] — 2026-10-05

Settings, split into sections: it is no longer a page four screens long.

### Changed
- **Settings is divided into six sections**, each with its own button under “Settings” in the
  sidebar: General, System, Watching, Automation, Updates, and About. It used to be one long page,
  and getting to “Updates” meant scrolling through four screens. With the window at its default
  size, no section needs scrolling. The global shortcut and administrator rights move to
  “System.” The new-version and administrator notifications take you to their section, and
  coming back to Settings opens the last one you were looking at. (T14-24)

### Fixed
- With the app in Spanish, the sidebar subtitle no longer says “Process Manager”: it says
  “Gestor de procesos.” (T14-27)

## [1.10.4] — 2026-10-05

The process table: rows of the same height, Kill always in view when zoomed, and the focus where
it belongs after closing with the keyboard.

### Fixed
- **A process with several ports no longer triples the height of its row.** You see the first one
  and how many more there are (“3000 +5”); the full list shows on hover and in “Copy ports,” and
  the search box still finds the process by any of them. (T14-06)
- **With zoom, Kill no longer ends up behind the scroll.** When the table does not fit, the
  “Uptime” and “PID” columns are hidden first — both are in the row menu — and if you still have
  to scroll it, Kill stays fixed on the right. (T14-17)
- **After closing a process with the keyboard, the focus is no longer lost**: it moves to Kill on
  the next row; after closing several at once, to the first row left; and if none is left, to the
  search box. (T14-13)

## [1.10.3] — 2026-10-05

The window stops behaving like a web page: no browser menu and no reloads. Plus five more fixes
in notifications, the sidebar, zoom, and Services.

### Fixed
- **Right-clicking no longer opens the browser menu**, with “Back,” “Refresh,” and “Print” in
  the Windows language. It still opens in the search box and in text fields, where you need it to
  copy and paste, and each row keeps its own menu. **F5 and Ctrl+R refresh the list** instead of
  reloading the window, which lost the search, the filter, the sort order, and the selection;
  Ctrl+P, Ctrl+G, Ctrl+U, F3, and F7 no longer do anything. (T14-02)
- **The new-version notification takes you to “Updates,”** with “Download and install” in view:
  it used to leave you at the top of Settings, three screens away from the button. And “Settings”
  carries a mark in the sidebar while a version is waiting. (T14-12)
- **An error notification stays until you close it**, with its own button. It used to disappear
  after four seconds, even when it carried a file path and the Windows error. Success
  notifications still go away on their own. With the app in Spanish, the notification area is no
  longer announced in English. (T14-15)
- **“Settings” no longer ends up behind the sidebar scroll** when five or more runtimes have
  processes: the four views are always visible, and what scrolls is the list of filters. (T14-16)
- With zoom, the “Ctrl F” hint no longer covers the search box text, and when the header gets
  narrow the search box moves to a second row instead of becoming unusable. (T14-18)
- In Services, with a small window, the service name is readable in full — “postgresql-x64-17”
  and not “postgre…” — the “Startup” column takes less room and the start or stop button shrinks
  to its icon. (T14-20)

### Internal
- The tests that run the app press real keys and count the app's windows, to see what happens
  outside the page. (T14-02)

## [1.10.2] — 2026-10-05

The app under a Windows contrast theme: it shows again what is on, what is selected, and where the
focus is.

### Fixed
- **With a Windows contrast theme, the app was readable but did not show what state anything was
  in.** The switches in Settings looked empty whether they were on or off — including the ones
  for Auto-Kill and the global shortcut — the selected option for Language and Theme, the active
  view, the active filter, and the selected row looked like all the others, and you could not see
  where the keyboard focus was. All of that now uses the theme's colors. (T14-22)
- With a contrast theme, the CPU and RAM bars and each service's status dot were not drawn.
  (T14-23)

### Internal
- The design audit can be repeated: a script walks through the app and leaves the screenshots and
  the measurements. (T14-01)

## [1.10.1] — 2026-10-03

The sidebar filters, your choice, and three more checks before each version is published.

### Added
- **The sidebar filters can all be shown.** Since v1.10.0, only the runtimes that have at least
  one process appear. With the new switch in Settings → General, “Always show every runtime”, all
  seven are always shown, with a count of zero. It is off by default. (T13-07)

### Internal
- The tests that drive the running app now check three things that until now only had
  separate tests: that an installer changed after it was downloaded is not installed and is
  deleted, that an internal failure leaves its line in the log, and that “protected” is not
  shown when the setting could not be saved. (T13-05, T13-06)

## [1.10.0] — 2026-10-03

Java, Deno, and Bun, watched out of the box, and release notes in English too.

### Added
- **Java, Deno, and Bun are watched out of the box**, each with its own icon, filter, and entry in
  the tray menu. A Java row shows its main class or its `.jar`, and a Deno or Bun row shows the
  script or the task (`bun run dev` → `dev`). If you run a Java program that is not for
  development, protect it in Settings: Nuke All, the tray, the shortcut, and Auto-Kill would close
  it. (T13-01)
- **Release notes in English.** With the app in English, Settings shows what is new in a version
  in English. Versions published before this one only have notes in Spanish. (T13-04)

### Changed
- The sidebar only shows filters for the runtimes that have processes, plus the one that is
  selected. With six built-in runtimes, showing all of them did not fit. (T13-01)

### Internal
- Eight development dependencies were updated because of security advisories (`undici`, `hono`,
  `brace-expansion`, `ip-address`, `fast-uri`, `js-yaml`, `vitest`, and `qs`). None of them ships
  in the installer. (T13-02)
- The publishing script now also writes the version to `package-lock.json`, which had been left
  at v1.5.3.
- The tests that drive the running app can now also be started on GitHub, by hand: the runner
  handles them, in about 10 minutes. They still do not run on every push. (T13-03)

[Unreleased]: https://github.com/xfiberex/ProcessDevKill/compare/v1.10.5...HEAD
[1.10.5]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.10.5
[1.10.4]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.10.4
[1.10.3]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.10.3
[1.10.2]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.10.2
[1.10.1]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.10.1
[1.10.0]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.10.0
