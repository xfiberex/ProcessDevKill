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

[Unreleased]: https://github.com/xfiberex/ProcessDevKill/compare/v1.10.1...HEAD
[1.10.1]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.10.1
[1.10.0]: https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.10.0
