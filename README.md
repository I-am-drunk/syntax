<p align="center">
  <a href="https://syntax-platform.github.io/syntax/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="public/assets/syntax-pixel-banner-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="public/assets/syntax-pixel-banner-light.png" />
      <img alt="Syntax" src="public/assets/syntax-pixel-banner-light.png" width="100%" />
    </picture>
  </a>
</p>

<h1 align="center">Syntax</h1>

<p align="center">An open-source, extensible interactive learning platform.</p>

<p align="center">
  <a href="https://syntax-platform.github.io/syntax/"><strong>Launch</strong></a> ·
  <a href="https://syntax-platform.github.io/syntax-dev/">Syntax Dev</a> ·
  <a href="https://github.com/syntax-platform/syntax-official-plugins">Official Plugins</a> ·
  <a href="https://syntax-platform.github.io/syntax-community/">Community Hub</a> ·
  <a href="https://github.com/syntax-platform/syntax/releases">Releases</a>
</p>

Syntax is a fast, browser-based learning runtime built to be extended. Courses, interactive engines, study tools, and themes are designed to plug into Syntax rather than being locked into one monolith.

## What you get

- **Extensible by design.** Courses, interactive engines, and study tools are built to live as installable plugins rather than hardcoded features.
- **Runs in the browser.** Static web app with nothing to install.
- **Accounts and sync.** Sign in with passkeys, Google, or Apple to sync progress and settings across devices.
- **Themes.** Switch between built-in themes or install custom theme packs.
- **Sema.** An interactive companion that lives alongside your workspace.
- **Open source.** Built in the open so anyone can publish courses, themes, or plugins.

## Ecosystem

| Repository | Purpose |
| :--- | :--- |
| [`syntax`](https://github.com/syntax-platform/syntax) | Core Syntax web app and runtime |
| [`syntax-official-plugins`](https://github.com/syntax-platform/syntax-official-plugins) | Official courses and plugins maintained by the Syntax team |
| [`syntax-community`](https://github.com/syntax-platform/syntax-community) | Community catalog for third-party courses and plugins |
| [`syntax-dev`](https://github.com/syntax-platform/syntax-dev) | Nightly pre-release builds deployed from `syntax` |

## Development

```bash
git clone https://github.com/syntax-platform/syntax.git
cd syntax
npm install
npm run dev
```

Run `npm run build` to type-check and build the production bundle.

## Contributing

Bug reports, focused pull requests, and community plugins are welcome. Open an issue before starting large architectural changes.

## License

MIT.
